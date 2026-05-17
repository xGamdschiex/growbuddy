/**
 * Pure-Function-Tests für nutrient-usage.
 * Nutzt echte Feedline (athena-pro) — kein Mocking nötig, Schema-Daten sind Pure-Data.
 */

import { describe, it, expect } from 'vitest';
import { calcNutrientUsage, productSeries, productSeriesCumulative, calcUsageForecast } from './nutrient-usage';
import type { CheckIn, Grow } from '$lib/stores/grow';

const baseGrow: Grow = {
	id: 'g1',
	name: 'Test Grow',
	strain: 'OG Kush',
	strain_type: 'photo',
	medium: 'coco',
	space: '80x80',
	feedline_id: 'athena-pro',
	light_info: 'LED 200W',
	plant_count: 2,
	status: 'active',
	started_at: '2026-04-01T00:00:00.000Z',
	harvested_at: null,
	yield_g: null,
	grow_score: null,
	notes: '',
};

function ci(overrides: Partial<CheckIn> & { day: number; phase: string; week: number }): CheckIn {
	const baseDate = new Date('2026-04-01T08:00:00');
	const created = new Date(baseDate.getTime() + (overrides.day - 1) * 86400000);
	const { day, phase, week, ...rest } = overrides;
	return {
		id: `c-${day}`,
		grow_id: 'g1',
		phase,
		week,
		day,
		photo_data: null,
		photos_data: [],
		temp: null,
		rh: null,
		vpd: null,
		ec_measured: null,
		ph_measured: null,
		watered: false,
		nutrients_given: false,
		water_ml: null,
		nutrient_ml: null,
		training: null,
		notes: '',
		created_at: created.toISOString(),
		...rest,
	};
}

