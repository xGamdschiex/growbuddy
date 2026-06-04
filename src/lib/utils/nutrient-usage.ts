/**
 * Nutrient-Usage — aggregiert den Düngerverbrauch eines Grows pro Produkt.
 *
 * Idee: Für jeden Check-in mit watered=true + water_ml + Grow-feedline_id wird das
 * Düngerschema (Phase + Woche) gelesen und die im Wasser enthaltene Menge jedes
 * Produkts (g oder mL) hochgerechnet.
 *
 * Faktor:
 *  - Wenn `ec_measured` UND `schema.ec_ziel` vorhanden: faktor = clamp(ec_measured / ec_ziel, 0.3, 1.2)
 *    → Wenn der User halb so stark dosiert (gemessen 1.5 vs Ziel 3.0), zählen wir nur die halbe Menge.
 *  - Sonst: faktor = 1.0 (100% Schema-Dosierung).
 *
 * Reservoir-Logik: water_ml ist die TATSÄCHLICH gegebene Wassermenge.
 * `calcProductDosierung` interpretiert reservoir_L → wir geben water_ml/1000 rein.
 *
 * Output enthält:
 *  - `byProduct`: pro Produkt-Key Total + Einheit + n_checkins
 *  - `history`: pro Check-in welche Mengen wann gegeben wurden (Chart-fähig)
 */

import type { CheckIn, Grow } from '$lib/stores/grow';
import { getFeedLine } from '$lib/calc/feedlines/registry';
import {
	getSchemaForWeek,
	calcProductDosierung,
	type FeedLine,
	type FeedProduct,
} from '$lib/calc/feedlines/types';

export interface ProductUsage {
	/** Produkt-Key wie 'grow', 'bloom', 'core' */
	key: string;
	/** Display-Name 'Pro Grow' */
	name: string;
	/** g | mL */
	einheit: 'g' | 'mL';
	/** Summe über alle Check-ins (in einheit) */
	total: number;
	/** Ø pro Anwendung (= total / n_checkins) */
	avg_per_application: number;
	/** Anzahl Check-ins die dieses Produkt enthielten (Dosierung > 0) */
	n_checkins: number;
	/** Welche Produkt-Kategorie ('base' | 'supplement' | ...) — für UI-Gruppierung */
	kategorie: FeedProduct['kategorie'];
}

export interface UsageHistoryPoint {
	/** Check-in created_at */
	created_at: string;
	/** Grow-Tag relativ zu started_at (1-basiert) */
	day: number;
	/** Wassermenge in L */
	water_l: number;
	/** Phase + Woche dieses Check-ins */
	phase: string;
	week: number;
	/** Pro Produkt-Key: Menge in seiner Einheit */
	per_product: Record<string, number>;
	/** Faktor der verwendet wurde (1.0 = 100%) */
	faktor: number;
}

export interface PhaseUsage {
	/** Phase-Name, z.B. 'Veg', 'Bloom' */
	phase: string;
	/** Anzahl Düng-Check-ins in dieser Phase */
	n_checkins: number;
	/** Summe Wassermenge L in dieser Phase */
	water_l: number;
	/** Produkte mit ihrem Total in dieser Phase, sortiert nach Total absteigend */
	products: ProductUsage[];
}

/**
 * v1.4.6: Diagnostische Stats pro Phase — zeigt User WARUM eine Phase keine
 * Düngungs-Daten produziert hat. Wird für ALLE Phasen mit ≥1 Check-in befüllt,
 * unabhängig vom Düngungs-Filter.
 */
export interface PhaseCheckinStats {
	/** Phase-Name */
	phase: string;
	/** Alle Check-ins in dieser Phase (auch ohne Wasser/Dünger) */
	n_total: number;
	/** Check-ins mit watered=true UND water_ml>0 */
	n_watered: number;
	/** Check-ins die in `byPhase` gewertet wurden (alle 3 Filter erfüllt + Schema gefunden) */
	n_fertigated: number;
	/** Check-ins die gewertet wären (Filter erfüllt) aber Schema fehlte */
	n_skipped: number;
}

