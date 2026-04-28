# GrowBuddy

Smarter Grow-Assistent — wissenschaftlich korrekt, KI-gestützt, offline-fähig.
Svelte 5 (Runes) + SvelteKit 2 + Supabase + Capacitor 8 (Android).

**Aktuelle Version:** 1.3.25 (versionCode 28) · **Letzter Release:** 2026-04-28

## Features

- **Daily Check-in** — Foto, Werte (VPD/Temp/RH/EC/pH), Wasser/Dünger
- **Grow-Tracking** — Phasen (Keimung → Veg → Blüte → Trocknung → Curing), Charts mit Phasen-Targets
- **Düngerrechner** — 11 Feedlines (Athena Pro/Blended, Hesi, BioBizz, GH, Atami, Canna, AN)
- **Tools** — VPD, DLI, Dry-Calc, AI Plant-Doctor (Gemini)
- **Cloud-Sync** — Supabase mit PKCE-Auth (Magic Link + Google OAuth), Last-Write-Wins-Merge, Multi-Photo
- **Community (Phase 2 Beta)** — Username/Avatar/Bio, Public-Profile `/u/[username]`, Likes, Follows, "Folge ich"-Filter, Reports
- **Insights** — Strain-Stats (Yield, Dauer, Score), Phasen-Histogramme
- **Pro** — Beta-Code: `GROWBUDDY2026`

## Quick Start

```bash
npm install
npm run dev        # Dev-Server auf :5173
npm run build      # Production-Build nach build/
```

## Scripts

- `npm run dev` — Vite Dev-Server
- `npm run build` — Static Build (adapter-static)
- `npm run preview` — lokale Preview des Production-Builds
- `npm run check` — Svelte + TypeScript-Check

## Android APK Build

### Voraussetzungen
- **Java JDK 17 oder 21** (NICHT 24! Gradle ist inkompatibel)
- **Android Studio** oder **Android SDK Command-line tools**
- `ANDROID_HOME` gesetzt (z.B. `C:\Users\DU\AppData\Local\Android\Sdk`)
- `JAVA_HOME` auf JDK 17/21 zeigend

### Debug-APK
```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

### Release-APK (signed, für Play Store)

1. **Keystore erstellen** (einmalig — SICHER aufbewahren!):
```bash
keytool -genkey -v -keystore growbuddy-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias growbuddy
```

2. **Gradle-Properties setzen** (`~/.gradle/gradle.properties`):
```properties
GROWBUDDY_KEYSTORE_FILE=C:/Pfad/zu/growbuddy-release.jks
GROWBUDDY_KEYSTORE_PASSWORD=deinPasswort
GROWBUDDY_KEY_ALIAS=growbuddy
GROWBUDDY_KEY_PASSWORD=deinKeyPasswort
```

3. **Release-APK bauen**:
```bash
cd android
./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

4. **AAB für Play Store** (empfohlen statt APK):
```bash
./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

### Android Studio Workflow (einfacher)
```bash
npm run build
npx cap sync android
npx cap open android    # öffnet Android Studio
```
Dort: **Build → Generate Signed Bundle / APK** → Assistent folgen.

## Supabase Setup

SQL-Schema einmalig im Supabase Dashboard unter SQL Editor ausführen:
```bash
# Datei: supabase-schema.sql
```

Erstellt: `grows`, `checkins` Tabellen + RLS-Policies + `checkin-photos` Storage-Bucket.

## Web Deployment (Vercel)

```bash
vercel --prod
```
Build-Config ist in `vercel.json` definiert (static adapter, SPA-Fallback, Cache-Header für `_app/immutable`).

## Struktur

```
src/
├── lib/
│   ├── components/    # UI-Komponenten (DailyCheckin, InstallPrompt, ...)
│   ├── stores/        # Svelte Stores (grow, xp, streak, reminders, sync, ...)
│   ├── data/          # Static Data (feedlines, science, ...)
│   ├── i18n/          # DE + EN Locale-Dateien
│   └── utils/         # gemini, storage, validation, backup, ...
├── routes/
│   ├── +layout.svelte # Top-Level Layout (Nav, Banner, SW-Update)
│   ├── +page.svelte   # Dashboard mit Daily Check-in Hero
│   ├── grow/          # Grow-Listing + Detail
│   ├── calc/          # Düngerrechner
│   ├── tools/         # VPD, DLI, Dry, Doctor
│   ├── settings/      # Einstellungen
│   ├── profile/       # Profil + XP
│   └── legal/         # Impressum + Datenschutz
android/               # Capacitor Android-Projekt
static/                # PWA-Assets (manifest, sw, icons)
supabase-schema.sql    # Vollständiges DB-Schema
```

## Lizenz

Privat — © 2026 Lauritz Wirtz
