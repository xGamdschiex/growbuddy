/**
 * Green House Powder Feeding -- Feed Schedules
 * Quelle: Green House Seed Company (greenhousefeeding.com)
 * Daten: Offizielle Mineral Line Soil Feeding Charts (globalgarden.co / led-grower.eu)
 *        Konvertiert von g/gal -> g/L (1 US gal = 3.785 L)
 *
 * DREI Sub-Lines:
 * 1. ghHybrids        -- Hybrids (NPK 15-7-22+3.6Mg) fuer 8-10W Bluete
 * 2. ghShortFlowering -- Short Flowering (NPK 16-6-26) fuer kurze Bluete (6-8W)
 * 3. ghGrow           -- Grow (NPK 24-6-12) fuer reine Veg / Mutterpflanzen
 *
 * Phasen standardisiert: Veg → Bloom → Flush (kein Clone bei GH)
 * Ripen wird als letzte Bloom-Woche modelliert (repeat_peak schützt Peak)
 *
 * Auto-Faktor: Mineralisch, Pulver löst sich langsam → moderate Ranges.
 * Engere Ranges als Athena weil niedrigere EC-Ziele.
 */

import type { FeedLine } from './types';

// ─── HYBRIDS (Haupt-Line fuer 8-10W Bluete-Strains) ─────────────────────

