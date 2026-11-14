"""Mars-Hydro-BLE-Protokoll der Altgeräte („Mars Legacy"-App) – reiner Codec, ohne Bluetooth.

Belegt durch Mitschnitt der Original-App und Gegenprobe vom Raspberry Pi (FC-E 4000 + iFresh DF100-M):

- GATT: ein Service, Schreiben mit Response, Statusmeldungen als Notification. Kein Pairing.
- Werbename `MZ_<Modell>_<Produktcode>_<12-Hex-ID>`.
- Befehle sind ASCII: `<Befehl>|<Flag>|<Produktcode>|<ID>|<Wert…>`.
- Statusmeldung alle ~3 s, eine Zeile mit `|`-Feldern, endet mit Zeilenumbruch:
    0|<ID>||<Modell>|<Firmware>|<Produkt>|1|1|<WLAN-Name>|<WLAN-Passwort>|-1|<auto|cmd>|<an>|<Stufe>|?|?|<Gerätezeit UTC>|?|…
  Lüfter zusätzlich: …|<Automatik "1,0">|<°C>|<% rF>|<U/min>|…

ACHTUNG: Die Geräte senden WLAN-Name und WLAN-Passwort im Klartext mit. Diese Felder werden
hier nie ausgewertet, nie gespeichert und in Protokollausgaben geschwärzt (siehe redact()).

Nebenwirkungen, die der Mitschnitt gezeigt hat:
- Lüfterstufe (Befehl 2): Automatik bleibt an → freigegeben.
- Lüfter an/aus (Befehl 1): schaltet die Automatik ab → gesperrt.
- Lampe dimmen (Befehl 2): schaltet die Zeitschaltung ab (Modus "cmd") → gesperrt, bis die Bridge
  die Zeitschaltung direkt danach wieder setzen kann.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

SERVICE_UUID = "83677baa-3eb8-4866-b6b6-96e5ed5cc48d"
WRITE_UUID = "f5d2b3fe-e6b5-49b5-aa5f-a00bb4156d1d"
NOTIFY_UUID = "6f588463-f8f1-44f8-bdae-a1272a1b0f6e"

NAME_PREFIX = "MZ_"
LEVEL_MIN = {"lamp": 10, "fan": 25}
LEVEL_MAX = 100

# Bekannte Modelle. Unbekannte werden ignoriert statt geraten.
MODELS: dict[str, str] = {"MARS": "lamp", "MZF002": "fan"}

# Modell → Aktionen, die am echten Gerät ohne schädliche Nebenwirkung bestätigt sind.
VERIFIED: dict[str, frozenset[str]] = {"MZF002": frozenset({"level"})}

_NAME_RE = re.compile(r"^MZ_([A-Za-z0-9]+)_(\d+)_([0-9A-Fa-f]{12})$")
_ID_RE = re.compile(r"^[0-9A-F]{12}$")
_MODES = ("auto", "cmd")


@dataclass(frozen=True)
class Ident:
    """Aus dem Werbenamen, z. B. MZ_MZF002_32527_<ID>."""

    name: str
    model: str
    product: str
    dev_id: str
    kind: str  # "lamp" | "fan"


@dataclass(frozen=True)
class Status:
    dev_id: str
    model: str
    firmware: str
    product: str
    mode: str  # "auto" = Zeitschaltung/Automatik aktiv, "cmd" = von Hand
    on: bool  # Lampe: an. Lüfter: läuft gerade.
    level: int
    device_time: int | None  # Unix UTC
    automation: bool | None = None  # nur Lüfter
    temp_c: float | None = None
    rh: float | None = None
    rpm: int | None = None


def parse_name(name: str | None) -> Ident | None:
    m = _NAME_RE.match((name or "").strip())
    if not m:
        return None
    model = m.group(1).upper()
    kind = MODELS.get(model)
    if kind is None:
        return None
    return Ident(name=m.group(0), model=model, product=m.group(2), dev_id=m.group(3).upper(), kind=kind)


def caps(model: str) -> dict[str, bool]:
    """Was die App für dieses Modell anbieten darf."""
    ok = VERIFIED.get(model.upper(), frozenset())
    return {"power": "power" in ok, "level": "level" in ok}


def clamp_level(kind: str, pct: int) -> int:
    return max(LEVEL_MIN.get(kind, 10), min(LEVEL_MAX, int(pct)))


def cmd_level(kind: str, product: str, dev_id: str, pct: int) -> bytes:
    return f"2|0|{product}|{dev_id}|{clamp_level(kind, pct)}".encode("ascii")


def cmd_power(product: str, dev_id: str, on: bool) -> bytes:
    return f"1|0|{product}|{dev_id}|{1 if on else 0}".encode("ascii")


def cmd_set_time(product: str, unix_utc: float) -> bytes:
    """Geräteuhr stellen – die Original-App sendet das bei jedem Verbinden."""
    return f"6|1|{product}|ALL|{int(unix_utc)}".encode("ascii")


def _mode_index(fields: list[str]) -> int | None:
    """Position des Modus-Felds. Davor stehen die WLAN-Zugangsdaten (können selbst `|` enthalten)."""
    for i in range(11, len(fields)):
        if fields[i] in _MODES and re.fullmatch(r"-?\d+", fields[i - 1] or ""):
            return i
    return None


def redact(line: str) -> str:
    """Statuszeile für Protokollausgaben: WLAN-Zugangsdaten entfernt. Unbekanntes wird gar nicht gezeigt."""
    fields = line.strip().split("|")
    m = _mode_index(fields)
    if m is None:
        return f"<{len(line)} Zeichen, nicht erkannt>"
    return "|".join(fields[:8] + ["***", "***"] + fields[m - 1 :])


def _float_in(text: str, low: float, high: float) -> float | None:
    try:
        v = float(text)
    except ValueError:
        return None
    return v if low <= v <= high else None


def parse_status(line: str) -> Status | None:
    """Eine vollständige Statuszeile → Status. None bei allem, was nicht sicher erkannt wird."""
    fields = line.strip().split("|")
    m = _mode_index(fields)
    if m is None or len(fields) < m + 6:
        return None
    dev_id, model, firmware, product = fields[1].upper(), fields[3].upper(), fields[4], fields[5]
    kind = MODELS.get(model)
    if kind is None or not _ID_RE.match(dev_id) or not product.isdigit():
        return None
    on, level = fields[m + 1], fields[m + 2]
    if on not in ("0", "1") or not level.isdigit() or not 0 <= int(level) <= 100:
        return None
    time_txt = fields[m + 5]
    device_time = int(time_txt) if time_txt.isdigit() and int(time_txt) > 1_600_000_000 else None
    extra: dict = {}
    if kind == "fan" and len(fields) >= m + 11:
        rpm = fields[m + 10]
        extra = {
            "automation": fields[m + 7].startswith("1"),
            "temp_c": _float_in(fields[m + 8], -20.0, 60.0),
            "rh": _float_in(fields[m + 9], 0.0, 100.0),
            "rpm": int(rpm) if rpm.isdigit() and int(rpm) <= 20000 else None,
        }
    return Status(
        dev_id=dev_id,
        model=model,
        firmware=firmware,
        product=product,
        mode=fields[m],
        on=on == "1",
        level=int(level),
        device_time=device_time,
        **extra,
    )


class LineBuffer:
    """Setzt Statuszeilen zusammen, falls eine Meldung über mehrere Notifications verteilt ankommt."""

    def __init__(self, limit: int = 2048):
        self._buf = ""
        self._limit = limit

    def feed(self, data: bytes) -> list[str]:
        self._buf += bytes(data).decode("ascii", errors="replace")
        if "\n" not in self._buf:
            if len(self._buf) > self._limit:
                self._buf = ""  # nie endlos sammeln
            return []
        *lines, self._buf = self._buf.split("\n")
        return [ln.strip("\r\x00 ") for ln in lines if ln.strip("\r\x00 ")]