describe('calcNutrientUsage', () => {
	it('liefert leeres Result wenn Grow keine feedline hat', () => {
		const g: Grow = { ...baseGrow, feedline_id: '' };
		const r = calcNutrientUsage(g, []);
		expect(r.feedline).toBeNull();
		expect(r.byProduct).toEqual([]);
		expect(r.history).toEqual([]);
	});

	it('liefert leeres Result wenn feedline_id unbekannt', () => {
		const g: Grow = { ...baseGrow, feedline_id: 'does-not-exist' };
		const r = calcNutrientUsage(g, [{ ...ci({ day: 1, phase: 'Veg', week: 1, watered: true, nutrients_given: true, water_ml: 1000 }) }]);
		expect(r.feedline).toBeNull();
	});

	it('ignoriert Check-ins ohne watered, ohne nutrients oder ohne water_ml', () => {
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Veg', week: 1, watered: false, nutrients_given: true, water_ml: 1000 }),
			ci({ day: 2, phase: 'Veg', week: 1, watered: true, nutrients_given: false, water_ml: 1000 }),
			ci({ day: 3, phase: 'Veg', week: 1, watered: true, nutrients_given: true, water_ml: null }),
			ci({ day: 4, phase: 'Veg', week: 1, watered: true, nutrients_given: true, water_ml: 0 }),
		];
		const r = calcNutrientUsage(baseGrow, checkins);
		expect(r.history).toEqual([]);
		expect(r.byProduct).toEqual([]);
		expect(r.n_fertigated_checkins).toBe(0);
	});

	it('berechnet Athena Pro Veg W1: 5L Wasser → 10.15g Pro Grow + 6.1g Pro Core', () => {
		// Schema Veg W1: grow=20.3 g/10L, core=12.2 g/10L
		// → bei 5L (= 0.5 * 10L): grow=10.15g, core=6.1g
		const checkins: CheckIn[] = [
			ci({
				day: 1, phase: 'Veg', week: 1,
				watered: true, nutrients_given: true, water_ml: 5000,
			}),
		];
		const r = calcNutrientUsage(baseGrow, checkins);
		expect(r.feedline?.id).toBe('athena-pro');
		expect(r.n_fertigated_checkins).toBe(1);
		expect(r.history.length).toBe(1);
		expect(r.history[0].faktor).toBe(1.0);
		expect(r.history[0].water_l).toBe(5);

		const grow = r.byProduct.find(p => p.key === 'grow');
		const core = r.byProduct.find(p => p.key === 'core');
		expect(grow?.total).toBeCloseTo(10.15, 1);
		expect(core?.total).toBeCloseTo(6.1, 1);
		// Pro Bloom war nicht im Schema → nicht enthalten
		expect(r.byProduct.find(p => p.key === 'bloom')).toBeUndefined();
	});

	it('aggregiert über mehrere Check-ins korrekt', () => {
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Veg', week: 1, watered: true, nutrients_given: true, water_ml: 5000 }),
			ci({ day: 3, phase: 'Veg', week: 1, watered: true, nutrients_given: true, water_ml: 5000 }),
			ci({ day: 5, phase: 'Veg', week: 2, watered: true, nutrients_given: true, water_ml: 10000 }),
		];
		const r = calcNutrientUsage(baseGrow, checkins);
		expect(r.n_fertigated_checkins).toBe(3);
		// Pro Grow: 10.15 + 10.15 + 20.3 = 40.6g
		const grow = r.byProduct.find(p => p.key === 'grow');
		expect(grow?.total).toBeCloseTo(40.6, 1);
		expect(grow?.n_checkins).toBe(3);
	});

	it('EC-Faktor: gemessen 1.5 vs Ziel 3.0 → halbiert die Dosierung', () => {
		const checkins: CheckIn[] = [
			ci({
				day: 1, phase: 'Veg', week: 1,
				watered: true, nutrients_given: true, water_ml: 10000,
				ec_measured: 1.5,
			}),
		];
		const r = calcNutrientUsage(baseGrow, checkins);
		expect(r.history[0].faktor).toBeCloseTo(0.5, 2);
		// Pro Grow Schema 20.3 g/10L bei 10L * 0.5 = 10.15g
		const grow = r.byProduct.find(p => p.key === 'grow');
		expect(grow?.total).toBeCloseTo(10.15, 1);
	});

	it('EC-Faktor clamped: ec_measured 10 vs Ziel 3.0 → maximal 1.2', () => {
		const checkins: CheckIn[] = [
			ci({
				day: 1, phase: 'Veg', week: 1,
				watered: true, nutrients_given: true, water_ml: 10000,
				ec_measured: 10,
			}),
		];
		const r = calcNutrientUsage(baseGrow, checkins);
		expect(r.history[0].faktor).toBe(1.2);
	});

	it('zählt Check-ins die ein nicht existentes Schema treffen als skipped', () => {
		// Athena-Pro hat kein 'Seedling' Schema
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Seedling', week: 1, watered: true, nutrients_given: true, water_ml: 1000 }),
		];
		const r = calcNutrientUsage(baseGrow, checkins);
		expect(r.n_fertigated_checkins).toBe(1);
		expect(r.n_skipped_checkins).toBe(1);
		expect(r.history).toEqual([]);
	});

	it('history.day ist 1-basiert relativ zu grow.started_at', () => {
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Veg', week: 1, watered: true, nutrients_given: true, water_ml: 1000 }),
			ci({ day: 7, phase: 'Veg', week: 2, watered: true, nutrients_given: true, water_ml: 1000 }),
		];
		const r = calcNutrientUsage(baseGrow, checkins);
		expect(r.history[0].day).toBe(1);
		expect(r.history[1].day).toBe(7);
	});

	it('sortiert byProduct nach Total absteigend', () => {
		// Veg W1: grow=20.3, core=12.2 → bei 10L: grow=20.3g, core=12.2g
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Veg', week: 1, watered: true, nutrients_given: true, water_ml: 10000 }),
		];
		const r = calcNutrientUsage(baseGrow, checkins);
		expect(r.byProduct[0].key).toBe('grow');
		expect(r.byProduct[1].key).toBe('core');
	});

	it('total_water_l aggregiert nur gewertete Check-ins', () => {
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Veg', week: 1, watered: true, nutrients_given: true, water_ml: 3000 }),
			ci({ day: 2, phase: 'Veg', week: 1, watered: true, nutrients_given: true, water_ml: 2000 }),
			ci({ day: 3, phase: 'Veg', week: 1, watered: true, nutrients_given: false, water_ml: 5000 }),  // skip
		];
		const r = calcNutrientUsage(baseGrow, checkins);
		expect(r.total_water_l).toBe(5);
	});
});

