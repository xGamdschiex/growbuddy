/**
 * Per-Line-Tests für Athena Blended Line (flüssig, 2-Part).
 *
 * Diese Tests sichern Athena-Blended-spezifische Logik ab:
 * - 2-Part-System: A vor B in der Mix-Reihenfolge
 * - Mix-Reihenfolge (CalMag vor Cleanse vor Produkten)
 * - Hydro/Coco-Empfehlung (Warning bei Erde)
 * - Stack-Booster ab Bloom W2
 * - Fade-Phase (Bloom W8-W9)
 *
 * Änderungen am Athena-Blended-Schema brechen NUR diese Tests, nicht andere Lines.
 */

import { describe, it, expect } from 'vitest';
import { calculate, type CalcInput } from '../nutrients';
import { athenaBlended } from './athena-blended';

function inputBlended(overrides: Partial<CalcInput> = {}): CalcInput {
	return {
		feedline_id: 'athena-blended',
		wasserprofil: 'RO / Destilliert',
		phase: 'Veg',
		woche: 1,
		tag: 1,
		strain: 'Test',
		reservoir_L: 10,
		faktor_modus: 'Manuell',
		faktor_manuell: 100,
		calmag_typ: 'A',
		ec_einheit: 'mS/cm',
		hat_ro: true,
		medium: 'hydro',
		system: 'topf',
		...overrides,
	};
}

describe('Athena Blended — Schema-Integrität', () => {
	it('hat 3 Phasen: Clone, Veg, Bloom', () => {
		expect(athenaBlended.phasen.map((p) => p.name)).toEqual(['Clone', 'Veg', 'Bloom']);
	});

	it('Hydro + Coco', () => {
		expect(athenaBlended.medien).toEqual(['hydro', 'coco']);
	});

	it('Clone 2W, Veg 4W, Bloom 9W', () => {
		expect(athenaBlended.phasen.find((p) => p.name === 'Clone')?.schema_wochen).toBe(2);
		expect(athenaBlended.phasen.find((p) => p.name === 'Veg')?.schema_wochen).toBe(4);
		expect(athenaBlended.phasen.find((p) => p.name === 'Bloom')?.schema_wochen).toBe(9);
	});

	it('hat module.buildMixSteps Hook', () => {
		expect(athenaBlended.module?.buildMixSteps).toBeDefined();
	});

	it('hat module.validateInput Hook', () => {
		expect(athenaBlended.module?.validateInput).toBeDefined();
	});

	it('hat module.weekNotes Hook', () => {
		expect(athenaBlended.module?.weekNotes).toBeDefined();
	});
});

describe('Athena Blended — Mix-Reihenfolge', () => {
	it('Veg W1 T1: Wasser → CalMag → Cleanse → Produkte → pH → EC', () => {
		const r = calculate(inputBlended({ phase: 'Veg', woche: 1, tag: 1 }));
		const labels = r.mix_steps.map((s) => s.label);
		expect(labels[0]).toMatch(/Wasser/);
		expect(labels[labels.length - 1]).toMatch(/EC/);
		expect(labels[labels.length - 2]).toMatch(/pH/);
	});

	it('A kommt vor B im Mix (2-Part-Regel)', () => {
		// Bloom W3: bl_bloom_a + bl_bloom_b aktiv
		const r = calculate(inputBlended({ phase: 'Bloom', woche: 3, tag: 1 }));
		const labels = r.mix_steps.map((s) => s.label);
		const idxA = labels.findIndex((l) => l.includes('Bloom A'));
		const idxB = labels.findIndex((l) => l.includes('Bloom B'));
		expect(idxA).toBeGreaterThanOrEqual(0);
		expect(idxB).toBeGreaterThanOrEqual(0);
		expect(idxA).toBeLessThan(idxB);
	});

	it('Grow A kommt vor Grow B im Mix (Veg)', () => {
		const r = calculate(inputBlended({ phase: 'Veg', woche: 2, tag: 1 }));
		const labels = r.mix_steps.map((s) => s.label);
		const idxA = labels.findIndex((l) => l.includes('Grow A'));
		const idxB = labels.findIndex((l) => l.includes('Grow B'));
		expect(idxA).toBeGreaterThanOrEqual(0);
		expect(idxB).toBeGreaterThanOrEqual(0);
		expect(idxA).toBeLessThan(idxB);
	});

	it('Cleanse-Step bei Bloom W3 vorhanden (T1→T7 Rampe)', () => {
		const r = calculate(inputBlended({ phase: 'Bloom', woche: 3, tag: 4 }));
		const cleanse = r.mix_steps.find((s) => s.label === 'Cleanse');
		expect(cleanse).toBeDefined();
		expect(r.cleanse_mL_tank).toBeGreaterThan(0);
	});
});

