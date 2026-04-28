# GrowBuddy — Verbesserungsplan (2026-04-19)

Basis: Vollständiges Code-Audit aller Routen, Stores, Calc-Engine, Components, i18n, Supabase-Schema, Capacitor-Config und Android-Setup.

Ziel: Playstore-Reife + maximale Retention. Integriert in Masterplan v2.1.

**Legende:**
- 🎨 = **Claude Design** — UI/UX-Handoff (Mockups, Komponenten-Design, Design-Tokens, Illustrations)
- 🔧 = Code-Implementation (Logik, State, Backend)
- 🔀 = Beides nötig (Design liefert Mockup → Code implementiert)

---

## 🔴 PHASE A — Kritische Fixes (vor v1.3.0)

**Warum zuerst:** Datenverlust-Risiken, stille Bugs, UX-Blocker für neue User. **Alles 🔧 Code.**

### A1. Race-Conditions & Hydration 🔧
- **`src/routes/+layout.svelte`** — Onboarding-Redirect: zwei `$effect` können doppelt feuern auf langsamen Devices → zu einem async-guard zusammenführen.
- **`src/routes/+page.svelte`** (Dashboard) — `$derived.by()` mit `$state(false)` Initialwert erzeugt leeres Rendering für ~100ms → Pattern auf sauberen `$derived`-Subscribe umstellen.

### A2. Null-Handling im Check-in 🔧
- **`src/routes/grow/[id]/+page.svelte`** + **`src/lib/components/DailyCheckin.svelte`** — `calcVPD(temp, rh)` wird ohne Null-Check aufgerufen, kann undefined speichern → DB-Constraint-Fehler. Guard: `$derived(temp !== null && rh !== null ? calcVPD(...) : null)`.

### A3. Offline→Online Merge-Konflikte 🔧
- **`src/lib/stores/sync.ts`** + **`src/routes/profile/+page.svelte`** — `pullSync()` überschreibt Lokales → Grows, die offline erstellt wurden, gehen verloren.
- **Fix:** Last-Write-Wins mit `updated_at` Timestamp pro Row, lokales Merge statt Überschreibung.

### A4. Photo-Compression blockiert UI 🔧
- **`src/lib/components/DailyCheckin.svelte`** — `canvas.toDataURL()` ist sync, 5 Fotos × ~1.5s = 7.5s UI-Freeze auf Mid-Range Android.
- **Fix:** `OffscreenCanvas` + `createImageBitmap` in Batch-Loop mit `await` zwischen Frames (`requestIdleCallback`).

### A5. Photo-Limit Silent Drop 🔧
- **`src/lib/components/DailyCheckin.svelte`** — `.slice(0, 5)` wirft stillschweigend 6tes Foto weg → Toast bei Limit.

### A6. localStorage voll 🔧
- **`src/lib/stores/calc.ts`**, **`grow.ts`** — leere Catch-Blöcke schlucken Quota-Fehler → Toast + In-Memory-Fallback + Hinweis auf "Export/Backup".

### A7. i18n Missing Keys 🔧
- Build-Validator schreiben: scannt alle `tr('...')` Aufrufe, checkt gegen `de.ts` + `en.ts`, bricht Build bei Missing.
- Known missing: `grow.active_sub`, `grow.new_short`, `grow.plants_plural`, `grow.plant`.

---

## 🟡 PHASE B — UX-Polish für Retention (v1.3.0)

### B1. Check-in Edit/Delete (bereits im Masterplan) 🔀
- 🎨 Design: Long-Press Bottom-Sheet Mockup, Delete-Confirm-Dialog, Edit-Formular-Layout.
- 🔧 Code: Cascade-Delete Storage-Photos, Streak-Preservation-Logik, XP nicht rückwirkend.

### B2. Check-in Week/Day Auto-Berechnung 🔧
- Statt manueller Eingabe: `week = ceil(days_since_started_at / 7)`, `day = days_since_started_at`. Optional-Override für Stretch.

### B3. Verlaufs-Graphen (Masterplan) 🔀
- 🎨 Design: `<LineChart>` SVG-Mockup, Metric-Tab-Bar, Farbschema pro Metrik, Empty-State "Noch keine Daten", Tooltip-Design.
- 🔧 Code: SVG-Rendering, Daten-Aggregation, Tab-State.

### B4. Touch-Targets (a11y + Playstore) 🎨
- Bottom-Nav Icons aktuell 24×24px in 64px-Bar → zu klein. Mindesten 48×48px Hit-Area (Material Design), Icons optisch 24px aber Padding drumherum.
- Design-Pass über ALLE Buttons/Tap-Areas (Check-in, Calc-Slider, Grow-Card-Actions).

### B5. Calc-Page zu lang (605 Zeilen) 🔀
- 🎨 Design: Multi-Step-Wizard oder Tab-Layout Mockup (Tab 1 "Setup", Tab 2 "Ergebnis", Tab 3 "Wasser"), Progress-Indicator, Stretch-/EC-Richtwert-Badges.
- 🔧 Code: Refactoring der 605-Zeilen-Route in Sub-Components.

