# Claude Design — Handoff-Paket GrowBuddy v1.3→v1.4

**Für dich, Lauri, zum Kopieren in einen neuen Claude-Chat (Design-Fokus).**
Ziel: Die visuellen/UX-Pakete aus dem Improvement-Plan umsetzen, die reinen Code-Items sind in v1.3.0 schon live.

---

## Kontext für Claude Design (einmal pasten)

```
Ich baue GrowBuddy — eine mobile-first PWA für Cannabis-Grower (Hobbyisten/Heimanbau).
Tech: SvelteKit 2 + Svelte 5 (Runes, $state/$derived/$effect), TailwindCSS 4 mit
@theme inline in src/app.css (KEINE tailwind.config!), adapter-static, Capacitor 8
Android. Repo: C:/Users/lauri/OneDrive/Desktop/growbuddy. Sprache: Deutsch primär,
EN i18n (~270 Keys in src/lib/i18n/de.ts + en.ts).

Aktueller Stand: v1.3.0 läuft auf meinem Nothing Phone 3a Pro (via ADB flashbar).
Codebase-Logik ist stabil (24 Unit-Tests grün, RLS gehärtet, Deep-Links, i18n komplett).
Was fehlt sind die VISUELLEN Pakete — da brauche ich dich.

Arbeitsweise:
- Deutsch, kurz, autonom arbeiten (keine Rückfragen bei Routine)
- Mobile-first, Touch-Targets ≥44px (min-h-11 min-w-11)
- Dark-Mode-First (App ist aktuell NUR dark — Light-Mode ist Paket #9)
- Keine externen UI-Libs (kein shadcn, kein Material) — nur Tailwind-Utility-Klassen
- Komponenten in src/lib/components/, Routes in src/routes/
- IMMER bestehende Dateien editieren, keine neuen ohne Nötigkeit
- NIE Store-State/Felder streichen — nur visuell umgruppieren
- IMMER Build nach Änderungen: cd "C:/Users/lauri/OneDrive/Desktop/growbuddy" && npm run build
- Preview via MCP: preview_start (Port 5174) → preview_screenshot
```

---

## Design-Tokens (Tailwind 4 via `@theme` in `src/app.css`)

**Wichtig:** Tailwind 4 hat **keine** `tailwind.config.js` mehr. Alle Farben/Tokens sind inline in `src/app.css` im `@theme`-Block definiert. Wenn du neue Farben brauchst, erweitere dort — nicht woanders.

```css
@theme {
  --color-gb-green:       #22c55e;  /* Primary, CTAs, Success */
  --color-gb-green-dark:  #16a34a;
  --color-gb-green-light: #4ade80;  /* Hover-State */
  --color-gb-bg:          #0a0a0a;  /* Page-Background (fast Schwarz) */
  --color-gb-surface:     #171717;  /* Card-Background */
  --color-gb-surface-2:   #262626;  /* Nested Card */
  --color-gb-border:      #333333;  /* Borders, Dividers */
  --color-gb-text:        #f5f5f5;
  --color-gb-text-muted:  #a3a3a3;  /* Labels, Sekundärtext */
  --color-gb-accent:      #a855f7;  /* Purple — Pro-Features, pH */
  --color-gb-warning:     #f59e0b;  /* Gelb — Hinweise */
  --color-gb-danger:      #ef4444;  /* Rot — Fehler, Delete */
  --color-gb-info:        #3b82f6;  /* Blau — Info */
}
```

**Nutzung:** `class="bg-gb-surface text-gb-text-muted border border-gb-border"` etc.

**Bestehende Utility-Klassen in `src/app.css`:** `.safe-bottom` (iPhone-Notch), `.skeleton` (Loading-Shimmer), globales Button-Active-Scale 0.97, Focus-Ring (2px gb-green).

---

## Svelte 5 Runes — Store-Lese-Pattern (NICHT brechen!)

Weil GrowBuddy Svelte-Stores mit Runes kombiniert, wird überall dieses Pattern genutzt. **Nicht ersetzen** durch `$:` (Legacy) oder naives `$store` — bricht den Build:

```typescript
// Store-Subscribe in Runes-Mode:
let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
let userIsPro = $derived.by(() => { let v = false; isPro.subscribe(x => v = x)(); return v; });
```

Für State/Effects:
```typescript
let count = $state(0);
let doubled = $derived(count * 2);
$effect(() => { if (count > 10) toastStore.warning('hoch'); });
```

---

## Build-Disziplin (Pflicht pro Paket)

