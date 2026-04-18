/**
 * GrowBuddy — Nutrient Calculation Engine
 *
 * Generisch für alle Düngerlinien (Athena, CANNA, BioBizz, AN, GH, Atami).
 *
 * Berechnung:
 * - Schema-Lookup by phase + woche (mit Stretch für längere Strains)
 * - EC-Soll = Schema_EC * faktor/100 * unit_factor + LW_EC * hahn_pct/100 * unit_factor
 * - Produkt-Dosierungen: schema_value * faktor/100 * reservoir_scale
 * - Cleanse ramp (Athena): linear T1→T7
 * - CalMag (optional): Ca-First Logik
 * - Medium-abhängige pH-Korrektur
 */

import type { FeedLine, FeedSchemaRow, GenericCalcInput, DosierungResult, FeedProduct } from './feedlines/types';
import { getSchemaForWeek, calcProductDosierung } from './feedlines/types';
import { getFeedLine } from './feedlines/registry';
import type { WasserProfil } from './schema';
import { getWasserProfil, PRODUKTE } from './schema';
import type { ECEinheit } from './units';
import { unitFactor } from './units';
import { calcAutoFaktor, calcFaktor, type FaktorModus } from './factor';
import { calcCalMag, calcHahnPct, type CalMagResult, type CalMagInput } from './calmag';

import type { CalMagTyp } from './schema';

export interface CalcInput {
  wasserprofil: string;
  phase: string;
  woche: number;
  tag: number;
  strain: string;
  reservoir_L: number;
  faktor_modus: FaktorModus;
  faktor_manuell: number;
  calmag_typ: CalMagTyp;
  ec_einheit: ECEinheit;
  ist_ec?: number;
  ist_ph?: number;
  feedline_id?: string;
  medium?: 'hydro' | 'coco' | 'erde';
  /** Hat der User RO-Wasser? Default: false (die meisten Grower haben kein RO) */
  hat_ro?: boolean;
  /** Custom Wasserprofil (wenn 'Benutzerdefiniert' gewählt) */
  custom_wasser?: { ca: number; mg: number; ec: number; ph: number };
}

// ─── GENERIC RESULT ──────────────────────────────────────────────────────

export interface CalcResult {
  // FeedLine Info
  feedline: FeedLine;

  // Schema reference
  schema: FeedSchemaRow;
  profil: WasserProfil;

  // Factor
  faktor_aktiv: number;
  faktor_auto: number;

  // Water mix
  hahn_pct: number;
  ro_L: number;
  lw_L: number;
  lw_ec: number;

  // EC
  ec_ziel_raw: number;
  ec_soll: number;

  // Generische Dosierungen (für alle Lines)
  dosierungen: DosierungResult[];

  // Legacy Athena-Felder (für backwards-compat, 0 bei anderen Lines)
  grow_g: number;
  bloom_g: number;
  core_g: number;
  fade_mL: number;
  cleanse_mL_per_10L: number;
  cleanse_mL_tank: number;

  // CalMag (optional)
  calmag: CalMagResult;

  // pH
  ph_min: number;
  ph_max: number;
  ph_ziel: string;

  // Validations
  ec_check: string;
  ph_check: string;
  ec_budget_ok: boolean;
  ec_budget_warnung: string;

  // Mix steps
  mix_steps: MixStep[];
}

export interface MixStep {
  nr: number;
  label: string;
  detail: string;
  menge: string;
}

// ─── MAIN CALCULATION ─────────────────────────────────────────────────────

