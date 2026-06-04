#!/usr/bin/env bash
# install-now.sh — One-Shot Install der aktuellen Release-APK (v1.4.20) aufs Handy
# Erwartet eine bereits gebaute APK unter android/app/build/outputs/apk/release/

set -e

ADB="${LOCALAPPDATA:-$HOME/AppData/Local}/Android/Sdk/platform-tools/adb.exe"
APK="$(cd "$(dirname "$0")/.." && pwd)/android/app/build/outputs/apk/release/app-release.apk"
VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$(dirname "$0")/../package.json" | head -n1)

if [ ! -f "$APK" ]; then
  echo "✗ APK nicht gefunden: $APK"
  echo "  → erst 'bash scripts/release.sh <version> <msg>' laufen lassen, oder Gradle assembleRelease"
  exit 1
fi

# Erst frische mDNS-Discovery
"$ADB" mdns services 2>&1 | tail -n +2 | head -5

# Versuche mDNS-Endpoint
TARGET=$("$ADB" mdns services 2>&1 | grep '_adb-tls-connect' | awk '{print $3}' | head -n1)
if [ -n "$TARGET" ]; then
  echo "→ Probiere mDNS-Endpoint: $TARGET"
  "$ADB" connect "$TARGET" 2>&1 || true
fi

# Fallback: statischer DEVICE
"$ADB" connect 192.168.2.62:5555 >/dev/null 2>&1 || true

# Erstes verbundenes Gerät nehmen (mDNS-Namen können Whitespace enthalten — daher robust)
DEV=$("$ADB" devices | awk 'NR>1 && /device$/ {print $1; exit}')
if [ -z "$DEV" ]; then
  echo "✗ Kein Gerät erreichbar."
  echo "  → Am Handy: Settings → Developer Options → Wireless Debugging → bei mDNS-Notification 'Allow' tippen"
  exit 2
fi

echo "→ Installiere auf $DEV"
"$ADB" -s "$DEV" install -r "$APK"
"$ADB" -s "$DEV" shell "am force-stop app.growbuddy.de" >/dev/null 2>&1 || true
"$ADB" -s "$DEV" shell "monkey -p app.growbuddy.de -c android.intent.category.LAUNCHER 1" >/dev/null 2>&1 || true
"$ADB" -s "$DEV" push "$APK" "//sdcard/Download/GrowBuddy-$VERSION.apk" >/dev/null 2>&1 || true
echo "✓ v$VERSION installiert + gestartet, APK auch in /sdcard/Download/ kopiert"