```bash
cd "C:/Users/lauri/OneDrive/Desktop/growbuddy"
npm run build          # Vite build — MUSS grün sein
npm test               # 24 Unit-Tests
npm run check:i18n     # i18n-Vollständigkeit DE=EN
```

Wenn ein Paket durch ist: kurzer Commit mit Format `design: <paket> — <summary>`, dann APK-Test (siehe APK_INSTALL.md).

---

## ⚠️ Wichtigste Regel (Lesson-Learned aus dem ersten Versuch)

**Beim ersten Design-Refactor sind essentielle Eingabefelder in Calc und Daily Check-in verloren gegangen.** Das darf nicht wieder passieren.

- Jedes Paket listet unten eine explizite **"Felder die erhalten bleiben müssen"**-Sektion (vor allem #1 und #2).
- Dein Job ist ausschließlich **visuelles Redesign + Progressive Disclosure**, nicht Feature-Reduktion.
- Felder dürfen umgruppiert, hinter "mehr"-Toggles versteckt, als Slider/Chips/Cards statt Number-Input dargestellt werden — aber **der State (`CalcState`, Check-in-Payload) bleibt 1:1 erhalten**.
- Wenn du unsicher bist, ob ein Feld raus darf: **fragen, nicht löschen**.
- Build + Unit-Tests müssen nach jedem Paket grün sein (`cd ~/Desktop/growbuddy && npm run build && npm test`).

---

## Die 11 Design-Pakete

### 1. Check-in-UX polishing (B-Serie, visuell)
**Was fehlt:** Der Check-in-Dialog zeigt jetzt Woche/Tag auto-berechnet an ("(auto)"-Label). Visuell ist er aber noch eine Wand aus Inputs.

**⚠️ ALLE FELDER UNTEN MÜSSEN ERHALTEN BLEIBEN — NUR VISUELL UMORDNEN!**
Im ersten Design-Versuch sind essentielle Felder verloren gegangen. Keines dieser Felder darf aus dem DOM/State entfernt werden, sie dürfen nur umgruppiert oder progressiv versteckt werden:

**Header:**
- Streak-Anzeige (🔥 X-Tage · Nx XP, conditional)
- Close-Button (wenn `onCancel` gesetzt)

**Grow-Kontext (conditional):**
- Grow-Auswahl-Select (nur wenn `active.length > 1 && !growId`) — darf nicht verschwinden bei mehreren Grows!

**Foto-Block:**
- Multi-Upload (max 5 Fotos, siehe `MAX_PHOTOS`), mit Thumbnail-Grid und ✕-Button pro Foto
- Compression-State ("⏳ Verarbeite…")
- Counter "(X/5)"

**Phase/Woche/Tag (3er-Grid):**
- Phase-Select (Seedling/Veg/Bloom/Flush/Dry/Cure)
- Woche-Input (number, 1-30) mit "(auto)"-Suffix solange `!weekDayManual` — on-input setzt `weekDayManual=true`
- Tag-Input (number, 1-7) dito

**Messwerte (2er-Grid):**
- Temp °C (number, 0-50, step 0.5) — TRIGGERT VPD!
- RH % (number, 0-100, step 1) — TRIGGERT VPD!
- EC (number, dynamischer Step/Placeholder je nach Einheit) — **nur !compact**
- pH (number, 0-14, step 0.1) — **nur !compact**

**EC-Einheit-Selector (3 Chips, nur !compact):** mS/cm · ppm(500) · ppm(700) — gespeichert in localStorage `growbuddy_ec_unit`

**VPD-Anzeige (readonly, conditional):** berechnet aus Temp+RH, mit Farb-Status (optimal/warn) je nach Phase

**Toggles (nur !compact):**
- Gegossen (checkbox)
- Gedüngt (checkbox)

**Mengen (conditional & nur !compact):**
- Wasser mL (wenn `watered`, step 100)
- Dünger mL (wenn `nutrients`, step 1)

**Training-Chips (nur !compact):** LST · Topping · FIM · ScrOG · Defoliation (Single-Select, toggle-off bei Re-Klick)

**Notizen-Textarea (nur !compact):** 2 Zeilen, Placeholder "Beobachtungen…"

**Submit-Button:** Label ändert sich je nach `alreadyToday` ("Weiteren Check-in speichern" vs. "Check-in speichern")

**Compact-Mode (`compact=true`, vom Dashboard-Quick-Checkin):** blendet EC/pH/Einheit + Toggles + Mengen + Training + Notizen aus. **Der Compact-Mode bleibt und darf NICHT ersetzt werden** — er wird aus `src/routes/+page.svelte` via `<DailyCheckin compact />` genutzt.

**Design-Brief (nur visuelle Änderungen):**
- Progressive Disclosure: Foto/Phase/Temp/RH sofort sichtbar, Rest unter "Details anzeigen"-Toggle (nicht löschen, nur collapsen)
- Slider statt Number-Input für EC/pH (mit Zielbereich-Band farbig hinterlegt) — funktional identisch, nur UI-Variante
- Foto-Upload als großer Drop-Zone statt kleines File-Input (Multi-Upload-Fähigkeit erhalten!)
- "Speichern"-Button sticky unten, volle Breite

**Dateien:** `src/lib/components/DailyCheckin.svelte`, `src/routes/grow/[id]/+page.svelte` (Inline-Check-in-Block)

### 2. Calc-Redesign (Dünger-Rechner)
**Aktuell:** Einfach/Voll-Modus toggle, viele Felder.

**⚠️ ALLE FELDER UNTEN MÜSSEN ERHALTEN BLEIBEN — NUR VISUELL UMORDNEN!**
Im ersten Design-Versuch sind essentielle Felder verloren gegangen. Der CalcState (`src/lib/stores/calc.ts`) ist Vertragsgrundlage — nichts darf gestrichen werden:

**Modus-Toggle (oben rechts):**
- Einfach-Modus (⚡) / Voll-Modus (⚙️) Button — **bleibt**, steuert Progressive Disclosure
- Quickstart-Banner (nur wenn `!calcState.ever_used`)

**Immer sichtbar (Einfach- UND Voll-Modus):**
- **Feedline-Select** (mit Pro-Paywall: Free = max 2, Pro = alle) — führt `pro.limits.max_feedlines` aus
- **Phase-Select** (dynamisch je Feedline via `feedline.phasen`)
- **Woche-Select** (dynamisch je Phase via `getWochenForPhase`)
- **Tag-Select** (1–7) — **NICHT nur Woche!**
- **Reservoir-L-Input** (number, 1-1000)
- **Medium-Select** (coco · hydro · erde)

**Anbausystem (sichtbar wenn `!einfach_modus || system !== 'topf'`):**
- 4 Buttons: 🪴 Topf · 💧 AutoPot · 💧 DWC · ♻️ RDWC
- Non-Topf = Pro-Lock (disabled + opacity-50 wenn `!userIsPro`)
- Hinweistext je nach System aus i18n (`calc.system_hint_*`)

**Voll-Modus only (`!einfach_modus`, in `<details open>`-Block "⚙️ Erweiterte Optionen"):**

- **RO-Wasser-Toggle** (checkbox)
- **Stadt-Lookup**: Text-Input + Button, Enter-Submit, setzt Custom-Wasser-Werte automatisch
  - Success-Box (grün) mit Ca/Mg/EC/pH + Source-Note
  - Error-Text (rot) bei Fehler
- **Wasserprofil-Select** (aus `WASSER_PROFILE` + "Benutzerdefiniert")
- **Custom-Wasser (4-Felder-Grid, conditional wenn `wasserprofil === 'Benutzerdefiniert'`):**
  - Ca (mg/L, 0-300)
  - Mg (mg/L, 0-100)
  - EC (mS/cm, 0-3, step 0.01)
  - pH (4-9, step 0.1)
- **EC-Einheit-Selector** (3 Chips: mS/cm · ppm(500) · ppm(700))
- **Faktor-Block:**
  - Auto/Manuell-Toggle
  - Slider 20-100% (nur wenn Manuell), Anzeige rechts

**Ergebnis-Block (readonly, wenn `result` vorhanden):**
- Stretch-Hinweis (conditional)
- EC-Soll + pH-Ziel (2er-Grid, große Zahlen)
- EC-Richtwert-Warnung bei organischen Lines
- Faktor-Anzeige
- EC-Budget-Warnung (conditional)
- Dosierungen-Liste (Produktname, Schema-Menge, Tank-Menge)
- Cleanse-Eintrag (conditional)
- CalMag-Eintrag (conditional)
- Mix-Steps-Liste (nummeriert, mit Details)

**Apply-Action (bleibt zwingend!):**
- Button "🧪 Nährlösung angemischt & gegeben" — legt Check-in im gewählten Grow an
- Apply-Modal: Grow-Select + Zusammenfassung (Wasser/EC/pH/Phase/Woche/Tag) + Abbrechen/Anlegen

**Error-Block:** rote Box wenn `error` gesetzt

**Design-Brief (visuelle Neuordnung — FUNKTION bleibt!):**
- Drei-Schritt-Flow statt Monolith: (1) Wasser+Medium → (2) Feedline+Phase/Woche/Tag → (3) Ergebnis — Felder nur gruppieren, keine entfernen
- Ergebnis-Karte groß mit Copy-Button pro Zeile (Dosierungen kopierbar)
- "Quickstart"-Preset-Chips (Veg W2, Blüte W4, etc.) die `phase`+`woche`+`tag` in einem Klick setzen
- Einfach/Voll-Toggle bleibt als Top-Level-Switch

**Dateien:** `src/routes/calc/+page.svelte`, Store `src/lib/stores/calc.ts` (CalcState nicht schrumpfen!)

### 3. Grow-Verlaufs-Graphen
**Aktuell:** Check-ins sind nur Liste.
**Design-Brief:**
- Pro Grow: EC-Kurve, pH-Kurve, Temp/RH-Kurve über Zeit
- SVG-basiert (keine Chart-Lib), minimal
- Zielbereich als Band hinterlegt, Ausreißer rot
- Tap auf Punkt → zeigt zugehörigen Check-in
**Dateien:** neue Komponente `src/lib/components/GrowChart.svelte`, eingebaut in `src/routes/grow/[id]/+page.svelte`

### 4. Empty-States
**Aktuell:** Leere Listen zeigen nur "Keine Grows".
**Design-Brief:**
- Illustrationen (SVG inline, keine Assets) pro Empty-State: Grows, Check-ins, Reminders
- CTA-Button prominent ("Ersten Grow anlegen")
- Hilfetext: "Warum brauchst du das?"
**Dateien:** `src/routes/+page.svelte`, `src/routes/grow/+page.svelte`, `src/routes/tools/+page.svelte`

### 5. Touch-Target-Audit
**Aktuell:** Viele Buttons <44px.
**Design-Brief:**
- Alle interaktiven Elemente auf min-h-11 min-w-11 (44px)
- Abstände zwischen Controls ≥8px
- IconButtons bekommen `aria-label`
**Dateien:** Sweep durch `src/lib/components/*.svelte` und alle Routes

### 6. Pro-Modal (DSGVO-konformer Paywall)
**Aktuell:** Keine Pro-Features sichtbar.
**Design-Brief:**
- Modal mit 3 Pro-Benefits + Preis (Stripe-IDs in `reference_growbuddy_infra.md`)
- DSGVO: Widerruf 14 Tage, Button "Nicht jetzt" groß, X oben rechts
- Nach Kauf: Confetti + Toast + Pro-Badge im Profil
**Dateien:** neue Komponente `src/lib/components/ProModal.svelte`, Trigger aus Settings + Dashboard

### 7. DSGVO-Flows
**Was fehlt:** Datenexport + Account-Löschung + Consent-Banner
**Design-Brief:**
- Settings → Datenschutz-Block mit: "Meine Daten exportieren" (JSON-Download), "Account löschen" (2-Step-Bestätigung), "Cookie-Einstellungen"
- Beim ersten Start: Banner für optionale Telemetrie (default OFF)
**Dateien:** `src/routes/settings/+page.svelte`, neue `src/lib/utils/data-export.ts`, Consent-Store

### 8. App-Icon + Splash
**Aktuell:** Capacitor-Default.
**Design-Brief:**
- Icon: Blatt + "GB"-Monogramm, grün/dunkelgrün auf schwarz
- Adaptive Icon (Android foreground+background)
- Splash: nur Logo zentriert, dunkler Hintergrund
**Assets-Location:** `android/app/src/main/res/mipmap-*`, Capacitor splash via `resources/`

### 9. Dark-Mode durchziehen
**Aktuell:** Nur teilweise dark-safe.
**Design-Brief:**
- Alle Komponenten mit `dark:` Varianten
- Toggle in Settings (light/dark/system)
- Prefers-color-scheme als default
- Check: alle Buttons, Cards, Inputs, Modals, Toasts
**Dateien:** global in allen `*.svelte`-Files, zentraler Theme-Store in `src/lib/stores/theme.ts`

### 10. Tablet-/Landscape-Layout
**Aktuell:** Nur Portrait-Mobile optimiert.
**Design-Brief:**
- Breakpoint `md:` (768px): 2-Spalten-Layout (Liste links, Detail rechts) für Grow-Übersicht und Check-ins
- `lg:` (1024px): 3 Spalten im Dashboard
- Landscape-Portrait-Switch darf App nicht kaputt machen
**Dateien:** `src/routes/+layout.svelte`, Routes mit Listen

### 11. Share-Cards (Social)
**Aktuell:** Nix.
**Design-Brief:**
- "Grow teilen"-Button auf Grow-Detail-Seite
- Generiert PNG via Canvas mit: Strain-Name, Phase, Woche, Foto, GrowBuddy-Branding
- Teilen via Capacitor Share-API
**Dateien:** neue `src/lib/utils/share-card.ts`, Button auf `src/routes/grow/[id]/+page.svelte`

---

## Reihenfolge-Empfehlung
1. **App-Icon + Splash (#8)** — schneller Win, sichtbarster Unterschied
2. **Touch-Targets (#5)** — 1h Arbeit, massiver UX-Gewinn
3. **Empty-States (#4)** — erster Eindruck für neue User
4. **Dark-Mode (#9)** — Grundlage für alles danach
5. **Check-in-Polish (#1)** + **Calc-Redesign (#2)** — Kernflows
6. **Verlaufs-Graphen (#3)** — Killerfeature für Engagement
7. **DSGVO (#7)** vor Launch zwingend
8. **Pro-Modal (#6)** wenn Stripe-Integration sitzt
9. **Tablet-Layout (#10)** + **Share-Cards (#11)** zum Schluss

## Repo-Map (wo findet man was)

```
src/
├── app.css                      ← Tailwind 4 @theme Design-Tokens
├── app.html                     ← Shell (Meta, Favicon)
├── lib/
│   ├── components/              ← Wiederverwendbare UI (DailyCheckin, MiniChart, Lightbox, Skeleton, InstallPrompt)
│   ├── stores/                  ← Svelte-Stores (grow, auth, sync, pro, xp, toast, streak, reminders, onboarding)
│   ├── calc/                    ← Dünger-Engine (nutrients, factor, calmag, feedlines/*, schema, units)
│   ├── data/                    ← Stammdaten (science.ts: VPD-Ranges etc.)
│   ├── i18n/                    ← de.ts, en.ts (~270 Keys), index.ts (tr-Funktion)
│   └── utils/                   ← haptic, photo-compression, validation, logger, water-lookup
└── routes/
    ├── +layout.svelte           ← App-Shell: Tab-Bar, Safe-Area
    ├── +page.svelte             ← Dashboard (Quick-Checkin via <DailyCheckin compact />)
    ├── grow/                    ← +page (Liste), new/, [id]/ (Detail mit Check-in-Block)
    ├── calc/+page.svelte        ← Dünger-Rechner (Paket #2)
    ├── tools/                   ← vpd, dli, dry, doctor (Pro)
    ├── guide/                   ← ipm, training
    ├── pro/, profile/, settings/, legal/, onboarding/, auth/callback/
```

## Routen-Übersicht
| Route | Zweck | Pro-Feature? |
|-------|-------|-------------|
| `/` | Dashboard | — |
| `/grow`, `/grow/new`, `/grow/[id]` | Grows + Check-ins | — |
| `/calc` | Dünger-Rechner (2 Feedlines Free, alle mit Pro) | teilweise |
| `/tools/doctor` | AI Plant Doctor (Gemini Vision) | ja |
| `/tools/vpd`, `/dli`, `/dry` | Kleine Tools | — |
| `/guide/ipm`, `/guide/training` | Guides | — |
| `/pro` | Upgrade-Screen | — |
| `/profile`, `/settings` | XP/Achievements/Prefs/Auth | — |

## Wissenschaftliche Korrektheit (harte Regeln — nicht per Design anfassen)
- **KEIN Neem-Öl** in UI/Guides empfehlen (Azadirachtin-Rückstände)
- **IPM:** Nur Nützlinge, Bt, Spinosad, Kaliseife (nur Veg), Beauveria bassiana
- **Autos:** Nur LST — NIE Topping bei Auto-Strains vorschlagen
- Training-Chips im Check-in dürfen nicht um "Topping für Autos" erweitert werden

## Deploy (nicht dein Job — aber Context)
- **APK:** Siehe `APK_INSTALL.md` im gleichen Ordner
- **Web:** Vercel Auto-Deploy bei `git push origin master`
- **Secrets/IDs** (Supabase, Stripe, Keystore) kommen nicht in diesen Übergabeordner — die übergibt dir Lauri separat, wenn Paket #6 (Pro-Modal) oder #7 (DSGVO) dran ist.
