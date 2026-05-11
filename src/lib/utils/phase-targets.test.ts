import { describe, it, expect } from 'vitest';
import { PHASE_TARGETS, targetFor, classifyValue, phaseTargetSegments, inRangeStats } from './phase-targets';

describe('phase-targets — PHASE_TARGETS', () => {
	it('hat vpd, temp, rh, ec, ph', () => {
		expect(Object.keys(PHASE_TARGETS)).toEqual(['vpd', 'temp', 'rh', 'ec', 'ph']);
	});

	it('Veg + Bloom für alle Metriken', () => {
		for (const m of Object.keys(PHASE_TARGETS)) {
			expect((PHASE_TARGETS as any)[m].Veg).toBeDefined();
			expect((PHASE_TARGETS as any)[m].Bloom).toBeDefined();
		}
	});

	it('VPD Bloom > Veg (Bloom braucht trockener)', () => {
		expect(PHASE_TARGETS.vpd.Bloom.min).toBeGreaterThanOrEqual(PHASE_TARGETS.vpd.Veg.min);
	});

	it('RH Bloom < Veg (Bloom braucht trockener)', () => {
		expect(PHASE_TARGETS.rh.Bloom.max).toBeLessThan(PHASE_TARGETS.rh.Veg.max);
	});
});

describe('phase-targets — targetFor', () => {
	it('vpd Veg → 0.8-1.2', () => {
		expect(targetFor('vpd', 'Veg')).toEqual({ min: 0.8, max: 1.2 });
	});

	it('unbekannte Phase → null', () => {
		expect(targetFor('vpd', 'Unknown')).toBeNull();
	});

	it('phase=null → null', () => {
		expect(targetFor('vpd', null)).toBeNull();
	});
});

describe('phase-targets — classifyValue', () => {
	it('Wert im Range → "in"', () => {
		expect(classifyValue('vpd', 'Veg', 1.0)).toBe('in');
	});

	it('Wert unter min → "low"', () => {
		expect(classifyValue('vpd', 'Veg', 0.5)).toBe('low');
	});

	it('Wert über max → "high"', () => {
		expect(classifyValue('vpd', 'Veg', 1.5)).toBe('high');
	});

	it('Grenzwert min → "in"', () => {
		expect(classifyValue('vpd', 'Veg', 0.8)).toBe('in');
	});

	it('Grenzwert max → "in"', () => {
		expect(classifyValue('vpd', 'Veg', 1.2)).toBe('in');
	});

	it('unbekannte Phase → null', () => {
		expect(classifyValue('vpd', 'Drying', 1.0)).toBeNull();
	});
});

describe('phase-targets — phaseTargetSegments', () => {
	it('leere serieDays → leer', () => {
		expect(phaseTargetSegments('vpd', [], [], () => 0)).toEqual([]);
	});

	it('nur Veg → 1 Segment ab atIndex 0', () => {
		const cis = [
			{ phase: 'Veg', day: 1 },
			{ phase: 'Veg', day: 2 },
			{ phase: 'Veg', day: 3 },
		];
		const segs = phaseTargetSegments('vpd', cis, [1, 2, 3], (c) => c.day);
		expect(segs).toEqual([{ atIndex: 0, min: 0.8, max: 1.2 }]);
	});

	it('Veg → Bloom Transition → 2 Segmente', () => {
		const cis = [
			{ phase: 'Veg', day: 1 },
			{ phase: 'Veg', day: 2 },
			{ phase: 'Bloom', day: 3 },
			{ phase: 'Bloom', day: 4 },
		];
		const segs = phaseTargetSegments('vpd', cis, [1, 2, 3, 4], (c) => c.day);
		expect(segs).toHaveLength(2);
		expect(segs[0]).toEqual({ atIndex: 0, min: 0.8, max: 1.2 });
		expect(segs[1]).toEqual({ atIndex: 2, min: 1.2, max: 1.5 });
	});
});

describe('phase-targets — inRangeStats', () => {
	it('leere values → rate=0', () => {
		expect(inRangeStats('vpd', [])).toEqual({ total: 0, inRange: 0, low: 0, high: 0, rate: 0 });
	});

	it('alle in-range → rate=1.0', () => {
		const vals = [
			{ ci: { phase: 'Veg' }, value: 1.0 },
			{ ci: { phase: 'Veg' }, value: 0.9 },
		];
		expect(inRangeStats('vpd', vals).rate).toBe(1.0);
	});

	it('gemischt → korrekte Zählung', () => {
		const vals = [
			{ ci: { phase: 'Veg' }, value: 1.0 }, // in
			{ ci: { phase: 'Veg' }, value: 0.5 }, // low
			{ ci: { phase: 'Veg' }, value: 1.5 }, // high
			{ ci: { phase: 'Bloom' }, value: 1.3 }, // in
		];
		const r = inRangeStats('vpd', vals);
		expect(r.total).toBe(4);
		expect(r.inRange).toBe(2);
		expect(r.low).toBe(1);
		expect(r.high).toBe(1);
		expect(r.rate).toBe(0.5);
	});

	it('Phase ohne Target → skipped', () => {
		const vals = [
			{ ci: { phase: 'Drying' }, value: 1.0 }, // skip
			{ ci: { phase: 'Veg' }, value: 1.0 }, // in
		];
		const r = inRangeStats('vpd', vals);
		expect(r.total).toBe(1);
		expect(r.inRange).toBe(1);
	});
});