export interface NutrientUsageResult {
	/** Düngerlinie die für die Berechnung benutzt wurde, oder null wenn Grow keine hat / unbekannt */
	feedline: FeedLine | null;
	/** Aggregat pro Produkt (alle Phasen), sortiert nach Total absteigend */
	byProduct: ProductUsage[];
	/** Aggregat pro Phase mit eigener Produkt-Liste, sortiert chronologisch nach Phase-Reihenfolge der Feedline */
	byPhase: PhaseUsage[];
	/**
	 * v1.4.6: Diagnose-Stats für ALLE Phasen mit Check-ins (auch ohne Düngung).
	 * Damit kann UI dem User zeigen warum Phase X keine Daten hat.
	 */
	phaseCheckinStats: PhaseCheckinStats[];
	/** Chronologische History für Chart */
	history: UsageHistoryPoint[];
	/** Wie viele Check-ins überhaupt mit Düngung gewertet wurden */
	n_fertigated_checkins: number;
	/** Wie viele Check-ins übersprungen wurden (kein Schema für Phase/Woche, kein water_ml, etc.) */
	n_skipped_checkins: number;
	/** Summe Wassermenge L (nur gewertete Check-ins) */
	total_water_l: number;
}

const EMPTY: NutrientUsageResult = {
	feedline: null,
	byProduct: [],
	byPhase: [],
	phaseCheckinStats: [],
	history: [],
	n_fertigated_checkins: 0,
	n_skipped_checkins: 0,
	total_water_l: 0,
};

/**
 * Hauptfunktion: berechnet Düngerverbrauch für einen Grow.
 *
 * Berücksichtigt nur Check-ins mit:
 *  - watered = true
 *  - nutrients_given = true
 *  - water_ml > 0
 *  - passende Schema-Zeile für Phase + Woche
 *
 * Edge-Cases:
 *  - Grow ohne feedline_id → leeres Result (feedline=null)
 *  - feedline_id unbekannt im Registry → leeres Result
 *  - Phase/Woche nicht im Schema (z.B. 'Seedling' nicht definiert) → Check-in übersprungen
 */
