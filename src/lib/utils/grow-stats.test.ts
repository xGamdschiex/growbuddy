/**
 * Pure-Function-Tests für grow-stats.
 * Schnell, keine Stores/Mocks.
 */

import { describe, it, expect } from 'vitest';
import {
	metricStats,
	metricPerPhase,
	stressDays,
	checkinConsistency,
	type RangeTarget,
} from './grow-stats';
import type { CheckIn } from '$lib/stores/grow';

// Hilfs-Factory für Test-CheckIns (Defaults für nicht relevante Felder)
function ci(overrides: Partial<CheckIn> & { day: number }): CheckIn {
	const baseDate = new Date('2026-04-01T08:00:00');
	const created = new Date(baseDate.getTime() + (overrides.day - 1) * 86400000);
	const { day, ...rest } = overrides;
	return {
		id: `c-${day}`,
		grow_id: 'g1',
		phase: 'Veg',
		week: 1,
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
		updated_at: created.toISOString(),
		...rest,
	};
}

describe('metricStats', () => {
	it('Empty Array: alles null, n=0', () => {
		expect(metricStats([])).toEqual({ avg: null, min: null, max: null, n: 0 });
	});

	it('Nur null/undefined: behandelt wie empty', () => {
		expect(metricStats([null, undefined, null])).toEqual({ avg: null, min: null, max: null, n: 0 });
	});

	it('Mix mit nulls: ignoriert nulls', () => {
		const r = metricStats([1, null, 3, undefined, 5]);
		expect(r.n).toBe(3);
		expect(r.min).toBe(1);
		expect(r.max).toBe(5);
		expect(r.avg).toBe(3);
	});

	it('Single Wert: avg=min=max=value', () => {
		expect(metricStats([7])).toEqual({ avg: 7, min: 7, max: 7, n: 1 });
	});

	it('NaN ignoriert', () => {
		const r = metricStats([1, NaN, 3]);
		expect(r.n).toBe(2);
		expect(r.avg).toBe(2);
	});
});

describe('metricPerPhase', () => {
	it('Empty Checkins: leeres Object', () => {
		expect(metricPerPhase([], 'temp')).toEqual({});
	});

	it('Trennt Phasen sauber', () => {
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Veg', temp: 22 }),
			ci({ day: 2, phase: 'Veg', temp: 24 }),
			ci({ day: 3, phase: 'Bloom', temp: 26 }),
			ci({ day: 4, phase: 'Bloom', temp: 28 }),
		];
		const r = metricPerPhase(checkins, 'temp');
		expect(r.Veg.avg).toBe(23);
		expect(r.Veg.n).toBe(2);
		expect(r.Bloom.avg).toBe(27);
		expect(r.Bloom.n).toBe(2);
	});

	it('Phasen ohne Daten erscheinen nicht', () => {
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Veg', temp: 22 }),
			ci({ day: 2, phase: 'Bloom', temp: null }),
		];
		const r = metricPerPhase(checkins, 'temp');
		expect(r.Veg).toBeDefined();
		expect(r.Bloom).toBeUndefined();
	});

	it('Funktioniert für ec_measured', () => {
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Bloom', ec_measured: 1.8 }),
			ci({ day: 2, phase: 'Bloom', ec_measured: 2.0 }),
		];
		const r = metricPerPhase(checkins, 'ec_measured');
		expect(r.Bloom.avg).toBe(1.9);
	});
});

