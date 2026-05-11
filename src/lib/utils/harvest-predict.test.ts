import { describe, it, expect } from 'vitest';
import { predictHarvest, formatDaysUntil, formatYieldRange } from './harvest-predict';

describe('harvest-predict — predictHarvest', () => {
	it('Photo Default ohne Check-ins: 120d total, 70g/Pflanze', () => {
		const r = predictHarvest({ strainType: 'photo', plantCount: 1, currentGrowDays: 0, checkins: [] });
		expect(r.totalDaysExpected).toBe(120);
		expect(r.daysUntilHarvest).toBe(120);
		expect(r.yieldGrams).toBe(70);
		expect(r.confidence).toBe('low');
	});

	it('Auto Default: 80d total, 50g/Pflanze', () => {
		const r = predictHarvest({ strainType: 'auto', plantCount: 1, currentGrowDays: 0, checkins: [] });
		expect(r.totalDaysExpected).toBe(80);
		expect(r.yieldGrams).toBe(50);
	});

	it('Plant Count skaliert linear: 4 Pflanzen = 4× Yield', () => {
		const r1 = predictHarvest({ strainType: 'photo', plantCount: 1, currentGrowDays: 0, checkins: [] });
		const r4 = predictHarvest({ strainType: 'photo', plantCount: 4, currentGrowDays: 0, checkins: [] });
		expect(r4.yieldGrams).toBe(r1.yieldGrams * 4);
	});

	it('currentDays > totalDays → daysUntilHarvest = 0', () => {
		const r = predictHarvest({ strainType: 'auto', plantCount: 1, currentGrowDays: 100, checkins: [] });
		expect(r.daysUntilHarvest).toBe(0);
	});

	it('5+ Check-ins mit guten Werten → confidence medium, perfMult > 0.7', () => {
		const cis = Array.from({ length: 10 }, (_, i) => ({
			phase: 'Veg',
			vpd: 1.0, // in-range Veg
			temp: 24, // in-range Veg
		}));
		const r = predictHarvest({ strainType: 'photo', plantCount: 1, currentGrowDays: 30, checkins: cis });
		expect(r.confidence).toBe('medium');
		expect(r.performanceMultiplier).toBeGreaterThan(0.7);
	});

	it('20+ Check-ins → confidence high', () => {
		const cis = Array.from({ length: 25 }, () => ({ phase: 'Veg', vpd: 1.0, temp: 24 }));
		const r = predictHarvest({ strainType: 'photo', plantCount: 1, currentGrowDays: 30, checkins: cis });
		expect(r.confidence).toBe('high');
	});

	it('Schlechte Werte → perfMult < 1.0, Yield reduziert', () => {
		const cisGood = Array.from({ length: 10 }, () => ({ phase: 'Veg', vpd: 1.0, temp: 24 }));
		const cisBad = Array.from({ length: 10 }, () => ({ phase: 'Veg', vpd: 2.5, temp: 35 })); // way over
		const rGood = predictHarvest({ strainType: 'photo', plantCount: 1, currentGrowDays: 30, checkins: cisGood });
		const rBad = predictHarvest({ strainType: 'photo', plantCount: 1, currentGrowDays: 30, checkins: cisBad });
		expect(rBad.performanceMultiplier).toBeLessThan(rGood.performanceMultiplier);
		expect(rBad.yieldGrams).toBeLessThan(rGood.yieldGrams);
	});

	it('plantCount = 0 → Yield 0', () => {
		const r = predictHarvest({ strainType: 'photo', plantCount: 0, currentGrowDays: 30, checkins: [] });
		expect(r.yieldGrams).toBe(0);
	});

	it('yieldRange = ±25% von yieldGrams', () => {
		const r = predictHarvest({ strainType: 'photo', plantCount: 1, currentGrowDays: 0, checkins: [] });
		expect(r.yieldRange.min).toBe(Math.round(r.yieldGrams * 0.75));
		expect(r.yieldRange.max).toBe(Math.round(r.yieldGrams * 1.25));
	});
});

describe('harvest-predict — formatDaysUntil', () => {
	it('0d → "Erntereif"', () => {
		expect(formatDaysUntil(0)).toBe('Erntereif');
	});

	it('1-3d → "in Nd"', () => {
		expect(formatDaysUntil(2)).toBe('in 2d');
	});

	it('4-14d → "~Nd"', () => {
		expect(formatDaysUntil(10)).toBe('~10d');
	});

	it('>14d → Wochen', () => {
		expect(formatDaysUntil(30)).toBe('~4 Wochen');
		expect(formatDaysUntil(56)).toBe('~8 Wochen');
	});
});

describe('harvest-predict — formatYieldRange', () => {
	it('0g → "–"', () => {
		expect(formatYieldRange(0, { min: 0, max: 0 })).toBe('–');
	});

	it('70g → "~70g"', () => {
		expect(formatYieldRange(70, { min: 53, max: 88 })).toBe('~70g');
	});
});