export function calcNutrientUsage(grow: Grow, allCheckins: CheckIn[]): NutrientUsageResult {
	if (!grow.feedline_id) return EMPTY;
	const feedline = getFeedLine(grow.feedline_id);
	if (!feedline) return EMPTY;

	// Bloom-Wochen für total_weeks-Skalierung: gewichteter Durchschnitt aus strains[].flowering_weeks
	let totalBloomWeeks: number | undefined;
	const strains = grow.strains ?? [];
	if (strains.length > 0) {
		const total = strains.reduce((s, e) => s + (e.plant_count || 0), 0);
		if (total > 0) {
			const wAvg = strains.reduce((s, e) => s + (e.flowering_weeks ?? 0) * (e.plant_count || 0), 0) / total;
			if (wAvg > 0) totalBloomWeeks = Math.round(wAvg);
		}
	}

	const checkins = allCheckins
		.filter((c) => c.grow_id === grow.id)
		.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

	const startMs = new Date(grow.started_at).getTime();

	// Akkumulator pro Produkt-Key (gesamt)
	const totals = new Map<string, { name: string; einheit: 'g' | 'mL'; total: number; n: number; kategorie: FeedProduct['kategorie'] }>();
	// Akkumulator pro Phase → pro Produkt
	const byPhaseMap = new Map<string, { n: number; water_l: number; products: Map<string, { name: string; einheit: 'g' | 'mL'; total: number; n: number; kategorie: FeedProduct['kategorie'] }> }>();
	// v1.4.6: Diagnostische Stats pro Phase (ALLE Check-ins, vor Filter)
	const phaseStatsMap = new Map<string, { n_total: number; n_watered: number; n_fertigated: number; n_skipped: number }>();
	const history: UsageHistoryPoint[] = [];
	let n_fertigated = 0;
	let n_skipped = 0;
	let total_water_l = 0;

	for (const ci of checkins) {
		// v1.4.6: Diagnostik FÜR ALLE Check-ins sammeln (vor Filter)
		const phaseKey = ci.phase || 'Unbekannt';
		let stats = phaseStatsMap.get(phaseKey);
		if (!stats) {
			stats = { n_total: 0, n_watered: 0, n_fertigated: 0, n_skipped: 0 };
			phaseStatsMap.set(phaseKey, stats);
		}
		stats.n_total++;
		const hasWaterMl = ci.water_ml != null && ci.water_ml > 0;
		if (ci.watered && hasWaterMl) stats.n_watered++;

		// Nur Check-ins mit echter Wassergabe + Dünger
		if (!ci.watered || !ci.nutrients_given || !hasWaterMl) continue;
		n_fertigated++;

		const schema = getSchemaForWeek(feedline, ci.phase, ci.week, ci.phase === 'Bloom' ? totalBloomWeeks : undefined);
		if (!schema) {
			n_skipped++;
			stats.n_skipped++;
			continue;
		}
		stats.n_fertigated++;

		// EC-basierter Faktor: wenn gemessen < Ziel → User dosiert schwächer
		let faktor = 1.0;
		if (ci.ec_measured != null && schema.ec_ziel > 0) {
			faktor = ci.ec_measured / schema.ec_ziel;
			// Clamp damit Ausreißer (Schema 0.4 → ec_measured 2.0 = 500%) nicht alles verzerren
			if (faktor < 0.3) faktor = 0.3;
			if (faktor > 1.2) faktor = 1.2;
		}

		const water_l = (ci.water_ml as number) / 1000;
		total_water_l += water_l;
		const per_product: Record<string, number> = {};

		// Phase-Bucket vorbereiten
		let phaseBucket = byPhaseMap.get(ci.phase);
		if (!phaseBucket) {
			phaseBucket = { n: 0, water_l: 0, products: new Map() };
			byPhaseMap.set(ci.phase, phaseBucket);
		}
		phaseBucket.n += 1;
		phaseBucket.water_l += water_l;

		for (const product of feedline.produkte) {
			const schemaMenge = schema.dosierungen[product.key];
			if (!schemaMenge || schemaMenge <= 0) continue;

			// calcProductDosierung erwartet faktor als Prozent
			const result = calcProductDosierung(product, schemaMenge, water_l, faktor * 100);
			const menge = result.menge_tank;
			if (menge <= 0) continue;

			per_product[product.key] = menge;

			// Gesamt-Total
			const acc = totals.get(product.key);
			if (acc) {
				acc.total += menge;
				acc.n += 1;
			} else {
				totals.set(product.key, {
					name: product.name,
					einheit: product.einheit,
					total: menge,
					n: 1,
					kategorie: product.kategorie,
				});
			}

			// Pro Phase
			const pacc = phaseBucket.products.get(product.key);
			if (pacc) {
				pacc.total += menge;
				pacc.n += 1;
			} else {
				phaseBucket.products.set(product.key, {
					name: product.name,
					einheit: product.einheit,
					total: menge,
					n: 1,
					kategorie: product.kategorie,
				});
			}
		}

		// Grow-Tag (1-basiert). Math.max für Edge-Case "Check-in vor Start" (Edit-Bug-Resilience).
		const day = Math.max(1, Math.floor((new Date(ci.created_at).getTime() - startMs) / 86400000) + 1);

		history.push({
			created_at: ci.created_at,
			day,
			water_l,
			phase: ci.phase,
			week: ci.week,
			per_product,
			faktor,
		});
	}

	const byProduct: ProductUsage[] = Array.from(totals.entries())
		.map(([key, v]) => ({
			key,
			name: v.name,
			einheit: v.einheit,
			total: Math.round(v.total * 100) / 100,
			avg_per_application: v.n > 0 ? Math.round((v.total / v.n) * 100) / 100 : 0,
			n_checkins: v.n,
			kategorie: v.kategorie,
		}))
		.sort((a, b) => b.total - a.total);

	// Phase-Order aus Feedline (Clone → Veg → Bloom → Flush) — Phasen die nicht im Schema sind kommen ans Ende
	const phaseOrder = new Map(feedline.phasen.map((p, i) => [p.name, i]));
	const byPhase: PhaseUsage[] = Array.from(byPhaseMap.entries())
		.map(([phase, bucket]) => ({
			phase,
			n_checkins: bucket.n,
			water_l: Math.round(bucket.water_l * 100) / 100,
			products: Array.from(bucket.products.entries())
				.map(([key, v]) => ({
					key,
					name: v.name,
					einheit: v.einheit,
					total: Math.round(v.total * 100) / 100,
					avg_per_application: v.n > 0 ? Math.round((v.total / v.n) * 100) / 100 : 0,
					n_checkins: v.n,
					kategorie: v.kategorie,
				}))
				.sort((a, b) => b.total - a.total),
		}))
		.sort((a, b) => (phaseOrder.get(a.phase) ?? 999) - (phaseOrder.get(b.phase) ?? 999));

	// v1.4.6: phaseCheckinStats (sortiert nach Feedline-Phase-Order)
	const phaseCheckinStats: PhaseCheckinStats[] = Array.from(phaseStatsMap.entries())
		.map(([phase, s]) => ({ phase, ...s }))
		.sort((a, b) => (phaseOrder.get(a.phase) ?? 999) - (phaseOrder.get(b.phase) ?? 999));

	return {
		feedline,
		byProduct,
		byPhase,
		phaseCheckinStats,
		history,
		n_fertigated_checkins: n_fertigated,
		n_skipped_checkins: n_skipped,
		total_water_l: Math.round(total_water_l * 100) / 100,
	};
}

