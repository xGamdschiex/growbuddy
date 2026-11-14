#!/usr/bin/env bash
# GrowBuddy-Bridge auf einem Raspberry Pi installieren oder aktualisieren.
#
#   sudo bash bridge/install.sh --url https://<projekt>.supabase.co --anon-key <anon key>
#
# Erneuter Aufruf (auch ohne Optionen) aktualisiert den Code; Konfiguration und Kopplung bleiben.
# Der anon key ist der öffentliche Schlüssel der App, kein Geheimnis. Das geheime Bridge-Token
# erzeugt der Pi selbst und speichert es nur lokal.
set -euo pipefail

URL=""
KEY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --url) URL="${2:?--url braucht einen Wert}"; shift 2 ;;
    --anon-key) KEY="${2:?--anon-key braucht einen Wert}"; shift 2 ;;
    *) echo "Unbekannte Option: $1" >&2; exit 2 ;;
  esac
done

[ "$(id -u)" = 0 ] || { echo "Bitte mit sudo starten." >&2; exit 1; }

SRC="$(cd "$(dirname "$0")" && pwd)"
APP=/opt/growbuddy-bridge
STATE=/var/lib/growbuddy-bridge
CFG="$STATE/config.json"
SVC_USER=growbuddy

python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' \
  || { echo "Python 3.11 oder neuer nötig (Raspberry Pi OS Bookworm oder neuer)." >&2; exit 1; }
[ "$(getconf LONG_BIT)" = 64 ] || { echo "64-Bit-System nötig (Raspberry Pi OS Lite 64-bit)." >&2; exit 1; }
if [ ! -f "$CFG" ] && { [ -z "$URL" ] || [ -z "$KEY" ]; }; then
  echo "Erstinstallation braucht --url und --anon-key." >&2
  exit 2
fi

echo "→ Pakete"
apt-get update -qq
apt-get install -y -qq python3-venv bluez >/dev/null
rfkill unblock bluetooth 2>/dev/null || true

echo "→ Benutzer und Verzeichnisse"
id "$SVC_USER" >/dev/null 2>&1 || useradd --system --home-dir "$STATE" --shell /usr/sbin/nologin "$SVC_USER"
usermod -aG bluetooth "$SVC_USER"
install -d -m 0755 "$APP"
install -d -m 0700 -o "$SVC_USER" -g "$SVC_USER" "$STATE"
install -m 0644 "$SRC/bridge.py" "$SRC/marshydro.py" "$APP/"

echo "→ Python-Umgebung"
[ -x "$APP/venv/bin/python" ] || python3 -m venv "$APP/venv"
"$APP/venv/bin/pip" install -q --disable-pip-version-check bleak==3.1.0 httpx==0.28.1

echo "→ Konfiguration"
GB_URL="$URL" GB_KEY="$KEY" "$APP/venv/bin/python" - "$CFG" <<'PY'
import json, os, secrets, sys

path = sys.argv[1]
data = json.load(open(path)) if os.path.exists(path) else {}
if os.environ["GB_URL"]:
    data["supabase_url"] = os.environ["GB_URL"].rstrip("/")
if os.environ["GB_KEY"]:
    data["anon_key"] = os.environ["GB_KEY"]
data.setdefault("token", secrets.token_urlsafe(32))  # bestehendes Token behalten = Kopplung bleibt
with open(path, "w") as f:
    json.dump(data, f, indent=2)
PY
chown "$SVC_USER:$SVC_USER" "$CFG"
chmod 600 "$CFG"

echo "→ Dienst"
cat > /etc/systemd/system/growbuddy-bridge.service <<EOF
[Unit]
Description=GrowBuddy Bridge (Mars Hydro Bluetooth <-> Supabase)
After=bluetooth.service network-online.target
Wants=bluetooth.service network-online.target

[Service]
User=$SVC_USER
SupplementaryGroups=bluetooth
Environment=PYTHONUNBUFFERED=1
ExecStart=$APP/venv/bin/python $APP/bridge.py
Restart=always
RestartSec=5
StateDirectory=growbuddy-bridge
StateDirectoryMode=0700
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable -q growbuddy-bridge
systemctl restart growbuddy-bridge

echo "→ Kopplung"
sleep 3
runuser -u "$SVC_USER" -- "$APP/venv/bin/python" "$APP/bridge.py" --pair \
  || echo "Kopplungscode später holen: sudo -u $SVC_USER $APP/venv/bin/python $APP/bridge.py --pair"

echo
echo "Fertig. Protokoll ansehen: journalctl -u growbuddy-bridge -f"