export const ghHybrids: FeedLine = {
  id: 'gh-hybrids',
  name: 'GH Powder Feeding — Hybrids',
  hersteller: 'Green House Seed Co.',
  typ: 'mineral',
  medien: ['hydro', 'coco', 'erde'],

  features: {
    auto_faktor: true,
    calmag_ziele: false,
    cleanse_rampe: false,
    fade: false,
    calmag_empfohlen: true,
  },

  produkte: [
    { key: 'hybrids',   name: 'Hybrids (15-7-22)',     einheit: 'g', pro: 'L', kategorie: 'base',       icon: 'scale' },
    { key: 'calcium',   name: 'Calcium',                einheit: 'g', pro: 'L', kategorie: 'supplement', icon: 'beaker' },
    { key: 'booster',   name: 'Booster PK+ (0-30-27)',  einheit: 'g', pro: 'L', kategorie: 'booster',    icon: 'sparkles', nur_phasen: ['Bloom'] },
    { key: 'enhancer',  name: 'Enhancer',               einheit: 'g', pro: 'L', kategorie: 'stimulator', icon: 'sprout' },
  ],

  phasen: [
    { name: 'Veg',   schema_wochen: 3, max_wochen: 6,  stretch: 'repeat_last' },
    { name: 'Bloom', schema_wochen: 8, max_wochen: 12, stretch: 'repeat_peak' },
    { name: 'Flush', schema_wochen: 1, max_wochen: 2,  stretch: 'repeat_last' },
  ],

  schema: [
    // ─── Veg ─────────────────────────────────────────────────
    {
      phase: 'Veg', woche: 1, ec_ziel: 1.0, ph_min: 6.0, ph_max: 6.5,
      fmin: 45, fmax: 58,
      dosierungen: { hybrids: 0.55, calcium: 0.50, booster: 0, enhancer: 0.5 },
      hinweis: 'Seedling / Jungpflanze',
    },
    {
      phase: 'Veg', woche: 2, ec_ziel: 1.2, ph_min: 6.0, ph_max: 6.5,
      fmin: 50, fmax: 63,
      dosierungen: { hybrids: 0.61, calcium: 0.79, booster: 0, enhancer: 0.5 },
    },
    {
      phase: 'Veg', woche: 3, ec_ziel: 1.4, ph_min: 6.0, ph_max: 6.5,
      fmin: 55, fmax: 68,
      dosierungen: { hybrids: 0.66, calcium: 1.0, booster: 0, enhancer: 0.5 },
      hinweis: 'Letzte Veg-Woche, Umstellung auf 12/12',
    },

    // ─── Bloom ───────────────────────────────────────────────
    {
      phase: 'Bloom', woche: 1, ec_ziel: 1.4, ph_min: 6.0, ph_max: 6.5,
      fmin: 50, fmax: 63,
      dosierungen: { hybrids: 0.69, calcium: 1.0, booster: 0.34, enhancer: 0.5 },
      hinweis: 'Stretch-Phase, Booster PK+ Start',
    },
    {
      phase: 'Bloom', woche: 2, ec_ziel: 1.5, ph_min: 6.0, ph_max: 6.5,
      fmin: 55, fmax: 68,
      dosierungen: { hybrids: 0.79, calcium: 1.0, booster: 0.34, enhancer: 0.5 },
    },
    {
      phase: 'Bloom', woche: 3, ec_ziel: 1.5, ph_min: 6.0, ph_max: 6.5,
      fmin: 58, fmax: 72,
      dosierungen: { hybrids: 0.79, calcium: 1.0, booster: 0.40, enhancer: 0.5 },
    },
    {
      phase: 'Bloom', woche: 4, ec_ziel: 1.5, ph_min: 6.0, ph_max: 6.5,
      fmin: 62, fmax: 76,
      dosierungen: { hybrids: 0.61, calcium: 1.0, booster: 0.50, enhancer: 0 },
      hinweis: 'Booster PK+ Peak',
    },
    {
      phase: 'Bloom', woche: 5, ec_ziel: 1.5, ph_min: 6.0, ph_max: 6.5,
      fmin: 62, fmax: 76,
      dosierungen: { hybrids: 0.61, calcium: 1.0, booster: 0.50, enhancer: 0 },
    },
    {
      phase: 'Bloom', woche: 6, ec_ziel: 1.6, ph_min: 6.0, ph_max: 6.5,
      fmin: 65, fmax: 78,
      dosierungen: { hybrids: 0.61, calcium: 1.0, booster: 0.61, enhancer: 0 },
      hinweis: 'Booster PK+ Maximum',
    },
    {
      phase: 'Bloom', woche: 7, ec_ziel: 1.7, ph_min: 6.0, ph_max: 6.5,
      fmin: 58, fmax: 72,
      dosierungen: { hybrids: 0.50, calcium: 1.29, booster: 0.50, enhancer: 0 },
      hinweis: 'Letzte volle Bloom-Woche, Calcium erhöhen',
    },
    {
      phase: 'Bloom', woche: 8, ec_ziel: 1.4, ph_min: 6.0, ph_max: 6.5,
      fmin: 40, fmax: 55,
      dosierungen: { hybrids: 0.40, calcium: 0.79, booster: 0, enhancer: 0 },
      hinweis: 'Ripen — minimale Düngung, Reifung',
    },

    // ─── Flush ───────────────────────────────────────────────
    {
      phase: 'Flush', woche: 1, ec_ziel: 0.0, ph_min: 6.0, ph_max: 6.5,
      fmin: 0, fmax: 0,
      dosierungen: { hybrids: 0, calcium: 0, booster: 0, enhancer: 0 },
      hinweis: 'Nur Wasser, 7-14 Tage',
    },
  ],

  hinweise: [
    'Hybrids-Pulver (NPK 15-7-22) für den gesamten Zyklus verwenden',
    'Calcium bei weichem Wasser / RO / Coco immer hinzufügen',
    'Booster PK+ (0-30-27) nur in Bloom W1-W7',
    'Enhancer: 0.5 g/L alle 2 Wochen, Veg bis Bloom W3',
    'Bei RO-Wasser: Zuerst Calcium bis EC 0.3-0.4, dann Hauptprodukt',
  ],
};

// ─── SHORT FLOWERING (6-8W Bluete, z.B. Indica-dominant) ────────────────

