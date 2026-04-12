/**
 * BioBizz Organic — Feed Schedule 2024
 * Quelle: Offizielles BioBizz Düngerschema 2024 (PDF, DE)
 *
 * DIESES SCHEMA: Light-Mix / Coco-Mix Variante
 * (All-Mix hat niedrigere Dosierungen weil das Substrat vorgedüngt ist)
 *
 * Phasen standardisiert: Clone (Vermehrung) → Veg (Wachstum) → Bloom (WK1-8) → Flush
 *
 * Produkte (alle mL/L außer Microbes = g/L):
 *   Root-Juice, Bio-Grow, Bio-Bloom, Top-Max,
 *   Bio-Heaven, Alg-A-Mic, Acti-Vera, Microbes
 *
 * Fish-Mix ist Alternative zu Bio-Grow in der Veg-Phase (Fußnote 2).
 *
 * pH: 6.2 - 6.5 (Erde), 5.8 - 6.2 (Coco/Hydro)
 * EC: Bei Organik nur eingeschränkt aussagekräftig
 *
 * CalMag (BioBizz CalMag):
 *   Hydro/Coco Prävention: 0.5 mL/L (WK1-6), 1 mL/L (WK6-8), 1 mL/L (WK8-10)
 *   Substrat/Erde Prävention: 0.3 mL/L (WK1-6), 0.5 mL/L (WK6-8), 0.8 mL/L (WK8-10)
 *
 * Auto-Faktor: Organische Dünger reagieren langsamer, daher engere Ranges (50-80%).
 * Niedrigere fmin weil BioBizz-Lösung im Reservoir schneller altert (organisch).
 */

import type { FeedLine } from './types';

