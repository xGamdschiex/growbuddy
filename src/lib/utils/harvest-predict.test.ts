import { describe, it, expect } from 'vitest';
import { predictHarvest, predictHarvestPerStrain, formatDaysUntil, formatYieldRange } from './harvest-predict';

describe('harvest-predict — predictHarvest (Default-Lifecycle ohne Bloom-Start)', () => {
	it('Photo Default: vegWeeks(5)+floweringWeeks(9) = 14 Wo = 98d, 70g/Pflanze', () => {
		const r = predictHarvest({ strainType: 'photo', plantCount: 1, currentGrowDays: 0, checkins: [] });
		expect(r.totalDaysExpected).toBe(98);
		expect(r.daysUntilHarvest).toBe(98);
		expect(r.yieldGrams).toBe(70);
		expect(r.confidence).toBe('low');
	});

	it('Auto Default: vegWeeks(4)+floweringWeeks(5) = 9 Wo = 63d, 50g/Pflanze', () => {
		const r = predictHarvest({ strainType: 'auto', plantCount: 1, currentGrowDays: 0, checkins: [] });
		expect(r.totalDaysExpected).toBe(63);
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
});

describe('harvest-predict — predictHarvest mit Bloom-Start', () => {
	// Lauris realer Bug: 39d Grow, Bloom seit Tag 26 → ~6-7 Wo bis Harvest, NICHT ~11 Wo
	it('Photo W3 Bloom (bloomStartDay=26, currentDay=39, 9 Wo Bloom): ~50d Rest', () => {
		const r = predictHarvest({
			strainType: 'photo',
			plantCount: 1,
			currentGrowDays: 39,
			bloomStartDay: 26,
			checkins: [],
		});
		// harvestDay = 26 + 9*7 = 89, currentDay = 39 → 50d Rest
		expect(r.totalDaysExpected).toBe(89);
		expect(r.daysUntilHarvest).toBe(50);
	});

	it('Custom floweringWeeks=8: harvestDay anders', () => {
		const r = predictHarvest({
			strainType: 'photo',
			plantCount: 1,
			currentGrowDays: 30,
			bloomStartDay: 25,
			floweringWeeks: 8,
			checkins: [],
		});
		// harvestDay = 25 + 8*7 = 81
		expect(r.totalDaysExpected).toBe(81);
		expect(r.daysUntilHarvest).toBe(51);
	});

	it('Sehr kurze Bloom (5 Wo): kommt früher zur Ernte', () => {
		const r9 = predictHarvest({ strainType: 'photo', plantCount: 1, currentGrowDays: 30, bloomStartDay: 25, floweringWeeks: 9, checkins: [] });
		const r5 = predictHarvest({ strainType: 'photo', plantCount: 1, currentGrowDays: 30, bloomStartDay: 25, floweringWeeks: 5, checkins: [] });
		expect(r5.daysUntilHarvest).toBeLessThan(r9.daysUntilHarvest);
	});

	it('floweringWeeks=0 oder negativ → Default greift', () => {
		const r = predictHarvest({
			strainType: 'photo',
			plantCount: 1,
			currentGrowDays: 30,
			bloomStartDay: 25,
			floweringWeeks: 0,
			checkins: [],
		});
		// Fallback auf photo-Default 9 Wo
		expect(r.totalDaysExpected).toBe(25 + 63);
	});

	it('bloomStartDay = null → Veg-Default-Logik', () => {
		const r = predictHarvest({
			strainType: 'photo',
			plantCount: 1,
			currentGrowDays: 10,
			bloomStartDay: null,
			checkins: [],
		});
		expect(r.totalDaysExpected).toBe(98); // 5 + 9 = 14 Wo
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

describe('harvest-predict — predictHarvestPerStrain', () => {
	it('Multi-Strain ohne flowering_weeks: Summe = Total-Yield', () => {
		const entries = [
			{ strain: 'A', plant_count: 2 },
			{ strain: 'B', plant_count: 1 },
			{ strain: 'C', plant_count: 1 },
		];
		const total = predictHarvest({ strainType: 'photo', plantCount: 4, currentGrowDays: 30, checkins: [] });
		const perStrain = predictHarvestPerStrain(entries, { strainType: 'photo', currentGrowDays: 30, checkins: [] });
		const sumPer = perStrain.reduce((s, e) => s + e.yieldGrams, 0);
		expect(sumPer).toBe(total.yieldGrams);
	});

	it('Pro Strain eigene flowering_weeks → unterschiedliche daysUntilHarvest', () => {
		const entries = [
			{ strain: 'Schnell', plant_count: 1, flowering_weeks: 7 },
			{ strain: 'Langsam', plant_count: 1, flowering_weeks: 10 },
		];
		const per = predictHarvestPerStrain(entries, {
			strainType: 'photo',
			currentGrowDays: 30,
			bloomStartDay: 25,
			checkins: [],
		});
		expect(per[0].daysUntilHarvest).toBeLessThan(per[1].daysUntilHarvest);
		expect(per[0].floweringWeeks).toBe(7);
		expect(per[1].floweringWeeks).toBe(10);
	});

	it('Pro Strain proportional zu plant_count', () => {
		const entries = [
			{ strain: 'Duo', plant_count: 2 },
			{ strain: 'Solo', plant_count: 1 },
		];
		const per = predictHarvestPerStrain(entries, { strainType: 'photo', currentGrowDays: 30, checkins: [] });
		expect(per[0].yieldGrams).toBe(per[1].yieldGrams * 2);
	});

	it('Alle Strains haben gleichen performanceMultiplier (gleiche Klimadaten)', () => {
		const cis = Array.from({ length: 10 }, () => ({ phase: 'Veg', vpd: 1.0, temp: 24 }));
		const per = predictHarvestPerStrain(
			[{ strain: 'A', plant_count: 2 }, { strain: 'B', plant_count: 1 }],
			{ strainType: 'photo', currentGrowDays: 30, checkins: cis }
		);
		expect(per[0].performanceMultiplier).toBe(per[1].performanceMultiplier);
	});

	it('Gleiche flowering_weeks → gleiches daysUntilHarvest', () => {
		const per = predictHarvestPerStrain(
			[{ strain: 'A', plant_count: 2 }, { strain: 'B', plant_count: 1 }],
			{ strainType: 'photo', currentGrowDays: 30, bloomStartDay: 25, checkins: [] }
		);
		expect(per[0].daysUntilHarvest).toBe(per[1].daysUntilHarvest);
	});

	it('1 Strain → 1 Entry', () => {
		const per = predictHarvestPerStrain(
			[{ strain: 'Solo', plant_count: 3 }],
			{ strainType: 'auto', currentGrowDays: 0, checkins: [] }
		);
		expect(per).toHaveLength(1);
		expect(per[0].plantCount).toBe(3);
	});

	it('Leere Liste → leeres Array', () => {
		expect(predictHarvestPerStrain([], { strainType: 'photo', currentGrowDays: 0, checkins: [] })).toEqual([]);
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
