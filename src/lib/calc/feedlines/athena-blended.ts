/**
 * Athena Blended Line — Feed Schedule 2024
 * Quelle: Official Athena Blended Line Feed Schedule
 *
 * WICHTIG — NICHT mit "Athena Pro Line" verwechseln!
 *   • Pro Line      = Pulver/Granulat (g/10L), id='athena-pro'
 *   • Blended Line  = Flüssig 2-Part (mL/L), id='athena-blended'
 *
 * Produkte (alle mL/L außer CaMg):
 *   Blended Grow A + B, Blended Bloom A + B,
 *   Stack (Bloom-Booster), Cleanse, Fade, CaMg
 *
 * Dosierung: 2-Part-System — A und B immer in GLEICHEN Mengen dosieren,
 * getrennt einfüllen (A zuerst, dann B nach Umrühren).
 *
 * pH: Veg 5.8-6.2, Bloom W1-7 6.0-6.4, Finish W8-9 6.0-6.4
 * EC: Veg 2.4-3.0, Bloom-Peak 2.8-3.2, Fade 1.4-1.6
 */

import type { FeedLine } from './types';

export const athenaBlended: FeedLine = {
  id: 'athena-blended',
  name: 'Athena Blended Line (flüssig)',
  hersteller: 'Athena Ag',
  typ: 'mineral',
  medien: ['hydro', 'coco'],

  features: {
    auto_faktor: true,
    calmag_ziele: true,
    cleanse_rampe: true,
    fade: true,
    calmag_empfohlen: true,
  },

  // Eindeutige Produkt-Keys mit 'bl_' Prefix zur Abgrenzung von der Pro Line
  produkte: [
    { key: 'bl_grow_a',  name: 'Blended Grow A',  einheit: 'mL', pro: 'L', kategorie: 'base',       icon: 'flask',    nur_phasen: ['Veg'] },
    { key: 'bl_grow_b',  name: 'Blended Grow B',  einheit: 'mL', pro: 'L', kategorie: 'base',       icon: 'flask',    nur_phasen: ['Veg'] },
    { key: 'bl_bloom_a', name: 'Blended Bloom A', einheit: 'mL', pro: 'L', kategorie: 'base',       icon: 'flask',    nur_phasen: ['Clone', 'Bloom'] },
    { key: 'bl_bloom_b', name: 'Blended Bloom B', einheit: 'mL', pro: 'L', kategorie: 'base',       icon: 'flask',    nur_phasen: ['Clone', 'Bloom'] },
    { key: 'bl_stack',   name: 'Stack',           einheit: 'mL', pro: 'L', kategorie: 'booster',    icon: 'star',     nur_phasen: ['Bloom'] },
    { key: 'bl_cleanse', name: 'Cleanse',         einheit: 'mL', pro: 'L', kategorie: 'enzyme',     icon: 'sparkles' },
    { key: 'bl_fade',    name: 'Fade',            einheit: 'mL', pro: 'L', kategorie: 'supplement', icon: 'wind',     nur_phasen: ['Bloom'] },
  ],

  phasen: [
    { name: 'Clone', schema_wochen: 2, max_wochen: 3,  stretch: 'repeat_last' },
    { name: 'Veg',   schema_wochen: 4, max_wochen: 8,  stretch: 'repeat_last' },
    { name: 'Bloom', schema_wochen: 9, max_wochen: 12, stretch: 'repeat_peak' },
  ],

  schema: [
    // ─── Clone (2W) ──────────────────────────────────────────
    {
      phase: 'Clone', woche: 1, ec_ziel: 1.4, ph_min: 5.6, ph_max: 5.8,
      fmin: 40, fmax: 55, ca_ziel: 55, mg_ziel: 22,
      dosierungen: { bl_grow_a: 0, bl_grow_b: 0, bl_bloom_a: 2, bl_bloom_b: 2, bl_stack: 0, bl_fade: 0 },
      cleanse_t1: 0.3, cleanse_t7: 0.3,
    },
    {
      phase: 'Clone', woche: 2, ec_ziel: 1.5, ph_min: 5.6, ph_max: 5.8,
      fmin: 45, fmax: 60, ca_ziel: 60, mg_ziel: 25,
      dosierungen: { bl_grow_a: 0, bl_grow_b: 0, bl_bloom_a: 2, bl_bloom_b: 2, bl_stack: 0, bl_fade: 0 },
      cleanse_t1: 0.3, cleanse_t7: 0.5,
    },

    // ─── Veg (4W) ────────────────────────────────────────────
    {
      phase: 'Veg', woche: 1, ec_ziel: 2.4, ph_min: 5.8, ph_max: 6.2,
      fmin: 50, fmax: 62, ca_ziel: 65, mg_ziel: 30,
      dosierungen: { bl_grow_a: 4, bl_grow_b: 4, bl_bloom_a: 0, bl_bloom_b: 0, bl_stack: 0, bl_fade: 0 },
      cleanse_t1: 0.5, cleanse_t7: 1.3,
    },
    {
      phase: 'Veg', woche: 2, ec_ziel: 2.6, ph_min: 5.8, ph_max: 6.2,
      fmin: 55, fmax: 67, ca_ziel: 70, mg_ziel: 32,
      dosierungen: { bl_grow_a: 4, bl_grow_b: 4, bl_bloom_a: 0, bl_bloom_b: 0, bl_stack: 0, bl_fade: 0 },
      cleanse_t1: 0.5, cleanse_t7: 1.3,
    },
    {
      phase: 'Veg', woche: 3, ec_ziel: 2.8, ph_min: 5.8, ph_max: 6.2,
      fmin: 58, fmax: 70, ca_ziel: 80, mg_ziel: 36,
      dosierungen: { bl_grow_a: 4, bl_grow_b: 4, bl_bloom_a: 0, bl_bloom_b: 0, bl_stack: 0, bl_fade: 0 },
      cleanse_t1: 0.5, cleanse_t7: 1.3,
    },
    {
      phase: 'Veg', woche: 4, ec_ziel: 3.0, ph_min: 5.8, ph_max: 6.2,
      fmin: 60, fmax: 72, ca_ziel: 90, mg_ziel: 40,
      dosierungen: { bl_grow_a: 4, bl_grow_b: 4, bl_bloom_a: 0, bl_bloom_b: 0, bl_stack: 0, bl_fade: 0 },
      cleanse_t1: 0.5, cleanse_t7: 1.3,
    },

    // ─── Bloom (9W) ──────────────────────────────────────────
    {
      phase: 'Bloom', woche: 1, ec_ziel: 2.6, ph_min: 5.8, ph_max: 6.2,
      fmin: 48, fmax: 60, ca_ziel: 65, mg_ziel: 28,
      dosierungen: { bl_grow_a: 0, bl_grow_b: 0, bl_bloom_a: 4, bl_bloom_b: 4, bl_stack: 0, bl_fade: 0 },
      cleanse_t1: 0.5, cleanse_t7: 1.3, hinweis: 'Streckungsphase',
    },
    {
      phase: 'Bloom', woche: 2, ec_ziel: 2.8, ph_min: 5.8, ph_max: 6.2,
      fmin: 55, fmax: 67, ca_ziel: 85, mg_ziel: 38,
      dosierungen: { bl_grow_a: 0, bl_grow_b: 0, bl_bloom_a: 4, bl_bloom_b: 4, bl_stack: 0.25, bl_fade: 0 },
      cleanse_t1: 0.5, cleanse_t7: 1.3,
    },
    {
      phase: 'Bloom', woche: 3, ec_ziel: 3.0, ph_min: 6.0, ph_max: 6.4,
      fmin: 60, fmax: 72, ca_ziel: 100, mg_ziel: 45,
      dosierungen: { bl_grow_a: 0, bl_grow_b: 0, bl_bloom_a: 4, bl_bloom_b: 4, bl_stack: 0.5, bl_fade: 0 },
      cleanse_t1: 0.5, cleanse_t7: 1.3,
    },
    {
      phase: 'Bloom', woche: 4, ec_ziel: 3.0, ph_min: 6.0, ph_max: 6.4,
      fmin: 63, fmax: 75, ca_ziel: 105, mg_ziel: 48,
      dosierungen: { bl_grow_a: 0, bl_grow_b: 0, bl_bloom_a: 4, bl_bloom_b: 4, bl_stack: 0.75, bl_fade: 0 },
      cleanse_t1: 0.5, cleanse_t7: 1.3, hinweis: 'Peak-Blüte, Knospenbildung',
    },
    {
      phase: 'Bloom', woche: 5, ec_ziel: 3.0, ph_min: 6.0, ph_max: 6.4,
      fmin: 65, fmax: 77, ca_ziel: 110, mg_ziel: 50,
      dosierungen: { bl_grow_a: 0, bl_grow_b: 0, bl_bloom_a: 4, bl_bloom_b: 4, bl_stack: 1.0, bl_fade: 0 },
      cleanse_t1: 0.5, cleanse_t7: 1.3,
    },
    {
      phase: 'Bloom', woche: 6, ec_ziel: 3.0, ph_min: 6.0, ph_max: 6.4,
      fmin: 65, fmax: 77, ca_ziel: 112, mg_ziel: 52,
      dosierungen: { bl_grow_a: 0, bl_grow_b: 0, bl_bloom_a: 4, bl_bloom_b: 4, bl_stack: 1.0, bl_fade: 0 },
      cleanse_t1: 0.5, cleanse_t7: 1.3,
    },
    {
      phase: 'Bloom', woche: 7, ec_ziel: 2.8, ph_min: 6.0, ph_max: 6.4,
      fmin: 62, fmax: 74, ca_ziel: 110, mg_ziel: 50,
      dosierungen: { bl_grow_a: 0, bl_grow_b: 0, bl_bloom_a: 4, bl_bloom_b: 4, bl_stack: 0.75, bl_fade: 0 },
      cleanse_t1: 0.5, cleanse_t7: 1.3,
    },
    {
      phase: 'Bloom', woche: 8, ec_ziel: 1.5, ph_min: 6.0, ph_max: 6.4,
      fmin: 48, fmax: 60, ca_ziel: 100, mg_ziel: 45,
      dosierungen: { bl_grow_a: 0, bl_grow_b: 0, bl_bloom_a: 1.8, bl_bloom_b: 1.8, bl_stack: 0, bl_fade: 2.2 },
      cleanse_t1: 0.8, cleanse_t7: 1.4, hinweis: 'Fade startet — Nährstoffe abbauen',
    },
    {
      phase: 'Bloom', woche: 9, ec_ziel: 1.5, ph_min: 6.0, ph_max: 6.4,
      fmin: 28, fmax: 40, ca_ziel: 65, mg_ziel: 28,
      dosierungen: { bl_grow_a: 0, bl_grow_b: 0, bl_bloom_a: 1.8, bl_bloom_b: 1.8, bl_stack: 0, bl_fade: 3.0 },
      cleanse_t1: 1.3, cleanse_t7: 2.6, hinweis: 'Finish — Fade maximal',
    },
  ],

  hinweise: [
    'NICHT mit Athena Pro Line verwechseln — das hier ist die flüssige 2-Part-Variante',
    'A und B getrennt einfüllen: A zuerst, gut umrühren, DANN B dazu',
    'A und B immer in gleichen Mengen dosieren (1:1 Verhältnis)',
    'Cleanse-Dosierung steigt linear von T1 bis T7',
    'Stack ist der PK-Booster — startet ab Bloom W2',
    'Fade nur in Bloom W8-W9 (Finish/Ripen)',
  ],
};