export function calculate(input: CalcInput): CalcResult {
  const feedline_id = input.feedline_id ?? 'athena-pro';
  const feedline = getFeedLine(feedline_id);
  if (!feedline) {
    throw new Error(`FeedLine not found: ${feedline_id}`);
  }

  // Schema-Lookup (mit Stretch-Support)
  const schema = getSchemaForWeek(feedline, input.phase, input.woche);
  if (!schema) {
    throw new Error(`Schema not found: ${feedline_id} ${input.phase}|W${input.woche}`);
  }

  const profil = getWasserProfil(input.wasserprofil, input.custom_wasser);
  if (!profil) {
    throw new Error(`Wasserprofil not found: ${input.wasserprofil}`);
  }

  const uf = unitFactor(input.ec_einheit);

  // ── Factor ──
  let faktor: number;
  let faktor_auto: number;

  if (feedline.features.auto_faktor && schema.fmin !== undefined && schema.fmax !== undefined) {
    // Athena-Style: Auto-Faktor mit fmin/fmax
    // Vorwoche nachschlagen für glatte Übergänge (kein Rücksprung an Wochengrenzen)
    let prevWeekFmax: number | undefined;
    if (input.woche > 1) {
      const prevSchema = getSchemaForWeek(feedline, input.phase, input.woche - 1);
      if (prevSchema?.fmax !== undefined) {
        prevWeekFmax = prevSchema.fmax;
      }
    }
    const faktorResult = calcFaktor({
      modus: input.faktor_modus,
      manuell_pct: input.faktor_manuell,
      tag: input.tag,
      schema: { fmin: schema.fmin, fmax: schema.fmax } as any,
      prevWeekFmax,
    });
    faktor = faktorResult.aktiv_pct;
    faktor_auto = faktorResult.auto_pct;
  } else {
    // Andere Lines: Manueller Faktor (Default 100%)
    faktor = input.faktor_modus === 'Manuell' ? input.faktor_manuell : 100;
    faktor_auto = 100;
  }

  // ── Water mix (Hahn-Anteil) ──
  let hahn_pct: number;
  const hat_ro = input.hat_ro === true; // Default false — die meisten Grower haben kein RO
  if (!hat_ro) {
    // Kein RO-Wasser → 100% Leitungswasser
    hahn_pct = 100;
  } else if (feedline.features.calmag_ziele && schema.ca_ziel !== undefined) {
    // Athena: Hahn-Anteil basiert auf Ca-Ziel
    hahn_pct = calcHahnPctGeneric(schema.ca_ziel, profil);
  } else {
    // Andere Lines: Einfacher Hahn-Anteil basiert auf EC-Budget
    hahn_pct = calcHahnPctByEC(schema.ec_ziel, profil);
  }

  const lw_L = round(input.reservoir_L * hahn_pct / 100, 1);
  const ro_L = round(input.reservoir_L * (1 - hahn_pct / 100), 1);
  const lw_ec = round(profil.ec * uf, 2);

  // ── EC-Soll ──
  const ec_ziel_raw = schema.ec_ziel;

  // Ohne RO: LW-EC verbraucht EC-Budget → Dosierung muss runter
  // ABER: Bei organischen Lines (BioBizz) ist EC nicht aussagekräftig → keine Reduktion
  const lw_ec_anteil = profil.ec * (hahn_pct / 100);
  let dosierfaktor = faktor;
  let ec_budget_warnung = '';
  const ist_organisch = feedline.typ === 'organisch';

  if (!hat_ro && profil.ec > 0.05 && !ist_organisch) {
    // Nur bei mineralischen Lines: EC-Budget-Reduktion
    const ec_fuer_naehrstoffe = Math.max(ec_ziel_raw - lw_ec_anteil, 0);
    if (ec_ziel_raw > 0) {
      const reduktion = ec_fuer_naehrstoffe / ec_ziel_raw;
      dosierfaktor = round(faktor * reduktion, 1);
      if (reduktion < 0.5) {
        ec_budget_warnung = `LW-EC (${profil.ec}) verbraucht >50% des EC-Budgets!`;
      }
    }
    if (lw_ec_anteil >= ec_ziel_raw) {
      ec_budget_warnung = `LW-EC (${profil.ec}) bereits >= Ziel-EC (${ec_ziel_raw}) — keine Duengung noetig!`;
      dosierfaktor = 0;
    }
  } else if (!hat_ro && ist_organisch) {
    // Organisch: Volle Dosierung laut Schema, EC nur als grober Richtwert
    ec_budget_warnung = '';
  }

  const ec_soll = round(
    ist_organisch
      ? ec_ziel_raw * (faktor / 100) * uf  // Organisch: EC ist nur Schätzwert, LW-EC nicht addieren
      : ec_ziel_raw * (dosierfaktor / 100) * uf + lw_ec_anteil * uf,
    2
  );

  // ── Produkt-Dosierungen (generisch) ──
  const dosierungen: DosierungResult[] = [];
  for (const product of feedline.produkte) {
    // Skip Cleanse — wird separat berechnet (Athena Rampe)
    if (product.key === 'cleanse') continue;

    const schemaMenge = schema.dosierungen[product.key] ?? 0;
    if (schemaMenge <= 0) continue;

    // Phasen-Filter: Nur aktiv in bestimmten Phasen?
    if (product.nur_phasen && product.nur_phasen.length > 0) {
      if (!product.nur_phasen.includes(input.phase)) continue;
    }

    dosierungen.push(calcProductDosierung(product, schemaMenge, input.reservoir_L, dosierfaktor));
  }

  // ── Cleanse (Athena-spezifisch: T1→T7 Rampe) ──
  let cleanse_mL_per_10L = 0;
  let cleanse_mL_tank = 0;
  if (feedline.features.cleanse_rampe && schema.cleanse_t1 !== undefined && schema.cleanse_t7 !== undefined) {
    cleanse_mL_per_10L = round(
      schema.cleanse_t1 + (schema.cleanse_t7 - schema.cleanse_t1) * (input.tag - 1) / 6,
      2
    );
    cleanse_mL_tank = round(cleanse_mL_per_10L * (input.reservoir_L / 10), 2);
  }

  // ── CalMag ──
  let calmag: CalMagResult;
  if (feedline.features.calmag_ziele && schema.ca_ziel !== undefined && schema.mg_ziel !== undefined) {
    // Athena: Volle CalMag-Berechnung mit Ca/Mg-Zielen
    calmag = calcCalMag({
      schema: { ca_ziel: schema.ca_ziel, mg_ziel: schema.mg_ziel } as any,
      profil,
      hahn_pct,
      reservoir_L: input.reservoir_L,
      typ: input.calmag_typ,
    });
  } else if (feedline.features.calmag_empfohlen) {
    // Andere Lines: Vereinfachte CalMag-Berechnung (Schätzwerte)
    const estimated_ca = estimateCalMagTargets(schema.ec_ziel, input.phase);
    calmag = calcCalMag({
      schema: { ca_ziel: estimated_ca.ca, mg_ziel: estimated_ca.mg } as any,
      profil,
      hahn_pct,
      reservoir_L: input.reservoir_L,
      typ: input.calmag_typ,
    });
  } else {
    // Kein CalMag
    calmag = emptyCalMagResult();
  }

  // ── Legacy Athena-Felder (backwards-compat) ──
  const grow_g = getDosierungMenge(dosierungen, 'grow');
  const bloom_g = getDosierungMenge(dosierungen, 'bloom');
  const core_g = getDosierungMenge(dosierungen, 'core');
  const fade_mL = getDosierungMenge(dosierungen, 'fade');

  // ── pH (medium-abhängig) ──
  let ph_min = schema.ph_min;
  let ph_max = schema.ph_max;
  const medium = input.medium ?? 'coco';
  if (medium === 'erde' && ph_min < 6.0) {
    ph_min = 6.0;
    ph_max = Math.max(ph_max, 6.5);
  } else if (medium === 'hydro' && ph_max > 6.2) {
    ph_min = Math.min(ph_min, 5.5);
    ph_max = 6.0;
  }
  const ph_ziel = `${ph_min} - ${ph_max}`;

  // ── Validation ──
  let ec_check = '--';
  if (input.ist_ec !== undefined && input.ist_ec > 0) {
    const deviation = Math.abs(input.ist_ec - ec_soll);
    ec_check = deviation < ec_soll * 0.15 ? 'OK' : 'Abweichung > 15%';
  }

  let ph_check = '--';
  if (input.ist_ph !== undefined && input.ist_ph > 0) {
    ph_check = (input.ist_ph >= ph_min && input.ist_ph <= ph_max) ? 'OK' : 'Ausserhalb';
  }

  const ec_budget_ok = profil.ec <= ec_ziel_raw * (dosierfaktor / 100 + 0.3);

  // ── Mix Steps ──
  const mix_steps = buildMixSteps({
    feedline, dosierungen, calmag,
    cleanse_mL_tank, ro_L, lw_L,
    ph_ziel, ec_soll, input, schema,
  });

  return {
    feedline, schema, profil,
    faktor_aktiv: dosierfaktor,
    faktor_auto,
    hahn_pct, ro_L, lw_L, lw_ec,
    ec_ziel_raw, ec_soll,
    dosierungen,
    grow_g, bloom_g, core_g, fade_mL,
    cleanse_mL_per_10L, cleanse_mL_tank,
    calmag,
    ph_min, ph_max, ph_ziel,
    ec_check, ph_check, ec_budget_ok, ec_budget_warnung,
    mix_steps,
  };
}