### B6. VPD-Status live im Check-in 🔀
- 🎨 Design: Traffic-Light-Badge (grün/gelb/rot) pro Phase, Tooltip mit Sollwerten.
- 🔧 Code: Berechnung + Phase-Lookup.

### B7. Water-Profile Fallback 🔧
- Default `Mainz Petersaue` ist hardcoded → für Nicht-DE-User falsch. Fallback: wenn Browser-Locale nicht `de-*`, zeige Hinweis "Eigenes Wasserprofil oder RO annehmen".

### B8. Reminder-Permission-UI 🔀
- 🎨 Design: Erklär-Modal Mockup vor Permission-Request, Zeit-Picker-Design.
- 🔧 Code: Capacitor-Permission-Flow, Persistence.

### B9. Empty-States konsistent 🎨
- Dashboard + `/grow` haben unterschiedliche Leerstates → vereinheitlichen.
- Design-Task: Illustrated Empty-State (Pflanze als SVG), klarer CTA, konsistente Copy.

### B10. Grow-Limit Error mit CTA 🔀
- 🎨 Design: Pro-Upgrade-Modal mit Feature-Vergleich.
- 🔧 Code: Modal-Trigger statt Toast.

### B11. Achievement-Persistenz 🔧
- **`src/routes/profile/+page.svelte`** — `awardedAchievements = $state(new Set())` nie persistiert → bei Reload wieder Toast. Als Bit-Flag im `xpStore` speichern.

---

## 🟡 PHASE C — Playstore-Härtung (v1.4.0)

### C1. Legal & DSGVO 🔀
- 🎨 Design: Legal-Page-Layout, Account-Löschen-Confirm-Flow (mehrstufig), Public-Toggle Privacy-Hinweis.
- 🔧 Code: Cascade-Delete (DB + Storage), Data-Retention-Doc, Text-Inhalt.

### C2. Supabase RLS Review 🔧
- Alle Policies reviewen: `grows`, `checkins`, `profiles`, Storage-Bucket `checkin-photos`.
- Sicherstellen: kein cross-user-leak möglich.

### C3. Deep-Links erweitern 🔧
- **`android/app/src/main/AndroidManifest.xml`** — aktuell nur `/auth/callback`. Ergänzen: `/grow/{id}`, `/calc`, `/tools/*` für Push-Notifications + Share-Links.

### C4. App-Version aus package.json 🔧
- **`capacitor.config.ts`** + **`static/sw.js`** — Version automatisch aus `package.json` injizieren (build-time) statt hardcoded `v3`.

### C5. Camera-Permission erklären 🔀
- 🎨 Design: Permission-Erklär-Modal mit Icon + Copy "Für Pflanzen-Fotos".
- 🔧 Code: Permission-Trigger vor Capacitor-Call.

### C6. Splash/Icon reviewen 🎨
- Adaptive Icon (Foreground/Background-Layer), Monochrome-Icon für Android 13+ Theming, Splash-Theme für Android 12+.
- **Claude Design Hauptarbeit:** App-Icon-Set, Splash-Screen, Notification-Icon.

---

## 🟢 PHASE D — Tech-Debt & Polish (parallel zu v2.0 Community)

### D1. Unit-Tests für Calc-Engine 🔧
- Vitest-Setup. Testen: `nutrients.ts`, `factor.ts`, `calmag.ts`, alle Feedlines mit Fixture-Inputs. Edge-Cases: Woche 0, Stretch-Week, RO vs. Leitungswasser.

### D2. Constants-File 🔧
- **`src/lib/constants.ts`** — Magic Numbers bündeln: `MAX_PHOTOS = 5`, `PHOTO_MAX_WIDTH = 1024`, `COMPRESSION_QUALITY = 0.75`, `EC_STEP_MSCM = 0.1`.

### D3. Logger-Infra 🔧
- **`src/lib/utils/logger.ts`** — strukturiertes Logger mit Level. Production: optional Sentry-Wrapper für gefangene Errors.

### D4. Error-Boundaries 🔀
- 🎨 Design: Freundliche Error-Page-Illustration + Copy "Oops, hier ist was schiefgelaufen" + Retry-Button.
- 🔧 Code: `src/routes/+error.svelte`, try/catch in async `load()`.

### D5. Water-Lookup Cache 🔧
- **`src/lib/utils/water-lookup.ts`** — LocalStorage-Cache mit TTL 7 Tage. Spart API-Calls.

### D6. Dark-Mode 🎨
- **Claude Design Hauptarbeit:** Komplettes Dark-Theme-Farbschema, alle `gb-*` Design-Tokens in Dark-Variante.
- 🔧 Code: `prefers-color-scheme` Media-Query + CSS-Var Overrides in `app.css`, Toggle in Settings.

