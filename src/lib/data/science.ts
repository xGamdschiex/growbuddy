/**
 * Wissenschaftliche Referenzdaten für Cannabis-Kultivierung
 * Quellen: Peer-reviewed Papers, offizielle Herstellerangaben, Dr. Bruce Bugbee (Utah State)
 * Stand: 2024-2025
 */

// ─── GROW-PHASEN ─────────────────────────────────────────────────────

export type GrowPhase = 'seedling' | 'vegetative' | 'early_flower' | 'late_flower' | 'drying' | 'curing';
export type Medium = 'soil' | 'coco' | 'hydro';

export const PHASE_LABELS: Record<GrowPhase, string> = {
	seedling: 'Sämling / Klon',
	vegetative: 'Vegetation',
	early_flower: 'Frühe Blüte',
	late_flower: 'Späte Blüte',
	drying: 'Trocknung',
	curing: 'Curing',
};

// ─── VPD (Vapor Pressure Deficit) ────────────────────────────────────

export interface VPDTarget {
	min: number;  // kPa
	max: number;
	temp_min: number;  // °C
	temp_max: number;
	rh_min: number;    // %
	rh_max: number;
}

export const VPD_TARGETS: Record<string, VPDTarget> = {
	seedling:     { min: 0.4, max: 0.8, temp_min: 24, temp_max: 26, rh_min: 65, rh_max: 75 },
	vegetative:   { min: 0.8, max: 1.2, temp_min: 24, temp_max: 28, rh_min: 55, rh_max: 65 },
	early_flower: { min: 1.0, max: 1.4, temp_min: 24, temp_max: 26, rh_min: 50, rh_max: 60 },
	late_flower:  { min: 1.2, max: 1.6, temp_min: 22, temp_max: 25, rh_min: 40, rh_max: 50 },
};

/**
 * VPD berechnen aus Lufttemperatur, Blatttemperatur und Luftfeuchtigkeit.
 * Blatttemp ca. 1-2°C unter Lufttemp (Default: -2°C).
 */
export function calcVPD(tempAir: number, rh: number, leafOffset = -2): number {
	const tempLeaf = tempAir + leafOffset;
	const svpAir = 0.6108 * Math.exp((17.27 * tempAir) / (tempAir + 237.3));
	const svpLeaf = 0.6108 * Math.exp((17.27 * tempLeaf) / (tempLeaf + 237.3));
	const avp = svpAir * (rh / 100);
	return round(svpLeaf - avp, 2);
}

export function getVPDStatus(vpd: number, phase: string): 'low' | 'optimal' | 'high' {
	const target = VPD_TARGETS[phase];
	if (!target) return 'optimal';
	if (vpd < target.min) return 'low';
	if (vpd > target.max) return 'high';
	return 'optimal';
}

// ─── DLI (Daily Light Integral) ──────────────────────────────────────

export interface DLITarget {
	ppfd_min: number;   // µmol/m²/s
	ppfd_max: number;
	hours: number;      // Photoperiode
	dli_min: number;    // mol/m²/d
	dli_max: number;
}

export const DLI_TARGETS: Record<string, DLITarget> = {
	seedling:     { ppfd_min: 150, ppfd_max: 300, hours: 18, dli_min: 10, dli_max: 20 },
	vegetative:   { ppfd_min: 400, ppfd_max: 600, hours: 18, dli_min: 25, dli_max: 40 },
	flower:       { ppfd_min: 600, ppfd_max: 900, hours: 12, dli_min: 30, dli_max: 40 },
	flower_co2:   { ppfd_min: 900, ppfd_max: 1200, hours: 12, dli_min: 40, dli_max: 50 },
};

/** DLI = PPFD × Stunden × 3600 / 1.000.000 */
export function calcDLI(ppfd: number, hours: number): number {
	return round((ppfd * hours * 3600) / 1_000_000, 1);
}

/** PPFD nötig für Ziel-DLI bei gegebener Photoperiode */
export function ppfdForDLI(dli: number, hours: number): number {
	if (hours <= 0) return 0;
	return round((dli * 1_000_000) / (hours * 3600), 0);
}

// ─── pH-BEREICHE ─────────────────────────────────────────────────────

export const PH_RANGES: Record<Medium, { min: number; max: number }> = {
	soil:  { min: 6.2, max: 6.8 },
	coco:  { min: 5.8, max: 6.2 },
	hydro: { min: 5.5, max: 6.0 },
};

// ─── EC-ZIELWERTE ────────────────────────────────────────────────────

export const EC_TARGETS: Record<string, { min: number; max: number }> = {
	seedling:     { min: 0.4, max: 0.8 },
	early_veg:    { min: 0.8, max: 1.2 },
	late_veg:     { min: 1.2, max: 1.6 },
	early_flower: { min: 1.4, max: 1.8 },
	late_flower:  { min: 1.6, max: 2.2 },
	flush:        { min: 0.0, max: 0.3 },
};

// ─── NÄHRSTOFF-MOBILITÄT ─────────────────────────────────────────────

export type NutrientMobility = 'mobile' | 'immobile';

export interface NutrientInfo {
	symbol: string;
	name: string;
	mobility: NutrientMobility;
	deficiency_appears: string;  // 'alte Blätter' | 'neue Blätter'
}

