# GrowBuddy Release-Keystore

## WICHTIG: Niemals committen oder verlieren!
Ohne diesen Keystore können keine Updates im Play Store veröffentlicht werden.

## Infos
- **Datei:** `growbuddy-release.jks`
- **Alias:** `growbuddy`
- **Passwort (store + key):** `growbuddy2026`
- **Gültigkeit:** 10.000 Tage (bis ~2053)
- **Algorithmus:** RSA 2048, SHA384withRSA
- **Zertifikat:** CN=Lauritz Wirtz, OU=GrowBuddy, O=GrowBuddy, C=DE

## Backup (EMPFEHLUNG)
1. Kopie verschlüsseln: `7z a -pGEHEIM backup.7z growbuddy-release.jks README.md`
2. Backup in sicherem Offline-Storage (externe Festplatte, Cloud mit 2FA)
3. Passwort separat speichern (z.B. Passwort-Manager)

## Play Console — App Signing (empfohlen)
Google bietet "Play App Signing": Der Upload-Key kann ersetzt werden, falls verloren.
Beim ersten AAB-Upload im Play Console aktivieren.

## Release-Build starten
```bash
cd android
./gradlew bundleRelease \
  -PGROWBUDDY_KEYSTORE_FILE="C:/Users/lauri/OneDrive/Desktop/growbuddy/keystore/growbuddy-release.jks" \
  -PGROWBUDDY_KEYSTORE_PASSWORD=growbuddy2026 \
  -PGROWBUDDY_KEY_ALIAS=growbuddy \
  -PGROWBUDDY_KEY_PASSWORD=growbuddy2026
```

Oder dauerhaft in `~/.gradle/gradle.properties` (nicht committen!):
```properties
GROWBUDDY_KEYSTORE_FILE=C:/Users/lauri/OneDrive/Desktop/growbuddy/keystore/growbuddy-release.jks
GROWBUDDY_KEYSTORE_PASSWORD=growbuddy2026
GROWBUDDY_KEY_ALIAS=growbuddy
GROWBUDDY_KEY_PASSWORD=growbuddy2026
```

Dann einfach: `npm run aab:release`

## Output
AAB: `android/app/build/outputs/bundle/release/app-release.aab` (3.2 MB)
APK: `android/app/build/outputs/apk/release/app-release.apk`
