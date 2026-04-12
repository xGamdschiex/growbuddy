# GrowBuddy — Projektregeln

## Verhaltensregeln

- Mach was gefragt wird, nicht mehr
- NIE Dateien erstellen die nicht nötig sind
- IMMER bestehende Dateien editieren statt neue zu erstellen
- NIE Doku/README erstellen ohne Aufforderung
- IMMER Datei lesen vor dem Editieren
- NIE Secrets/Credentials committen
- Sprache: Deutsch, kurz und knapp
- Autonom arbeiten, keine Rückfragen — nach bestem Wissen vorgehen

## App Tech-Stack

- SvelteKit 2 + Svelte 5 (Runes: `$state`, `$derived`, `$effect`)
- Tailwind CSS 4, TypeScript, adapter-static
- PWA mit manifest.json + Service Worker
- Backend: Supabase (Auth, DB, Storage) — wird in Phase 2 integriert
- AI: Gemini API (Pflanzen-Diagnose) — wird in Phase 3 integriert
- Build: `cd /path/to/growbuddy && npm run build`
- Dev: `cd /path/to/growbuddy && npm run dev`

## Wissenschaftliche Korrektheit

- KEIN Neem-Öl empfehlen (Azadirachtin-Rückstände bei Consumables)
- IPM: Nur Nützlinge, Bt, Spinosad, Kaliseife (nur Veg), Beauveria bassiana
- VPD/DLI/pH/EC: Immer phasen- und medium-spezifisch
- Trocknung: 18-21°C, 55-62% RH, 10-14 Tage
- Training: Autos NUR LST — kein Topping bei Autos empfehlen
- Im Zweifelsfall: lieber keine Empfehlung als eine falsche

## Build & Test

```bash
npm run build
npm run dev
```

## Parallelisierung

- Alle unabhängigen Operationen parallel in EINER Message
- Alle File-Reads/Writes/Edits gebündelt

## Codebase-Map

### Calc-Engine (`src/lib/calc/`)
Portiert aus AutoPot Athena — 6 Feedlines, generisches FeedLine-Interface.
| File | Zweck |
|------|-------|
| `nutrients.ts` | Haupt-Berechnung: EC, pH, Dosierungen, Mix-Steps |
| `factor.ts` | Auto-Faktor Interpolation (fmin→fmax, glatte Wochengrenzen) |
| `calmag.ts` | CalMag Ca-First-Logik |
| `schema.ts` | Wasserprofile, Produkte |
| `units.ts` | EC-Einheiten Umrechnung |
| `feedlines/` | Athena Pro, BioBizz, GH Feeding (×3), Atami B'Cuzz |

### Science Data (`src/lib/data/`)
| File | Zweck |
|------|-------|
| `science.ts` | VPD, DLI, pH, EC, Nährstoff-Mobilität, Trocknung, Training |
| `ipm.ts` | 8 Schädlinge/Krankheiten mit Lösungen (keine Neem!) |

### Routen
| Route | Zweck |
|-------|-------|
| `/` | Dashboard |
| `/grow` | Grow-Liste |
| `/calc` | Düngerrechner |
| `/tools` | Tool-Übersicht |
| `/tools/vpd` | VPD-Rechner |
| `/tools/dli` | DLI-Rechner |
| `/profile` | XP, Level, Achievements |
