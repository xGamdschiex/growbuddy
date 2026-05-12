/**
 * Harvest-Predict — grobe Schätzung von Ertrag (g) und verbleibenden Tagen bis Harvest.
 *
 * Disclaimer: Yield-Predict ohne PPFD/Watt-Daten ist eine Schätzung mit ±50% Bandbreite.
 * Wir zeigen daher Range-Werte (~80g · ~50d) statt Punktschätzungen.
 *
 * Algorithmus:
 *  daysUntilHarvest = expectedTotalDays(strain_type) - currentGrowDays
 *  yield_g          = baseYieldPerPlant × plant_count × performance_multiplier
 *
 * Performance-Multiplier 0.6-1.1 abhängig von:
 *  - VPD-In-Range-Rate
 *  - Temp-In-Range-Rate
 *  - Check-in-Konsistenz (Streak-Proxy)
 */

import { inRangeStats, type MetricKey } from './phase-targets';

export type StrainType = 'auto' | 'photo';

/**
 * Default-Werte pro Strain-Typ:
 *  - vegWeeks: typische Veg-Dauer (wird genutzt wenn der Grow noch nicht in Bloom ist)
 *  - floweringWeeks: typische Bloom-Dauer (User kann pro Strain überschreiben)
 *  - yieldPerPlant: Basis-Ertrag (Photo > Auto wegen meist größerer Pflanzen)
 */
const STRAIN_DEFAULTS = {
	auto: { vegWeeks: 4, floweringWeeks: 5, yieldPerPlant: 50 },
	photo: { vegWeeks: 5, floweringWeeks: 9, yieldPerPlant: 70 },
} as const;

export interface HarvestPredictInput {
	strainType: StrainType;
	plantCount: number;
	currentGrowDays: number;
	/** Wenn gesetzt: Bloom-Wochen für DIESEN Strain (User-Override). Default je nach strainType. */
	floweringWeeks?: number;
	/**
	 * Tag im Grow, an dem die Bloom-Phase begann (aus check-ins ableiten).
	 * Wenn null/undefined: Grow ist noch nicht in Bloom (Veg/Seedling).
	 */
	bloomStartDay?: number | null;
	/** Check-ins (chronologisch sortiert) mit Temp/RH/VPD-Werten zur Performance-Bestimmung */
	checkins: Array<{
		phase?: string | null;
		temp?: number | null;
		rh?: number | null;
		vpd?: number | null;
	}>;
}

export interface HarvestPredictResult {
	daysUntilHarvest: number;
	yieldGrams: number;
	yieldRange: { min: number; max: number };
	totalDaysExpected: number;
	performanceMultiplier: number; // 0.6 - 1.1
	/** Confidence-Level basierend auf Datenmenge: 'low' (wenig CIs), 'medium', 'high' */
	confidence: 'low' | 'medium' | 'high';
}

/**
 * Hauptfunktion: berechnet Harvest-Schätzung.
 *
 * Algorithmus:
 *  - Wenn `bloomStartDay` gesetzt (Grow schon in Bloom): harvestDay = bloomStartDay + floweringWeeks×7
 *  - Sonst (Veg/Seedling): harvestDay = vegWeeks×7 + floweringWeeks×7 (full lifecycle estimate)
 *
 * Edge-Cases:
 *  - plant_count <= 0 → 0g Yield, totalDays/2 als Rest
 *  - keine Check-ins → confidence='low', perfMultiplier=1.0 (Default)
 *  - currentGrowDays > totalDaysExpected → daysUntilHarvest = 0 (Auto-Harvest)
 */
