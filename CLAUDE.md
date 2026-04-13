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
- Tailwind CSS 4 mit `@theme` Design-Tokens (gb-green, gb-surface, gb-bg etc.)
- TypeScript, adapter-static, Vercel Deploy
- PWA mit manifest.json + Service Worker (stale-while-revalidate)
- Supabase: Auth (Magic Link + Google OAuth) + DB (grows, checkins mit RLS)
- Gemini 2.0 Flash: AI Plant Doctor (Vision API, Pro-Feature)
- Stripe: Payment Links für Pro-Abo (4.99€/mo, 39.99€/yr)
- Capacitor: Für zukünftige Android APK

## Store-Pattern (Svelte 5 Runes)

```typescript
// So werden Svelte Stores in Runes-Mode gelesen:
let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
let userIsPro = $derived.by(() => { let v = false; isPro.subscribe(x => v = x)(); return v; });
```

## Wissenschaftliche Korrektheit

- KEIN Neem-Öl empfehlen (Azadirachtin-Rückstände bei Consumables)
- IPM: Nur Nützlinge, Bt, Spinosad, Kaliseife (nur Veg), Beauveria bassiana
- VPD/DLI/pH/EC: Immer phasen- und medium-spezifisch
- Trocknung: 18-21°C, 55-62% RH, 10-14 Tage
- Training: Autos NUR LST — kein Topping bei Autos empfehlen
- Im Zweifelsfall: lieber keine Empfehlung als eine falsche

## Build & Test

```bash
cd "C:/Users/lauri/OneDrive/Desktop/growbuddy" && npm run build
cd "C:/Users/lauri/OneDrive/Desktop/growbuddy" && npm run dev
```

- IMMER nach Änderungen Build prüfen
- Bei UI-Änderungen: Preview MCP nutzen (preview_start → preview_screenshot)
- Preview Port: 5174 (launch.json config "growbuddy" im Claude-sheet Projekt)

## Deploy

```bash
cd "C:/Users/lauri/OneDrive/Desktop/growbuddy" && vercel --prod
```

Git: `git push origin master` → Vercel baut automatisch

## Parallelisierung

- Alle unabhängigen Operationen parallel in EINER Message
- Alle File-Reads/Writes/Edits gebündelt

## Codebase-Map

### Stores (`src/lib/stores/`)
| File | Export | Zweck |
|------|--------|-------|
| `grow.ts` | `growStore`, `activeGrows`, `harvestedGrows` | Grows + Check-ins (localStorage) |
| `auth.ts` | `authStore`, `isLoggedIn`, `currentUser` | Supabase Auth (Magic Link + Google) |
| `sync.ts` | `syncStore`, `syncStatus` | Cloud-Sync Push/Pull zu Supabase |
| `pro.ts` | `proStore`, `isPro`, `limits`, `TIER_LIMITS` | Free/Pro/CSC Tier-System |
| `xp.ts` | `xpStore`, `currentLevel`, `xpProgress` | XP, Level, Achievements |
| `toast.ts` | `toastStore` | UI-Notifications |
| `onboarding.ts` | `onboardingStore` | Onboarding-Flow State |
| `reminders.ts` | `reminderStore` | Check-in Erinnerungen |

### Calc-Engine (`src/lib/calc/`)
| File | Zweck |
|------|-------|
| `nutrients.ts` | Haupt-Berechnung: EC, pH, Dosierungen, Mix-Steps |
| `factor.ts` | Auto-Faktor Interpolation (fmin→fmax) |
| `calmag.ts` | CalMag Ca-First-Logik |
| `feedlines/` | Athena Pro, BioBizz, GH Feeding (×3), Atami B'Cuzz |

### Routen
| Route | Zweck |
|-------|-------|
| `/` | Dashboard (Quick Actions, Active Grows) |
| `/grow` | Grow-Liste + `/grow/new` + `/grow/[id]` |
| `/calc` | Düngerrechner (Pro-Gate: max 2 Feedlines free) |
| `/tools` | Tool-Übersicht |
| `/tools/vpd` | VPD-Rechner |
| `/tools/dli` | DLI-Rechner |
| `/tools/dry` | Trocknungs-Timer |
| `/tools/doctor` | AI Plant Doctor (Pro-Feature) |
| `/guide/ipm` | IPM Guide (8 Schädlinge, kein Neem) |
| `/guide/training` | Training Guide (7 Techniken) |
| `/pro` | Pro-Abo + Beta-Code (GROWBUDDY2026) |
| `/profile` | XP, Achievements, Settings, Auth, Cloud-Sync |
| `/auth/callback` | OAuth Redirect Handler |
| `/onboarding` | 4 Slides + Experience + Goal |
| `/legal` | Impressum + Datenschutz |

### i18n (`src/lib/i18n/`)
- `de.ts` + `en.ts`: ~270 Keys, `tr()` Funktion via `$derived`
- Locale in localStorage (`growbuddy_locale`)
