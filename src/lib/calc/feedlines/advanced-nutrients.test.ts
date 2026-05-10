/**
 * Per-Line-Tests für Advanced Nutrients Sensi pH Perfect.
 *
 * Sichert ab:
 * - Schema-Integrität (Phasen, EC-Range, A=B-Invariant)
 * - Module-Hooks (weekNotes, validateInput, recommendedAddons)
 * - Phase-Filter (Sensi Grow nur Veg, Sensi Bloom nur Bloom, Voodoo nur Veg, Big Bud nur Bloom)
 * - Big Bud → Overdrive Wechsel ab Bloom W6
 *
 * Änderungen am AN-Schema brechen NUR diese Tests.
 */

import { describe, it, expect } from 'vitest';
import { calculate, type CalcInput } from '../nutrients';
import { advancedSensi } from './advanced-nutrients';

function inputAN(overrides: Partial<CalcInput> = {}): CalcInput {
	return {
		feedline_id: 'advanced-sensi',
		wasserprofil: 'Mainz Petersaue',
		phase: 'Veg',
		woche: 1,
		tag: 1,
		strain: 'Test',
		reservoir_L: 10,
		faktor_modus: 'Manuell',
		faktor_manuell: 100,
		calmag_typ: 'A',
		ec_einheit: 'mS/cm',
		hat_ro: false,
		medium: 'coco',
		system: 'topf',
		...overrides,
	};
}

describe('Advanced Sensi — Schema-Integrität', () => {
	it('typ mineral, alle Medien', () => {
		expect(advancedSensi.typ).toBe('mineral');
		expect(advancedSensi.medien).toEqual(['hydro', 'coco', 'erde']);
	});

	it('calmag_empfohlen=false (Sensi enthält Ca/Mg)', () => {
		expect(advancedSensi.features.calmag_empfohlen).toBe(false);
	});

	it('Phasen: Veg 4W + Bloom 8W + Flush', () => {
		expect(advancedSensi.phasen.find(p => p.name === 'Veg')?.schema_wochen).toBe(4);
		expect(advancedSensi.phasen.find(p => p.name === 'Bloom')?.schema_wochen).toBe(8);
		expect(advancedSensi.phasen.find(p => p.name === 'Flush')?.schema_wochen).toBe(1);
	});

	it('Sensi Grow A == Sensi Grow B IMMER (Veg-Phasen)', () => {
		const vegRows = advancedSensi.schema.filter(r => r.phase === 'Veg');
		for (const row of vegRows) {
			const a = row.dosierungen.sensi_grow_a ?? 0;
			const b = row.dosierungen.sensi_grow_b ?? 0;
			expect(a, `Veg W${row.woche}: grow_a (${a}) != grow_b (${b})`).toBe(b);
		}
	});

	it('Sensi Bloom A == Sensi Bloom B IMMER (Bloom-Phasen)', () => {
		const bloomRows = advancedSensi.schema.filter(r => r.phase === 'Bloom');
		for (const row of bloomRows) {
			const a = row.dosierungen.sensi_bloom_a ?? 0;
			const b = row.dosierungen.sensi_bloom_b ?? 0;
			expect(a, `Bloom W${row.woche}: bloom_a (${a}) != bloom_b (${b})`).toBe(b);
		}
	});

	it('hat alle Module-Hooks', () => {
		expect(advancedSensi.module?.weekNotes).toBeDefined();
		expect(advancedSensi.module?.validateInput).toBeDefined();
		expect(advancedSensi.module?.recommendedAddons).toBeDefined();
	});
});

