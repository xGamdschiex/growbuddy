/**
 * Advanced Nutrients pH Perfect Sensi — Feed Schedule 2024
 * Quelle: Offizielle AN Düngetabelle
 *
 * Produkte (alle mL/L):
 *   Sensi Grow A+B, Sensi Bloom A+B,
 *   B-52, Voodoo Juice, Big Bud, Overdrive, Bud Candy, Flawless Finish
 *
 * Besonderheit: pH Perfect Technologie — pH wird automatisch gepuffert.
 * pH-Bereich: 5.5-6.3 (wird automatisch gehalten)
 * EC: Veg 1.0-1.5, Bloom 1.4-2.2, Flush 0.0
 */

import type { FeedLine } from './types';

export const advancedSensi: FeedLine = {
  id: 'advanced-sensi',
  name: 'Advanced Nutrients Sensi pH Perfect',
  hersteller: 'Advanced Nutrients',
  typ: 'mineral',
  medien: ['hydro', 'coco', 'erde'],

  features: {
    auto_faktor: true,
    calmag_ziele: false,
    cleanse_rampe: false,
    fade: true,
    calmag_empfohlen: false, // Sensi hat bereits Ca/Mg
  },

  produkte: [
    { key: 'sensi_grow_a',  name: 'Sensi Grow A',  einheit: 'mL', pro: 'L', kategorie: 'base',       icon: 'leaf',     nur_phasen: ['Veg'] },
    { key: 'sensi_grow_b',  name: 'Sensi Grow B',  einheit: 'mL', pro: 'L', kategorie: 'base',       icon: 'leaf',     nur_phasen: ['Veg'] },
    { key: 'sensi_bloom_a', name: 'Sensi Bloom A',  einheit: 'mL', pro: 'L', kategorie: 'base',      icon: 'flower',   nur_phasen: ['Bloom'] },
    { key: 'sensi_bloom_b', name: 'Sensi Bloom B',  einheit: 'mL', pro: 'L', kategorie: 'base',      icon: 'flower',   nur_phasen: ['Bloom'] },
    { key: 'b52',           name: 'B-52',           einheit: 'mL', pro: 'L', kategorie: 'supplement', icon: 'star' },
    { key: 'voodoo_juice',  name: 'Voodoo Juice',   einheit: 'mL', pro: 'L', kategorie: 'stimulator', icon: 'sprout' },
    { key: 'big_bud',       name: 'Big Bud',        einheit: 'mL', pro: 'L', kategorie: 'booster',   icon: 'sparkles', nur_phasen: ['Bloom'] },
    { key: 'overdrive',     name: 'Overdrive',      einheit: 'mL', pro: 'L', kategorie: 'booster',   icon: 'flask',    nur_phasen: ['Bloom'] },
    { key: 'bud_candy',     name: 'Bud Candy',      einheit: 'mL', pro: 'L', kategorie: 'supplement', icon: 'flask',   nur_phasen: ['Bloom'] },
  ],

  phasen: [
    { name: 'Veg',   schema_wochen: 4, max_wochen: 8,  stretch: 'repeat_last' },
    { name: 'Bloom', schema_wochen: 8, max_wochen: 12, stretch: 'repeat_peak' },
    { name: 'Flush', schema_wochen: 1, max_wochen: 2,  stretch: 'repeat_last' },
  ],

  schema: [
    // Veg — Sensi Grow A+B immer gleiche Menge
    { phase: 'Veg', woche: 1, ec_ziel: 1.0, ph_min: 5.5, ph_max: 6.3, fmin: 50, fmax: 70,  dosierungen: { sensi_grow_a: 1.0, sensi_grow_b: 1.0, b52: 2.0, voodoo_juice: 2.0 } },
    { phase: 'Veg', woche: 2, ec_ziel: 1.2, ph_min: 5.5, ph_max: 6.3, fmin: 60, fmax: 80,  dosierungen: { sensi_grow_a: 2.0, sensi_grow_b: 2.0, b52: 2.0, voodoo_juice: 2.0 } },
    { phase: 'Veg', woche: 3, ec_ziel: 1.3, ph_min: 5.5, ph_max: 6.3, fmin: 65, fmax: 85,  dosierungen: { sensi_grow_a: 3.0, sensi_grow_b: 3.0, b52: 2.0 } },
    { phase: 'Veg', woche: 4, ec_ziel: 1.4, ph_min: 5.5, ph_max: 6.3, fmin: 70, fmax: 90,  dosierungen: { sensi_grow_a: 4.0, sensi_grow_b: 4.0, b52: 2.0 } },
    // Bloom — Sensi Bloom A+B
    { phase: 'Bloom', woche: 1, ec_ziel: 1.4, ph_min: 5.5, ph_max: 6.3, fmin: 60, fmax: 80,  dosierungen: { sensi_bloom_a: 2.0, sensi_bloom_b: 2.0, b52: 2.0, big_bud: 1.0 } },
    { phase: 'Bloom', woche: 2, ec_ziel: 1.5, ph_min: 5.5, ph_max: 6.3, fmin: 65, fmax: 85,  dosierungen: { sensi_bloom_a: 3.0, sensi_bloom_b: 3.0, b52: 2.0, big_bud: 2.0, bud_candy: 2.0 } },
    { phase: 'Bloom', woche: 3, ec_ziel: 1.7, ph_min: 5.5, ph_max: 6.3, fmin: 70, fmax: 90,  dosierungen: { sensi_bloom_a: 4.0, sensi_bloom_b: 4.0, big_bud: 2.0, bud_candy: 2.0 } },
    { phase: 'Bloom', woche: 4, ec_ziel: 1.9, ph_min: 5.5, ph_max: 6.3, fmin: 80, fmax: 100, dosierungen: { sensi_bloom_a: 4.0, sensi_bloom_b: 4.0, big_bud: 2.0, bud_candy: 2.0 } },
    { phase: 'Bloom', woche: 5, ec_ziel: 2.0, ph_min: 5.5, ph_max: 6.3, fmin: 80, fmax: 100, dosierungen: { sensi_bloom_a: 4.0, sensi_bloom_b: 4.0, big_bud: 2.0, bud_candy: 2.0 } },
    { phase: 'Bloom', woche: 6, ec_ziel: 1.8, ph_min: 5.5, ph_max: 6.3, fmin: 75, fmax: 95,  dosierungen: { sensi_bloom_a: 3.0, sensi_bloom_b: 3.0, overdrive: 2.0, bud_candy: 2.0 } },
    { phase: 'Bloom', woche: 7, ec_ziel: 1.5, ph_min: 5.5, ph_max: 6.3, fmin: 60, fmax: 80,  dosierungen: { sensi_bloom_a: 2.0, sensi_bloom_b: 2.0, overdrive: 2.0 } },
    { phase: 'Bloom', woche: 8, ec_ziel: 1.0, ph_min: 5.5, ph_max: 6.3, fmin: 40, fmax: 60,  dosierungen: { sensi_bloom_a: 1.0, sensi_bloom_b: 1.0 } },
    // Flush
    { phase: 'Flush', woche: 1, ec_ziel: 0.0, ph_min: 5.5, ph_max: 6.3, fmin: 0, fmax: 0, dosierungen: {} },
  ],

  hinweise: [
    'pH Perfect: Kein pH-Korrektur nötig — wird automatisch gepuffert.',
    'A und B Komponenten IMMER in gleicher Menge verwenden!',
    'Big Bud nur in Bloom W1-5 (Peak Flowering), dann auf Overdrive wechseln.',
    'Voodoo Juice nur in den ersten 2 Wochen verwenden.',
  ],
};
