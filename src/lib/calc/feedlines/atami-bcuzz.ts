/**
 * Atami B'cuzz Bastics — Coco Feed Schedule
 * Quelle: Atami Grow Guide "Bastics B'cuzz Coco" (Dezember 2024)
 * PDF: atami.com/wp-content/uploads/2024/12/Atami-Grow-Guide-Bastics-Bcuzz-Coco.pdf
 *
 * Phasen standardisiert: Clone → Veg → Bloom → Flush
 * (Offizielles 10-Spalten-Schema gemappt auf 4 Phasen)
 *
 * Mapping: G1-G2 → Clone, EB1-EB2 → Veg, B1-B2+ER1-ER2 → Bloom, R1 → Bloom W5, R2 → Flush
 *
 * Auto-Faktor: Mineralisch A+B System, moderate Ranges.
 * A+B reagiert gleichmäßig → engere Ranges als Athena Pulver.
 */

import type { FeedLine } from './types';

export const atamiBcuzz: FeedLine = {
  id: 'atami-bcuzz',
  name: "Atami B'cuzz Bastics Coco",
  hersteller: 'Atami',
  typ: 'mineral',
  medien: ['coco'],

  features: {
    auto_faktor: true,
    calmag_ziele: false,
    cleanse_rampe: false,
    fade: false,
    calmag_empfohlen: false,  // CalMag ist bereits als Produkt im Schema enthalten
  },

  produkte: [
    { key: 'coco_a',       name: 'Coco Nutrition A',     einheit: 'mL', pro: 'L', kategorie: 'base',       icon: 'flask' },
    { key: 'coco_b',       name: 'Coco Nutrition B',     einheit: 'mL', pro: 'L', kategorie: 'base',       icon: 'flask' },
    { key: 'calmag',       name: 'ATA CalMag',           einheit: 'mL', pro: 'L', kategorie: 'supplement', icon: 'beaker' },
    { key: 'bloombastic',  name: 'Bloombastic',          einheit: 'mL', pro: 'L', kategorie: 'booster',    icon: 'sparkles', nur_phasen: ['Veg', 'Bloom'] },
    { key: 'rokzbastic',   name: 'Rokzbastic',           einheit: 'mL', pro: 'L', kategorie: 'booster',    icon: 'star',     nur_phasen: ['Bloom'] },
    { key: 'booster_uni',  name: 'Coco Booster Uni',     einheit: 'mL', pro: 'L', kategorie: 'stimulator', icon: 'sprout',   nur_phasen: ['Clone'] },
    { key: 'bloom_stim',   name: 'Bloom Stimulator',     einheit: 'mL', pro: 'L', kategorie: 'stimulator', icon: 'flower',   nur_phasen: ['Veg', 'Bloom'] },
    { key: 'rootbastic',   name: 'Rootbastic',           einheit: 'mL', pro: 'L', kategorie: 'stimulator', icon: 'sprout',   nur_phasen: ['Clone'] },
    { key: 'silic_boost',  name: 'Silic Boost',          einheit: 'mL', pro: 'L', kategorie: 'supplement', icon: 'shield',   nur_phasen: ['Clone', 'Veg', 'Bloom'] },
    { key: 'atazyme',      name: 'Atazyme',              einheit: 'mL', pro: 'L', kategorie: 'enzyme',     icon: 'beaker' },
  ],

  phasen: [
    { name: 'Clone', schema_wochen: 2, max_wochen: 3,  stretch: 'repeat_last' },
    { name: 'Veg',   schema_wochen: 2, max_wochen: 6,  stretch: 'repeat_last' },
    { name: 'Bloom', schema_wochen: 6, max_wochen: 10, stretch: 'repeat_peak' },
    { name: 'Flush', schema_wochen: 1, max_wochen: 2,  stretch: 'repeat_last' },
  ],

  schema: [
    // ─── Clone (G1, G2) ─────────────────────────────────────
    {
      phase: 'Clone', woche: 1, ec_ziel: 1.2, ph_min: 5.5, ph_max: 6.0,
      fmin: 42, fmax: 55,
      dosierungen: {
        coco_a: 1.5, coco_b: 1.5, calmag: 0.45,
        bloombastic: 0, rokzbastic: 0,
        booster_uni: 0.5, bloom_stim: 0, rootbastic: 0.1, silic_boost: 0.1, atazyme: 0,
      },
    },
    {
      phase: 'Clone', woche: 2, ec_ziel: 1.4, ph_min: 5.5, ph_max: 6.0,
      fmin: 45, fmax: 58,
      dosierungen: {
        coco_a: 2.0, coco_b: 2.0, calmag: 0.45,
        bloombastic: 0, rokzbastic: 0,
        booster_uni: 0, bloom_stim: 0, rootbastic: 0.2, silic_boost: 0.1, atazyme: 1,
      },
    },

    // ─── Veg (EB1, EB2) ──────────────────────────────────────
    {
      phase: 'Veg', woche: 1, ec_ziel: 1.8, ph_min: 5.5, ph_max: 6.0,
      fmin: 50, fmax: 63,
      dosierungen: {
        coco_a: 2.5, coco_b: 2.5, calmag: 0.3,
        bloombastic: 0.9, rokzbastic: 0,
        booster_uni: 0, bloom_stim: 0.75, rootbastic: 0, silic_boost: 0.1, atazyme: 1,
      },
    },
    {
      phase: 'Veg', woche: 2, ec_ziel: 2.0, ph_min: 5.5, ph_max: 6.0,
      fmin: 55, fmax: 68,
      dosierungen: {
        coco_a: 2.9, coco_b: 2.9, calmag: 0.3,
        bloombastic: 0.9, rokzbastic: 0,
        booster_uni: 0, bloom_stim: 0.75, rootbastic: 0, silic_boost: 0.1, atazyme: 1,
      },
    },

    // ─── Bloom (B1, B2, ER1, ER2, R1) ───────────────────────
    {
      phase: 'Bloom', woche: 1, ec_ziel: 2.2, ph_min: 5.5, ph_max: 6.0,
      fmin: 55, fmax: 68,
      dosierungen: {
        coco_a: 2.8, coco_b: 2.8, calmag: 0.2,
        bloombastic: 0.9, rokzbastic: 0,
        booster_uni: 0, bloom_stim: 0.75, rootbastic: 0, silic_boost: 0.1, atazyme: 1,
      },
      hinweis: 'Peak Bloom — max Bloombastic',
    },
    {
      phase: 'Bloom', woche: 2, ec_ziel: 2.4, ph_min: 5.5, ph_max: 6.0,
      fmin: 60, fmax: 75,
      dosierungen: {
        coco_a: 2.7, coco_b: 2.7, calmag: 0.2,
        bloombastic: 0.45, rokzbastic: 0.45,
        booster_uni: 0, bloom_stim: 0.75, rootbastic: 0, silic_boost: 0.1, atazyme: 1,
      },
      hinweis: 'Transition: Bloombastic → Rokzbastic',
    },
    {
      phase: 'Bloom', woche: 3, ec_ziel: 2.2, ph_min: 5.5, ph_max: 6.0,
      fmin: 58, fmax: 72,
      dosierungen: {
        coco_a: 2.6, coco_b: 2.6, calmag: 0.15,
        bloombastic: 0, rokzbastic: 0.9,
        booster_uni: 0, bloom_stim: 0.75, rootbastic: 0, silic_boost: 0, atazyme: 1,
      },
    },
    {
      phase: 'Bloom', woche: 4, ec_ziel: 2.0, ph_min: 5.5, ph_max: 6.0,
      fmin: 55, fmax: 68,
      dosierungen: {
        coco_a: 2.5, coco_b: 2.5, calmag: 0.15,
        bloombastic: 0, rokzbastic: 0.9,
        booster_uni: 0, bloom_stim: 0.75, rootbastic: 0, silic_boost: 0, atazyme: 1,
      },
    },
    {
      phase: 'Bloom', woche: 5, ec_ziel: 1.8, ph_min: 5.5, ph_max: 6.0,
      fmin: 48, fmax: 62,
      dosierungen: {
        coco_a: 2.5, coco_b: 2.5, calmag: 0.15,
        bloombastic: 0, rokzbastic: 0.9,
        booster_uni: 0, bloom_stim: 0.75, rootbastic: 0, silic_boost: 0, atazyme: 1,
      },
      hinweis: 'Ripening — Dosierung reduzieren',
    },
    {
      phase: 'Bloom', woche: 6, ec_ziel: 0.8, ph_min: 5.5, ph_max: 6.0,
      fmin: 35, fmax: 50,
      dosierungen: {
        coco_a: 1.0, coco_b: 1.0, calmag: 0.1,
        bloombastic: 0, rokzbastic: 0,
        booster_uni: 0, bloom_stim: 0, rootbastic: 0, silic_boost: 0, atazyme: 0.5,
      },
      hinweis: 'Spät-Ripening — nur Base minimal',
    },

    // ─── Flush ───────────────────────────────────────────────
    {
      phase: 'Flush', woche: 1, ec_ziel: 0.0, ph_min: 5.5, ph_max: 6.0,
      fmin: 0, fmax: 0,
      dosierungen: {
        coco_a: 0, coco_b: 0, calmag: 0,
        bloombastic: 0, rokzbastic: 0,
        booster_uni: 0, bloom_stim: 0, rootbastic: 0, silic_boost: 0, atazyme: 0,
      },
      hinweis: 'Flush — nur Wasser',
    },
  ],

  hinweise: [
    'A+B IMMER im gleichen Verhältnis 1:1 dosieren!',
    'ATA CalMag ZUERST ins Wasser, dann A, dann B',
    'Bloombastic und Rokzbastic NIE gleichzeitig verwenden',
    'Bloombastic: Veg bis Bloom W1',
    'Rokzbastic: Ab Bloom W2 bis W5',
    'Dosierungen sind Midpoints der offiziellen Ranges',
  ],
};
