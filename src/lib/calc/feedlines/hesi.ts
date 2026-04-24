/**
 * Hesi — Feed Schedule (Soil / Erde)
 * Quelle: Offizielle Hesi Düngetabelle (hesi.nl / DE-Broschüre)
 *
 * Produkte (alle mL/L):
 *   TNT Complex (Grow), Bloom Complex, Root Complex, SuperVit (Tropfen ≈0.08 mL/L),
 *   PK 13/14, Hesi Boost, Power Zyme, Phosphorus Plus
 *
 * Phasen: Clone → Veg (4 W) → Bloom (8 W) → Flush
 *
 * pH: Erde 6.0-6.5
 * EC: Veg 0.9-1.5, Bloom 1.4-1.8, Flush 0.0
 *
 * Typ: Hybrid (organisch-mineralisch) — Hesi ist chelatiert und enthält
 * natürliche Zusätze (Aminosäuren, Vitamine), dosiert sich aber wie Mineraldünger.
 *
 * CalMag: In der Regel nicht nötig (Hesi enthält bereits Ca/Mg), bei RO-Wasser
 * optional 0.3-0.5 mL/L CalMag.
 */

import type { FeedLine } from './types';

export const hesi: FeedLine = {
  id: 'hesi',
  name: 'Hesi Soil (Erde)',
  hersteller: 'Hesi',
  typ: 'hybrid',
  medien: ['erde'],

  features: {
    auto_faktor: true,
    calmag_ziele: false,
    cleanse_rampe: false,
    fade: true,
    calmag_empfohlen: false,
  },

  produkte: [
    { key: 'root_complex',  name: 'Root Complex',  einheit: 'mL', pro: 'L', kategorie: 'stimulator', icon: 'sprout',   nur_phasen: ['Clone', 'Veg'] },
    { key: 'tnt_complex',   name: 'TNT Complex',   einheit: 'mL', pro: 'L', kategorie: 'base',       icon: 'leaf',     nur_phasen: ['Veg'] },
    { key: 'bloom_complex', name: 'Bloom Complex', einheit: 'mL', pro: 'L', kategorie: 'base',       icon: 'flower',   nur_phasen: ['Bloom'] },
    { key: 'pk1314',        name: 'PK 13/14',      einheit: 'mL', pro: 'L', kategorie: 'booster',    icon: 'star',     nur_phasen: ['Bloom'] },
    { key: 'boost',         name: 'Hesi Boost',    einheit: 'mL', pro: 'L', kategorie: 'booster',    icon: 'sparkles', nur_phasen: ['Bloom'] },
    { key: 'power_zyme',    name: 'Power Zyme',    einheit: 'mL', pro: 'L', kategorie: 'enzyme',     icon: 'flask' },
    { key: 'super_vit',     name: 'SuperVit',      einheit: 'mL', pro: 'L', kategorie: 'supplement', icon: 'droplet' },
    { key: 'phos_plus',     name: 'Phosphorus Plus', einheit: 'mL', pro: 'L', kategorie: 'supplement', icon: 'beaker', nur_phasen: ['Bloom'] },
  ],

  phasen: [
    { name: 'Clone', schema_wochen: 1, max_wochen: 2,  stretch: 'repeat_last' },
    { name: 'Veg',   schema_wochen: 4, max_wochen: 8,  stretch: 'repeat_last' },
    { name: 'Bloom', schema_wochen: 8, max_wochen: 12, stretch: 'repeat_peak' },
    { name: 'Flush', schema_wochen: 1, max_wochen: 2,  stretch: 'repeat_last' },
  ],

  schema: [
    // ─── Clone ───────────────────────────────────────────────
    {
      phase: 'Clone', woche: 1, ec_ziel: 0.5, ph_min: 6.0, ph_max: 6.5,
      fmin: 40, fmax: 55,
      dosierungen: {
        root_complex: 5, tnt_complex: 0, bloom_complex: 0, pk1314: 0,
        boost: 0, power_zyme: 0, super_vit: 0.08, phos_plus: 0,
      },
      hinweis: 'Stecklinge/Jungpflanzen — SuperVit als Tropfen (1 Trpf ≈ 0.08 mL/L)',
    },

    // ─── Veg (Wachstum) ──────────────────────────────────────
    {
      phase: 'Veg', woche: 1, ec_ziel: 0.9, ph_min: 6.0, ph_max: 6.5,
      fmin: 50, fmax: 65,
      dosierungen: {
        root_complex: 2, tnt_complex: 5, bloom_complex: 0, pk1314: 0,
        boost: 0, power_zyme: 5, super_vit: 0.08, phos_plus: 0,
      },
    },
    {
      phase: 'Veg', woche: 2, ec_ziel: 1.1, ph_min: 6.0, ph_max: 6.5,
      fmin: 60, fmax: 75,
      dosierungen: {
        root_complex: 2, tnt_complex: 5, bloom_complex: 0, pk1314: 0,
        boost: 0, power_zyme: 5, super_vit: 0.08, phos_plus: 0,
      },
    },
    {
      phase: 'Veg', woche: 3, ec_ziel: 1.3, ph_min: 6.0, ph_max: 6.5,
      fmin: 65, fmax: 80,
      dosierungen: {
        root_complex: 2, tnt_complex: 5, bloom_complex: 0, pk1314: 0,
        boost: 0, power_zyme: 5, super_vit: 0.08, phos_plus: 0,
      },
    },
    {
      phase: 'Veg', woche: 4, ec_ziel: 1.5, ph_min: 6.0, ph_max: 6.5,
      fmin: 70, fmax: 85,
      dosierungen: {
        root_complex: 0, tnt_complex: 5, bloom_complex: 0, pk1314: 0,
        boost: 0, power_zyme: 5, super_vit: 0.08, phos_plus: 0,
      },
      hinweis: 'Umstellung Bloom vorbereiten',
    },

    // ─── Bloom W1-W8 ─────────────────────────────────────────
    {
      phase: 'Bloom', woche: 1, ec_ziel: 1.4, ph_min: 6.0, ph_max: 6.5,
      fmin: 60, fmax: 75,
      dosierungen: {
        root_complex: 0, tnt_complex: 0, bloom_complex: 5, pk1314: 0,
        boost: 2, power_zyme: 5, super_vit: 0.08, phos_plus: 0,
      },
      hinweis: 'Streckungsphase — Boost-Einstieg',
    },
    {
      phase: 'Bloom', woche: 2, ec_ziel: 1.5, ph_min: 6.0, ph_max: 6.5,
      fmin: 65, fmax: 80,
      dosierungen: {
        root_complex: 0, tnt_complex: 0, bloom_complex: 5, pk1314: 2,
        boost: 3, power_zyme: 5, super_vit: 0.08, phos_plus: 0,
      },
    },
    {
      phase: 'Bloom', woche: 3, ec_ziel: 1.6, ph_min: 6.0, ph_max: 6.5,
      fmin: 70, fmax: 85,
      dosierungen: {
        root_complex: 0, tnt_complex: 0, bloom_complex: 5, pk1314: 3,
        boost: 3, power_zyme: 5, super_vit: 0.08, phos_plus: 1,
      },
    },
    {
      phase: 'Bloom', woche: 4, ec_ziel: 1.7, ph_min: 6.0, ph_max: 6.5,
      fmin: 75, fmax: 90,
      dosierungen: {
        root_complex: 0, tnt_complex: 0, bloom_complex: 5, pk1314: 3,
        boost: 3, power_zyme: 5, super_vit: 0.08, phos_plus: 1,
      },
      hinweis: 'Peak-Blüte, volle Knospenbildung',
    },
    {
      phase: 'Bloom', woche: 5, ec_ziel: 1.8, ph_min: 6.0, ph_max: 6.5,
      fmin: 75, fmax: 90,
      dosierungen: {
        root_complex: 0, tnt_complex: 0, bloom_complex: 5, pk1314: 3,
        boost: 3, power_zyme: 5, super_vit: 0.08, phos_plus: 1,
      },
    },
    {
      phase: 'Bloom', woche: 6, ec_ziel: 1.7, ph_min: 6.0, ph_max: 6.5,
      fmin: 70, fmax: 85,
      dosierungen: {
        root_complex: 0, tnt_complex: 0, bloom_complex: 5, pk1314: 3,
        boost: 3, power_zyme: 5, super_vit: 0.08, phos_plus: 1,
      },
    },
    {
      phase: 'Bloom', woche: 7, ec_ziel: 1.5, ph_min: 6.0, ph_max: 6.5,
      fmin: 60, fmax: 75,
      dosierungen: {
        root_complex: 0, tnt_complex: 0, bloom_complex: 4, pk1314: 2,
        boost: 2, power_zyme: 5, super_vit: 0.08, phos_plus: 0,
      },
      hinweis: 'Reifung — Nährstoffe reduzieren',
    },
    {
      phase: 'Bloom', woche: 8, ec_ziel: 1.2, ph_min: 6.0, ph_max: 6.5,
      fmin: 45, fmax: 60,
      dosierungen: {
        root_complex: 0, tnt_complex: 0, bloom_complex: 3, pk1314: 0,
        boost: 0, power_zyme: 5, super_vit: 0, phos_plus: 0,
      },
      hinweis: 'Letzte Bloom-Woche — Übergang zu Flush',
    },

    // ─── Flush ───────────────────────────────────────────────
    {
      phase: 'Flush', woche: 1, ec_ziel: 0.0, ph_min: 6.0, ph_max: 6.5,
      fmin: 0, fmax: 0,
      dosierungen: {
        root_complex: 0, tnt_complex: 0, bloom_complex: 0, pk1314: 0,
        boost: 0, power_zyme: 5, super_vit: 0, phos_plus: 0,
      },
      hinweis: 'Nur Wasser — Power Zyme optional zum Abbau von Wurzelresten',
    },
  ],

  hinweise: [
    'Schema: Soil / Erde — für Coco/Hydro abweichende Dosen (separate Line geplant)',
    'Hesi ist chelatiert: Nährstoffe auch bei höherem pH pflanzenverfügbar',
    'pH: 6.0-6.5 (Erde)',
    'SuperVit wird in Tropfen dosiert: 1 Tropfen ≈ 0.08 mL/L',
    'CalMag in der Regel nicht nötig — Hesi enthält bereits Ca/Mg',
    'Bei RO-Wasser: optional 0.3-0.5 mL/L CalMag ergänzen',
    'Power Zyme hilft beim Abbau toter Wurzeln — durchgehend einsetzbar',
    'Boost und PK 13/14 können parallel dosiert werden (keine Konkurrenz)',
  ],
};
