import { describe, it, expect } from 'vitest';
import { getStrainEntries, totalPlantCount, summarizeStrains, joinedStrainName, validateStrains } from './grow-strains';
import type { Grow } from '$lib/stores/grow';

function mkGrow(overrides: Partial<Grow> = {}): Pick<Grow, 'strain' | 'plant_count' | 'strains'> {
	return { strain: 'Default', plant_count: 1, ...overrides };
}

describe('grow-strains — getStrainEntries', () => {
	it('Legacy Grow (kein strains-Array) → 1 Entry aus strain+plant_count', () => {
		const r = getStrainEntries(mkGrow({ strain: 'Test', plant_count: 3 }));
		expect(r).toEqual([{ strain: 'Test', plant_count: 3 }]);
	});

	it('Multi-Strain → Array', () => {
		const r = getStrainEntries(mkGrow({
			strain: 'Mixed',
			plant_count: 4,
			strains: [
				{ strain: 'Strawberry Gummies', plant_count: 2 },
				{ strain: 'Don Mega', plant_count: 1 },
				{ strain: 'White Runtz', plant_count: 1 },
			],
		}));
		expect(r).toHaveLength(3);
		expect(r[0].strain).toBe('Strawberry Gummies');
	});

	it('Leere strains[] → Fallback auf Legacy', () => {
		const r = getStrainEntries(mkGrow({ strain: 'Legacy', plant_count: 2, strains: [] }));
		expect(r).toEqual([{ strain: 'Legacy', plant_count: 2 }]);
	});

	it('Filtert leere/invalide Entries raus', () => {
		const r = getStrainEntries(mkGrow({
			strain: 'X',
			plant_count: 5,
			strains: [
				{ strain: 'Valid', plant_count: 2 },
				{ strain: '', plant_count: 1 },        // leer
				{ strain: 'Zero', plant_count: 0 },    // 0 Pflanzen
			],
		}));
		expect(r).toEqual([{ strain: 'Valid', plant_count: 2 }]);
	});

	it('Kein strain + keine strains → leer', () => {
		const r = getStrainEntries({ strain: '', plant_count: 0 } as any);
		expect(r).toEqual([]);
	});
});

describe('grow-strains — totalPlantCount', () => {
	it('Legacy: nutzt plant_count', () => {
		expect(totalPlantCount(mkGrow({ plant_count: 5 }))).toBe(5);
	});

	it('Multi-Strain: Summe', () => {
		const r = totalPlantCount(mkGrow({
			strains: [
				{ strain: 'A', plant_count: 2 },
				{ strain: 'B', plant_count: 3 },
				{ strain: 'C', plant_count: 4 },
			],
		}));
		expect(r).toBe(9);
	});

	it('Leerer Grow → 0', () => {
		expect(totalPlantCount({ strain: '', plant_count: 0 } as any)).toBe(0);
	});
});

describe('grow-strains — summarizeStrains', () => {
	it('1 Strain ×1 → nur Name', () => {
		expect(summarizeStrains(mkGrow({ strain: 'Test', plant_count: 1 }))).toBe('Test');
	});

	it('1 Strain ×2 → "Test ×2"', () => {
		expect(summarizeStrains(mkGrow({ strain: 'Test', plant_count: 2 }))).toBe('Test ×2');
	});

	it('2 Strains', () => {
		const r = summarizeStrains(mkGrow({
			strains: [
				{ strain: 'A', plant_count: 2 },
				{ strain: 'B', plant_count: 1 },
			],
		}));
		expect(r).toBe('A ×2 · B ×1');
	});

	it('Sehr viele Strains → kompakt', () => {
		const r = summarizeStrains(mkGrow({
			strains: [
				{ strain: 'Super Long Strain Name One', plant_count: 1 },
				{ strain: 'Super Long Strain Name Two', plant_count: 1 },
				{ strain: 'Super Long Strain Name Three', plant_count: 1 },
				{ strain: 'Super Long Strain Name Four', plant_count: 1 },
			],
		}), { maxLength: 50 });
		expect(r).toMatch(/4 Strains \(4 Pflanzen\)/);
	});
});

describe('grow-strains — joinedStrainName', () => {
	it('1 Strain → exakt', () => {
		expect(joinedStrainName([{ strain: 'Solo', plant_count: 2 }])).toBe('Solo');
	});

	it('Multi → comma-separated', () => {
		expect(joinedStrainName([
			{ strain: 'A', plant_count: 2 },
			{ strain: 'B', plant_count: 1 },
		])).toBe('A, B');
	});

	it('Leere/invalide rausfiltern', () => {
		expect(joinedStrainName([
			{ strain: 'Valid', plant_count: 1 },
			{ strain: '', plant_count: 1 },
		])).toBe('Valid');
	});
});

describe('grow-strains — validateStrains', () => {
	it('Mind. 1 Valid → ok', () => {
		expect(validateStrains([{ strain: 'OK', plant_count: 1 }]).ok).toBe(true);
	});

	it('Alle invalid → fail', () => {
		const r = validateStrains([
			{ strain: '', plant_count: 1 },
			{ strain: 'X', plant_count: 0 },
		]);
		expect(r.ok).toBe(false);
		expect(r.error).toMatch(/Mindestens/);
	});

	it('Plant-Count > 50 → fail', () => {
		const r = validateStrains([{ strain: 'X', plant_count: 51 }]);
		expect(r.ok).toBe(false);
		expect(r.error).toMatch(/> 50/);
	});
});
