"""Tests für Codec und Bridge-Logik – ohne Bluetooth, ohne Netz.

    python3 -m unittest discover -s bridge -p "test_*.py"

Die Statuszeilen entsprechen im Aufbau dem Mitschnitt der echten Geräte. Geräte-IDs und
WLAN-Zugangsdaten sind erfunden (das Repo ist öffentlich).
"""

import json
import logging
import time
import unittest
from unittest import mock

import bridge as br
import marshydro as mh

LAMP_ID, FAN_ID = "0123456789AB", "BA9876543210"
LAMP, FAN = f"MZ_MARS_32527_{LAMP_ID}", f"MZ_MZF002_32527_{FAN_ID}"
SSID, PASSWORD = "TestNetz", "kein|echtes|passwort"  # mit Trennzeichen: der Parser darf nicht verrutschen
T0 = 1_800_000_000.0


def status(dev_id: str, *, on: int = 1, level: int = 36, mode: str = "auto", t: int = 1_800_000_000,
           temp: str = "22", rh: str = "58.9", rpm: int = 1620, auto: str = "1,0") -> bytes:
    model, fw = ("MZF002", "1.8") if dev_id == FAN_ID else ("MARS", "3.4")
    head = f"0|{dev_id}||{model}|{fw}|32527|1|1|{SSID}|{PASSWORD}|-1|{mode}|{on}|{level}|42|0|{t}|92852"
    tail = f"|{auto}|{temp}|{rh}|{rpm}|0" if model == "MZF002" else "|0"
    return (head + tail + "\n").encode()


class FakeMono:
    def __init__(self, t: float = 1000.0):
        self.t = t

    def __call__(self) -> float:
        return self.t