export const biobizz: FeedLine = {
  id: 'biobizz',
  name: 'BioBizz Organic (Light-Mix / Coco)',
  hersteller: 'BioBizz',
  typ: 'organisch',
  medien: ['erde', 'coco'],

  features: {
    auto_faktor: true,
    calmag_ziele: false,
    cleanse_rampe: false,
    fade: false,
    calmag_empfohlen: true,
  },

  produkte: [
    { key: 'root_juice',  name: 'Root-Juice',  einheit: 'mL', pro: 'L', kategorie: 'stimulator', icon: 'sprout',   nur_phasen: ['Clone'] },
    { key: 'bio_grow',    name: 'Bio-Grow',     einheit: 'mL', pro: 'L', kategorie: 'base',       icon: 'leaf' },
    { key: 'bio_bloom',   name: 'Bio-Bloom',    einheit: 'mL', pro: 'L', kategorie: 'base',       icon: 'flower',   nur_phasen: ['Bloom'] },
    { key: 'top_max',     name: 'Top-Max',      einheit: 'mL', pro: 'L', kategorie: 'booster',    icon: 'sparkles', nur_phasen: ['Bloom'] },
    { key: 'bio_heaven',  name: 'Bio-Heaven',   einheit: 'mL', pro: 'L', kategorie: 'supplement', icon: 'star' },
    { key: 'alg_a_mic',   name: 'Alg-A-Mic',    einheit: 'mL', pro: 'L', kategorie: 'supplement', icon: 'flask',    nur_phasen: ['Bloom'] },
    { key: 'acti_vera',   name: 'Acti-Vera',    einheit: 'mL', pro: 'L', kategorie: 'supplement', icon: 'droplet' },
    { key: 'microbes',    name: 'Microbes',      einheit: 'g',  pro: 'L', kategorie: 'enzyme',     icon: 'beaker' },
  ],

  phasen: [
    { name: 'Clone', schema_wochen: 1, max_wochen: 2,  stretch: 'repeat_last' },
    { name: 'Veg',   schema_wochen: 1, max_wochen: 8,  stretch: 'repeat_last' },
    { name: 'Bloom', schema_wochen: 8, max_wochen: 12, stretch: 'repeat_peak' },
    { name: 'Flush', schema_wochen: 1, max_wochen: 2,  stretch: 'repeat_last' },
  ],

  schema: [
    // ─── Clone (Vermehrung) ──────────────────────────────────
    {
      phase: 'Clone', woche: 1, ec_ziel: 0.4, ph_min: 6.2, ph_max: 6.5,
      fmin: 40, fmax: 55,
      dosierungen: {
        root_juice: 4, bio_grow: 0, bio_bloom: 0, top_max: 0,
        bio_heaven: 2, alg_a_mic: 0, acti_vera: 2, microbes: 0,
      },
      hinweis: 'Jungpflanze 10-15cm oder 2-4 Blätter, dann Veg starten',
    },

    // ─── Veg (Wachstum) ──────────────────────────────────────
    {
      phase: 'Veg', woche: 1, ec_ziel: 0.8, ph_min: 6.2, ph_max: 6.5,
      fmin: 50, fmax: 65,
      dosierungen: {
        root_juice: 0, bio_grow: 2, bio_bloom: 0, top_max: 0,
        bio_heaven: 2, alg_a_mic: 0, acti_vera: 2, microbes: 0.4,
      },
      hinweis: 'Fish-Mix als Alternative zu Bio-Grow möglich (gleiche Dosis)',
    },

    // ─── Bloom WK1-WK8 ──────────────────────────────────────
    {
      phase: 'Bloom', woche: 1, ec_ziel: 1.0, ph_min: 6.2, ph_max: 6.5,
      fmin: 50, fmax: 65,
      dosierungen: {
        root_juice: 0, bio_grow: 2, bio_bloom: 1, top_max: 1,
        bio_heaven: 2, alg_a_mic: 1, acti_vera: 2, microbes: 0.4,
      },
    },
    {
      phase: 'Bloom', woche: 2, ec_ziel: 1.0, ph_min: 6.2, ph_max: 6.5,
      fmin: 55, fmax: 68,
      dosierungen: {
        root_juice: 0, bio_grow: 3, bio_bloom: 2, top_max: 1,
        bio_heaven: 2, alg_a_mic: 2, acti_vera: 2, microbes: 0.2,
      },
    },
    {
      phase: 'Bloom', woche: 3, ec_ziel: 1.2, ph_min: 6.2, ph_max: 6.5,
      fmin: 58, fmax: 72,
      dosierungen: {
        root_juice: 0, bio_grow: 3, bio_bloom: 2, top_max: 1,
        bio_heaven: 3, alg_a_mic: 2, acti_vera: 3, microbes: 0.2,
      },
    },
    {
      phase: 'Bloom', woche: 4, ec_ziel: 1.4, ph_min: 6.2, ph_max: 6.5,
      fmin: 60, fmax: 75,
      dosierungen: {
        root_juice: 0, bio_grow: 4, bio_bloom: 3, top_max: 1,
        bio_heaven: 4, alg_a_mic: 3, acti_vera: 4, microbes: 0.4,
      },
    },
    {
      phase: 'Bloom', woche: 5, ec_ziel: 1.4, ph_min: 6.2, ph_max: 6.5,
      fmin: 62, fmax: 78,
      dosierungen: {
        root_juice: 0, bio_grow: 4, bio_bloom: 3, top_max: 1,
        bio_heaven: 4, alg_a_mic: 3, acti_vera: 4, microbes: 0.4,
      },
    },
    {
      phase: 'Bloom', woche: 6, ec_ziel: 1.6, ph_min: 6.2, ph_max: 6.5,
      fmin: 65, fmax: 80,
      dosierungen: {
        root_juice: 0, bio_grow: 4, bio_bloom: 4, top_max: 4,
        bio_heaven: 5, alg_a_mic: 4, acti_vera: 5, microbes: 0.4,
      },
    },
    {
      phase: 'Bloom', woche: 7, ec_ziel: 1.6, ph_min: 6.2, ph_max: 6.5,
      fmin: 60, fmax: 75,
      dosierungen: {
        root_juice: 0, bio_grow: 4, bio_bloom: 4, top_max: 4,
        bio_heaven: 5, alg_a_mic: 4, acti_vera: 5, microbes: 0.2,
      },
    },
    {
      phase: 'Bloom', woche: 8, ec_ziel: 1.6, ph_min: 6.2, ph_max: 6.5,
      fmin: 45, fmax: 60,
      dosierungen: {
        root_juice: 0, bio_grow: 4, bio_bloom: 4, top_max: 4,
        bio_heaven: 5, alg_a_mic: 4, acti_vera: 5, microbes: 0.2,
      },
      hinweis: 'Letzte Bloom-Woche',
    },

    // ─── Flush ───────────────────────────────────────────────
    {
      phase: 'Flush', woche: 1, ec_ziel: 0.0, ph_min: 6.2, ph_max: 6.5,
      fmin: 0, fmax: 0,
      dosierungen: {
        root_juice: 0, bio_grow: 0, bio_bloom: 0, top_max: 0,
        bio_heaven: 0, alg_a_mic: 0, acti_vera: 0, microbes: 0.2,
      },
      hinweis: 'Nur Wasser — Microbes optional',
    },
  ],

  hinweise: [
    'Schema: Light-Mix / Coco-Mix (All-Mix hat niedrigere Dosen)',
    'Organischer Dünger: EC-Messung nur eingeschränkt aussagekräftig',
    'pH: 6.2-6.5 (Erde), bei Coco evtl. 5.8-6.2',
    'Fish-Mix kann Bio-Grow in der Wachstumsphase ersetzen (gleiche Dosis)',
    'CalMag bei Coco/RO: 0.5 mL/L (WK1-6), 1 mL/L (WK6+)',
    'CalMag bei Erde: 0.3 mL/L (WK1-6), 0.5 mL/L (WK6+)',
    'Microbes: 1x pro Woche, 2x bei hohem Nährstoffbedarf',
    'Vegetationsphase kann beliebig verlängert werden',
  ],
};
