/**
 * Athena Pro Line — Feed Schedule 2024
 * Quelle: Official Athena Pro Line Feed Schedule
 *
 * Produkte: Pro Grow (Pulver), Pro Bloom (Pulver), Pro Core (Pulver),
 *           Fade (Flüssig), Cleanse (Flüssig)
 * Dosierung: g/10L bzw. mL/10L
 * Phasen: Clone (2W), Veg (4W), Bloom (9W)
 */

import type { FeedLine } from './types';

export const athenaPro: FeedLine = {
  id: 'athena-pro',
  name: 'Athena Pro Line',
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

  produkte: [
    { key: 'grow',    name: 'Pro Grow',  einheit: 'g',  pro: '10L', kategorie: 'base',       icon: 'scale',    nur_phasen: ['Veg'] },
    { key: 'bloom',   name: 'Pro Bloom', einheit: 'g',  pro: '10L', kategorie: 'base',       icon: 'scale',    nur_phasen: ['Clone', 'Bloom'] },
    { key: 'core',    name: 'Pro Core',  einheit: 'g',  pro: '10L', kategorie: 'supplement', icon: 'scale' },
    { key: 'fade',    name: 'Fade',      einheit: 'mL', pro: '10L', kategorie: 'supplement', icon: 'wind',     nur_phasen: ['Bloom'] },
    { key: 'cleanse', name: 'Cleanse',   einheit: 'mL', pro: '10L', kategorie: 'enzyme',     icon: 'sparkles' },
  ],

  phasen: [
    { name: 'Clone', schema_wochen: 2, max_wochen: 3,  stretch: 'repeat_last' },
    { name: 'Veg',   schema_wochen: 4, max_wochen: 8,  stretch: 'repeat_last' },
    { name: 'Bloom', schema_wochen: 9, max_wochen: 12, stretch: 'repeat_peak' },
  ],

  schema: [
    // Clone
    {
      phase: 'Clone', woche: 1, ec_ziel: 2.0, ph_min: 5.6, ph_max: 5.8,
      fmin: 40, fmax: 55, ca_ziel: 55, mg_ziel: 22,
      dosierungen: { grow: 0, bloom: 12.9, core: 7.7, fade: 0 },
      cleanse_t1: 3, cleanse_t7: 3, hinweis: '',
    },
    {
      phase: 'Clone', woche: 2, ec_ziel: 2.0, ph_min: 5.6, ph_max: 5.8,
      fmin: 45, fmax: 60, ca_ziel: 60, mg_ziel: 25,
      dosierungen: { grow: 0, bloom: 12.9, core: 7.7, fade: 0 },
      cleanse_t1: 3, cleanse_t7: 5, hinweis: '',
    },
    // Veg
    {
      phase: 'Veg', woche: 1, ec_ziel: 3.0, ph_min: 5.8, ph_max: 6.2,
      fmin: 50, fmax: 62, ca_ziel: 65, mg_ziel: 30,
      dosierungen: { grow: 20.3, bloom: 0, core: 12.2, fade: 0 },
      cleanse_t1: 5, cleanse_t7: 13, hinweis: '',
    },
    {
      phase: 'Veg', woche: 2, ec_ziel: 3.0, ph_min: 5.8, ph_max: 6.2,
      fmin: 55, fmax: 67, ca_ziel: 70, mg_ziel: 32,
      dosierungen: { grow: 20.3, bloom: 0, core: 12.2, fade: 0 },
      cleanse_t1: 5, cleanse_t7: 13, hinweis: '',
    },
    {
      phase: 'Veg', woche: 3, ec_ziel: 3.0, ph_min: 5.8, ph_max: 6.2,
      fmin: 58, fmax: 70, ca_ziel: 80, mg_ziel: 36,
      dosierungen: { grow: 20.3, bloom: 0, core: 12.2, fade: 0 },
      cleanse_t1: 5, cleanse_t7: 13, hinweis: '',
    },
    {
      phase: 'Veg', woche: 4, ec_ziel: 3.0, ph_min: 5.8, ph_max: 6.2,
      fmin: 60, fmax: 72, ca_ziel: 90, mg_ziel: 40,
      dosierungen: { grow: 20.3, bloom: 0, core: 12.2, fade: 0 },
      cleanse_t1: 5, cleanse_t7: 13, hinweis: '',
    },
    // Bloom
    {
      phase: 'Bloom', woche: 1, ec_ziel: 3.0, ph_min: 5.8, ph_max: 6.2,
      fmin: 48, fmax: 60, ca_ziel: 65, mg_ziel: 28,
      dosierungen: { grow: 0, bloom: 20.3, core: 12.2, fade: 0 },
      cleanse_t1: 5, cleanse_t7: 13, hinweis: '',
    },
    {
      phase: 'Bloom', woche: 2, ec_ziel: 3.0, ph_min: 5.8, ph_max: 6.2,
      fmin: 55, fmax: 67, ca_ziel: 85, mg_ziel: 38,
      dosierungen: { grow: 0, bloom: 20.3, core: 12.2, fade: 0 },
      cleanse_t1: 5, cleanse_t7: 13, hinweis: '',
    },
    {
      phase: 'Bloom', woche: 3, ec_ziel: 3.0, ph_min: 6.0, ph_max: 6.4,
      fmin: 60, fmax: 72, ca_ziel: 100, mg_ziel: 45,
      dosierungen: { grow: 0, bloom: 20.3, core: 12.2, fade: 0 },
      cleanse_t1: 5, cleanse_t7: 13, hinweis: '',
    },
    {
      phase: 'Bloom', woche: 4, ec_ziel: 3.0, ph_min: 6.0, ph_max: 6.4,
      fmin: 63, fmax: 75, ca_ziel: 105, mg_ziel: 48,
      dosierungen: { grow: 0, bloom: 20.3, core: 12.2, fade: 0 },
      cleanse_t1: 5, cleanse_t7: 13, hinweis: '',
    },
    {
      phase: 'Bloom', woche: 5, ec_ziel: 3.0, ph_min: 6.0, ph_max: 6.4,
      fmin: 65, fmax: 77, ca_ziel: 110, mg_ziel: 50,
      dosierungen: { grow: 0, bloom: 20.3, core: 12.2, fade: 0 },
      cleanse_t1: 5, cleanse_t7: 13, hinweis: '',
    },
    {
      phase: 'Bloom', woche: 6, ec_ziel: 3.0, ph_min: 6.0, ph_max: 6.4,
      fmin: 65, fmax: 77, ca_ziel: 112, mg_ziel: 52,
      dosierungen: { grow: 0, bloom: 20.3, core: 12.2, fade: 0 },
      cleanse_t1: 5, cleanse_t7: 13, hinweis: '',
    },
    {
      phase: 'Bloom', woche: 7, ec_ziel: 3.0, ph_min: 6.0, ph_max: 6.4,
      fmin: 62, fmax: 74, ca_ziel: 110, mg_ziel: 50,
      dosierungen: { grow: 0, bloom: 20.3, core: 12.2, fade: 0 },
      cleanse_t1: 5, cleanse_t7: 13, hinweis: '',
    },
    {
      phase: 'Bloom', woche: 8, ec_ziel: 1.5, ph_min: 6.0, ph_max: 6.4,
      fmin: 48, fmax: 60, ca_ziel: 100, mg_ziel: 45,
      dosierungen: { grow: 0, bloom: 9.4, core: 5.7, fade: 22 },
      cleanse_t1: 8, cleanse_t7: 14, hinweis: '',
    },
    {
      phase: 'Bloom', woche: 9, ec_ziel: 1.5, ph_min: 6.0, ph_max: 6.4,
      fmin: 28, fmax: 40, ca_ziel: 65, mg_ziel: 28,
      dosierungen: { grow: 0, bloom: 9.4, core: 5.7, fade: 30 },
      cleanse_t1: 13, cleanse_t7: 26, hinweis: '',
    },
  ],

  hinweise: [
    'Pulver immer einzeln einwiegen, nicht vormischen',
    'Cleanse-Dosierung steigt linear von T1 bis T7',
    'Fade nur in Bloom W8-W9',
  ],
};
