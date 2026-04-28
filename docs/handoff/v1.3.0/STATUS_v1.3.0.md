# GrowBuddy v1.3.0 — Status

**Stand:** 2026-04-19
**Auf dem Handy:** v1.3.0 (signiertes APK via ADB installiert)
**Vercel:** noch zu deployen (Push auf main triggert Auto-Deploy)

---

## Was ist live (v1.3.0)

### Phase A — i18n
- ✅ 14 fehlende EN-Keys ergänzt (`calc.*`): `einfach_modus`, `voll_modus`, `advanced_options`, `ec_richtwert`, `stretch_*`, `system_*`, `quickstart_*`
- ✅ `npm run check:i18n` meldet 0 Fehlende

### Phase B — Code-UX
- ✅ **B2 Auto-Woche/Tag:** Check-in berechnet Woche/Tag automatisch aus `started_at`; manuelle Eingabe sperrt Auto-Berechnung; Label zeigt "(auto)"
- ✅ **B7 Non-DE Default:** Nicht-deutsche Locales bekommen "RO/Benutzerdefiniert" statt "Mainz Petersaue"
- ✅ **B11 Achievements persistieren:** `awarded_achievements[]` im XP-Store; Toast nur beim ersten Mal
- ✅ `safeSetItem` überall wo XP/State gespeichert wird (Quota-Safe)

### Phase C — Infra
- ✅ **C2 RLS Hardening:** `UPDATE`-Policies haben `with check`; `checkins INSERT` prüft `grow_id` Ownership. Dokumentiert in `RLS_AUDIT.md`, angewandt in `supabase-schema.sql`.
- ✅ **C3 Deep-Links:** Android Intent-Filter für `/grow/*`, `/calc`, `/tools`, `/guide` + `growbuddy://` URI-Scheme
- ✅ **C4 Version single-source:** `package.json` → Vite `define.__APP_VERSION__` → UI + `sw.js` (Build-Plugin ersetzt Platzhalter). Settings/Profil zeigen dynamische Version.

### Phase D — Code-Qualität
- ✅ **D1 Unit Tests:** 24 Tests (calmag, factor, units) mit vitest, alle grün
- ✅ **D2 Konstanten:** `src/lib/constants.ts` mit Magic Numbers (Photo-Limits, EC-Steps, TTLs, Storage-Keys)
- ✅ **D3 Logger:** `src/lib/utils/logger.ts` mit Level-Filter (dev/prod), Sink für Sentry-Integration später
- ✅ **D5 Water-Lookup:** safeSetItem + Logger statt blindem localStorage.setItem

### Deployment
- ✅ APK signed mit `growbuddy-release.jks` (PW: growbuddy2026)
- ✅ versionCode 3, versionName 1.3.0
- ✅ Install via `adb -s 192.168.2.62:5555 install -r` → Success

---

## Was noch offen ist

### Sofort (manuell durch dich)
1. **Supabase Migration ausführen:**
   - `ALTER TABLE grows` für `system` + `coco_perlite_ratio` (siehe `todo_supabase_migration.md`)
   - RLS-Patches aus `RLS_AUDIT.md` im Supabase SQL-Editor laufen lassen
2. **Vercel Deploy:** `git push origin main` (oder manueller Deploy)
3. **APK-Backup:** `android/app/build/outputs/apk/release/app-release.apk` irgendwo sichern

### Phase B/C/D — Design-Tasks (an Claude Design übergeben)
→ siehe `CLAUDE_DESIGN_HANDOFF.md`

### Phase E — Community v2.0
→ eigener großer Block, später. Masterplan v2 in `growbuddy_masterplan_v2.md`.

---

## Schnelltests fürs Handy

- [ ] App startet, zeigt "v1.3.0" unten in Settings + Profil
- [ ] Neuen Grow anlegen → Check-in öffnen → Woche/Tag sind vorausgefüllt + markiert mit "(auto)"
- [ ] In Settings Sprache auf EN umstellen → Calc zeigt englische Labels überall
- [ ] Achievement unlocken → nach App-Neustart kein Toast nochmal
- [ ] Deep-Link: Browser → `https://growbuddy-app.vercel.app/grow/XY` öffnet App

## Rollback falls was kaputt ist

```bash
adb -s 192.168.2.62:5555 install -r /pfad/zum/alten/v1.2.0.apk
```

(oder aus Play Store falls du sie dort hast)