/**
 * Hilfsfunktion: Series pro Produkt für Chart-Plot.
 *
 * Liefert für einen Produkt-Key die Tag- + Wert-Arrays (gleicher Schemastil wie
 * andere Stats-Series). Tage ohne Dosierung dieses Produkts werden NICHT
 * eingetragen (sparse), damit der Chart nicht durch 0-Werte verzerrt wird.
 */
export function productSeries(
	history: UsageHistoryPoint[],
	productKey: string,
): { days: number[]; values: number[] } {
	const days: number[] = [];
	const values: number[] = [];
	for (const h of history) {
		const v = h.per_product[productKey];
		if (v != null && v > 0) {
			days.push(h.day);
			values.push(Math.round(v * 100) / 100);
		}
	}
	return { days, values };
}

/**
 * Hilfsfunktion: kumulierte Series pro Produkt (Total bis Tag X).
 * Praktisch für "wie viel hab ich bis Tag 42 insgesamt verbraucht"-Charts.
 */
export function productSeriesCumulative(
	history: UsageHistoryPoint[],
	productKey: string,
): { days: number[]; values: number[] } {
	const days: number[] = [];
	const values: number[] = [];
	let cum = 0;
	for (const h of history) {
		const v = h.per_product[productKey];
		if (v != null && v > 0) {
			cum += v;
			days.push(h.day);
			values.push(Math.round(cum * 100) / 100);
		}
	}
	return { days, values };
}

// ─── FORECAST ────────────────────────────────────────────────────────────

export interface ProductForecast {
	key: string;
	name: string;
	einheit: 'g' | 'mL';
	/** Bisher verbraucht (Σ aller Phasen) */
	used: number;
	/** Voraussichtlich bis Schema-Ende noch nötig */
	remaining_est: number;
	/** Voraussichtlicher Total = used + remaining_est */
	total_est: number;
	kategorie: FeedProduct['kategorie'];
}