class CodecTest(unittest.TestCase):
    def test_parse_name(self):
        lamp, fan = mh.parse_name(LAMP), mh.parse_name(FAN)
        self.assertEqual((lamp.model, lamp.product, lamp.dev_id, lamp.kind), ("MARS", "32527", LAMP_ID, "lamp"))
        self.assertEqual((fan.model, fan.kind), ("MZF002", "fan"))
        for bad in (None, "", "MZ_", "MZ_MZF002_32527_XYZ", "Other_MZF002_32527_BA9876543210",
                    "MZ_MZF002_BA9876543210", "MZ_HEATER9_32527_BA9876543210"):  # unbekanntes Modell: ignorieren
            self.assertIsNone(mh.parse_name(bad), bad)

    def test_commands_as_captured_from_the_app(self):
        self.assertEqual(mh.cmd_level("fan", "32527", FAN_ID, 45), f"2|0|32527|{FAN_ID}|45".encode())
        self.assertEqual(mh.cmd_power("32527", FAN_ID, False), f"1|0|32527|{FAN_ID}|0".encode())
        self.assertEqual(mh.cmd_set_time("32527", 1794583446.9), b"6|1|32527|ALL|1794583446")

    def test_level_is_clamped(self):
        self.assertEqual(mh.clamp_level("lamp", 3), 10)
        self.assertEqual(mh.clamp_level("fan", 3), 25)
        self.assertEqual(mh.clamp_level("fan", 250), 100)
        self.assertTrue(mh.cmd_level("fan", "32527", FAN_ID, 0).endswith(b"|25"))

    def test_only_side_effect_free_actions_are_enabled(self):
        self.assertEqual(mh.caps("MZF002"), {"power": False, "level": True})  # Stufe: Automatik bleibt an
        self.assertEqual(mh.caps("MARS"), {"power": False, "level": False})  # Dimmen würde die Zeitschaltung abschalten
        self.assertEqual(mh.caps("UNBEKANNT"), {"power": False, "level": False})

    def test_parse_fan_status(self):
        st = mh.parse_status(status(FAN_ID, on=0, level=35, temp="22", rh="58.9", rpm=0).decode())
        self.assertEqual((st.dev_id, st.model, st.firmware, st.product), (FAN_ID, "MZF002", "1.8", "32527"))
        self.assertEqual((st.mode, st.on, st.level, st.device_time), ("auto", False, 35, 1_800_000_000))
        self.assertEqual((st.automation, st.temp_c, st.rh, st.rpm), (True, 22.0, 58.9, 0))
        self.assertFalse(mh.parse_status(status(FAN_ID, auto="0,0", mode="cmd").decode()).automation)

    def test_parse_lamp_status(self):
        st = mh.parse_status(status(LAMP_ID, on=1, level=36).decode())
        self.assertEqual((st.dev_id, st.model, st.mode, st.on, st.level), (LAMP_ID, "MARS", "auto", True, 36))
        self.assertEqual((st.temp_c, st.rh, st.rpm, st.automation), (None, None, None, None))

    def test_implausible_values_are_dropped_not_guessed(self):
        st = mh.parse_status(status(FAN_ID, temp="250", rh="-3").decode())
        self.assertEqual((st.temp_c, st.rh), (None, None))
        for bad in ("", "hello", "0|x", status(FAN_ID).decode().replace("|auto|", "|turbo|"),
                    status(FAN_ID, level=250).decode(), status(FAN_ID).decode().replace(FAN_ID, "ZZZ"),
                    status(FAN_ID).decode().replace("MZF002", "HEATER9")):
            self.assertIsNone(mh.parse_status(bad), bad)

    def test_wifi_credentials_never_survive(self):
        line = status(FAN_ID).decode()
        st = mh.parse_status(line)
        self.assertNotIn(SSID, repr(st))
        self.assertNotIn("passwort", repr(st))
        red = mh.redact(line)
        self.assertNotIn(SSID, red)
        self.assertNotIn("passwort", red)
        self.assertIn(FAN_ID, red)
        self.assertIn("|auto|", red)
        self.assertNotIn(SSID, mh.redact(f"irgendwas|{SSID}|{PASSWORD}"))  # Unbekanntes wird gar nicht gezeigt

    def test_line_buffer_reassembles_split_notifications(self):
        buf, line = mh.LineBuffer(), status(FAN_ID)
        self.assertEqual(buf.feed(line[:20]), [])
        self.assertEqual(buf.feed(line[20:60]), [])
        self.assertEqual(buf.feed(line[60:] + status(LAMP_ID)[:10]), [line.decode().strip()])
        self.assertEqual(buf.feed(status(LAMP_ID)[10:]), [status(LAMP_ID).decode().strip()])
        buf.feed(b"x" * 5000)  # nie endlos sammeln
        self.assertEqual(buf.feed(line), [line.decode().strip()])


class ClockAggregatorTest(unittest.TestCase):
    def setUp(self):
        self.mono = FakeMono()
        self.clock = br.Clock(self.mono)
        self.agg = br.Aggregator(self.clock)

    def sample(self, **kw):
        base = {k: None for k in br.MEAN_KEYS + br.LAST_KEYS}
        base.update(kw)
        return base

    def test_no_rows_until_clock_known(self):
        self.agg.add(self.mono(), self.sample(temp_c=24.0))
        self.mono.t += 3600
        self.assertEqual(self.agg.flush(), [])  # ohne DB-Zeit keine Zeitstempel
        self.clock.set_server_now(T0)  # exakt auf 5-min-Raster
        rows = self.agg.flush()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["t"], "2027-01-15T07:00:00+00:00")  # eine Stunde vor "jetzt"

    def test_bucket_only_when_complete_and_values(self):
        self.clock.set_server_now(T0)
        for i, (temp, rh, lvl) in enumerate([(24.0, 60.0, 40), (25.0, 62.0, 45), (None, None, 50)]):
            self.agg.add(self.mono() + i * 60, self.sample(temp_c=temp, rh=rh, fan_pct=lvl, fan_rpm=1800 + i, lamp_on=True))
        self.mono.t += 200
        self.assertEqual(self.agg.flush(), [])  # 5-Minuten-Fenster läuft noch
        self.mono.t += 100
        (row,) = self.agg.flush()
        self.assertEqual(row["t"], "2027-01-15T08:00:00+00:00")
        self.assertEqual((row["temp_c"], row["rh"]), (24.5, 61.0))  # Mittel ohne Lücken
        self.assertEqual((row["fan_pct"], row["fan_rpm"], row["lamp_on"], row["lamp_pct"]), (50, 1801, True, None))
        self.assertEqual(self.agg.flush(), [])  # nichts doppelt

    def test_empty_samples_are_skipped(self):
        self.clock.set_server_now(T0)
        self.agg.add(self.mono(), self.sample())
        self.mono.t += 600
        self.assertEqual(self.agg.flush(), [])


