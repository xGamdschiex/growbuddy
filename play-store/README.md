# Play-Store Assets

## Inhalt

- `listing-de.md` — Deutsche Store-Beschreibung (Titel, Kurz-/Langbeschreibung, Keywords)
- `listing-en.md` — Englische Store-Beschreibung
- `graphics/` — Feature-Grafik (1024×500) und App-Icon (512×512)
- `screenshots/` — Screenshots (1080×1920, 5 Stück)

## Benötigte Assets (manuell erstellen)

### App-Icon
- **Pfad:** `static/icon-512.png` (existiert bereits)
- **Größe:** 512×512 PNG, 32-bit mit Alpha

### Feature-Grafik
- **Größe:** 1024×500 PNG oder JPG
- **Inhalt:** GrowBuddy-Logo + Tagline "Dein smarter Grow-Assistent"
- **Hintergrund:** Dark theme (#0a0a0a) mit grünem Akzent (#22c55e)
- Speichern unter `graphics/feature-graphic.png`

### Screenshots (5× Phone, 1080×1920)
Empfohlene Flows:
1. **Dashboard** — Daily Check-in Hero mit Streak-Badge
2. **Grow-Detail** — Phasen-Timeline, letzte Check-ins, Foto
3. **Düngerrechner** — 9 Düngerlinien, Wochenwerte
4. **AI Plant Doctor** — Foto-Upload + Diagnose-Ergebnis
5. **VPD/DLI-Tool** — Klima-Diagramm

### Wie Screenshots aufnehmen
1. Chrome DevTools → Device Mode → Pixel 7 (1080×2400) oder Custom 1080×1920
2. Oder: APK auf Gerät installieren, mit `adb exec-out screencap -p > screen.png`
3. Oder: Android-Emulator über Android Studio

### Upload zu Google Play Console
1. Internal testing track erst (Test via Link)
2. Dann Closed Testing
3. Production nach Freigabe

## Build-Artefakte

- Debug APK: `../android/app/build/outputs/apk/debug/app-debug.apk` (4.3 MB)
- Release APK: via `npm run apk:release` (benötigt Keystore, siehe Haupt-README)
- Release AAB: via `npm run aab:release` (Upload-Format für Play Store)
