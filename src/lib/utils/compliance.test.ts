import { describe, it, expect } from 'vitest';
import { plantLimit, normalizeAdults, sumPlants, complianceCheck, PLANTS_PER_ADULT } from './compliance';

describe('normalizeAdults', () => {
	it('clamps to min 1', () => {
		expect(normalizeAdults(0)).toBe(1);
		expect(normalizeAdults(-5)).toBe(1);
	});
	it('floors floats', () => {
		expect(normalizeAdults(1.9)).toBe(1);
		expect(normalizeAdults(2.4)).toBe(2);
	});
	it('handles NaN/garbage → 1', () => {
		expect(normalizeAdults(NaN)).toBe(1);
		expect(normalizeAdults(Infinity)).toBe(1);
	});
});

describe('plantLimit', () => {
	it('scales 3 per adult', () => {
		expect(plantLimit(1)).toBe(3);
		expect(plantLimit(2)).toBe(6);
		expect(plantLimit(3)).toBe(9);
		expect(plantLimit(4)).toBe(12);
	});
	it('never below 3 (min 1 adult)', () => {
		expect(plantLimit(0)).toBe(3);
		expect(plantLimit(-2)).toBe(3);
	});
	it('PLANTS_PER_ADULT constant is 3', () => {
		expect(PLANTS_PER_ADULT).toBe(3);
	});
});

describe('sumPlants', () => {
	it('sums plant_count', () => {
		expect(sumPlants([{ plant_count: 2 }, { plant_count: 3 }])).toBe(5);
	});
	it('ignores null/undefined/negative/NaN', () => {
		expect(sumPlants([{ plant_count: 2 }, { plant_count: null }, { plant_count: undefined }, {}])).toBe(2);
		expect(sumPlants([{ plant_count: -3 }, { plant_count: 4 }])).toBe(4);
	});
	it('floors fractional counts', () => {
		expect(sumPlants([{ plant_count: 2.9 }])).toBe(2);
	});
	it('empty → 0', () => {
		expect(sumPlants([])).toBe(0);
	});
});

describe('complianceCheck', () => {
	it('within limit (1 adult, no grows)', () => {
		const r = complianceCheck([], 1);
		expect(r).toEqual({ adults: 1, limit: 3, current: 0, over: false, remaining: 3 });
	});

	it('exactly at limit is NOT over', () => {
		const r = complianceCheck([{ plant_count: 3 }], 1);
		expect(r.current).toBe(3);
		expect(r.over).toBe(false);
		expect(r.remaining).toBe(0);
	});

	it('over limit with 1 adult', () => {
		const r = complianceCheck([{ plant_count: 2 }, { plant_count: 2 }], 1);
		expect(r.current).toBe(4);
		expect(r.limit).toBe(3);
		expect(r.over).toBe(true);
		expect(r.remaining).toBe(-1);
	});

	it('scales with adults: 2 adults → 6 plants ok', () => {
		const r = complianceCheck([{ plant_count: 4 }], 2);
		expect(r.limit).toBe(6);
		expect(r.over).toBe(false);
		expect(r.remaining).toBe(2);
	});

	it('3 adults → 9 plants exactly ok', () => {
		const r = complianceCheck([{ plant_count: 6 }, { plant_count: 3 }], 3);
		expect(r.current).toBe(9);
		expect(r.limit).toBe(9);
		expect(r.over).toBe(false);
	});

	it('clamps adults to min 1', () => {
		const r = complianceCheck([{ plant_count: 5 }], 0);
		expect(r.adults).toBe(1);
		expect(r.limit).toBe(3);
		expect(r.over).toBe(true);
	});
});
