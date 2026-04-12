/**
 * CANNA Terra/Coco — Feed Schedule 2024
 * Quelle: Offizielle CANNA Düngetabelle
 *
 * Produkte (alle mL/L):
 *   Terra Vega, Terra Flores (Erde)
 *   Coco A+B (Coco)
 *   Rhizotonic, Cannazym, Boost, PK 13-14
 *
 * pH: Erde 6.0-6.5, Coco 5.5-6.2
 * EC: Veg 1.0-1.4, Bloom 1.4-2.0, Flush 0.0
 */

import type { FeedLine } from './types';

export const cannaTerra: FeedLine = {
  id: 'canna-terra',
  name: 'CANNA Terra',
  hersteller: 'CANNA',
  typ: 'mineral',
  medien: ['erde'],

  features: {
    auto_faktor: true,
    calmag_ziele: false,
    cleanse_rampe: false,
    fade: true,
    calmag_empfohlen: false,
  },

  produkte: [
    { key: 'terra_vega',  name: 'Terra Vega',  einheit: 'mL', pro: 'L', kategorie: 'base',       icon: 'leaf',     nur_phasen: ['Veg'] },
    { key: 'terra_flores', name: 'Terra Flores', einheit: 'mL', pro: 'L', kategorie: 'base',      icon: 'flower',   nur_phasen: ['Bloom', 'Flush'] },
    { key: 'rhizotonic',  name: 'Rhizotonic',   einheit: 'mL', pro: 'L', kategorie: 'stimulator', icon: 'sprout' },
    { key: 'cannazym',    name: 'Cannazym',     einheit: 'mL', pro: 'L', kategorie: 'enzyme',     icon: 'flask' },
    { key: 'boost',       name: 'Boost',        einheit: 'mL', pro: 'L', kategorie: 'booster',    icon: 'sparkles', nur_phasen: ['Bloom'] },
    { key: 'pk1314',      name: 'PK 13-14',     einheit: 'mL', pro: 'L', kategorie: 'booster',    icon: 'star',     nur_phasen: ['Bloom'] },
  ],

  phasen: [
    { phase: 'Veg',   wochen: 4, label: 'Vegetativ' },
    { phase: 'Bloom', wochen: 8, label: 'Blüte' },
    { phase: 'Flush', wochen: 1, label: 'Flush' },
  ],

  schema: [
    // Veg W1-4
    { phase: 'Veg', woche: 1, ec_ziel: 0.9,  ph_min: 6.0, ph_max: 6.5, fmin: 50, fmax: 70,  dosen: { terra_vega: 2.0, rhizotonic: 0.4, cannazym: 2.5 } },
    { phase: 'Veg', woche: 2, ec_ziel: 1.1,  ph_min: 6.0, ph_max: 6.5, fmin: 60, fmax: 80,  dosen: { terra_vega: 3.0, rhizotonic: 0.4, cannazym: 2.5 } },
    { phase: 'Veg', woche: 3, ec_ziel: 1.2,  ph_min: 6.0, ph_max: 6.5, fmin: 65, fmax: 85,  dosen: { terra_vega: 4.0, rhizotonic: 0.4, cannazym: 2.5 } },
    { phase: 'Veg', woche: 4, ec_ziel: 1.3,  ph_min: 6.0, ph_max: 6.5, fmin: 70, fmax: 90,  dosen: { terra_vega: 5.0, rhizotonic: 0.4, cannazym: 2.5 } },
    // Bloom W1-8
    { phase: 'Bloom', woche: 1, ec_ziel: 1.3, ph_min: 6.0, ph_max: 6.5, fmin: 60, fmax: 80, dosen: { terra_flores: 2.0, rhizotonic: 0.4, cannazym: 2.5, boost: 1.0 } },
    { phase: 'Bloom', woche: 2, ec_ziel: 1.4, ph_min: 6.0, ph_max: 6.5, fmin: 65, fmax: 85, dosen: { terra_flores: 3.0, cannazym: 2.5, boost: 2.0 } },
    { phase: 'Bloom', woche: 3, ec_ziel: 1.6, ph_min: 6.0, ph_max: 6.5, fmin: 70, fmax: 90, dosen: { terra_flores: 4.0, cannazym: 2.5, boost: 3.0 } },
    { phase: 'Bloom', woche: 4, ec_ziel: 1.7, ph_min: 6.0, ph_max: 6.5, fmin: 75, fmax: 95, dosen: { terra_flores: 4.0, cannazym: 2.5, boost: 4.0, pk1314: 0.5 } },
    { phase: 'Bloom', woche: 5, ec_ziel: 1.8, ph_min: 6.0, ph_max: 6.5, fmin: 80, fmax: 100, dosen: { terra_flores: 4.0, cannazym: 2.5, boost: 4.0, pk1314: 1.0 } },
    { phase: 'Bloom', woche: 6, ec_ziel: 1.7, ph_min: 6.0, ph_max: 6.5, fmin: 75, fmax: 95, dosen: { terra_flores: 4.0, cannazym: 2.5, boost: 3.0, pk1314: 0.75 } },
    { phase: 'Bloom', woche: 7, ec_ziel: 1.4, ph_min: 6.0, ph_max: 6.5, fmin: 60, fmax: 80, dosen: { terra_flores: 3.0, cannazym: 2.5, boost: 2.0 } },
    { phase: 'Bloom', woche: 8, ec_ziel: 1.0, ph_min: 6.0, ph_max: 6.5, fmin: 40, fmax: 60, dosen: { terra_flores: 2.0, cannazym: 2.5 } },
    // Flush
    { phase: 'Flush', woche: 1, ec_ziel: 0.0, ph_min: 6.0, ph_max: 6.5, fmin: 0, fmax: 0, dosen: {} },
  ],

  hinweise: [
    'CANNA Terra ist für vorgedüngte Erde optimiert.',
    'PK 13-14 nur in Bloom W4-6, sparsam dosieren.',
    'Rhizotonic auch als Blattspray verwendbar (0.4 mL/L).',
  ],
};

