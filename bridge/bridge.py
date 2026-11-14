#!/usr/bin/env python3
"""GrowBuddy-Bridge: Mars-Hydro-Geräte (Bluetooth) ↔ Supabase.

Läuft als systemd-Dienst auf einem Raspberry Pi neben dem Zelt (siehe install.sh).

  bridge.py            Dienst starten
  bridge.py --pair     neuen Kopplungscode holen und anzeigen
  bridge.py --probe    Geräte suchen und mitlesen – schreibt nichts (Diagnose)

Grundsätze:
- Die Bridge schaltet nie von sich aus. Sie führt Befehle aus der App sofort aus oder gar nicht.
  Einzige Ausnahme: Sie stellt die Geräteuhr, so wie es die Original-App bei jedem Verbinden tut.
- Zeit kommt von der Datenbank (der Pi hat keine Echtzeituhr); intern zählt nur time.monotonic().
- Bluetooth: Scan und Verbindungsaufbau nie gleichzeitig (BlueZ), ein Schreibvorgang je Gerät.
- Statusmeldungen enthalten WLAN-Zugangsdaten der Geräte. Sie werden nur über marshydro.parse_status
  ausgewertet (das diese Felder überspringt) und nie roh protokolliert oder gespeichert.
- Tests: python3 -m unittest discover -s bridge -p "test_*.py"  (ohne bleak/httpx lauffähig)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import platform
import random
import secrets
import signal
import sqlite3
import time
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import marshydro as mh

log = logging.getLogger("bridge")

VERSION = 1
STATE_DIR = Path(os.environ.get("GB_STATE_DIR", "/var/lib/growbuddy-bridge"))

SYNC_IDLE_S = 10.0  # niemand schaut zu
SYNC_FAST_S = 2.0  # App ist offen
SAMPLE_S = 60.0
BUCKET_S = 300  # Cloud-Auflösung: 5-Minuten-Mittel
FRESH_S = 30.0  # Status kommt alle ~3 s; älter = Gerät nicht erreichbar
SILENT_S = 90.0  # verbunden, aber so lange stumm → neu verbinden
CONFIRM_S = 6.0  # so lange auf die bestätigende Statusmeldung warten (kommt nach 1–3 s)
WRITE_TIMEOUT_S = 5.0
WRITE_GAP_S = 0.3
CLOCK_TOLERANCE_S = 60  # ab dieser Abweichung die Geräteuhr neu stellen
CLOCK_RETRY_S = 600.0
MAX_DEVICES = 4

MEAN_KEYS = ("temp_c", "rh", "fan_rpm")
LAST_KEYS = ("fan_pct", "lamp_pct", "lamp_on")


# ─── Konfiguration ───────────────────────────────────────────────────────


@dataclass
class Config:
    path: Path
    supabase_url: str = ""
    anon_key: str = ""
    token: str = ""

    @classmethod
    def load(cls, path: Path) -> "Config":
        data = json.loads(path.read_text()) if path.exists() else {}
        cfg = cls(
            path=path,
            supabase_url=str(data.get("supabase_url", "")).rstrip("/"),
            anon_key=str(data.get("anon_key", "")),
            token=str(data.get("token", "")),
        )
        if not cfg.token:
            cfg.token = secrets.token_urlsafe(32)
            cfg.save()
        return cfg

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(
            json.dumps(
                {"supabase_url": self.supabase_url, "anon_key": self.anon_key, "token": self.token},
                indent=2,
            )
        )
        os.chmod(tmp, 0o600)
        tmp.replace(self.path)


# ─── Zeit, Aggregation, Puffer (reine Logik) ─────────────────────────────


class Clock:
    """Wanduhr aus der DB-Zeit. Unabhängig von der Systemuhr des Pi."""

    def __init__(self, mono: Callable[[], float] = time.monotonic):
        self._mono = mono
        self._offset: float | None = None

    @property
    def known(self) -> bool:
        return self._offset is not None

    def set_server_now(self, server_now: float) -> None:
        self._offset = float(server_now) - self._mono()

    def wall(self, mono_t: float) -> float:
        if self._offset is None:
            raise RuntimeError("Uhr noch nicht bekannt")
        return mono_t + self._offset

    def now(self) -> float:
        return self.wall(self._mono())


class Aggregator:
    """Sammelt Minutenwerte und gibt fertige 5-Minuten-Zeilen heraus – erst, wenn die Uhr stimmt."""

    def __init__(self, clock: Clock, bucket_s: int = BUCKET_S, max_samples: int = 1500):
        self.clock = clock
        self.bucket_s = bucket_s
        self._samples: deque[tuple[float, dict]] = deque(maxlen=max_samples)

    def add(self, mono_t: float, sample: dict) -> None:
        if any(v is not None for v in sample.values()):
            self._samples.append((mono_t, sample))

    def flush(self) -> list[dict]:
        if not self.clock.known:
            return []
        now = self.clock.now()
        done: dict[int, list[dict]] = {}
        keep: deque[tuple[float, dict]] = deque(maxlen=self._samples.maxlen)
        for mono_t, sample in self._samples:
            bucket = int(self.clock.wall(mono_t) // self.bucket_s) * self.bucket_s
            if bucket + self.bucket_s <= now:
                done.setdefault(bucket, []).append(sample)
            else:
                keep.append((mono_t, sample))
        self._samples = keep
        return [self._row(b, done[b]) for b in sorted(done)]

    @staticmethod
    def _row(bucket: int, samples: list[dict]) -> dict:
        row: dict[str, Any] = {"t": datetime.fromtimestamp(bucket, timezone.utc).isoformat()}
        for key in MEAN_KEYS:
            vals = [s[key] for s in samples if s.get(key) is not None]
            row[key] = None if not vals else round(sum(vals) / len(vals), 0 if key == "fan_rpm" else 2)
        if row["fan_rpm"] is not None:
            row["fan_rpm"] = int(row["fan_rpm"])
        for key in LAST_KEYS:
            vals = [s[key] for s in samples if s.get(key) is not None]
            row[key] = vals[-1] if vals else None
        return row


class Buffer:
    """Fertige Messzeilen auf der SD-Karte, bis die Datenbank sie bestätigt hat."""

    def __init__(self, path: str | Path, max_rows: int = 120_000):
        self._db = sqlite3.connect(str(path))
        self._db.execute("create table if not exists readings (t text primary key, body text not null)")
        self._db.commit()
        self._max = max_rows

    def put(self, rows: list[dict]) -> None:
        if not rows:
            return
        self._db.executemany(
            "insert or replace into readings (t, body) values (?, ?)",
            [(r["t"], json.dumps(r)) for r in rows],
        )
        extra = self.count() - self._max
        if extra > 0:
            self._db.execute(
                "delete from readings where t in (select t from readings order by t limit ?)", (extra,)
            )
        self._db.commit()

    def peek(self, n: int) -> list[dict]:
        cur = self._db.execute("select body from readings order by t limit ?", (n,))
        return [json.loads(body) for (body,) in cur.fetchall()]

    def drop(self, ts: list[str]) -> None:
        if ts:
            self._db.executemany("delete from readings where t = ?", [(t,) for t in ts])
            self._db.commit()

    def count(self) -> int:
        return int(self._db.execute("select count(*) from readings").fetchone()[0])


# ─── Bluetooth ───────────────────────────────────────────────────────────


@dataclass
class Found:
    name: str
    address: str
    rssi: int | None = None
    handle: Any = None  # BLEDevice aus dem Scan


class BleakConn:
    def __init__(self, client: Any):
        self._client = client

    @property
    def connected(self) -> bool:
        return bool(self._client.is_connected)

    async def write(self, data: bytes) -> None:
        await self._client.write_gatt_char(mh.WRITE_UUID, data, response=True)

    async def close(self) -> None:
        try:
            await self._client.disconnect()
        except Exception as e:  # Verbindung ist ohnehin weg
            log.debug("Trennen: %s", e)


class BleakBackend:
    """Dünne Hülle um bleak. Import erst hier, damit die Logik ohne bleak testbar bleibt."""

    async def scan(self, timeout: float) -> list[Found]:
        from bleak import BleakScanner

        found = await BleakScanner.discover(timeout=timeout, return_adv=True)
        out = []
        for dev, adv in found.values():
            name = adv.local_name or dev.name or ""
            if name.startswith(mh.NAME_PREFIX):
                out.append(Found(name=name, address=dev.address, rssi=adv.rssi, handle=dev))
        return out

    async def connect(self, found: Found, on_data: Callable[[bytes], None], on_disconnect: Callable[[], None]) -> BleakConn:
        from bleak import BleakClient

        client = BleakClient(found.handle, disconnected_callback=lambda _c: on_disconnect(), timeout=20)
        await client.connect()  # nie pair(): die Geräte arbeiten ohne Kopplung
        try:
            await client.start_notify(mh.NOTIFY_UUID, lambda _ch, data: on_data(bytes(data)))
        except Exception:
            await client.disconnect()
            raise
        return BleakConn(client)


class DeviceLink:
    """Ein Gerät: Verbindung, zuletzt gemeldeter Status, Befehle."""

    def __init__(self, ident: mh.Ident, mono: Callable[[], float] = time.monotonic, route: Callable[[str], None] | None = None):
        self.ident = ident
        self._mono = mono
        # Statuszeilen der Lampe kommen zeitweise über die Lüfter-Verbindung (Mesh) → immer nach ID zuordnen.
        self.route = route or self._route_own
        self.found: Found | None = None
        self.conn: Any = None
        self.status: mh.Status | None = None
        self.status_at: float | None = None
        self.connected_at = 0.0
        self.time_set_at = -1e9
        self.rssi: int | None = None
        self.next_try = 0.0
        self._backoff = 2.0
        self._lines = mh.LineBuffer()
        self._changed = asyncio.Event()
        self._write_lock = asyncio.Lock()
        self._last_write = -1e9

    @property
    def connected(self) -> bool:
        return self.conn is not None and self.conn.connected

    @property
    def fresh(self) -> bool:
        return self.status_at is not None and self._mono() - self.status_at < FRESH_S

    @property
    def product(self) -> str:
        return self.status.product if self.status else self.ident.product

    def _route_own(self, line: str) -> None:
        status = mh.parse_status(line)
        if status is not None and status.dev_id == self.ident.dev_id:
            self.apply(status)

    def on_data(self, data: bytes) -> None:
        for line in self._lines.feed(data):
            if log.isEnabledFor(logging.DEBUG):
                log.debug("%s ← %s", self.ident.model, mh.redact(line))
            self.route(line)

    def apply(self, status: mh.Status) -> None:
        self.status = status
        self.status_at = self._mono()
        self._changed.set()

    def on_disconnect(self) -> None:
        if self.conn is not None:
            log.info("%s: Verbindung getrennt", self.ident.model)
        self.conn = None

    def fail(self) -> None:
        self.next_try = self._mono() + self._backoff + random.uniform(0, 1)
        self._backoff = min(60.0, self._backoff * 2)

    async def open(self, backend: Any) -> bool:
        if self.found is None:
            return False
        self._lines = mh.LineBuffer()
        try:
            self.conn = await backend.connect(self.found, self.on_data, self.on_disconnect)
        except Exception as e:
            log.info("%s: Verbinden fehlgeschlagen (%s: %s)", self.ident.model, type(e).__name__, e)
            self.conn = None
            self.fail()
            return False
        self._backoff = 2.0
        self.next_try = 0.0
        self.connected_at = self._mono()
        log.info("%s: verbunden (RSSI %s)", self.ident.model, self.rssi)
        return True

    async def close(self) -> None:
        conn, self.conn = self.conn, None
        if conn is not None:
            await conn.close()

    def snapshot(self, clock_skew_s: int | None = None) -> dict:
        kind = self.ident.kind
        st = self.status if self.fresh else None
        state: dict[str, Any] = {
            "online": st is not None,  # Status ist frisch (auch wenn er über das andere Gerät kam)
            "linked": self.connected,  # eigene Verbindung steht → Befehle möglich
            "on": st.on if st else None,
            "level": st.level if st else None,
            "mode": st.mode if st else None,
            "min": mh.LEVEL_MIN[kind],
            "max": mh.LEVEL_MAX,
            "caps": mh.caps(self.ident.model),
            "model": self.ident.model,
            "fw": self.status.firmware if self.status else None,
            "rssi": self.rssi,
            "clock_skew_s": clock_skew_s if st else None,
        }
        if kind == "fan":
            state["auto"] = st.automation if st else None
            state["temp_c"] = st.temp_c if st else None
            state["rh"] = st.rh if st else None
            state["rpm"] = st.rpm if st else None
        return {"device_key": self.ident.dev_id, "kind": kind, "name": self.ident.model, "state": state}

    async def _write(self, data: bytes) -> str | None:
        """Schreibt mit Mindestabstand. Rückgabe: Fehlertext oder None."""
        async with self._write_lock:
            gap = WRITE_GAP_S - (self._mono() - self._last_write)
            if gap > 0:
                await asyncio.sleep(gap)
            conn = self.conn
            if conn is None or not conn.connected:
                return "offline"
            try:
                await asyncio.wait_for(conn.write(data), WRITE_TIMEOUT_S)
            except Exception as e:
                return f"write failed ({type(e).__name__})"
            finally:
                self._last_write = self._mono()
        return None

    async def set_time(self, unix_utc: float) -> None:
        err = await self._write(mh.cmd_set_time(self.product, unix_utc))
        self.time_set_at = self._mono()
        log.info("%s: Geräteuhr %s", self.ident.model, f"nicht gestellt ({err})" if err else "gestellt")

    async def command(self, action: str, value: int) -> tuple[bool, str | None]:
        """Befehl senden und auf die bestätigende Statusmeldung warten."""
        if not self.connected:
            return False, "offline"
        if not mh.caps(self.ident.model).get(action):
            return False, "unsupported"
        kind, dev_id = self.ident.kind, self.ident.dev_id
        if action == "level":
            want = mh.clamp_level(kind, value)
            data = mh.cmd_level(kind, self.product, dev_id, want)

            def confirmed() -> bool:
                return self.status is not None and self.status.level == want

        elif action == "power":
            want_on = bool(value)
            data = mh.cmd_power(self.product, dev_id, want_on)

            def confirmed() -> bool:
                return self.status is not None and self.status.on is want_on

        else:
            return False, "unsupported"

        self._changed.clear()
        err = await self._write(data)
        if err:
            return False, err
        deadline = self._mono() + CONFIRM_S
        while not confirmed():
            left = deadline - self._mono()
            if left <= 0:
                return False, "no confirmation"
            self._changed.clear()
            try:
                await asyncio.wait_for(self._changed.wait(), left)
            except asyncio.TimeoutError:
                pass
        return True, None


# ─── Cloud ───────────────────────────────────────────────────────────────


class CloudError(Exception):
    pass


class Cloud:
    def __init__(self, url: str, anon_key: str):
        import httpx

        headers = {"apikey": anon_key}
        if anon_key.startswith("eyJ"):  # klassischer anon-JWT; neue sb_publishable-Keys brauchen nur apikey
            headers["Authorization"] = f"Bearer {anon_key}"
        self._http = httpx.AsyncClient(base_url=url.rstrip("/") + "/rest/v1/rpc/", headers=headers, timeout=10.0)

    async def rpc(self, fn: str, params: dict) -> Any:
        r = await self._http.post(fn, json=params)
        if r.status_code >= 400:
            try:
                msg = r.json().get("message") or r.text
            except Exception:
                msg = r.text
            raise CloudError(str(msg)[:200])
        return r.json()

    async def close(self) -> None:
        await self._http.aclose()


# ─── Bridge ──────────────────────────────────────────────────────────────


class Bridge:
    def __init__(self, cfg: Config, cloud: Any, backend: Any, buffer: Buffer, mono: Callable[[], float] = time.monotonic):
        self.cfg = cfg
        self.cloud = cloud
        self.backend = backend
        self.buffer = buffer
        self._mono = mono
        self.clock = Clock(mono)
        self.agg = Aggregator(self.clock)
        self.links: dict[str, DeviceLink] = {}
        self.acks: list[dict] = []
        self.pause_until = 0.0
        self.fast = False
        self.claimed: bool | None = None
        self._started = mono()
        self._ble_lock = asyncio.Lock()
        self._next_discovery = 0.0
        self._hint_at = -1e9
        self._ignored: set[str] = set()

    @property
    def paused(self) -> bool:
        return self._mono() < self.pause_until

    def route_line(self, line: str) -> None:
        """Statuszeile dem Gerät zuordnen, dessen ID darin steht – egal, über welche Verbindung sie kam."""
        status = mh.parse_status(line)
        if status is None:
            return
        link = self.links.get(status.dev_id)
        if link is not None:
            link.apply(status)

    def clock_skew(self, link: DeviceLink) -> int | None:
        st = link.status
        if not self.clock.known or st is None or st.device_time is None or link.status_at is None:
            return None
        return int(round(st.device_time - self.clock.wall(link.status_at)))

    # Bluetooth: suchen, verbinden, stumme Verbindungen erneuern, bei Pause freigeben
    async def ble_step(self) -> None:
        if self.paused:
            for link in self.links.values():
                if link.conn is not None:
                    log.info("%s: Pause – Verbindung freigegeben", link.ident.model)
                    await link.close()
            return
        now = self._mono()
        for link in self.links.values():
            if link.connected and now - max(link.status_at or 0.0, link.connected_at) > SILENT_S:
                log.info("%s: verbunden, aber stumm – verbinde neu", link.ident.model)
                await link.close()
        await self._keep_clocks()
        if now < self._next_discovery and not any(not l.connected and now >= l.next_try for l in self.links.values()):
            return
        try:
            async with self._ble_lock:
                found = await self.backend.scan(8.0)
        except Exception as e:
            log.warning("Scan fehlgeschlagen (%s: %s)", type(e).__name__, e)
            self._next_discovery = self._mono() + 15
            return
        seen: set[str] = set()
        for f in found:
            ident = mh.parse_name(f.name)
            if ident is None:
                if f.name not in self._ignored:
                    self._ignored.add(f.name)
                    log.info("Unbekanntes Modell wird ignoriert: %s", f.name.rsplit("_", 1)[0])
                continue
            link = self.links.get(ident.dev_id)
            if link is None:
                if len(self.links) >= MAX_DEVICES:
                    continue
                link = self.links[ident.dev_id] = DeviceLink(ident, self._mono, self.route_line)
                log.info("Gerät gefunden: %s (%s)", ident.model, ident.kind)
            link.found, link.rssi = f, f.rssi
            seen.add(ident.dev_id)
        now = self._mono()
        # BlueZ vergisst Geräte ~100 s nach dem Scan → immer direkt nach dem Scan verbinden.
        for link in [l for l in self.links.values() if not l.connected and now >= l.next_try]:
            if link.ident.dev_id not in seen:
                link.fail()  # außer Reichweite oder von Mars Legacy belegt
                continue
            async with self._ble_lock:
                opened = await link.open(self.backend)
            if opened and self.clock.known:
                await link.set_time(self.clock.now())
        all_up = bool(self.links) and all(l.connected for l in self.links.values())
        self._next_discovery = self._mono() + (300 if all_up else 15)

    async def _keep_clocks(self) -> None:
        """Geräteuhr nachstellen, wenn sie abweicht (z. B. nach Stromausfall am Gerät)."""
        if not self.clock.known:
            return
        for link in self.links.values():
            if not link.connected or self._mono() - link.time_set_at < CLOCK_RETRY_S:
                continue
            skew = self.clock_skew(link) if link.fresh else None
            never_set = link.time_set_at < 0 and link.fresh
            if never_set or (skew is not None and abs(skew) > CLOCK_TOLERANCE_S):
                await link.set_time(self.clock.now())

    # Einmal pro Minute den Stand festhalten
    async def sample_step(self) -> None:
        sample: dict[str, Any] = {k: None for k in MEAN_KEYS + LAST_KEYS}
        for link in self.links.values():
            st = link.status
            if st is None or not link.fresh:
                continue
            if link.ident.kind == "fan":
                sample["fan_pct"] = st.level if st.on else 0
                sample["temp_c"], sample["rh"], sample["fan_rpm"] = st.temp_c, st.rh, st.rpm
            else:
                sample["lamp_pct"], sample["lamp_on"] = st.level, st.on
        self.agg.add(self._mono(), sample)

    def info(self) -> dict:
        return {
            "v": VERSION,
            "uptime_s": int(self._mono() - self._started),
            "paused": self.paused,
            "buffered": self.buffer.count(),
            "host": platform.node(),
        }

    async def register(self) -> dict:
        resp = await self.cloud.rpc("bridge_register", {"p_token": self.cfg.token})
        if resp.get("claimed"):
            log.info("Bridge ist gekoppelt.")
        else:
            code = str(resp.get("pair_code", ""))
            log.info("Kopplungscode: %s-%s (15 Minuten gültig, neuer Code mit --pair)", code[:4], code[4:])
        return resp

    async def run_commands(self, commands: list[dict]) -> None:
        last = {(str(c.get("device_key")), str(c.get("action"))): c.get("id") for c in commands}
        for cmd in commands:
            if last[(str(cmd.get("device_key")), str(cmd.get("action")))] != cmd.get("id"):
                self.acks.append({"id": cmd.get("id"), "ok": False, "error": "superseded"})  # neuerer Wert folgt
                continue
            link = self.links.get(str(cmd.get("device_key")))
            if link is None:
                ok, err = False, "unknown device"
            else:
                try:
                    ok, err = await link.command(str(cmd.get("action")), int(cmd.get("value")))
                except Exception as e:
                    ok, err = False, f"error ({type(e).__name__})"
            log.info("Befehl %s=%s an %s: %s", cmd.get("action"), cmd.get("value"), link.ident.model if link else "?", "ok" if ok else err)
            self.acks.append({"id": cmd.get("id"), "ok": ok, "error": err})

    async def sync_once(self) -> float:
        """Ein Abgleich mit der Datenbank. Rückgabe: Sekunden bis zum nächsten."""
        self.buffer.put(self.agg.flush())
        rows = self.buffer.peek(200)
        acks = self.acks[:50]
        try:
            resp = await self.cloud.rpc(
                "bridge_sync",
                {
                    "p_token": self.cfg.token,
                    "p_states": [l.snapshot(self.clock_skew(l)) for l in self.links.values()],
                    "p_readings": rows,
                    "p_acks": acks,
                    "p_info": self.info(),
                },
            )
        except CloudError as e:
            if "unknown bridge" in str(e):
                self.claimed = False
                await self.register()
                return 5.0
            raise
        self.clock.set_server_now(resp["now"])
        if not resp.get("claimed"):
            self.claimed = False
            if self._mono() - self._hint_at > 600:
                self._hint_at = self._mono()
                log.info("Noch nicht gekoppelt – Code anzeigen mit: bridge.py --pair")
            return SYNC_IDLE_S
        if self.claimed is not True:
            log.info("Mit dem Konto gekoppelt – Abgleich läuft.")
        self.claimed = True
        self.buffer.drop([r["t"] for r in rows])
        del self.acks[: len(acks)]
        pause_s = float(resp.get("pause_s") or 0)
        self.pause_until = self._mono() + pause_s if pause_s > 0 else 0.0
        self.fast = bool(resp.get("fast"))
        commands = resp.get("commands") or []
        if commands:
            await self.run_commands(commands)
            return 0.0  # Quittungen sofort zurückmelden
        return SYNC_FAST_S if self.fast else SYNC_IDLE_S

    async def _loop(self, name: str, step: Callable[[], Any], delay: float) -> None:
        while True:
            try:
                await step()
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("Fehler in %s", name)
            await asyncio.sleep(delay)

    async def _sync_loop(self) -> None:
        fails = 0
        while True:
            try:
                delay = await self.sync_once()
                fails = 0
            except asyncio.CancelledError:
                raise
            except Exception as e:  # Internet weg o. ä. – Bluetooth läuft weiter, Werte bleiben im Puffer
                fails += 1
                delay = min(60.0, 5.0 * 2 ** min(fails - 1, 4))
                log.warning("Abgleich fehlgeschlagen (%s: %s) – neuer Versuch in %.0f s", type(e).__name__, e, delay)
            await asyncio.sleep(delay)

    async def run(self) -> None:
        await asyncio.gather(
            self._loop("Bluetooth", self.ble_step, 2.0),
            self._loop("Messwerte", self.sample_step, SAMPLE_S),
            self._sync_loop(),
        )

    async def shutdown(self) -> None:
        for link in self.links.values():
            await link.close()


# ─── Kommandozeile ───────────────────────────────────────────────────────


async def serve(cfg: Config) -> int:
    cloud = Cloud(cfg.supabase_url, cfg.anon_key)
    bridge = Bridge(cfg, cloud, BleakBackend(), Buffer(cfg.path.parent / "queue.db"))
    loop = asyncio.get_running_loop()
    task = asyncio.current_task()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, task.cancel)
    log.info("GrowBuddy-Bridge v%s gestartet", VERSION)
    try:
        await bridge.run()
    except asyncio.CancelledError:
        pass
    finally:
        await bridge.shutdown()  # Geräte sofort freigeben
        await cloud.close()
    return 0


async def pair(cfg: Config) -> int:
    cloud = Cloud(cfg.supabase_url, cfg.anon_key)
    try:
        resp = await cloud.rpc("bridge_register", {"p_token": cfg.token})
    finally:
        await cloud.close()
    if resp.get("claimed"):
        print("Bridge ist bereits gekoppelt.")
    else:
        code = str(resp["pair_code"])
        print(f"Kopplungscode: {code[:4]}-{code[4:]}   (15 Minuten gültig)")
        print("In GrowBuddy: Tools → Geräte → Code eingeben.")
    return 0


async def probe(seconds: int) -> int:
    """Diagnose ohne Schreiben. Zeigt Statuszeilen nur geschwärzt (sie enthalten WLAN-Zugangsdaten)."""
    from bleak import BleakClient, BleakScanner

    print("Suche 15 s nach Geräten (MZ_…). Mars Legacy muss geschlossen sein.")
    found = await BleakScanner.discover(timeout=15, return_adv=True)
    devs = [(d, a) for d, a in found.values() if (a.local_name or d.name or "").startswith(mh.NAME_PREFIX)]
    if not devs:
        print("Kein Gerät gefunden.")
        return 1
    for dev, adv in devs:
        name = adv.local_name or dev.name or ""
        ident = mh.parse_name(name)
        print(f"\n== {name}  RSSI {adv.rssi} dBm  →  {ident.kind if ident else 'unbekanntes Modell'}")
        try:
            async with BleakClient(dev, timeout=20) as client:
                for service in client.services:
                    for ch in service.characteristics:
                        print(f"   {service.uuid}  {ch.uuid}  {','.join(ch.properties)}")
                start = time.monotonic()
                lines = mh.LineBuffer()

                def on_data(_ch: Any, data: bytearray) -> None:
                    for line in lines.feed(bytes(data)):
                        print(f"   {time.monotonic() - start:6.1f} s  {mh.redact(line)}")

                await client.start_notify(mh.NOTIFY_UUID, on_data)
                print(f"   höre {seconds} s mit …")
                await asyncio.sleep(seconds)
        except Exception as e:
            print(f"   Fehler: {type(e).__name__}: {e}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="GrowBuddy-Bridge")
    ap.add_argument("--pair", action="store_true", help="neuen Kopplungscode anzeigen")
    ap.add_argument("--probe", nargs="?", type=int, const=30, metavar="SEKUNDEN", help="Geräte suchen und mitlesen")
    ap.add_argument("--debug", action="store_true", help="jede Statusmeldung (geschwärzt) protokollieren")
    args = ap.parse_args()
    logging.basicConfig(level=logging.DEBUG if args.debug else logging.INFO, format="%(levelname)s %(message)s")
    for noisy in ("httpx", "httpcore", "bleak", "dbus_fast"):
        logging.getLogger(noisy).setLevel(logging.WARNING)  # bleak würde im Debug-Modus rohe Meldungen zeigen
    if args.probe is not None:
        return asyncio.run(probe(args.probe))
    cfg = Config.load(STATE_DIR / "config.json")
    if not cfg.supabase_url or not cfg.anon_key:
        print(f"Konfiguration unvollständig: {cfg.path} (install.sh mit --url und --anon-key ausführen)")
        return 2
    if args.pair:
        return asyncio.run(pair(cfg))
    return asyncio.run(serve(cfg))


if __name__ == "__main__":
    raise SystemExit(main())