describe('calcNutrientUsage → byPhase', () => {
	it('schlüsselt Veg + Bloom getrennt auf', () => {
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Veg', week: 1, watered: true, nutrients_given: true, water_ml: 5000 }),
			ci({ day: 30, phase: 'Bloom', week: 1, watered: true, nutrients_given: true, water_ml: 10000 }),
		];
		const r = calcNutrientUsage(baseGrow, checkins);
		expect(r.byPhase.length).toBe(2);
		expect(r.byPhase[0].phase).toBe('Veg');
		expect(r.byPhase[1].phase).toBe('Bloom');
		// Veg: 5L → Pro Grow 10.15g, Pro Core 6.1g, KEIN Pro Bloom
		const veg = r.byPhase[0];
		expect(veg.water_l).toBe(5);
		expect(veg.products.find(p => p.key === 'grow')?.total).toBeCloseTo(10.15, 1);
		expect(veg.products.find(p => p.key === 'bloom')).toBeUndefined();
		// Bloom W1: 10L → Pro Bloom 20.3g, Pro Core 12.2g, KEIN Pro Grow
		const bloom = r.byPhase[1];
		expect(bloom.water_l).toBe(10);
		expect(bloom.products.find(p => p.key === 'bloom')?.total).toBeCloseTo(20.3, 1);
		expect(bloom.products.find(p => p.key === 'grow')).toBeUndefined();
	});

	it('sortiert Phasen nach Feedline-Reihenfolge (Clone→Veg→Bloom)', () => {
		// Erst Bloom-Check-in, dann Veg-Check-in — Output sollte trotzdem Veg vor Bloom listen
		const checkins: CheckIn[] = [
			ci({ day: 30, phase: 'Bloom', week: 1, watered: true, nutrients_given: true, water_ml: 5000 }),
			ci({ day: 1, phase: 'Veg', week: 1, watered: true, nutrients_given: true, water_ml: 5000 }),
		];
		const r = calcNutrientUsage(baseGrow, checkins);
		expect(r.byPhase.map(p => p.phase)).toEqual(['Veg', 'Bloom']);
	});

	it('byPhase ist leer wenn keine gewerteten Check-ins', () => {
		const r = calcNutrientUsage(baseGrow, []);
		expect(r.byPhase).toEqual([]);
		expect(r.total_water_l).toBe(0);
	});

	it('zählt mehrere Check-ins in gleicher Phase korrekt zusammen', () => {
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Veg', week: 1, watered: true, nutrients_given: true, water_ml: 5000 }),
			ci({ day: 3, phase: 'Veg', week: 1, watered: true, nutrients_given: true, water_ml: 5000 }),
			ci({ day: 5, phase: 'Veg', week: 2, watered: true, nutrients_given: true, water_ml: 5000 }),
		];
		const r = calcNutrientUsage(baseGrow, checkins);
		expect(r.byPhase.length).toBe(1);
		expect(r.byPhase[0].n_checkins).toBe(3);
		expect(r.byPhase[0].water_l).toBe(15);
		// Pro Grow: 3 × (5L × 20.3 g/10L) = 30.45g
		expect(r.byPhase[0].products.find(p => p.key === 'grow')?.total).toBeCloseTo(30.45, 1);
		expect(r.byPhase[0].products.find(p => p.key === 'grow')?.n_checkins).toBe(3);
	});
});

describe('productSeries / productSeriesCumulative', () => {
	const checkins: CheckIn[] = [
		ci({ day: 1, phase: 'Veg', week: 1, watered: true, nutrients_given: true, water_ml: 5000 }),
		ci({ day: 5, phase: 'Veg', week: 1, watered: true, nutrients_given: true, water_ml: 5000 }),
		ci({ day: 10, phase: 'Veg', week: 2, watered: true, nutrients_given: true, water_ml: 10000 }),
	];

	it('productSeries gibt sparse days+values für ein Produkt', () => {
		const r = calcNutrientUsage(baseGrow, checkins);
		const series = productSeries(r.history, 'grow');
		expect(series.days).toEqual([1, 5, 10]);
		expect(series.values[0]).toBeCloseTo(10.15, 1);
		expect(series.values[1]).toBeCloseTo(10.15, 1);
		expect(series.values[2]).toBeCloseTo(20.3, 1);
	});

	it('productSeriesCumulative liefert kumuliertes Total bis Tag X', () => {
		const r = calcNutrientUsage(baseGrow, checkins);
		const cum = productSeriesCumulative(r.history, 'grow');
		expect(cum.values[0]).toBeCloseTo(10.15, 1);
		expect(cum.values[1]).toBeCloseTo(20.3, 1);
		expect(cum.values[2]).toBeCloseTo(40.6, 1);
	});

	it('productSeries ignoriert Produkte die nicht in history sind', () => {
		const r = calcNutrientUsage(baseGrow, checkins);
		// 'fade' war Veg-Schema nicht enthalten (nur Bloom W8-9)
		const series = productSeries(r.history, 'fade');
		expect(series.days).toEqual([]);
		expect(series.values).toEqual([]);
	});

	it('avg_per_application = total / n_checkins', () => {
		const r = calcNutrientUsage(baseGrow, checkins);
		const grow = r.byProduct.find(p => p.key === 'grow')!;
		expect(grow.avg_per_application).toBeCloseTo(grow.total / grow.n_checkins, 1);
	});
});

