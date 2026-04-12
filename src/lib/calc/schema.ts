/**
 * AutoPot Athena v3 - Schema Data
 *
 * Wasserprofile + CalMag-Produkte (universell, nicht line-spezifisch).
 * Legacy Types + SCHEMA bleiben für backwards-compat.
 * Die eigentlichen Dünger-Schemas leben jetzt in feedlines/*.ts
 */

// ─── LEGACY TYPES (backwards-compat) ────────────────────────────────────

export interface SchemaRow {
  phase: Phase;
  woche: number;
  key: string;
  ec_ziel: number;
  grow_g_10L: number;
  bloom_g_10L: number;
  core_g_10L: number;
  fade_mL_10L: number;
  cleanse_t1_mL_10L: number;
  cleanse_t7_mL_10L: number;
  ca_ziel: number;
  mg_ziel: number;
  ph_min: number;
  ph_max: number;
  fmin: number;
  fmax: number;
  hinweis: string;
}

export type Phase = 'Clone' | 'Veg' | 'Bloom';

export type CalMagTyp = 'A' | 'B' | 'BB';

// ─── WATER PROFILES (universell) ─────────────────────────────────────────

export interface WasserProfil {
  name: string;
  ca: number;
  mg: number;
  ec: number;
  ph: number;
  na: number;
  hco3: number;
  quelle: string;
  status: string;
}

export const WASSER_PROFILE: WasserProfil[] = [
  { name: 'Mainz Petersaue',            ca: 103,  mg: 18,  ec: 0.64, ph: 7.6, na: 18,  hco3: 235, quelle: 'Mainzer Netze 2024 offiziell',          status: 'bestaetigt' },
  { name: 'Freisen',                     ca: 17,   mg: 8,   ec: 0.19, ph: 7.4, na: 5,   hco3: 45,  quelle: 'WVG3 Wuerzbachtal (energis Lab 09/2025)', status: 'bestaetigt' },
  { name: 'Ockenheim b.Mainz',          ca: 88,   mg: 15,  ec: 0.68, ph: 7.5, na: 14,  hco3: 190, quelle: 'WVR VG Gau-Algesheim Zone',             status: 'EC bestaetigt' },
  { name: 'Klein-Winternheim/Ober-Olm', ca: 100,  mg: 17,  ec: 0.84, ph: 7.3, na: 18,  hco3: 220, quelle: 'WVR HB Ober-Olm (03/2025)',             status: 'EC bestaetigt' },
  { name: 'Theley (Saarland)',           ca: 17,   mg: 8,   ec: 0.19, ph: 7.4, na: 4,   hco3: 40,  quelle: 'WVG3 Wuerzbachtal',                     status: 'bestaetigt' },
  { name: 'St. Wendel (Saarland)',       ca: 25,   mg: 8,   ec: 0.25, ph: 7.5, na: 6,   hco3: 58,  quelle: 'WVW WVG1 Wurzelbach',                   status: 'EC bestaetigt' },
  { name: 'RO / Destilliert',            ca: 0.5,  mg: 0.2, ec: 0.01, ph: 6.5, na: 0.1, hco3: 1,   quelle: 'Theoretisch',                           status: 'Referenz' },
];

// ─── CALMAG PRODUCTS (universell) ────────────────────────────────────────

export interface Produkt {
  name: string;
  ca_per_mL: number;
  mg_per_mL: number;
  dichte: number;
  tropfen_per_mL: number;
  anmerkung: string;
}

export const PRODUKTE: Produkt[] = [
  { name: 'Athena CalMag',       ca_per_mL: 25,   mg_per_mL: 13,   dichte: 1.0,  tropfen_per_mL: 23.5, anmerkung: 'Ca-First Hauptprodukt' },
  { name: 'CANNA CalMag Agent',  ca_per_mL: 40,   mg_per_mL: 12,   dichte: 1.0,  tropfen_per_mL: 18,   anmerkung: 'Alternative hoher Ca-Gehalt' },
  { name: 'BioBizz CalMag',      ca_per_mL: 25.0, mg_per_mL: 7.67, dichte: 1.06, tropfen_per_mL: 22,   anmerkung: 'Organisch, CaO 3.3%, MgO 1.2%' },
  { name: 'Canna Mono Mg 7%',    ca_per_mL: 0,    mg_per_mL: 50,   dichte: 1.0,  tropfen_per_mL: 28,   anmerkung: 'Rein Mg' },
];