export function predictHarvest(input: HarvestPredictInput): HarvestPredictResult {
	const { strainType, plantCount, currentGrowDays, checkins, bloomStartDay } = input;
	const defaults = STRAIN_DEFAULTS[strainType] ?? STRAIN_DEFAULTS.photo;
	const floweringWeeks = input.floweringWeeks && input.floweringWeeks > 0
		? input.floweringWeeks
		: defaults.floweringWeeks;
	const floweringDays = floweringWeeks * 7;

	// Erwartetes Harvest-Datum: relativ zu Bloom-Start (wenn in Bloom) oder via vegWeeks+floweringWeeks
	let harvestDay: number;
	if (typeof bloomStartDay === 'number' && bloomStartDay >= 0) {
		harvestDay = bloomStartDay + floweringDays;
	} else {
		harvestDay = defaults.vegWeeks * 7 + floweringDays;
	}
	const totalDaysExpected = harvestDay;
	const daysUntilHarvest = Math.max(0, harvestDay - currentGrowDays);

	// Performance-Multiplier aus In-Range-Raten von VPD, Temp.
	let performanceMultiplier = 1.0;
	let confidence: 'low' | 'medium' | 'high' = 'low';

	const validCis = checkins.filter((c) => c.phase);
	if (validCis.length >= 5) {
		const vpdVals = validCis
			.filter((c) => typeof c.vpd === 'number')
			.map((c) => ({ ci: c, value: c.vpd! }));
		const tempVals = validCis
			.filter((c) => typeof c.temp === 'number')
			.map((c) => ({ ci: c, value: c.temp! }));

		const vpdStats = inRangeStats('vpd' as MetricKey, vpdVals);
		const tempStats = inRangeStats('temp' as MetricKey, tempVals);

		// Gewichteter Score: VPD 50% + Temp 50%, jeweils Range 0..1
		const scores: number[] = [];
		if (vpdStats.total > 0) scores.push(vpdStats.rate);
		if (tempStats.total > 0) scores.push(tempStats.rate);
		const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.7;

		// Map 0..1 → 0.6..1.1 (gute Werte boosten leicht, schlechte halbieren NICHT komplett)
		performanceMultiplier = Math.max(0.6, Math.min(1.1, 0.6 + avgScore * 0.5));

		confidence = validCis.length >= 20 ? 'high' : 'medium';
	}

	const baseYield = defaults.yieldPerPlant * Math.max(0, plantCount);
	const yieldGrams = Math.round(baseYield * performanceMultiplier);

	// Range ±25% (Strain-Varianz, Setup-Unsicherheit)
	const yieldRange = {
		min: Math.round(yieldGrams * 0.75),
		max: Math.round(yieldGrams * 1.25),
	};

	return {
		daysUntilHarvest,
		yieldGrams,
		yieldRange,
		totalDaysExpected,
		performanceMultiplier,
		confidence,
	};
}

/**
 * Per-Strain Predict: berechnet pro Strain-Entry einen Yield-Predict
 * mit gleichem Performance-Multiplier (alle Strains im gleichen Grow haben
 * dieselben Klimabedingungen).
 *
 * Pro Strain kann eigene `flowering_weeks` (Bloom-Dauer) gesetzt sein → eigenes
 * daysUntilHarvest.
 *
 * Gesamt-Yield = Σ der Per-Strain-Yields. Gesamt-daysUntilHarvest = max der Strains
 * (= wann der LETZTE Strain fertig ist).
 */
export function predictHarvestPerStrain(
	strainEntries: Array<{ strain: string; plant_count: number; flowering_weeks?: number }>,
	baseInput: Omit<HarvestPredictInput, 'plantCount' | 'floweringWeeks'>,
): Array<HarvestPredictResult & { strain: string; plantCount: number; floweringWeeks: number }> {
	const defaults = STRAIN_DEFAULTS[baseInput.strainType] ?? STRAIN_DEFAULTS.photo;
	// Gemeinsamer Performance-Multiplier (gleiches Klima für alle Strains)
	const totalPlants = strainEntries.reduce((s, e) => s + (e.plant_count || 0), 0);
	const refTotal = predictHarvest({ ...baseInput, plantCount: totalPlants });

	return strainEntries.map((e) => {
		const fw = e.flowering_weeks && e.flowering_weeks > 0 ? e.flowering_weeks : defaults.floweringWeeks;
		// Strain-individueller Predict: gleiche Bloom-Start aber eigene flowering_weeks
		const perStrain = predictHarvest({
			...baseInput,
			plantCount: e.plant_count || 0,
			floweringWeeks: fw,
		});
		// Performance-Multiplier vom Gesamt-Predict übernehmen (klimaabhängig, gleich für alle)
		const baseYield = defaults.yieldPerPlant * Math.max(0, e.plant_count || 0);
		const yieldGrams = Math.round(baseYield * refTotal.performanceMultiplier);
		return {
			strain: e.strain,
			plantCount: e.plant_count,
			floweringWeeks: fw,
			daysUntilHarvest: perStrain.daysUntilHarvest,
			totalDaysExpected: perStrain.totalDaysExpected,
			performanceMultiplier: refTotal.performanceMultiplier,
			confidence: refTotal.confidence,
			yieldGrams,
			yieldRange: {
				min: Math.round(yieldGrams * 0.75),
				max: Math.round(yieldGrams * 1.25),
			},
		};
	});
}

/** Hilfsfunktion: formatiert Tage als "~Nd" oder "in Kürze" wenn ≤ 3. */
export function formatDaysUntil(days: number): string {
	if (days <= 0) return 'Erntereif';
	if (days <= 3) return `in ${days}d`;
	if (days <= 14) return `~${days}d`;
	const weeks = Math.round(days / 7);
	return `~${weeks} Wochen`;
}

/** Hilfsfunktion: formatiert Yield-Range als "~80g (60-100g)". */
export function formatYieldRange(g: number, range: { min: number; max: number }): string {
	if (g === 0) return '–';
	return `~${g}g`;
}
