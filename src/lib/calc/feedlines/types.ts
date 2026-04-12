/**
 * FeedLine System — Generische Types für alle Düngerlinien
 *
 * Jede Düngerlinie (Athena, BioBizz, GH Feeding, Atami, etc.)
 * implementiert dieses Interface. Die Calc-Engine arbeitet generisch damit.
 */

// ─── CORE TYPES ──────────────────────────────────────────────────────────

export interface FeedLine {
  id: string;                      // 'athena-pro', 'biobizz', 'gh-grow', 'atami-bcuzz'
  name: string;                    // 'Athena Pro Line'
  hersteller: string;              // 'Athena Ag'
  typ: 'mineral' | 'organisch' | 'hybrid';
  medien: Medium[];                // Für welche Medien geeignet

  produkte: FeedProduct[];         // Variable Anzahl Produkte
  phasen: PhaseConfig[];           // Phasen-Definition mit flexiblen Wochen
  schema: FeedSchemaRow[];         // Dosierungstabelle

  // Feature-Flags: nicht jede Line hat alles
  features: FeedLineFeatures;

  // Line-spezifische Hinweise für den User
  hinweise?: string[];
}

export type Medium = 'hydro' | 'coco' | 'erde';

export interface FeedLineFeatures {
  /** Athena-Style Auto-Faktor (fmin/fmax Interpolation über 7 Tage) */
  auto_faktor: boolean;
  /** Hat eigene Ca/Mg-Zielwerte im Schema (Athena) */
  calmag_ziele: boolean;
  /** Hat Cleanse-Produkt mit T1/T7 Rampe (Athena) */
  cleanse_rampe: boolean;
  /** Hat Fade-Out Phase (Athena Bloom W8-9) */
  fade: boolean;
  /** CalMag-Ergänzung empfohlen (für weiches Wasser / RO) */
  calmag_empfohlen: boolean;
}

// ─── PRODUCTS ────────────────────────────────────────────────────────────

export interface FeedProduct {
  key: string;                     // Eindeutiger Schlüssel: 'grow', 'bio_bloom', 'pk1314'
  name: string;                    // Display: 'Pro Grow', 'Bio-Bloom', 'PK 13-14'
  einheit: 'g' | 'mL';            // Pulver vs. Flüssig
  pro: 'L' | '10L';               // Bezugsgröße: BioBizz=mL/L, Athena=g/10L, GH=g/L
  kategorie: ProductKategorie;
  icon: string;                    // Für Mix-UI: 'scale', 'flask', 'beaker', etc.
  /** Nur in bestimmten Phasen aktiv? Leer = alle Phasen */
  nur_phasen?: string[];
}

export type ProductKategorie = 'base' | 'supplement' | 'booster' | 'enzyme' | 'stimulator';

// ─── SCHEMA (Dosierungstabelle) ──────────────────────────────────────────

export interface FeedSchemaRow {
  phase: string;                   // Generisch: 'Clone', 'Seedling', 'Growth', etc.
  woche: number;
  ec_ziel: number;                 // mS/cm (alle Lines)
  ph_min: number;
  ph_max: number;
  /** Dosierungen pro Produkt-Key → Menge in der Einheit des Produkts */
  dosierungen: Record<string, number>;
  /** Optional: Athena-spezifische Felder */
  fmin?: number;
  fmax?: number;
  ca_ziel?: number;                // mg/L
  mg_ziel?: number;                // mg/L
  /** Cleanse-Rampe (Athena) */
  cleanse_t1?: number;
  cleanse_t7?: number;
  hinweis?: string;
}

// ─── PHASE CONFIG ────────────────────────────────────────────────────────

export interface PhaseConfig {
  name: string;                    // 'Clone', 'Veg', 'Bloom', 'Seedling', 'Growth', etc.
  /** Wochen laut offiziellem Schema */
  schema_wochen: number;
  /** Max. Wochen die der User einstellen kann (für längere Strains) */
  max_wochen: number;
  /**
   * Stretch-Strategie: Was passiert bei Wochen > schema_wochen?
   * - 'repeat_last': Letzte Schema-Woche wiederholen
   * - 'repeat_peak': Vorletzte Woche wiederholen (letzte = Flush/Fade)
   * - 'hold_ec': EC halten, Dosierung der Peak-Woche
   */
  stretch: 'repeat_last' | 'repeat_peak' | 'hold_ec';
}