describe('Athena Blended — Validation', () => {
	it('Warning bei medium = erde', () => {
		const result = athenaBlended.module?.validateInput?.({
			feedline_id: 'athena-blended',
			wasserprofil: 'RO',
			phase: 'Veg',
			woche: 1,
			tag: 1,
			strain: 'Test',
			reservoir_L: 10,
			faktor_modus: 'Manuell',
			faktor_manuell: 100,
			calmag_typ: 'A',
			ec_einheit: 'mS/cm',
			medium: 'erde',
		});
		expect(result?.warnings.length).toBeGreaterThan(0);
		expect(result?.warnings[0]).toMatch(/Hydro\/Coco/);
	});

	it('Keine Warning bei medium = hydro', () => {
		const result = athenaBlended.module?.validateInput?.({
			feedline_id: 'athena-blended',
			wasserprofil: 'RO',
			phase: 'Veg',
			woche: 1,
			tag: 1,
			strain: 'Test',
			reservoir_L: 10,
			faktor_modus: 'Manuell',
			faktor_manuell: 100,
			calmag_typ: 'A',
			ec_einheit: 'mS/cm',
			medium: 'hydro',
		});
		expect(result?.warnings.length).toBe(0);
	});

	it('Keine Warning bei medium = coco', () => {
		const result = athenaBlended.module?.validateInput?.({
			feedline_id: 'athena-blended',
			wasserprofil: 'RO',
			phase: 'Veg',
			woche: 1,
			tag: 1,
			strain: 'Test',
			reservoir_L: 10,
			faktor_modus: 'Manuell',
			faktor_manuell: 100,
			calmag_typ: 'A',
			ec_einheit: 'mS/cm',
			medium: 'coco',
		});
		expect(result?.warnings.length).toBe(0);
	});
});

describe('Athena Blended — weekNotes', () => {
	it('Bloom W2: Stack-Hinweis', () => {
		const notes = athenaBlended.module?.weekNotes?.('Bloom', 2);
		expect(notes).toBeDefined();
		expect(notes?.[0]).toMatch(/Stack/);
	});

	it('Bloom W8: Fade-Hinweis', () => {
		const notes = athenaBlended.module?.weekNotes?.('Bloom', 8);
		expect(notes).toBeDefined();
		expect(notes?.[0]).toMatch(/Fade/);
	});

	it('Bloom W9: Fade-Hinweis', () => {
		const notes = athenaBlended.module?.weekNotes?.('Bloom', 9);
		expect(notes).toBeDefined();
		expect(notes?.[0]).toMatch(/Fade/);
	});

	it('Veg W1: keine speziellen Hinweise', () => {
		const notes = athenaBlended.module?.weekNotes?.('Veg', 1);
		expect(notes ?? []).toHaveLength(0);
	});
});

describe('Athena Blended — Pulver-Phasen-Filter', () => {
	it('Veg W1: Grow A+B aktiv, Bloom A+B inaktiv', () => {
		const r = calculate(inputBlended({ phase: 'Veg', woche: 1, tag: 1 }));
		const labels = r.mix_steps.map((s) => s.label);
		expect(labels.some((l) => l.includes('Grow A'))).toBe(true);
		expect(labels.some((l) => l.includes('Grow B'))).toBe(true);
		expect(labels.some((l) => l.includes('Bloom A'))).toBe(false);
	});

	it('Bloom W3: Bloom A+B aktiv, Grow A+B inaktiv', () => {
		const r = calculate(inputBlended({ phase: 'Bloom', woche: 3, tag: 1 }));
		const labels = r.mix_steps.map((s) => s.label);
		expect(labels.some((l) => l.includes('Bloom A'))).toBe(true);
		expect(labels.some((l) => l.includes('Bloom B'))).toBe(true);
		expect(labels.some((l) => l.includes('Grow A'))).toBe(false);
	});

	it('Bloom W9 Fade-Phase: Fade-Produkt im Schema aktiv', () => {
		const w9 = athenaBlended.schema.find((r) => r.phase === 'Bloom' && r.woche === 9);
		expect(w9?.dosierungen.bl_fade).toBeGreaterThan(0);
	});
});

describe('Athena Blended — Flush-Verhalten (Bloom W8→W9)', () => {
	it('Bloom W8 EC-Ziel = 1.5 (vorher 3.0 in W7)', () => {
		const w7 = athenaBlended.schema.find((r) => r.phase === 'Bloom' && r.woche === 7);
		const w8 = athenaBlended.schema.find((r) => r.phase === 'Bloom' && r.woche === 8);
		expect(w7?.ec_ziel).toBeGreaterThan(w8?.ec_ziel ?? 99);
		expect(w8?.ec_ziel).toBe(1.5);
	});

	it('Bloom W9 EC-Ziel bleibt bei 1.5', () => {
		const w9 = athenaBlended.schema.find((r) => r.phase === 'Bloom' && r.woche === 9);
		expect(w9?.ec_ziel).toBe(1.5);
	});

	it('Bloom W9 Fade-Dosierung > Bloom W8 Fade-Dosierung', () => {
		const w8 = athenaBlended.schema.find((r) => r.phase === 'Bloom' && r.woche === 8);
		const w9 = athenaBlended.schema.find((r) => r.phase === 'Bloom' && r.woche === 9);
		expect(w9?.dosierungen.bl_fade).toBeGreaterThan(w8?.dosierungen.bl_fade ?? 0);
	});
});

describe('Athena Blended — recommendedAddons', () => {
	it('liefert Athena-Addons', () => {
		const addons = athenaBlended.module?.recommendedAddons?.();
		expect(addons).toBeDefined();
		expect(addons?.length).toBeGreaterThan(0);
		expect(addons?.[0].name).toMatch(/Athena/);
	});
});
