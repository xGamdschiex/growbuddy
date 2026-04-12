/**
 * AutoPot Athena v3 - CalMag Calculation (Ca-First Logic)
 *
 * Strategy:
 * 1. Determine Ca-Basis from tap water * hahn_pct
 * 2. Delta_Ca = Ca_Ziel - Ca_Basis
 * 3. CalMag mL/L = Delta_Ca / Ca_per_mL of chosen product
 * 4. Mg via CalMag = CalMag_mL * Mg_per_mL
 * 5. Mono Mg tops up remaining Mg deficit (50 mg/mL)
 * 6. Check Ca:Mg ratio (target 2.0-2.8)
 */

import type { SchemaRow, WasserProfil, CalMagTyp } from './schema';
import { getProdukt, getMonoMg } from './schema';

export interface CalMagInput {
  schema: SchemaRow;
  profil: WasserProfil;
  hahn_pct: number;      // 0-100
  reservoir_L: number;
  typ: CalMagTyp;        // 'A' = Athena, 'B' = CANNA
}

export interface CalMagResult {
  // Per-liter values
  calmag_mLpL: number;
  mono_mg_mLpL: number;
  // Tank totals
  calmag_mL_total: number;
  mono_mg_mL_total: number;
  // Tropfen
  tropfen_pL: number;
  tropfen_total: number;
  // Resulting mineral levels (mg/L)
  ca_ist: number;
  mg_ist: number;
  mg_via_calmag: number;
  // Deltas (0 = perfect, negative = surplus)
  delta_ca: number;
  delta_mg: number;
  // Ratio
  camg_ratio: number;
  ratio_ok: boolean;
  // Basis values
  ca_basis: number;
  mg_basis: number;
  delta_ca_needed: number;
  delta_mg_needed: number;
}

/** Calculate the tap-water percentage (Hahn-Anteil) based on Ca target */
export function calcHahnPct(schema: SchemaRow, profil: WasserProfil): number {
  if (profil.ca < 0.001) return 100;
  const ratio = schema.ca_ziel / (profil.ca + 0.001);
  return Math.round(Math.min(ratio, 1) * 100);
}

/** Full CalMag calculation */
export function calcCalMag(input: CalMagInput): CalMagResult {
  const { schema, profil, hahn_pct, reservoir_L, typ } = input;
  const produkt = getProdukt(typ);
  const monoMg = getMonoMg();

  // Basis from tap water
  const ca_basis = round(profil.ca * hahn_pct / 100, 1);
  const mg_basis = round(profil.mg * hahn_pct / 100, 1);

  // Deficits
  const delta_ca_needed = Math.max(schema.ca_ziel - ca_basis, 0);
  const delta_mg_needed = Math.max(schema.mg_ziel - mg_basis, 0);

  // CalMag dosage (Ca-first: dose to meet Ca target)
  const calmag_mLpL = round(Math.max(delta_ca_needed / produkt.ca_per_mL, 0), 4);
  const calmag_mL_total = round(calmag_mLpL * reservoir_L, 3);

  // Tropfen
  const tropfen_pL = round(calmag_mLpL * produkt.tropfen_per_mL, 1);
  const tropfen_total = round(tropfen_pL * reservoir_L, 1);

  // Ca achieved
  const ca_ist = round(ca_basis + calmag_mLpL * produkt.ca_per_mL, 1);

  // Mg from CalMag
  const mg_via_calmag = round(calmag_mLpL * produkt.mg_per_mL, 1);

  // Mono Mg top-up: 2 Stufen
  // 1. Schema-Defizit ausgleichen (Mg-Ziel - Mg-Basis - Mg-via-CalMag)
  const mg_deficit_remaining = Math.max(delta_mg_needed - mg_via_calmag, 0);
  let mono_mg_mLpL_base = mg_deficit_remaining / monoMg.mg_per_mL;

  // 2. Ratio-Korrektur: Wenn Ca:Mg nach Schritt 1 noch > 2.8, Mono Mg hochskalieren
  //    Ziel-Ratio: 2.4 (Mitte des Fensters 2.0-2.8)
  const mg_nach_base = mg_basis + mg_via_calmag + mono_mg_mLpL_base * monoMg.mg_per_mL;
  const ratio_nach_base = mg_nach_base > 0 ? ca_ist / mg_nach_base : 99;
  const ZIEL_RATIO = 2.4;

  let mono_mg_extra = 0;
  if (ratio_nach_base > 2.8 && ca_ist > 0) {
    // Mg noetig fuer Ziel-Ratio: ca_ist / ZIEL_RATIO = mg_noetig
    const mg_noetig = ca_ist / ZIEL_RATIO;
    const mg_extra_needed = Math.max(mg_noetig - mg_nach_base, 0);
    mono_mg_extra = mg_extra_needed / monoMg.mg_per_mL;
  }

  const mono_mg_mLpL = round(Math.max(mono_mg_mLpL_base + mono_mg_extra, 0), 4);
  const mono_mg_mL_total = round(mono_mg_mLpL * reservoir_L, 2);

  // Mg achieved
  const mg_ist = round(mg_basis + mg_via_calmag + mono_mg_mLpL * monoMg.mg_per_mL, 1);

  // Deltas vs target
  const delta_ca = round(ca_ist - schema.ca_ziel, 1);
  const delta_mg = round(mg_ist - schema.mg_ziel, 1);

  // Ca:Mg ratio
  const camg_ratio = mg_ist > 0 ? round(ca_ist / mg_ist, 2) : 0;
  const ratio_ok = camg_ratio >= 2.0 && camg_ratio <= 2.8;

  return {
    calmag_mLpL,
    mono_mg_mLpL,
    calmag_mL_total,
    mono_mg_mL_total,
    tropfen_pL,
    tropfen_total,
    ca_ist,
    mg_ist,
    mg_via_calmag,
    delta_ca,
    delta_mg,
    camg_ratio,
    ratio_ok,
    ca_basis,
    mg_basis,
    delta_ca_needed,
    delta_mg_needed,
  };
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