export const NUTRIENTS: NutrientInfo[] = [
	{ symbol: 'N',  name: 'Stickstoff', mobility: 'mobile',   deficiency_appears: 'Alte Blätter zuerst' },
	{ symbol: 'P',  name: 'Phosphor',   mobility: 'mobile',   deficiency_appears: 'Alte Blätter zuerst' },
	{ symbol: 'K',  name: 'Kalium',     mobility: 'mobile',   deficiency_appears: 'Alte Blätter zuerst' },
	{ symbol: 'Ca', name: 'Calcium',    mobility: 'immobile', deficiency_appears: 'Neue Blätter zuerst' },
	{ symbol: 'Mg', name: 'Magnesium',  mobility: 'mobile',   deficiency_appears: 'Alte Blätter zuerst' },
	{ symbol: 'S',  name: 'Schwefel',   mobility: 'immobile', deficiency_appears: 'Neue Blätter zuerst' },
	{ symbol: 'Fe', name: 'Eisen',      mobility: 'immobile', deficiency_appears: 'Neue Blätter zuerst' },
	{ symbol: 'Mn', name: 'Mangan',     mobility: 'immobile', deficiency_appears: 'Neue Blätter zuerst' },
	{ symbol: 'Zn', name: 'Zink',       mobility: 'mobile',   deficiency_appears: 'Alte Blätter zuerst' },
	{ symbol: 'B',  name: 'Bor',        mobility: 'immobile', deficiency_appears: 'Neue Blätter zuerst' },
	{ symbol: 'Cu', name: 'Kupfer',     mobility: 'immobile', deficiency_appears: 'Neue Blätter zuerst' },
	{ symbol: 'Mo', name: 'Molybdän',   mobility: 'mobile',   deficiency_appears: 'Alte Blätter zuerst' },
];

// ─── TROCKNUNG & CURING ──────────────────────────────────────────────

export const DRYING_PARAMS = {
	temp_min: 18,       // °C
	temp_max: 21,
	rh_min: 55,         // %
	rh_max: 62,
	days_min: 10,
	days_max: 14,
	darkness: true,
	airflow: 'indirekt',  // Kein Ventilator direkt auf Pflanzen
	done_indicator: 'Kleine Zweige knacken (nicht biegen)',
};

export const CURING_PARAMS = {
	container: 'Luftdichte Gläser, 75% voll',
	target_rh: { min: 58, max: 62 },  // % im Glas
	burping: [
		{ weeks: '1-2', frequency: '2-3x täglich, je 10-15 Min' },
		{ weeks: '3',   frequency: '1x täglich' },
		{ weeks: '4+',  frequency: 'Alle 2-3 Tage' },
	],
	minimum_weeks: 4,
	optimal_weeks: 8,
	temp_min: 18,
	temp_max: 22,
	darkness: true,
};

// ─── TRAINING-TECHNIKEN ──────────────────────────────────────────────

export interface TrainingTechnique {
	id: string;
	name: string;
	type: 'LST' | 'HST';
	auto_safe: boolean;
	when: string;
	description: string;
}

export const TRAINING_TECHNIQUES: TrainingTechnique[] = [
	{
		id: 'lst',
		name: 'LST (Low Stress Training)',
		type: 'LST',
		auto_safe: true,
		when: 'Ab 4. Node, durchgehend bis Woche 2 Blüte',
		description: 'Triebe sanft herunterbiegen und fixieren für gleichmäßiges Canopy',
	},
	{
		id: 'topping',
		name: 'Topping',
		type: 'HST',
		auto_safe: false,
		when: 'Am 4.-6. Node, nur in Veg',
		description: 'Haupttrieb abschneiden → 2 neue Triebe. Nicht bei Autos!',
	},
	{
		id: 'fim',
		name: 'FIM (Fuck I Missed)',
		type: 'HST',
		auto_safe: false,
		when: 'Am 4.-5. Node',
		description: '80% des neuen Wachstums abschneiden → bis zu 4 neue Triebe',
	},
	{
		id: 'mainlining',
		name: 'Mainlining',
		type: 'HST',
		auto_safe: false,
		when: '3. Node toppen, symmetrisch aufbauen',
		description: 'Symmetrische Struktur mit 8-16 gleichmäßigen Colas. Min. 4 Wochen Veg nötig.',
	},
	{
		id: 'scrog',
		name: 'ScrOG (Screen of Green)',
		type: 'LST',
		auto_safe: true,
		when: 'Netz bei 40cm, tucken bis Woche 2 Blüte',
		description: 'Netz über den Pflanzen, Triebe hindurchflechten. Beste Erträge/m² indoor.',
	},
	{
		id: 'supercropping',
		name: 'Supercropping',
		type: 'HST',
		auto_safe: false,
		when: 'Späte Veg, zu hohe Triebe',
		description: 'Stängel vorsichtig knicken (nicht brechen) → stärkere Knoten',
	},
	{
		id: 'defoliation',
		name: 'Defoliation (Schwartz-Methode)',
		type: 'HST',
		auto_safe: false,
		when: 'Tag 1 + Tag 21 Blüte',
		description: 'Große Fächerblätter entfernen für bessere Lichtdurchdringung. Nur für erfahrene Grower.',
	},
];

// ─── HELPER ──────────────────────────────────────────────────────────

function round(n: number, decimals: number): number {
	const f = Math.pow(10, decimals);
	return Math.round(n * f) / f;
}