export const ghShortFlowering: FeedLine = {
  id: 'gh-short-flowering',
  name: 'GH Powder Feeding — Short Flowering',
  hersteller: 'Green House Seed Co.',
  typ: 'mineral',
  medien: ['hydro', 'coco', 'erde'],

  features: {
    auto_faktor: true,
    calmag_ziele: false,
    cleanse_rampe: false,
    fade: false,
    calmag_empfohlen: true,
  },

  produkte: [
    { key: 'short_fl',  name: 'Short Flowering (16-6-26)', einheit: 'g', pro: 'L', kategorie: 'base',       icon: 'scale' },
    { key: 'calcium',   name: 'Calcium',                    einheit: 'g', pro: 'L', kategorie: 'supplement', icon: 'beaker' },
    { key: 'booster',   name: 'Booster PK+ (0-30-27)',      einheit: 'g', pro: 'L', kategorie: 'booster',    icon: 'sparkles', nur_phasen: ['Bloom'] },
    { key: 'enhancer',  name: 'Enhancer',                   einheit: 'g', pro: 'L', kategorie: 'stimulator', icon: 'sprout' },
  ],

  phasen: [
    { name: 'Veg',   schema_wochen: 2, max_wochen: 4,  stretch: 'repeat_last' },
    { name: 'Bloom', schema_wochen: 7, max_wochen: 10, stretch: 'repeat_peak' },
    { name: 'Flush', schema_wochen: 1, max_wochen: 2,  stretch: 'repeat_last' },
  ],

  schema: [
    // ─── Veg ─────────────────────────────────────────────────
    {
      phase: 'Veg', woche: 1, ec_ziel: 1.0, ph_min: 6.0, ph_max: 6.5,
      fmin: 45, fmax: 58,
      dosierungen: { short_fl: 0.55, calcium: 0.50, booster: 0, enhancer: 0.5 },
    },
    {
      phase: 'Veg', woche: 2, ec_ziel: 1.2, ph_min: 6.0, ph_max: 6.5,
      fmin: 50, fmax: 63,
      dosierungen: { short_fl: 0.61, calcium: 0.79, booster: 0, enhancer: 0.5 },
      hinweis: 'Umstellung auf 12/12',
    },

    // ─── Bloom ───────────────────────────────────────────────
    {
      phase: 'Bloom', woche: 1, ec_ziel: 1.4, ph_min: 6.0, ph_max: 6.5,
      fmin: 50, fmax: 63,
      dosierungen: { short_fl: 0.66, calcium: 1.0, booster: 0.21, enhancer: 0.5 },
      hinweis: 'Stretch, Booster PK+ Start',
    },
    {
      phase: 'Bloom', woche: 2, ec_ziel: 1.4, ph_min: 6.0, ph_max: 6.5,
      fmin: 55, fmax: 68,
      dosierungen: { short_fl: 0.69, calcium: 1.0, booster: 0.34, enhancer: 0.5 },
    },
    {
      phase: 'Bloom', woche: 3, ec_ziel: 1.5, ph_min: 6.0, ph_max: 6.5,
      fmin: 58, fmax: 72,
      dosierungen: { short_fl: 0.79, calcium: 1.0, booster: 0.40, enhancer: 0 },
      hinweis: 'Peak Feeding',
    },
    {
      phase: 'Bloom', woche: 4, ec_ziel: 1.5, ph_min: 6.0, ph_max: 6.5,
      fmin: 62, fmax: 76,
      dosierungen: { short_fl: 0.79, calcium: 1.0, booster: 0.50, enhancer: 0 },
      hinweis: 'Booster PK+ Peak',
    },
    {
      phase: 'Bloom', woche: 5, ec_ziel: 1.6, ph_min: 6.0, ph_max: 6.5,
      fmin: 58, fmax: 72,
      dosierungen: { short_fl: 0.69, calcium: 1.0, booster: 0.40, enhancer: 0 },
    },
    {
      phase: 'Bloom', woche: 6, ec_ziel: 1.5, ph_min: 6.0, ph_max: 6.5,
      fmin: 50, fmax: 65,
      dosierungen: { short_fl: 0.61, calcium: 1.0, booster: 0.50, enhancer: 0 },
      hinweis: 'Letzte Bloom-Woche',
    },
    {
      phase: 'Bloom', woche: 7, ec_ziel: 1.4, ph_min: 6.0, ph_max: 6.5,
      fmin: 40, fmax: 55,
      dosierungen: { short_fl: 0.50, calcium: 0.79, booster: 0, enhancer: 0 },
      hinweis: 'Ripen — minimale Düngung',
    },

    // ─── Flush ───────────────────────────────────────────────
    {
      phase: 'Flush', woche: 1, ec_ziel: 0.0, ph_min: 6.0, ph_max: 6.5,
      fmin: 0, fmax: 0,
      dosierungen: { short_fl: 0, calcium: 0, booster: 0, enhancer: 0 },
      hinweis: 'Nur Wasser, 7-14 Tage',
    },
  ],

  hinweise: [
    'Short Flowering Pulver (NPK 16-6-26) für den gesamten Zyklus',
    'Für Indica-dominante Strains mit 6-8 Wochen Blüte',
    'Calcium bei weichem Wasser / RO / Coco immer hinzufügen',
    'Booster PK+ nur in Bloom W1-W6',
  ],
};