// ─── HAHN-ANTEIL HELPERS ─────────────────────────────────────────────────

/** Athena-Style: Hahn-Anteil basiert auf Ca-Ziel des Profils */
function calcHahnPctGeneric(ca_ziel: number, profil: WasserProfil): number {
  if (profil.ca < 0.001) return 100;
  const ratio = ca_ziel / (profil.ca + 0.001);
  return Math.round(Math.min(ratio, 1) * 100);
}

/** Generisch: Hahn-Anteil basiert auf EC-Budget (Leitungswasser-EC vs. Ziel-EC) */
function calcHahnPctByEC(ec_ziel: number, profil: WasserProfil): number {
  if (profil.ec < 0.01) return 100;  // RO Wasser → 100% Hahn
  // Max. Hahn-Anteil so dass LW-EC nicht > 30% des Ziel-EC ausmacht
  const maxHahn = (ec_ziel * 0.3) / profil.ec;
  return Math.round(Math.min(maxHahn, 1) * 100);
}

// ─── CALMAG HELPERS ──────────────────────────────────────────────────────

/** Schätzwerte für Ca/Mg-Ziel basierend auf EC (für Lines ohne eigene Ziele) */
function estimateCalMagTargets(ec_ziel: number, phase: string): { ca: number; mg: number } {
  // Faustregel: Ca ~ 40-50x EC, Mg ~ 15-20x EC
  const isBloom = phase.toLowerCase().includes('bloom') || phase.toLowerCase().includes('flower');
  return {
    ca: round(ec_ziel * (isBloom ? 45 : 35), 0),
    mg: round(ec_ziel * (isBloom ? 18 : 12), 0),
  };
}

