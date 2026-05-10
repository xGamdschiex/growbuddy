# GrowBuddy — Play Store Screenshots Plan

> **Ziel:** 5-7 Phone-Screenshots (1080x1920 oder höher), die GrowBuddy-Mehrwert
> in 3 Sekunden erfassbar machen. Mit Demo-Daten gemacht (Profil → Demo laden).

## Setup vor Screenshot-Session

1. **Demo-Daten laden** (Profil → 🎬 Demo laden)
   → 35-Tage-Grow "Demo Mary Jane" + 14 Check-ins (Veg + Bloom)
2. **Status-Bar in Statusleisten-Mode** (Battery 100%, Uhr 9:41 oder 12:00, kein Notification)
3. **Dark Mode aktiv** (Standard)
4. **Sprache:** Deutsch (für DE-Listing) + zusätzlich Englisch (für EN-Listing)
5. **Demo-Banner ausblenden** mit `growStore.clearDemo()` für 1-2 Screenshots
   → Sonst sieht jeder Screenshot orange-Banner oben

## Screenshot-Liste

### #1 — Dashboard mit Active-Grow (Hero-Shot)
**Route:** `/`
**Was zeigen:** Hero-Active-Grow-Card mit Phase-Badge, Streak-Anzeige, Quick-Stats
**Caption-Idee:** "Behalte deine Grows im Blick — Phase, Streak, Stats auf einen Blick"

### #2 — Grow-Detail mit Phase-Hero
**Route:** `/grow/[demo-grow-id]`
**Was zeigen:** Phase-Hero-Card (Bloom W3 · Tag 14), Charts, Foto-Galerie
**Caption-Idee:** "Detaillierte Grow-Historie mit Charts und Foto-Galerie"

### #3 — Calc mit Feedline + Mix-Steps
**Route:** `/calc`
**Setup:** Feedline = "Athena Pro Line", Phase = Bloom W5, Reservoir 10L
**Was zeigen:** Feedline-Auswahl, EC-Soll, Mix-Steps (Wasser → CalMag → Pulver)
**Caption-Idee:** "8 Düngerlinien — präzise berechnet pro Phase und Woche"

### #4 — Daily-Checkin (Modal)
**Route:** `/grow/[id]` → Check-in tippen
**Was zeigen:** Foto + Temp/RH + EC/pH + VPD-Gauge (live calculated)
**Caption-Idee:** "Daily Check-in mit VPD-Live-Berechnung — wissenschaftlich fundiert"

### #5 — Insights / Pro Strain
**Route:** `/insights` (mit Demo-Daten + paar manuellen weiteren Grows)
**Was zeigen:** Strain-Stats, Yield-Trends, Phase-Verteilung
**Caption-Idee:** "Lerne aus deinen Grows — Statistiken pro Strain und Phase"

### #6 — Feed (Community)
**Route:** `/feed`
**Setup:** Mind. 3-4 Public-Posts anderer User (Demo-Posts ggf. seeden)
**Was zeigen:** Public-Posts mit Foto, Username, Phase, Like-Button
**Caption-Idee:** "Tausch dich aus — Community-Feed mit anderen Growern"

### #7 — Profile mit Achievements
**Route:** `/profile`
**Was zeigen:** Level-Card, Stats (Grows/Harvests/Check-ins), Achievement-Grid
**Caption-Idee:** "Gamification — XP, Achievements, Streak-Multiplier"

## Optional (wenn Platz im Listing)

### #8 — Backup/Restore (Daten-Hoheit)
**Route:** `/profile` → Daten-Section
**Was zeigen:** Export/Import-Buttons + Demo-Daten-Status
**Caption-Idee:** "Deine Daten gehören dir — JSON-Export jederzeit"

## Tools

- **Android Studio Screenshot-Tool** (cleanstest, 1080x1920 nativ)
- **ADB:** `adb -s 192.168.2.62:5555 shell screencap /sdcard/screen.png && adb pull /sdcard/screen.png`
- **Cropping:** keine Cropping nötig wenn Device-Frame entfernt
- **Annotation:** Optional Caption-Overlay mit Figma/Affinity (3-Wort-Hooks)

## Workflow

1. Demo laden (Profil)
2. Screenshot #1-#3 mit Demo-Banner OFF (clearDemo + reload)
3. Screenshot #4-#5 mit Demo-Banner ON (zeigt Beta-Status für Tester-Track)
4. Sprache auf EN umstellen, Wiederholung für EN-Listing
5. Cropping: Status-Bar drinnen lassen (kann Battery 100% zeigen — wirkt clean)
6. Export als PNG, dateinamenschema: `gb_de_01_dashboard.png`

## Open Questions

- [ ] Soll Demo-Banner in Screenshots sichtbar sein? (Pro: Beta-Transparenz · Con: wirkt nicht-finished)
- [ ] Username-Beispiel für Profile-Shot? (z.B. "growmaster_de")
- [ ] Feature-Graphic 1024x500 (Headline-Banner für Store): braucht Marketing-Asset-Designer
- [ ] App-Icon final festgelegt? (Adaptive Icon-Set)