describe('calcUsageForecast', () => {
	it('null wenn keine History', () => {
		const r = calcNutrientUsage(baseGrow, []);
		expect(calcUsageForecast(r, 'Veg', 1, 1)).toBeNull();
	});

	it('null wenn unbekannte Phase', () => {
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Veg', week: 1, watered: true, nutrients_given: true, water_ml: 5000 }),
		];
		const r = calcNutrientUsage(baseGrow, checkins);
		expect(calcUsageForecast(r, 'NotAPhase', 1, 1)).toBeNull();
	});

	it('schätzt verbleibenden Verbrauch in Bloom mit Athena (Schema 9W = 63d)', () => {
		// 4× Veg-Wassergaben in 14d + 2× Bloom-Wassergaben in 7d
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Veg', week: 1, watered: true, nutrients_given: true, water_ml: 5000 }),
			ci({ day: 4, phase: 'Veg', week: 1, watered: true, nutrients_given: true, water_ml: 5000 }),
			ci({ day: 8, phase: 'Veg', week: 2, watered: true, nutrients_given: true, water_ml: 5000 }),
			ci({ day: 11, phase: 'Veg', week: 2, watered: true, nutrients_given: true, water_ml: 5000 }),
			ci({ day: 30, phase: 'Bloom', week: 1, watered: true, nutrients_given: true, water_ml: 10000 }),
			ci({ day: 34, phase: 'Bloom', week: 1, watered: true, nutrients_given: true, water_ml: 10000 }),
		];
		const r = calcNutrientUsage(baseGrow, checkins);
		// User ist in Bloom Tag 7 von 63 → 56 Tage in Bloom + 0 Folge-Phasen = 56 Tage remaining
		const fc = calcUsageForecast(r, 'Bloom', 7, 34);
		expect(fc).not.toBeNull();
		expect(fc!.current_phase).toBe('Bloom');
		expect(fc!.schema_days_total).toBe(63);
		expect(fc!.remaining_days_total).toBe(56);
		// Wasser: 4× 5L (Veg) + 2× 10L (Bloom) = 40L. avg = 40L/34d ≈ 1.18 L/d
		expect(fc!.avg_water_per_day_l).toBeCloseTo(40 / 34, 1);
		expect(fc!.water_remaining_est_l).toBeCloseTo((40 / 34) * 56, 0);
		// Pro Bloom: 16.24 + 16.24 + 8.12 + 8.12 + 20.3 + 20.3 = ... war nur in Bloom W1.
		// Actually Veg Schema hat bloom=0, Bloom W1 schema bloom=20.3 g/10L. Bei 10L: 20.3g pro Anwendung
		// = 40.6g für 2 Anwendungen
		const bloom = fc!.products.find(p => p.key === 'bloom');
		expect(bloom).toBeDefined();
		expect(bloom!.used).toBeCloseTo(40.6, 1);
		expect(bloom!.remaining_est).toBeGreaterThan(0);
	});

	it('remaining_days_total = 0 wenn Phase = letzte und über Schema', () => {
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Bloom', week: 1, watered: true, nutrients_given: true, water_ml: 10000 }),
		];
		const r = calcNutrientUsage(baseGrow, checkins);
		// Athena Bloom: schema_wochen=9. User auf Tag 70 → über Schema, days_left=0
		const fc = calcUsageForecast(r, 'Bloom', 70, 1);
		expect(fc!.remaining_days_total).toBe(0);
		// Alle Forecast-Werte = 0
		expect(fc!.water_remaining_est_l).toBe(0);
		expect(fc!.products.every(p => p.remaining_est === 0)).toBe(true);
	});

	it('addiert Folge-Phasen wenn current_phase nicht die letzte ist', () => {
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Veg', week: 1, watered: true, nutrients_given: true, water_ml: 5000 }),
		];
		const r = calcNutrientUsage(baseGrow, checkins);
		// User in Veg Tag 1 von 28 (4W). Athena: Veg=4W=28d, Bloom=9W=63d.
		// remaining = (28-1) + 63 = 90
		const fc = calcUsageForecast(r, 'Veg', 1, 1);
		expect(fc!.remaining_days_total).toBe(90);
	});
});