/** Leeres CalMag-Result (für Lines ohne CalMag) */
function emptyCalMagResult(): CalMagResult {
  return {
    calmag_mLpL: 0, mono_mg_mLpL: 0,
    calmag_mL_total: 0, mono_mg_mL_total: 0,
    tropfen_pL: 0, tropfen_total: 0,
    ca_ist: 0, mg_ist: 0, mg_via_calmag: 0,
    delta_ca: 0, delta_mg: 0,
    camg_ratio: 0, ratio_ok: true,
    ca_basis: 0, mg_basis: 0,
    delta_ca_needed: 0, delta_mg_needed: 0,
  };
}

// ─── DOSIERUNG HELPER ────────────────────────────────────────────────────

function getDosierungMenge(dosierungen: DosierungResult[], key: string): number {
  const d = dosierungen.find(d => d.product.key === key);
  return d ? d.menge_tank : 0;
}

// ─── MIX STEPS (generisch) ──────────────────────────────────────────────

interface MixStepInput {
  feedline: FeedLine;
  dosierungen: DosierungResult[];
  calmag: CalMagResult;
  cleanse_mL_tank: number;
  ro_L: number;
  lw_L: number;
  ph_ziel: string;
  ec_soll: number;
  input: CalcInput;
  schema: FeedSchemaRow;
}