// ─── LEGACY SCHEMA DATA (Athena Pro Line) ────────────────────────────────
// Bleibt für backwards-compat mit Code der noch direkt SCHEMA importiert.
// Neue Features nutzen feedlines/athena-pro.ts

export const SCHEMA: SchemaRow[] = [
  { phase: 'Clone', woche: 1, key: 'Clone|01', ec_ziel: 2.0, grow_g_10L: 0,    bloom_g_10L: 12.9, core_g_10L: 7.7,  fade_mL_10L: 0,  cleanse_t1_mL_10L: 3,  cleanse_t7_mL_10L: 3,  ca_ziel: 55,  mg_ziel: 22, ph_min: 5.6, ph_max: 5.8, fmin: 40, fmax: 55, hinweis: '' },
  { phase: 'Clone', woche: 2, key: 'Clone|02', ec_ziel: 2.0, grow_g_10L: 0,    bloom_g_10L: 12.9, core_g_10L: 7.7,  fade_mL_10L: 0,  cleanse_t1_mL_10L: 3,  cleanse_t7_mL_10L: 5,  ca_ziel: 60,  mg_ziel: 25, ph_min: 5.6, ph_max: 5.8, fmin: 45, fmax: 60, hinweis: '' },
  { phase: 'Veg',   woche: 1, key: 'Veg|01',   ec_ziel: 3.0, grow_g_10L: 20.3, bloom_g_10L: 0,    core_g_10L: 12.2, fade_mL_10L: 0,  cleanse_t1_mL_10L: 5,  cleanse_t7_mL_10L: 13, ca_ziel: 65,  mg_ziel: 30, ph_min: 5.8, ph_max: 6.2, fmin: 50, fmax: 62, hinweis: '' },
  { phase: 'Veg',   woche: 2, key: 'Veg|02',   ec_ziel: 3.0, grow_g_10L: 20.3, bloom_g_10L: 0,    core_g_10L: 12.2, fade_mL_10L: 0,  cleanse_t1_mL_10L: 5,  cleanse_t7_mL_10L: 13, ca_ziel: 70,  mg_ziel: 32, ph_min: 5.8, ph_max: 6.2, fmin: 55, fmax: 67, hinweis: '' },
  { phase: 'Veg',   woche: 3, key: 'Veg|03',   ec_ziel: 3.0, grow_g_10L: 20.3, bloom_g_10L: 0,    core_g_10L: 12.2, fade_mL_10L: 0,  cleanse_t1_mL_10L: 5,  cleanse_t7_mL_10L: 13, ca_ziel: 80,  mg_ziel: 36, ph_min: 5.8, ph_max: 6.2, fmin: 58, fmax: 70, hinweis: '' },
  { phase: 'Veg',   woche: 4, key: 'Veg|04',   ec_ziel: 3.0, grow_g_10L: 20.3, bloom_g_10L: 0,    core_g_10L: 12.2, fade_mL_10L: 0,  cleanse_t1_mL_10L: 5,  cleanse_t7_mL_10L: 13, ca_ziel: 90,  mg_ziel: 40, ph_min: 5.8, ph_max: 6.2, fmin: 60, fmax: 72, hinweis: '' },
  { phase: 'Bloom', woche: 1, key: 'Bloom|01',  ec_ziel: 3.0, grow_g_10L: 0,    bloom_g_10L: 20.3, core_g_10L: 12.2, fade_mL_10L: 0,  cleanse_t1_mL_10L: 5,  cleanse_t7_mL_10L: 13, ca_ziel: 65,  mg_ziel: 28, ph_min: 5.8, ph_max: 6.2, fmin: 48, fmax: 60, hinweis: '' },
  { phase: 'Bloom', woche: 2, key: 'Bloom|02',  ec_ziel: 3.0, grow_g_10L: 0,    bloom_g_10L: 20.3, core_g_10L: 12.2, fade_mL_10L: 0,  cleanse_t1_mL_10L: 5,  cleanse_t7_mL_10L: 13, ca_ziel: 85,  mg_ziel: 38, ph_min: 5.8, ph_max: 6.2, fmin: 55, fmax: 67, hinweis: '' },
  { phase: 'Bloom', woche: 3, key: 'Bloom|03',  ec_ziel: 3.0, grow_g_10L: 0,    bloom_g_10L: 20.3, core_g_10L: 12.2, fade_mL_10L: 0,  cleanse_t1_mL_10L: 5,  cleanse_t7_mL_10L: 13, ca_ziel: 100, mg_ziel: 45, ph_min: 6.0, ph_max: 6.4, fmin: 60, fmax: 72, hinweis: '' },
  { phase: 'Bloom', woche: 4, key: 'Bloom|04',  ec_ziel: 3.0, grow_g_10L: 0,    bloom_g_10L: 20.3, core_g_10L: 12.2, fade_mL_10L: 0,  cleanse_t1_mL_10L: 5,  cleanse_t7_mL_10L: 13, ca_ziel: 105, mg_ziel: 48, ph_min: 6.0, ph_max: 6.4, fmin: 63, fmax: 75, hinweis: '' },
  { phase: 'Bloom', woche: 5, key: 'Bloom|05',  ec_ziel: 3.0, grow_g_10L: 0,    bloom_g_10L: 20.3, core_g_10L: 12.2, fade_mL_10L: 0,  cleanse_t1_mL_10L: 5,  cleanse_t7_mL_10L: 13, ca_ziel: 110, mg_ziel: 50, ph_min: 6.0, ph_max: 6.4, fmin: 65, fmax: 77, hinweis: '' },
  { phase: 'Bloom', woche: 6, key: 'Bloom|06',  ec_ziel: 3.0, grow_g_10L: 0,    bloom_g_10L: 20.3, core_g_10L: 12.2, fade_mL_10L: 0,  cleanse_t1_mL_10L: 5,  cleanse_t7_mL_10L: 13, ca_ziel: 112, mg_ziel: 52, ph_min: 6.0, ph_max: 6.4, fmin: 65, fmax: 77, hinweis: '' },
  { phase: 'Bloom', woche: 7, key: 'Bloom|07',  ec_ziel: 3.0, grow_g_10L: 0,    bloom_g_10L: 20.3, core_g_10L: 12.2, fade_mL_10L: 0,  cleanse_t1_mL_10L: 5,  cleanse_t7_mL_10L: 13, ca_ziel: 110, mg_ziel: 50, ph_min: 6.0, ph_max: 6.4, fmin: 62, fmax: 74, hinweis: '' },
  { phase: 'Bloom', woche: 8, key: 'Bloom|08',  ec_ziel: 1.5, grow_g_10L: 0,    bloom_g_10L: 9.4,  core_g_10L: 5.7,  fade_mL_10L: 22, cleanse_t1_mL_10L: 8,  cleanse_t7_mL_10L: 14, ca_ziel: 100, mg_ziel: 45, ph_min: 6.0, ph_max: 6.4, fmin: 48, fmax: 60, hinweis: '' },
  { phase: 'Bloom', woche: 9, key: 'Bloom|09',  ec_ziel: 1.5, grow_g_10L: 0,    bloom_g_10L: 9.4,  core_g_10L: 5.7,  fade_mL_10L: 30, cleanse_t1_mL_10L: 13, cleanse_t7_mL_10L: 26, ca_ziel: 65,  mg_ziel: 28, ph_min: 6.0, ph_max: 6.4, fmin: 28, fmax: 40, hinweis: '' },
];

