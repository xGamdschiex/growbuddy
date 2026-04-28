# GrowBuddy Device Monitoring (WiFi-ADB)

## Gerät
- **OnePlus A059P** (Android 16)
- **IP:** 192.168.2.62:5555
- **Package:** app.growbuddy.de

## Monitoring-Infrastruktur

### Logs
- `logs/logcat-YYYY-MM-DD.log` — Tägliche Rotation, nur App-relevante Zeilen
- `logs/crashes.log` — Nur FATAL/AndroidRuntime-Errors
- `logs/user-actions.log` — Lifecycle-Events (Screens, Pause/Resume)

### Screenshots
- `screenshots/YYYY-MM-DD_HH-MM-SS.png` — On-demand via `shot.sh`

## Commands

```bash
# Connection prüfen (nach Handy-Neustart evtl. tot)
adb connect 192.168.2.62:5555

# Live-Logs der App
adb -s 192.168.2.62:5555 logcat --pid=$(adb -s 192.168.2.62:5555 shell pidof app.growbuddy.de)

# Screenshot jetzt
adb -s 192.168.2.62:5555 exec-out screencap -p > screenshot.png

# Crashes der letzten Stunde
adb -s 192.168.2.62:5555 logcat -d -t 3600.0 "*:E" AndroidRuntime:E

# App-Infos (Version, Installationszeit, etc.)
adb -s 192.168.2.62:5555 shell dumpsys package app.growbuddy.de | grep -E "versionName|firstInstallTime|lastUpdateTime"
```

## Nach Handy-Neustart (Reconnect)
Wenn `adb devices` leer: Handy über USB nochmal anstecken, dann:
```bash
adb tcpip 5555
adb connect 192.168.2.62:5555
```

## Einschränkungen
- Handy + PC müssen **im gleichen WLAN** sein
- Wenn Handy ins mobile Netz wechselt → Verbindung weg
- Screen muss nicht an sein — adb funktioniert auch bei gesperrtem Display
- Apps im Doze-Mode: Logs kommen verspätet durch