export const cannaCoco: FeedLine = {
  id: 'canna-coco',
  name: 'CANNA Coco A+B',
  hersteller: 'CANNA',
  typ: 'mineral',
  medien: ['coco', 'hydro'],

  features: {
    auto_faktor: true,
    calmag_ziele: false,
    cleanse_rampe: false,
    fade: true,
    calmag_empfohlen: true,
  },

  produkte: [
    { key: 'coco_a',      name: 'Coco A',      einheit: 'mL', pro: 'L', kategorie: 'base',       icon: 'leaf' },
    { key: 'coco_b',      name: 'Coco B',      einheit: 'mL', pro: 'L', kategorie: 'base',       icon: 'leaf' },
    { key: 'rhizotonic',  name: 'Rhizotonic',   einheit: 'mL', pro: 'L', kategorie: 'stimulator', icon: 'sprout' },
    { key: 'cannazym',    name: 'Cannazym',     einheit: 'mL', pro: 'L', kategorie: 'enzyme',     icon: 'flask' },
    { key: 'boost',       name: 'Boost',        einheit: 'mL', pro: 'L', kategorie: 'booster',    icon: 'sparkles', nur_phasen: ['Bloom'] },
    { key: 'pk1314',      name: 'PK 13-14',     einheit: 'mL', pro: 'L', kategorie: 'booster',    icon: 'star',     nur_phasen: ['Bloom'] },
  ],

  phasen: [
    { phase: 'Veg',   wochen: 3, label: 'Vegetativ' },
    { phase: 'Bloom', wochen: 8, label: 'Blüte' },
    { phase: 'Flush', wochen: 1, label: 'Flush' },
  ],

  schema: [
    // Coco A und B immer gleiche Menge!
    { phase: 'Veg', woche: 1, ec_ziel: 1.0, ph_min: 5.5, ph_max: 6.2, fmin: 50, fmax: 70, dosen: { coco_a: 2.0, coco_b: 2.0, rhizotonic: 0.4, cannazym: 2.5 } },
    { phase: 'Veg', woche: 2, ec_ziel: 1.2, ph_min: 5.5, ph_max: 6.2, fmin: 60, fmax: 80, dosen: { coco_a: 3.0, coco_b: 3.0, rhizotonic: 0.4, cannazym: 2.5 } },
    { phase: 'Veg', woche: 3, ec_ziel: 1.4, ph_min: 5.5, ph_max: 6.2, fmin: 65, fmax: 85, dosen: { coco_a: 4.0, coco_b: 4.0, rhizotonic: 0.4, cannazym: 2.5 } },
    { phase: 'Bloom', woche: 1, ec_ziel: 1.4, ph_min: 5.5, ph_max: 6.2, fmin: 60, fmax: 80, dosen: { coco_a: 3.0, coco_b: 3.0, cannazym: 2.5, boost: 1.0 } },
    { phase: 'Bloom', woche: 2, ec_ziel: 1.5, ph_min: 5.5, ph_max: 6.2, fmin: 65, fmax: 85, dosen: { coco_a: 3.5, coco_b: 3.5, cannazym: 2.5, boost: 2.0 } },
    { phase: 'Bloom', woche: 3, ec_ziel: 1.7, ph_min: 5.5, ph_max: 6.2, fmin: 70, fmax: 90, dosen: { coco_a: 4.0, coco_b: 4.0, cannazym: 2.5, boost: 3.0 } },
    { phase: 'Bloom', woche: 4, ec_ziel: 1.8, ph_min: 5.5, ph_max: 6.2, fmin: 75, fmax: 95, dosen: { coco_a: 4.0, coco_b: 4.0, cannazym: 2.5, boost: 4.0, pk1314: 0.5 } },
    { phase: 'Bloom', woche: 5, ec_ziel: 1.9, ph_min: 5.5, ph_max: 6.2, fmin: 80, fmax: 100, dosen: { coco_a: 4.0, coco_b: 4.0, cannazym: 2.5, boost: 4.0, pk1314: 1.0 } },
    { phase: 'Bloom', woche: 6, ec_ziel: 1.7, ph_min: 5.5, ph_max: 6.2, fmin: 75, fmax: 95, dosen: { coco_a: 3.5, coco_b: 3.5, cannazym: 2.5, boost: 3.0, pk1314: 0.75 } },
    { phase: 'Bloom', woche: 7, ec_ziel: 1.4, ph_min: 5.5, ph_max: 6.2, fmin: 60, fmax: 80, dosen: { coco_a: 3.0, coco_b: 3.0, cannazym: 2.5, boost: 2.0 } },
    { phase: 'Bloom', woche: 8, ec_ziel: 1.0, ph_min: 5.5, ph_max: 6.2, fmin: 40, fmax: 60, dosen: { coco_a: 2.0, coco_b: 2.0, cannazym: 2.5 } },
    { phase: 'Flush', woche: 1, ec_ziel: 0.0, ph_min: 5.5, ph_max: 6.2, fmin: 0, fmax: 0, dosen: {} },
  ],

  hinweise: [
    'Coco A und B IMMER in gleicher Menge verwenden!',
    'Coco bindet Calcium — CalMag bei weichem Wasser empfohlen.',
    'Nie A und B unverdünnt mischen!',
  ],
};