// ─── GROW (reine Veg-Line, Mutterpflanzen / lange Veg) ──────────────────

export const ghGrow: FeedLine = {
  id: 'gh-grow',
  name: 'GH Powder Feeding — Grow',
  hersteller: 'Green House Seed Co.',
  typ: 'mineral',
  medien: ['hydro', 'coco', 'erde'],

  features: {
    auto_faktor: true,
    calmag_ziele: false,
    cleanse_rampe: false,
    fade: false,
    calmag_empfohlen: true,
  },

  produkte: [
    { key: 'grow',     name: 'Grow (24-6-12)',  einheit: 'g', pro: 'L', kategorie: 'base',       icon: 'scale' },
    { key: 'calcium',  name: 'Calcium',         einheit: 'g', pro: 'L', kategorie: 'supplement', icon: 'beaker' },
    { key: 'enhancer', name: 'Enhancer',        einheit: 'g', pro: 'L', kategorie: 'stimulator', icon: 'sprout' },
  ],

  phasen: [
    { name: 'Clone', schema_wochen: 2, max_wochen: 3,  stretch: 'repeat_last' },
    { name: 'Veg',   schema_wochen: 4, max_wochen: 52, stretch: 'repeat_last' },
  ],

  schema: [
    // ─── Clone ───────────────────────────────────────────────
    {
      phase: 'Clone', woche: 1, ec_ziel: 0.4, ph_min: 6.0, ph_max: 6.5,
      fmin: 40, fmax: 55,
      dosierungen: { grow: 0.25, calcium: 0, enhancer: 0.5 },
    },
    {
      phase: 'Clone', woche: 2, ec_ziel: 0.6, ph_min: 6.0, ph_max: 6.5,
      fmin: 45, fmax: 58,
      dosierungen: { grow: 0.35, calcium: 0.30, enhancer: 0.5 },
    },

    // ─── Veg ─────────────────────────────────────────────────
    {
      phase: 'Veg', woche: 1, ec_ziel: 1.0, ph_min: 6.0, ph_max: 6.5,
      fmin: 50, fmax: 63,
      dosierungen: { grow: 0.50, calcium: 0.50, enhancer: 0.5 },
    },
    {
      phase: 'Veg', woche: 2, ec_ziel: 1.2, ph_min: 6.0, ph_max: 6.5,
      fmin: 55, fmax: 68,
      dosierungen: { grow: 0.65, calcium: 0.75, enhancer: 0.5 },
    },
    {
      phase: 'Veg', woche: 3, ec_ziel: 1.4, ph_min: 6.0, ph_max: 6.5,
      fmin: 58, fmax: 72,
      dosierungen: { grow: 0.80, calcium: 1.0, enhancer: 0.5 },
    },
    {
      phase: 'Veg', woche: 4, ec_ziel: 1.4, ph_min: 6.0, ph_max: 6.5,
      fmin: 60, fmax: 75,
      dosierungen: { grow: 1.0, calcium: 1.0, enhancer: 0.5 },
      hinweis: 'Maximale Veg-Dosierung',
    },
  ],

  hinweise: [
    'Grow-Pulver (NPK 24-6-12) NUR für Vegetationsphase',
    'Ideal für Mutterpflanzen oder lange Veg-Phasen',
    'Wechsel zu Hybrids / Short Flowering bei Bloom-Start',
    'Calcium bei weichem Wasser / RO / Coco hinzufügen',
  ],
};