// ─── LEGACY LOOKUP HELPERS ───────────────────────────────────────────────

export function getSchemaRow(phase: Phase, woche: number): SchemaRow | undefined {
  const key = `${phase}|${String(woche).padStart(2, '0')}`;
  return SCHEMA.find(r => r.key === key);
}

export function getWasserProfil(name: string): WasserProfil | undefined {
  return WASSER_PROFILE.find(p => p.name === name);
}

export function getProdukt(typ: CalMagTyp): Produkt {
  if (typ === 'A') return PRODUKTE[0];   // Athena CalMag
  if (typ === 'BB') return PRODUKTE[2];  // BioBizz CalMag
  return PRODUKTE[1];                     // CANNA CalMag
}

export function getMonoMg(): Produkt {
  return PRODUKTE[3];
}

/** All valid phases (legacy — for Athena only) */
export const PHASES: Phase[] = ['Clone', 'Veg', 'Bloom'];

/** Valid weeks per phase (legacy — for Athena only) */
export const WOCHEN_PER_PHASE: Record<Phase, number[]> = {
  Clone: [1, 2],
  Veg:   [1, 2, 3, 4],
  Bloom: [1, 2, 3, 4, 5, 6, 7, 8, 9],
};

/** Total grow duration in days (legacy) */
export const TOTAL_DAYS = 105;

/** Calculate day-of-grow from phase/woche/tag (legacy) */
export function growDay(phase: Phase, woche: number, tag: number): number {
  let days = 0;
  if (phase === 'Veg' || phase === 'Bloom') days += 2 * 7;
  if (phase === 'Bloom') days += 4 * 7;
  days += (woche - 1) * 7 + tag;
  return days;
}