### D7. Tablet-Layout 🎨
- Responsive Breakpoints durchdesignen: Dashboard 2-Spalten ab `md:`, Calc-Page Side-by-Side Setup+Ergebnis, Grow-Detail größere Foto-Grid.
- **Design-Aufgabe**, Code ist nur Tailwind-Klassen.

### D8. Photo-Gallery Lightbox 🔀
- 🎨 Design: Full-Screen Carousel-Mockup, Swipe-Indikator, Close-Button.
- 🔧 Code: `<Lightbox.svelte>` Component ausbauen.

### D9. XP-Transparenz 🔀
- 🎨 Design: Info-Modal mit XP-Breakdown-Tabelle (Check-in +X, Streak-Bonus +Y, Harvest +Z).
- 🔧 Code: Modal-Trigger, Daten aus `xp.ts`.

---

## 🟢 PHASE E — Nice-to-Have (nach v2.0)

- 🔧 Backup-Download UI-Button (**`src/lib/utils/backup.ts`** ist da, aber nicht verdrahtet)
- 🔧 Sync-Timestamp "Zuletzt synced: vor 2h" in Settings
- 🔀 Share-Feature: Harvest-Stats als Image/PDF — 🎨 **Claude Design Hauptarbeit** (Share-Card-Layout, Social-optimiert 1:1/9:16)
- 🔧 Strain-DB erweitern (50 → 100+) oder Seedfinder-Integration
- 🔧 BlurHash für Photo-Placeholder (Performance)
- 🔧 Service-Worker Force-Reload wenn Waiting-SW >1h alt
- 🔧 Rate-Limit/Debounce auf Calc-Engine-Aufrufe
- 🔧 Push-Notification Payload dynamisch (Grow-Name, Phase)
- 🔧 Signaturseite für IPM-Quellen (BfR/Beratung)

---

## Reihenfolge & Integration in Masterplan v2.1

| Phase | Zeitraum | Release |
|-------|----------|---------|
| **A** Kritische Fixes | KW 17 (jetzt) | v1.2.1 Hotfix |
| **B** UX-Polish | KW 17–18 | v1.3.0 (Edit/Delete, Graphen, Reminder) |
| **C** Playstore-Härtung | KW 18 parallel | v1.4.0 Platform |
| **D** Tech-Debt | KW 19+ parallel zu Community | v2.0.0-alpha |
| **E** Nice-to-Have | Nach v2.0 final | v2.1.0+ |

## 🎨 Claude Design — Zusammenfassung Handoff-Pakete

**Paket 1 — Check-in UX (Phase B):** Edit/Delete Bottom-Sheet, VPD-Traffic-Light-Badge, Reminder-Permission-Modal.

**Paket 2 — Calc-Redesign (Phase B):** Multi-Step-Wizard oder Tab-Layout für Düngerrechner, Stretch-/EC-Richtwert-Badges.

**Paket 3 — Graphen (Phase B):** `<LineChart>` SVG-Design, Metric-Tab-Bar, Empty-State, Tooltip.

**Paket 4 — Empty-States & Illustrations (Phase B):** Einheitliche Pflanzen-SVG-Illustrationen für alle Leerzustände + Error-Page.

**Paket 5 — Touch-Target-Pass (Phase B):** Audit aller Buttons/Tap-Areas, min. 48×48px, Consistency-Pass.

**Paket 6 — Pro-Upgrade-Modal (Phase B):** Feature-Vergleichs-Modal statt Toast bei Limit.

**Paket 7 — DSGVO/Legal-Flows (Phase C):** Account-Löschen mehrstufig, Public-Toggle Privacy-Hinweis.

**Paket 8 — App-Icon & Splash (Phase C):** Adaptive Icon Set (Android 13+ Themed), Splash-Screen, Notification-Icon.

**Paket 9 — Dark-Mode (Phase D):** Vollständiges Dark-Theme-Design-Token-Set.

**Paket 10 — Tablet-Layout (Phase D):** Responsive Design-Pass für `md:`+ Breakpoints.

**Paket 11 — Share-Cards (Phase E):** Harvest-Stats als teilbare Image-Cards (1:1 + 9:16).

**Was bleibt bei Code (Claude Code Sessions):**
- Alle Phase-A-Fixes (Race-Conditions, Null-Guards, Merge, Compression, i18n)
- Store-/Backend-Logik, Supabase-Migrations, RLS
- Vitest, Logger, Deep-Links, Versioning
- Implementation der von Claude Design gelieferten Mockups

## Messbare Erfolgsziele
- Crash-Rate < 0.5% (Play Console)
- Check-in-Completion-Rate > 80% nach Onboarding
- 7-Tage Retention > 40%
- Photo-Upload < 2s für 3 Fotos (Mid-Range Android)
- Build-Size < 5 MB APK
- Lighthouse PWA Score > 90