// ─── CALC I/O (generisch) ────────────────────────────────────────────────

export interface GenericCalcInput {
  feedline_id: string;
  wasserprofil: string;
  phase: string;                   // Generisch, nicht mehr hardcoded Phase type
  woche: number;
  tag: number;                     // 1-7
  strain: string;
  reservoir_L: number;
  faktor_modus: 'Auto' | 'Manuell';
  faktor_manuell: number;
  calmag_typ: 'A' | 'B';          // Athena / CANNA CalMag
  ec_einheit: 'mS/cm' | 'ppm500' | 'ppm700';
  medium?: Medium;                 // Für Lines die medium-abhängig dosieren
  ist_ec?: number;
  ist_ph?: number;
}

export interface DosierungResult {
  product: FeedProduct;
  /** Wert aus Schema (z.B. 20.3 g/10L oder 4 mL/L) */
  menge_schema: number;
  /** Skaliert auf Tank (Reservoir * Faktor) */
  menge_tank: number;
  /** Display-Einheit */
  display: string;                 // z.B. '95.8 g' oder '188 mL'
}

// ─── HELPERS ─────────────────────────────────────────────────────────────

/**
 * Findet die Schema-Zeile für Phase+Woche.
 * Bei Wochen > schema_wochen wird die Stretch-Strategie angewandt.
 */
export function getSchemaForWeek(
  line: FeedLine,
  phase: string,
  woche: number
): FeedSchemaRow | undefined {
  // Direkte Suche
  const direct = line.schema.find(r => r.phase === phase && r.woche === woche);
  if (direct) return direct;

  // Phase-Config finden
  const phaseConfig = line.phasen.find(p => p.name === phase);
  if (!phaseConfig) return undefined;

  // Woche liegt außerhalb des Schemas → Stretch
  if (woche > phaseConfig.schema_wochen && woche <= phaseConfig.max_wochen) {
    const rows = line.schema.filter(r => r.phase === phase);
    if (rows.length === 0) return undefined;

    switch (phaseConfig.stretch) {
      case 'repeat_last':
        return rows[rows.length - 1];
      case 'repeat_peak':
        // Vorletzte Woche (Peak), falls > 1 Woche existiert
        return rows.length > 1 ? rows[rows.length - 2] : rows[rows.length - 1];
      case 'hold_ec':
        return rows[rows.length - 1];
      default:
        return rows[rows.length - 1];
    }
  }

  return undefined;
}

/**
 * Gibt alle verfügbaren Wochen für eine Phase zurück (inkl. Stretch)
 */
export function getWochenForPhase(line: FeedLine, phase: string): number[] {
  const config = line.phasen.find(p => p.name === phase);
  if (!config) return [];
  return Array.from({ length: config.max_wochen }, (_, i) => i + 1);
}

/**
 * Berechnet die Dosierung für ein Produkt, skaliert auf Tank
 */
export function calcProductDosierung(
  product: FeedProduct,
  schemaMenge: number,
  reservoir_L: number,
  faktor_pct: number
): DosierungResult {
  const scale = faktor_pct / 100;
  let menge_tank: number;

  if (product.pro === '10L') {
    // Athena-Style: g/10L → skalieren auf Reservoir
    menge_tank = round(schemaMenge * scale * (reservoir_L / 10), 3);
  } else {
    // mL/L oder g/L → skalieren auf Reservoir
    menge_tank = round(schemaMenge * scale * reservoir_L, 3);
  }

  const display = product.einheit === 'g'
    ? `${round(menge_tank, 1)} g`
    : `${round(menge_tank, 1)} mL`;

  return {
    product,
    menge_schema: schemaMenge,
    menge_tank,
    display,
  };
}

/**
 * Berechnet den Grow-Tag (Tag im Gesamtgrow) für beliebige Phasen-Konfigurationen
 */
export function calcGrowDay(line: FeedLine, phase: string, woche: number, tag: number): number {
  let days = 0;
  for (const p of line.phasen) {
    if (p.name === phase) break;
    // Vorherige Phasen: schema_wochen * 7 Tage
    days += p.schema_wochen * 7;
  }
  days += (woche - 1) * 7 + tag;
  return days;
}

/**
 * Gesamtdauer eines Grows in Tagen (alle Phasen schema_wochen)
 */
export function calcTotalDays(line: FeedLine): number {
  return line.phasen.reduce((sum, p) => sum + p.schema_wochen * 7, 0);
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