function buildMixSteps(p: MixStepInput): MixStep[] {
  const steps: MixStep[] = [];
  let nr = 1;

  // CalMag-Label
  const calmagLabels: Record<string, string> = { A: 'Athena CalMag', B: 'CANNA CalMag', BB: 'BioBizz CalMag' };
  const calmag_name = calmagLabels[p.input.calmag_typ] ?? 'CalMag';

  // Helper: CalMag + MonoMg Steps
  function addCalMagSteps() {
    if (p.calmag.mono_mg_mL_total > 0) {
      steps.push({
        nr: nr++,
        label: 'Mono Mg',
        detail: `${p.calmag.mono_mg_mLpL} mL/L`,
        menge: `${p.calmag.mono_mg_mL_total} mL`,
      });
    }
    if (p.calmag.calmag_mL_total > 0) {
      steps.push({
        nr: nr++,
        label: calmag_name,
        detail: `${p.calmag.calmag_mLpL} mL/L`,
        menge: `${p.calmag.calmag_mL_total} mL`,
      });
    }
  }

  // Helper: Produkt-Dosierungen
  function addProductSteps() {
    for (const d of p.dosierungen) {
      const schemaLabel = d.product.pro === '10L'
        ? `${d.menge_schema} ${d.product.einheit}/10L`
        : `${d.menge_schema} ${d.product.einheit}/L`;
      steps.push({
        nr: nr++,
        label: d.product.einheit === 'g'
          ? `${d.product.name} einwiegen`
          : `${d.product.name} abmessen`,
        detail: `Schema: ${schemaLabel}`,
        menge: d.display,
      });
    }
  }

  // Step 1: Wasser
  const hat_ro = p.input.hat_ro !== false;
  steps.push({
    nr: nr++,
    label: 'Wasser befuellen',
    detail: hat_ro
      ? `${p.ro_L} L RO + ${p.lw_L} L Leitungswasser`
      : `${p.input.reservoir_L} L Leitungswasser (kein RO)`,
    menge: `${p.input.reservoir_L} L`,
  });

  // Mischreihenfolge abhängig von Düngerlinie
  const lineId = p.feedline.id;

  if (lineId === 'atami-bcuzz') {
    // Atami: CalMag ZUERST, dann A, dann B, dann Rest
    addCalMagSteps();
    addProductSteps();
  } else if (lineId === 'athena-pro') {
    // Athena: Mono Mg → CalMag → Cleanse → Produkte
    addCalMagSteps();
    if (p.cleanse_mL_tank > 0) {
      steps.push({
        nr: nr++,
        label: 'Cleanse',
        detail: `${p.cleanse_mL_tank} mL auf Tank`,
        menge: `${p.cleanse_mL_tank} mL`,
      });
    }
    addProductSteps();
  } else {
    // BioBizz, GH Feeding: Produkte → CalMag
    addProductSteps();
    addCalMagSteps();
  }

  // pH einstellen
  steps.push({
    nr: nr++,
    label: 'pH einstellen',
    detail: `Zielbereich: ${p.ph_ziel}`,
    menge: p.ph_ziel,
  });

  // EC kontrollieren
  steps.push({
    nr: nr++,
    label: 'EC kontrollieren',
    detail: `EC-Soll: ${p.ec_soll}`,
    menge: `${p.ec_soll}`,
  });

  return steps;
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