export interface UsageForecast {
	/** Aktuelle Phase laut Schema (z.B. 'Bloom') */
	current_phase: string;
	/** Tag in aktueller Phase (1-basiert) */
	current_day_in_phase: number;
	/** Schema-Tage gesamt für aktuelle Phase */
	schema_days_total: number;
	/** Restdauer aktuelle Phase + alle Folge-Phasen (Schema-Tage) */
	remaining_days_total: number;
	/** Forecast pro Produkt */
	products: ProductForecast[];
	/** Gesamt-Wasser-Voraussage (L) */
	water_remaining_est_l: number;
	/** Aktueller Ø-Verbrauch pro Tag (für Transparenz) */
	avg_water_per_day_l: number;
}

/**
 * Schätzt verbleibenden Düngerverbrauch bis Schema-Ende.
 *
 * Vereinfachte Heuristik: extrapoliert den DURCHSCHNITTLICHEN Tages-Verbrauch
 * der letzten Wochen über die noch verbleibenden Schema-Tage hinweg.
 *
 * Nicht-perfekt aber sehr nützlich:
 *  - Athena Schema variiert zwischen Phasen + Wochen — wir mitteln drüber
 *  - Trifft Größenordnung für Nachbestell-Entscheidungen
 *  - User sieht den Ø-Wert + kann selbst grob korrigieren
 *
 * Voraussetzung: ≥1 Düng-Check-in mit water_ml. Sonst Forecast = null.
 */
export function calcUsageForecast(
	usage: NutrientUsageResult,
	currentPhase: string,
	currentDayInPhase: number,
	totalDaysCovered: number,  // Tage seit Grow-Start an denen schon gedüngt wurde (etwa = letzter Düng-Tag)
): UsageForecast | null {
	if (!usage.feedline || usage.history.length === 0 || totalDaysCovered <= 0) return null;

	const line = usage.feedline;
	const phaseConfig = line.phasen.find((p) => p.name === currentPhase);
	if (!phaseConfig) return null;

	const schema_days_total = phaseConfig.schema_wochen * 7;
	// Tage übrig in aktueller Phase laut Schema (kann negativ sein wenn User über Schema hinaus geht)
	const days_left_in_current_phase = Math.max(0, schema_days_total - currentDayInPhase);

	// Restdauer aktuelle + Folge-Phasen
	const phaseOrder = line.phasen;
	const currentIdx = phaseOrder.findIndex((p) => p.name === currentPhase);
	let remaining_days_total = days_left_in_current_phase;
	if (currentIdx >= 0) {
		for (let i = currentIdx + 1; i < phaseOrder.length; i++) {
			remaining_days_total += phaseOrder[i].schema_wochen * 7;
		}
	}

	// Ø-Verbrauch pro Tag: aus History den Daily-Average bilden
	const avg_water_per_day_l = usage.total_water_l / totalDaysCovered;

	const products: ProductForecast[] = usage.byProduct.map((p) => {
		const avg_per_day = p.total / totalDaysCovered;
		const remaining_est = avg_per_day * remaining_days_total;
		return {
			key: p.key,
			name: p.name,
			einheit: p.einheit,
			used: p.total,
			remaining_est: Math.round(remaining_est * 10) / 10,
			total_est: Math.round((p.total + remaining_est) * 10) / 10,
			kategorie: p.kategorie,
		};
	});

	return {
		current_phase: currentPhase,
		current_day_in_phase: currentDayInPhase,
		schema_days_total,
		remaining_days_total,
		products,
		water_remaining_est_l: Math.round(avg_water_per_day_l * remaining_days_total * 10) / 10,
		avg_water_per_day_l: Math.round(avg_water_per_day_l * 100) / 100,
	};
}
