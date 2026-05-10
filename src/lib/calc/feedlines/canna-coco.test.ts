/**
 * Per-Line-Tests für CANNA Coco A+B (coco-spezifisch).
 *
 * Sichert ab:
 * - Schema-Integrität (Veg 3W + Bloom 8W + Flush)
 * - Coco-A == Coco-B Mengen IMMER
 * - Module-Hooks (weekNotes, validateInput, recommendedAddons)
 * - Phase-Filter: PK 13-14 nur Bloom W4-6
 *
 * Änderungen am Coco-Schema brechen NUR diese Tests.
 */

import { describe, it, expect } from 'vitest';
import { calculate, type CalcInput } from '../nutrients';
import { cannaCoco } from './canna';

function inputCoco(overrides: Partial<CalcInput> = {}): CalcInput {
	return {
		feedline_id: 'canna-coco',
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
		medium: 'coco',
		system: 'topf',
		...overrides,
	};
}

describe('CANNA Coco — Schema-Integrität', () => {
	it('typ ist mineral', () => {
		expect(cannaCoco.typ).toBe('mineral');
	});

	it('Medien: coco + hydro', () => {
		expect(cannaCoco.medien).toContain('coco');
		expect(cannaCoco.medien).toContain('hydro');
		expect(cannaCoco.medien).not.toContain('erde');
	});

	it('Phasen: Veg (3W) + Bloom (8W) + Flush', () => {
		expect(cannaCoco.phasen.find(p => p.name === 'Veg')?.schema_wochen).toBe(3);
		expect(cannaCoco.phasen.find(p => p.name === 'Bloom')?.schema_wochen).toBe(8);
		expect(cannaCoco.phasen.find(p => p.name === 'Flush')?.schema_wochen).toBe(1);
	});

	it('Coco A und Coco B IMMER in gleicher Menge (Schema-Constraint)', () => {
		// Critical Invariant: Manufacturer-Vorgabe — A != B würde Nährstoffmix kaputtmachen
		for (const row of cannaCoco.schema) {
			const a = row.dosierungen.coco_a ?? 0;
			const b = row.dosierungen.coco_b ?? 0;
			expect(a, `Phase ${row.phase} W${row.woche}: coco_a (${a}) != coco_b (${b})`).toBe(b);
		}
	});

	it('hat module mit allen 3 Hooks', () => {
		expect(cannaCoco.module?.weekNotes).toBeDefined();
		expect(cannaCoco.module?.validateInput).toBeDefined();
		expect(cannaCoco.module?.recommendedAddons).toBeDefined();
	});

	it('calmag_empfohlen=true (Coco bindet Ca/Mg)', () => {
		expect(cannaCoco.features.calmag_empfohlen).toBe(true);
	});
});

describe('CANNA Coco — Phasen-Filter', () => {
	it('Veg W2: Coco A+B aktiv (gleiche Menge)', () => {
		const r = calculate(inputCoco({ phase: 'Veg', woche: 2, tag: 1 }));
		const labels = r.mix_steps.map(s => s.label);
		expect(labels.some(l => /Coco A/.test(l))).toBe(true);
		expect(labels.some(l => /Coco B/.test(l))).toBe(true);
	});

	it('Bloom W5: PK 13-14 aktiv', () => {
		const r = calculate(inputCoco({ phase: 'Bloom', woche: 5, tag: 1 }));
		const labels = r.mix_steps.map(s => s.label);
		expect(labels.some(l => /PK 13-14/.test(l))).toBe(true);
	});

	it('Bloom W2: PK 13-14 NICHT aktiv (zu früh)', () => {
		const r = calculate(inputCoco({ phase: 'Bloom', woche: 2, tag: 1 }));
		const labels = r.mix_steps.map(s => s.label);
		expect(labels.some(l => /PK 13-14/.test(l))).toBe(false);
	});

	it('Flush: ec_ziel 0 im Schema, keine Produkt-Dosierung', () => {
		const flushRow = cannaCoco.schema.find(r => r.phase === 'Flush' && r.woche === 1)!;
		expect(flushRow.ec_ziel).toBe(0);
		expect(Object.keys(flushRow.dosierungen).length).toBe(0);
	});
});

describe('CANNA Coco — Mix-Reihenfolge (Default-Mix)', () => {
	it('Wasser zuerst, EC zuletzt, pH vorletzter', () => {
		const r = calculate(inputCoco({ phase: 'Bloom', woche: 4, tag: 1 }));
		const labels = r.mix_steps.map(s => s.label);
		expect(labels[0]).toMatch(/Wasser/);
		expect(labels[labels.length - 1]).toMatch(/EC/);
		expect(labels[labels.length - 2]).toMatch(/pH/);
	});
});

describe('CANNA Coco — Module-Hooks', () => {
	it('weekNotes Veg W1: A=B-Hinweis (Critical-Warn)', () => {
		const notes = cannaCoco.module?.weekNotes?.('Veg', 1);
		expect(notes?.some(n => /gleicher Menge/i.test(n))).toBe(true);
	});

	it('weekNotes Veg W2+: CalMag-Hinweis (Coco bindet Ca)', () => {
		const notes = cannaCoco.module?.weekNotes?.('Veg', 2);
		expect(notes?.some(n => /CalMag/i.test(n))).toBe(true);
	});

	it('weekNotes Bloom W5: PK 13-14 Hinweis', () => {
		const notes = cannaCoco.module?.weekNotes?.('Bloom', 5);
		expect(notes?.some(n => /PK 13-14/.test(n))).toBe(true);
	});

	it('weekNotes Bloom W7: Pre-Flush', () => {
		const notes = cannaCoco.module?.weekNotes?.('Bloom', 7);
		expect(notes?.some(n => /Pre-Flush/i.test(n))).toBe(true);
	});

	it('validateInput erde: warnt vor falscher Line', () => {
		const r = cannaCoco.module?.validateInput?.({
			feedline_id: 'canna-coco',
			wasserprofil: 'Mainz Petersaue',
			phase: 'Veg', woche: 1, tag: 1, strain: 'T',
			reservoir_L: 10, faktor_modus: 'Manuell', faktor_manuell: 100,
			calmag_typ: 'A', ec_einheit: 'mS/cm', medium: 'erde',
		});
		expect(r?.warnings.some(w => /Terra/.test(w))).toBe(true);
	});

	it('validateInput coco: keine Warnung', () => {
		const r = cannaCoco.module?.validateInput?.({
			feedline_id: 'canna-coco',
			wasserprofil: 'RO / Destilliert',
			phase: 'Veg', woche: 1, tag: 1, strain: 'T',
			reservoir_L: 10, faktor_modus: 'Manuell', faktor_manuell: 100,
			calmag_typ: 'A', ec_einheit: 'mS/cm', medium: 'coco',
		});
		expect(r?.warnings).toEqual([]);
	});

	it('recommendedAddons enthält CalMag + Cannazym', () => {
		const addons = cannaCoco.module?.recommendedAddons?.();
		expect(addons?.some(a => /CalMag/.test(a.name))).toBe(true);
		expect(addons?.some(a => /Cannazym/.test(a.name))).toBe(true);
	});
});
