# Source-Upload für Claude Design

**Zweck:** Diesen Ordner als Ganzes in das Claude-Design-Projekt (claude.ai/design) ziehen → "DROP FILES HERE". Alle Files bleiben dann als Kontext für Sketches/Mockups gespeichert.

## Was ist drin

| Datei (hier) | Original-Pfad im Repo | Zweck |
|---|---|---|
| `app.css` | `src/app.css` | **Design-Tokens** (Tailwind 4 `@theme` inline): `gb-green`, `gb-bg`, `gb-surface`, `gb-accent` etc. Plus Base-Styles, Animations, Skeleton-Loader. |
| `DailyCheckin.svelte` | `src/lib/components/DailyCheckin.svelte` | **Paket #1 — Check-in-UX.** Vollständige Komponente mit allen Feldern: Foto-Upload (max 5), Phase/Woche/Tag (auto), Temp/RH, EC+Einheit, pH, Toggles, Training-Chips, Notizen, VPD-Anzeige, Compact-Mode. |
| `calc_+page.svelte` | `src/routes/calc/+page.svelte` | **Paket #2 — Calc-Redesign.** Einfach/Voll-Modus, Feedline-Select, Phase/Woche/Tag, Reservoir, Medium, Anbausystem, RO, Stadt-Lookup, Custom-Wasser, EC-Einheit, Faktor, Ergebnis-Block, Apply-als-Check-in-Modal. |
| `calc_store.ts` | `src/lib/stores/calc.ts` | **`CalcState`-Typ** — maßgebender Datenvertrag für Paket #2. Keine Felder streichen beim Redesign! |
| `grow_store.ts` | `src/lib/stores/grow.ts` | **`Grow` + Check-in-Payload** (`growStore.addCheckIn(...)`-Signatur) — maßgebender Datenvertrag für Paket #1. |
| `i18n_de.ts` | `src/lib/i18n/de.ts` | Alle deutschen UI-Strings. Labels die du im Design siehst stammen hier — beim Neudesign ggf. Key-Namen referenzieren statt neuer Texte. |

## Wichtige Hinweise für den Design-Chat

1. **Tailwind 4 ohne config.js** — Design-Tokens sind **inline in `app.css`** via `@theme`. Keine `tailwind.config.js` anlegen!

2. **Svelte 5 Runes-Pattern** — Store-Zugriff erfolgt im Code über:
   ```ts
   let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
   ```
   Für HTML-Mockups (Option B) irrelevant — beim späteren Svelte-Port durch Claude Code CLI aber zwingend beibehalten.

3. **Felder NICHT löschen** — Der Haupt-Handoff [`../CLAUDE_DESIGN_HANDOFF.md`](../CLAUDE_DESIGN_HANDOFF.md) listet pro Paket explizit welche Felder erhalten bleiben müssen. Progressive Disclosure + Slider/Chips sind erwünscht, Feature-Reduktion nicht.

4. **Dark-Mode-First** — App ist aktuell komplett dark (`gb-bg = #0a0a0a`). Light-Mode kommt erst in Paket #9.

5. **Dateinamen hier haben Unterstriche** (z.B. `calc_+page.svelte`) weil manche Upload-Tools `+` nicht mögen. Original heißen sie im Repo anders — nicht durcheinanderkommen beim späteren Port.

## Workflow-Empfehlung

1. **Claude Design** → HTML-Mockups für jeweils ein Paket (Option B aus eurem Chat)
2. Visuell reviewen (Screenshot reicht)
3. Mockup-HTML + Spec an **Claude Code CLI** (zweites Terminal im GrowBuddy-Repo) übergeben
4. Claude Code portiert nach Svelte 5 Runes + baut + testet
5. APK flashen via `APK_INSTALL.md` Cheatsheet
