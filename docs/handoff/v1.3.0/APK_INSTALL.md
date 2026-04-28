# APK Install — Cheatsheet

## Schnell-Install (Handy via WLAN)

```bash
cd ~/Desktop/growbuddy
npm run apk:release
adb connect 192.168.2.62:5555
adb -s 192.168.2.62:5555 install -r android/app/build/outputs/apk/release/app-release.apk
```

## Wenn ADB nicht will

```bash
adb kill-server
adb start-server
adb connect 192.168.2.62:5555
adb devices    # muss 192.168.2.62:5555 device zeigen
```

## Keystore

- Datei: `~/Desktop/growbuddy/android/app/growbuddy-release.jks`
- Passwort: `growbuddy2026`
- Alias: `growbuddy`
- **NIE verlieren** — ohne den Key kann niemand (auch nicht Google Play) Updates ausrollen.
- Backup an sicheren Ort kopieren!

## Version bumpen für nächstes Release

1. `package.json` → `"version": "1.4.0"`
2. `android/app/build.gradle` → `versionCode` +1, `versionName "1.4.0"`
3. `npm run apk:release`
4. Vite-Plugin ersetzt automatisch Version in `sw.js` und `__APP_VERSION__`

## Debug statt Release (für schnelles Testen)

```bash
npm run apk:debug
adb -s 192.168.2.62:5555 install -r android/app/build/outputs/apk/debug/app-debug.apk
```