class BufferTest(unittest.TestCase):
    def test_put_peek_drop_prune(self):
        buf = br.Buffer(":memory:", max_rows=3)
        buf.put([{"t": f"2027-01-15T08:{m:02d}:00+00:00", "temp_c": m} for m in (0, 5, 10)])
        buf.put([{"t": "2027-01-15T08:05:00+00:00", "temp_c": 99}])  # gleiche Zeit ersetzt
        self.assertEqual([r["temp_c"] for r in buf.peek(10)], [0, 99, 10])
        buf.put([{"t": "2027-01-15T08:15:00+00:00", "temp_c": 15}])  # Obergrenze: älteste fliegt raus
        self.assertEqual([r["temp_c"] for r in buf.peek(10)], [99, 10, 15])
        buf.drop(["2027-01-15T08:05:00+00:00"])
        self.assertEqual(buf.count(), 2)


class FakeConn:
    """Simuliertes Gerät: beantwortet einen Stufen-Befehl mit einer Statuszeile, wie das echte."""

    def __init__(self, on_data, reply=True):
        self.on_data, self.reply, self.connected, self.written = on_data, reply, True, []

    async def write(self, data: bytes):
        self.written.append(data)
        cmd, _flag, _product, dev_id, *value = data.decode().split("|")
        if self.reply and cmd == "2":
            self.on_data(status(dev_id, level=int(value[0])))

    async def close(self):
        self.connected = False


class FakeBackend:
    def __init__(self, names):
        self.names, self.scans, self.fail_connect = list(names), 0, False
        self.conns = {}

    async def scan(self, timeout):
        self.scans += 1
        return [br.Found(name=n, address=f"AA:{i}", rssi=-70) for i, n in enumerate(self.names)]

    async def connect(self, found, on_data, on_disconnect):
        if self.fail_connect:
            raise OSError("nicht erreichbar")
        conn = self.conns[found.name] = FakeConn(on_data)
        return conn


class FakeCloud:
    def __init__(self):
        self.calls, self.replies, self.fail = [], [], None

    async def rpc(self, fn, params):
        self.calls.append((fn, params))
        if self.fail:
            raise self.fail
        if fn == "bridge_register":
            return {"claimed": False, "pair_code": "ABCDEFGH"}
        return self.replies.pop(0) if self.replies else {"claimed": True, "now": T0, "fast": False, "pause_s": 0, "commands": []}


class LinkTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.mono = FakeMono()
        self.fan = br.DeviceLink(mh.parse_name(FAN), self.mono)
        self.fan.conn = FakeConn(self.fan.on_data)
        self.fan.on_data(status(FAN_ID, on=1, level=40))
        self.lamp = br.DeviceLink(mh.parse_name(LAMP), self.mono)
        self.lamp.conn = FakeConn(self.lamp.on_data)
        self.lamp.on_data(status(LAMP_ID, level=36))

    async def test_status_is_applied_and_goes_stale(self):
        self.assertEqual((self.fan.status.level, self.fan.status.temp_c, self.fan.fresh), (40, 22.0, True))
        self.mono.t += br.FRESH_S + 1
        self.assertFalse(self.fan.fresh)
        self.assertEqual(self.fan.snapshot()["state"]["online"], False)
        self.assertIsNone(self.fan.snapshot()["state"]["temp_c"])  # alte Werte nicht als aktuell ausgeben

    async def test_fan_level_is_written_clamped_and_confirmed(self):
        self.assertEqual(await self.fan.command("level", 3), (True, None))
        self.assertEqual(self.fan.conn.written, [f"2|0|32527|{FAN_ID}|25".encode()])
        self.assertEqual(self.fan.status.level, 25)

    async def test_actions_with_side_effects_never_write(self):
        self.assertEqual(await self.fan.command("power", 0), (False, "unsupported"))  # würde die Automatik abschalten
        self.assertEqual(await self.lamp.command("level", 50), (False, "unsupported"))  # würde die Zeitschaltung abschalten
        self.assertEqual(await self.lamp.command("power", 1), (False, "unsupported"))
        self.assertEqual(await self.fan.command("explode", 1), (False, "unsupported"))
        self.assertEqual(self.fan.conn.written + self.lamp.conn.written, [])

    async def test_no_confirmation_is_reported(self):
        self.fan.conn.reply = False
        self.fan._mono = time.monotonic  # echte Zeit, damit die Wartefrist abläuft
        with mock.patch.object(br, "CONFIRM_S", 0.05):
            self.assertEqual(await self.fan.command("level", 50), (False, "no confirmation"))

    async def test_offline(self):
        self.fan.conn.connected = False
        self.assertEqual(await self.fan.command("level", 50), (False, "offline"))

    async def test_snapshot_has_no_credentials(self):
        blob = json.dumps([self.fan.snapshot(3), self.lamp.snapshot(None)])
        self.assertNotIn(SSID, blob)
        self.assertNotIn("passwort", blob)
        state = self.fan.snapshot(3)["state"]
        self.assertEqual((state["mode"], state["auto"], state["rpm"], state["fw"], state["clock_skew_s"]), ("auto", True, 1620, "1.8", 3))
        self.assertEqual(self.lamp.snapshot()["state"]["caps"], {"power": False, "level": False})

    async def test_debug_log_is_redacted(self):
        with self.assertLogs("bridge", level="DEBUG") as logs:
            self.fan.on_data(status(FAN_ID))
        text = "\n".join(logs.output)
        self.assertIn(FAN_ID, text)
        self.assertNotIn(SSID, text)
        self.assertNotIn("passwort", text)


class BridgeTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.mono = FakeMono()
        self.cloud = FakeCloud()
        self.backend = FakeBackend([LAMP, FAN, "MZ_HEATER9_32527_AAAAAAAAAAAA", "Fremdes Gerät"])
        cfg = br.Config(path=br.Path("/nonexistent/config.json"), supabase_url="x", anon_key="y", token="t" * 40)
        self.bridge = br.Bridge(cfg, self.cloud, self.backend, br.Buffer(":memory:"), self.mono)

    async def connect_all(self):
        await self.bridge.ble_step()
        self.backend.conns[FAN].on_data(status(FAN_ID, on=1, level=40))
        self.backend.conns[LAMP].on_data(status(LAMP_ID, on=1, level=36))

    async def test_discovers_and_connects_only_known_models(self):
        with self.assertLogs("bridge", level="INFO") as logs:
            await self.connect_all()
        self.assertEqual(sorted(l.ident.kind for l in self.bridge.links.values()), ["fan", "lamp"])
        self.assertTrue(all(l.connected for l in self.bridge.links.values()))
        self.assertTrue(any("Unbekanntes Modell" in line and "AAAAAAAAAAAA" not in line for line in logs.output))
        scans = self.backend.scans
        await self.bridge.ble_step()
        self.assertEqual(self.backend.scans, scans)  # alles verbunden → kein Dauerscan

    async def test_status_is_routed_by_id_not_by_connection(self):
        await self.connect_all()
        # Mesh: Statuszeile der Lampe kommt über die Lüfter-Verbindung
        self.backend.conns[FAN].on_data(status(LAMP_ID, level=55, mode="cmd"))
        self.assertEqual((self.bridge.links[LAMP_ID].status.level, self.bridge.links[LAMP_ID].status.mode), (55, "cmd"))
        self.assertEqual(self.bridge.links[FAN_ID].status.level, 40)  # Lüfter unberührt

    async def test_backoff_after_failed_connect(self):
        self.backend.fail_connect = True
        await self.bridge.ble_step()
        link = next(iter(self.bridge.links.values()))
        self.assertFalse(link.connected)
        self.assertGreater(link.next_try, self.mono())
        scans = self.backend.scans
        await self.bridge.ble_step()
        self.assertEqual(self.backend.scans, scans)  # wartet die Sperrfrist ab

    async def test_silent_connection_is_renewed(self):
        await self.connect_all()
        old = self.backend.conns[FAN]
        self.mono.t += br.SILENT_S + 1
        self.backend.conns[LAMP].on_data(status(LAMP_ID))  # Lampe meldet sich weiter, Lüfter schweigt
        await self.bridge.ble_step()
        self.assertFalse(old.connected)
        self.assertIsNot(self.backend.conns[FAN], old)
        self.assertTrue(self.bridge.links[FAN_ID].connected)

    async def test_device_clock_is_set_like_the_original_app(self):
        await self.bridge.sync_once()  # Uhr aus der Datenbank
        await self.connect_all()
        for name in (LAMP, FAN):
            self.assertEqual(self.backend.conns[name].written, [f"6|1|32527|ALL|{int(T0)}".encode()])
        # Uhr des Lüfters läuft 10 min falsch (z. B. nach Stromausfall) → wird nachgestellt, aber nicht dauernd
        self.mono.t += br.CLOCK_RETRY_S + 1
        self.backend.conns[FAN].on_data(status(FAN_ID, t=int(T0) - 600))
        self.backend.conns[LAMP].on_data(status(LAMP_ID, t=int(T0 + br.CLOCK_RETRY_S)))
        await self.bridge.ble_step()
        self.assertEqual(len(self.backend.conns[FAN].written), 2)
        self.assertEqual(len(self.backend.conns[LAMP].written), 1)  # Lampenuhr stimmt
        await self.bridge.ble_step()
        self.assertEqual(len(self.backend.conns[FAN].written), 2)

    async def test_clock_is_never_set_without_database_time(self):
        await self.connect_all()  # noch kein Abgleich → Uhr unbekannt
        await self.bridge.ble_step()
        self.assertEqual(self.backend.conns[FAN].written + self.backend.conns[LAMP].written, [])
        await self.bridge.sync_once()
        await self.bridge.ble_step()
        self.assertEqual(len(self.backend.conns[FAN].written), 1)  # wird nachgeholt

    async def test_pause_releases_bluetooth_and_resumes(self):
        await self.connect_all()
        self.cloud.replies = [{"claimed": True, "now": T0, "fast": False, "pause_s": 600, "commands": []}]
        await self.bridge.sync_once()
        await self.bridge.ble_step()
        self.assertFalse(any(l.connected for l in self.bridge.links.values()))
        self.mono.t += 601  # zählt lokal herunter, auch ohne Internet
        await self.bridge.ble_step()
        self.assertTrue(all(l.connected for l in self.bridge.links.values()))

    async def test_sync_sends_states_and_keeps_readings_until_confirmed(self):
        await self.connect_all()
        self.assertEqual(await self.bridge.sync_once(), br.SYNC_IDLE_S)  # Uhr wird gesetzt
        await self.bridge.sample_step()
        self.mono.t += 600
        self.cloud.fail = OSError("kein Internet")
        with self.assertRaises(OSError):
            await self.bridge.sync_once()
        self.assertEqual(self.bridge.buffer.count(), 1)  # bleibt im Puffer
        self.cloud.fail = None
        await self.bridge.sync_once()
        fn, params = self.cloud.calls[-1]
        self.assertEqual(fn, "bridge_sync")
        row = params["p_readings"][0]
        self.assertEqual((row["lamp_pct"], row["lamp_on"], row["fan_pct"], row["temp_c"], row["rh"], row["fan_rpm"]), (36, True, 40, 22.0, 58.9, 1620))
        self.assertEqual({s["kind"] for s in params["p_states"]}, {"lamp", "fan"})
        self.assertEqual(self.bridge.buffer.count(), 0)
        blob = json.dumps([p for _fn, p in self.cloud.calls])
        self.assertNotIn(SSID, blob)  # nichts davon verlässt den Pi
        self.assertNotIn("passwort", blob)

    async def test_stopped_fan_is_logged_as_zero(self):
        await self.connect_all()
        self.backend.conns[FAN].on_data(status(FAN_ID, on=0, level=40, rpm=0))
        await self.bridge.sync_once()
        await self.bridge.sample_step()
        self.mono.t += 600
        await self.bridge.sync_once()
        self.assertEqual(self.cloud.calls[-1][1]["p_readings"][0]["fan_pct"], 0)

    async def test_stale_status_is_not_logged(self):
        await self.connect_all()
        self.mono.t += br.FRESH_S + 1
        await self.bridge.sample_step()
        self.bridge.clock.set_server_now(T0)
        self.mono.t += 600
        self.assertEqual(self.bridge.agg.flush(), [])

    async def test_commands_are_acked_on_next_sync(self):
        await self.connect_all()
        self.cloud.replies = [
            {"claimed": True, "now": T0, "fast": True, "pause_s": 0, "commands": [
                {"id": "c1", "device_key": FAN_ID, "action": "level", "value": 45},
                {"id": "c2", "device_key": LAMP_ID, "action": "level", "value": 45},
                {"id": "c3", "device_key": "FFFFFFFFFFFF", "action": "level", "value": 45},
            ]}
        ]
        self.assertEqual(await self.bridge.sync_once(), 0.0)  # sofort erneut abgleichen
        self.assertEqual(self.backend.conns[FAN].written, [f"2|0|32527|{FAN_ID}|45".encode()])
        self.assertEqual(self.backend.conns[LAMP].written, [])
        self.assertEqual(await self.bridge.sync_once(), br.SYNC_IDLE_S)
        self.assertEqual(self.cloud.calls[-1][1]["p_acks"], [
            {"id": "c1", "ok": True, "error": None},
            {"id": "c2", "ok": False, "error": "unsupported"},
            {"id": "c3", "ok": False, "error": "unknown device"},
        ])
        self.assertEqual(self.bridge.acks, [])

    async def test_only_the_last_value_per_device_is_executed(self):
        await self.connect_all()
        self.cloud.replies = [
            {"claimed": True, "now": T0, "fast": True, "pause_s": 0, "commands": [
                {"id": "a", "device_key": FAN_ID, "action": "level", "value": 43},
                {"id": "b", "device_key": FAN_ID, "action": "level", "value": 44},
                {"id": "c", "device_key": FAN_ID, "action": "level", "value": 45},
            ]}
        ]
        await self.bridge.sync_once()
        self.assertEqual(self.backend.conns[FAN].written, [f"2|0|32527|{FAN_ID}|45".encode()])
        self.assertEqual([(a["id"], a["ok"], a["error"]) for a in self.bridge.acks],
                         [("a", False, "superseded"), ("b", False, "superseded"), ("c", True, None)])

    async def test_unknown_bridge_registers_and_unclaimed_keeps_data(self):
        self.cloud.fail = br.CloudError("unknown bridge")
        with self.assertRaises(br.CloudError):  # Registrieren scheitert hier ebenfalls → wird weitergereicht
            await self.bridge.sync_once()
        self.assertEqual(self.cloud.calls[-1][0], "bridge_register")
        self.cloud.fail = None
        self.cloud.replies = [{"claimed": False, "now": T0}]
        self.bridge.buffer.put([{"t": "2027-01-15T08:00:00+00:00", "temp_c": 24}])
        self.assertEqual(await self.bridge.sync_once(), br.SYNC_IDLE_S)
        self.assertIs(self.bridge.claimed, False)
        self.assertEqual(self.bridge.buffer.count(), 1)  # nichts verwerfen, solange ungekoppelt

    async def test_fast_polling_while_app_is_watching(self):
        self.cloud.replies = [{"claimed": True, "now": T0, "fast": True, "pause_s": 0, "commands": []}]
        self.assertEqual(await self.bridge.sync_once(), br.SYNC_FAST_S)


if __name__ == "__main__":
    logging.disable(logging.CRITICAL)
    unittest.main()