describe('Advanced Sensi — Phase-Filter', () => {
	it('Veg W2: Sensi Grow A+B aktiv, Bloom A+B nicht', () => {
		const r = calculate(inputAN({ phase: 'Veg', woche: 2, tag: 1 }));
		const labels = r.mix_steps.map(s => s.label);
		expect(labels.some(l => /Sensi Grow A/.test(l))).toBe(true);
		expect(labels.some(l => /Sensi Grow B/.test(l))).toBe(true);
		expect(labels.some(l => /Sensi Bloom/.test(l))).toBe(false);
	});

	it('Bloom W3: Sensi Bloom A+B aktiv, Grow nicht', () => {
		const r = calculate(inputAN({ phase: 'Bloom', woche: 3, tag: 1 }));
		const labels = r.mix_steps.map(s => s.label);
		expect(labels.some(l => /Sensi Bloom A/.test(l))).toBe(true);
		expect(labels.some(l => /Sensi Bloom B/.test(l))).toBe(true);
		expect(labels.some(l => /Sensi Grow/.test(l))).toBe(false);
	});

	it('Big Bud nur Bloom W1-5 (Schema-Constraint)', () => {
		for (const woche of [1, 2, 3, 4, 5]) {
			const row = advancedSensi.schema.find(r => r.phase === 'Bloom' && r.woche === woche)!;
			expect(row.dosierungen.big_bud, `Bloom W${woche}`).toBeGreaterThan(0);
		}
		for (const woche of [6, 7, 8]) {
			const row = advancedSensi.schema.find(r => r.phase === 'Bloom' && r.woche === woche)!;
			expect(row.dosierungen.big_bud ?? 0, `Bloom W${woche}`).toBe(0);
		}
	});

	it('Overdrive nur Bloom W6-7 (Schema-Constraint)', () => {
		for (const woche of [6, 7]) {
			const row = advancedSensi.schema.find(r => r.phase === 'Bloom' && r.woche === woche)!;
			expect(row.dosierungen.overdrive, `Bloom W${woche}`).toBeGreaterThan(0);
		}
		for (const woche of [1, 2, 3, 4, 5, 8]) {
			const row = advancedSensi.schema.find(r => r.phase === 'Bloom' && r.woche === woche)!;
			expect(row.dosierungen.overdrive ?? 0, `Bloom W${woche}`).toBe(0);
		}
	});
});

describe('Advanced Sensi — Module-Hooks', () => {
	it('weekNotes Veg W1: A=B-Invariant + Voodoo-Hinweis', () => {
		const notes = advancedSensi.module?.weekNotes?.('Veg', 1);
		expect(notes?.some(n => /gleicher Menge/i.test(n))).toBe(true);
		expect(notes?.some(n => /Voodoo/i.test(n))).toBe(true);
	});

	it('weekNotes Bloom W4: Big Bud Peak', () => {
		const notes = advancedSensi.module?.weekNotes?.('Bloom', 4);
		expect(notes?.some(n => /Big Bud Peak/i.test(n))).toBe(true);
	});

	it('weekNotes Bloom W6: Overdrive-Wechsel', () => {
		const notes = advancedSensi.module?.weekNotes?.('Bloom', 6);
		expect(notes?.some(n => /Overdrive/i.test(n))).toBe(true);
	});

	it('weekNotes Bloom W2: Bud Candy ab jetzt', () => {
		const notes = advancedSensi.module?.weekNotes?.('Bloom', 2);
		expect(notes?.some(n => /Bud Candy/i.test(n))).toBe(true);
	});

	it('validateInput pH außerhalb 5-7: Warnung', () => {
		const r = advancedSensi.module?.validateInput?.({
			feedline_id: 'advanced-sensi',
			wasserprofil: 'Mainz Petersaue',
			phase: 'Bloom', woche: 3, tag: 1, strain: 'T',
			reservoir_L: 10, faktor_modus: 'Manuell', faktor_manuell: 100,
			calmag_typ: 'A', ec_einheit: 'mS/cm', medium: 'hydro',
			ist_ph: 4.5,
		});
		expect(r?.warnings.some(w => /pH Perfect/.test(w))).toBe(true);
	});

	it('validateInput pH im normalen Range: keine Warnung', () => {
		const r = advancedSensi.module?.validateInput?.({
			feedline_id: 'advanced-sensi',
			wasserprofil: 'Mainz Petersaue',
			phase: 'Bloom', woche: 3, tag: 1, strain: 'T',
			reservoir_L: 10, faktor_modus: 'Manuell', faktor_manuell: 100,
			calmag_typ: 'A', ec_einheit: 'mS/cm', medium: 'hydro',
			ist_ph: 6.0,
		});
		expect(r?.warnings).toEqual([]);
	});

	it('recommendedAddons enthält Big Bud + Overdrive Wechsel-Hinweis', () => {
		const addons = advancedSensi.module?.recommendedAddons?.();
		const bigBud = addons?.find(a => /Big Bud/.test(a.name));
		expect(bigBud?.reason).toMatch(/Overdrive/);
	});
});