describe('stressDays', () => {
	const targets: Record<string, RangeTarget> = {
		Veg: { min: 0.8, max: 1.2 },
		Bloom: { min: 1.2, max: 1.5 },
	};

	it('Empty: total=0, percent=null', () => {
		expect(stressDays([], 'vpd', targets).total).toBe(0);
		expect(stressDays([], 'vpd', targets).okPercent).toBe(null);
	});

	it('Alle im Range: 100% ok', () => {
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Veg', vpd: 1.0 }),
			ci({ day: 2, phase: 'Veg', vpd: 0.9 }),
			ci({ day: 3, phase: 'Bloom', vpd: 1.4 }),
		];
		const r = stressDays(checkins, 'vpd', targets);
		expect(r.total).toBe(3);
		expect(r.ok).toBe(3);
		expect(r.stress).toBe(0);
		expect(r.okPercent).toBe(100);
	});

	it('Mix ok/stress: korrekte Zählung', () => {
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Veg', vpd: 1.0 }),     // ok (0.8-1.2)
			ci({ day: 2, phase: 'Veg', vpd: 1.5 }),     // stress (>1.2)
			ci({ day: 3, phase: 'Bloom', vpd: 0.9 }),   // stress (<1.2)
			ci({ day: 4, phase: 'Bloom', vpd: 1.3 }),   // ok
		];
		const r = stressDays(checkins, 'vpd', targets);
		expect(r.total).toBe(4);
		expect(r.ok).toBe(2);
		expect(r.stress).toBe(2);
		expect(r.okPercent).toBe(50);
	});

	it('Range-Boundaries inklusiv (min und max)', () => {
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Veg', vpd: 0.8 }),  // ok (= min)
			ci({ day: 2, phase: 'Veg', vpd: 1.2 }),  // ok (= max)
		];
		expect(stressDays(checkins, 'vpd', targets).ok).toBe(2);
	});

	it('Datenpunkte ohne Wert ignoriert', () => {
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Veg', vpd: 1.0 }),
			ci({ day: 2, phase: 'Veg', vpd: null }),
			ci({ day: 3, phase: 'Veg' }), // implicit null
		];
		expect(stressDays(checkins, 'vpd', targets).total).toBe(1);
	});

	it('Phasen ohne Targets ignoriert', () => {
		const checkins: CheckIn[] = [
			ci({ day: 1, phase: 'Veg', vpd: 1.0 }),
			ci({ day: 2, phase: 'Flush', vpd: 0.5 }),  // kein Flush-Target → ignored
		];
		expect(stressDays(checkins, 'vpd', targets).total).toBe(1);
	});
});

describe('checkinConsistency', () => {
	it('Empty Checkins, totalDays > 0: 0% percent, daysSinceLast=null', () => {
		const r = checkinConsistency([], '2026-04-01T08:00:00', '2026-04-08T08:00:00');
		expect(r.totalDays).toBe(8);
		expect(r.daysWithCheckin).toBe(0);
		expect(r.percent).toBe(0);
		expect(r.daysSinceLastCheckin).toBe(null);
	});

	it('Jeden Tag geloggt: 100%', () => {
		const checkins: CheckIn[] = [
			ci({ day: 1 }),
			ci({ day: 2 }),
			ci({ day: 3 }),
		];
		const r = checkinConsistency(checkins, '2026-04-01T08:00:00', '2026-04-03T20:00:00');
		expect(r.totalDays).toBe(3);
		expect(r.daysWithCheckin).toBe(3);
		expect(r.percent).toBe(100);
		expect(r.daysSinceLastCheckin).toBe(0); // letzter check-in heute
	});

	it('2 von 5 Tagen geloggt: 40%', () => {
		const checkins: CheckIn[] = [
			ci({ day: 1 }),
			ci({ day: 3 }),
		];
		const r = checkinConsistency(checkins, '2026-04-01T08:00:00', '2026-04-05T20:00:00');
		expect(r.totalDays).toBe(5);
		expect(r.daysWithCheckin).toBe(2);
		expect(r.percent).toBe(40);
		expect(r.daysSinceLastCheckin).toBe(2); // Tag 3 → Tag 5
	});

	it('Mehrere Check-ins am gleichen Tag zählen 1×', () => {
		const checkins: CheckIn[] = [
			{ ...ci({ day: 1 }), id: 'morning', created_at: '2026-04-01T08:00:00' },
			{ ...ci({ day: 1 }), id: 'evening', created_at: '2026-04-01T20:00:00' },
		];
		const r = checkinConsistency(checkins, '2026-04-01T08:00:00', '2026-04-01T22:00:00');
		expect(r.daysWithCheckin).toBe(1);
		expect(r.totalDays).toBe(1);
		expect(r.percent).toBe(100);
	});

	it('Kaputter growStartIso: alles null', () => {
		const r = checkinConsistency([], 'kaputt');
		expect(r.totalDays).toBe(0);
		expect(r.percent).toBe(null);
	});

	it('daysSinceLastCheckin: 7 Tage Lücke', () => {
		const checkins: CheckIn[] = [ci({ day: 1 })];
		const r = checkinConsistency(checkins, '2026-04-01T08:00:00', '2026-04-08T08:00:00');
		expect(r.daysSinceLastCheckin).toBe(7);
	});
});
