/**
 * Per-Line-Tests für CANNA Terra (erden-spezifisch).
 *
 * Sichert ab:
 * - Schema-Integrität (Phasen, Wochen, EC-Range)
 * - Module-Hooks (weekNotes, validateInput, recommendedAddons)
 * - Mix-Reihenfolge (Default-Mix, kein Custom-Builder)
 * - Phase-Filter: Terra Vega nur Veg, Terra Flores nur Bloom/Flush
 *
 * Änderungen am Terra-Schema brechen NUR diese Tests.
 */

import { describe, it, expect } from 'vitest';
import { calculate, type CalcInput } from '../nutrients';
import { cannaTerra } from './canna';

function inputTerra(overrides: Partial<CalcInput> = {}): CalcInput {
	return {
		feedline_id: 'canna-terra',
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
		medium: 'erde',
		system: 'topf',
		...overrides,
	};
}

describe('CANNA Terra — Schema-Integrität', () => {
	it('typ ist mineral', () => {
		expect(cannaTerra.typ).toBe('mineral');
	});

	it('medium: nur erde', () => {
		expect(cannaTerra.medien).toEqual(['erde']);
	});

	it('Phasen: Veg (4W) + Bloom (8W) + Flush (1W)', () => {
		expect(cannaTerra.phasen.find(p => p.name === 'Veg')?.schema_wochen).toBe(4);
		expect(cannaTerra.phasen.find(p => p.name === 'Bloom')?.schema_wochen).toBe(8);
		expect(cannaTerra.phasen.find(p => p.name === 'Flush')?.schema_wochen).toBe(1);
	});

	it('hat module mit weekNotes + validateInput + recommendedAddons', () => {
		expect(cannaTerra.module).toBeDefined();
		expect(cannaTerra.module?.weekNotes).toBeDefined();
		expect(cannaTerra.module?.validateInput).toBeDefined();
		expect(cannaTerra.module?.recommendedAddons).toBeDefined();
	});

	it('EC-Range: Veg 0.9-1.3, Bloom Peak 1.8, Flush 0', () => {
		const veg1 = cannaTerra.schema.find(r => r.phase === 'Veg' && r.woche === 1);
		const bloomPeak = cannaTerra.schema.find(r => r.phase === 'Bloom' && r.woche === 5);
		const flush = cannaTerra.schema.find(r => r.phase === 'Flush' && r.woche === 1);
		expect(veg1?.ec_ziel).toBe(0.9);
		expect(bloomPeak?.ec_ziel).toBe(1.8);
		expect(flush?.ec_ziel).toBe(0);
	});
});

describe('CANNA Terra — Phasen-Filter', () => {
	it('Veg W2: Terra Vega aktiv, Terra Flores nicht im Mix', () => {
		const r = calculate(inputTerra({ phase: 'Veg', woche: 2, tag: 1 }));
		const labels = r.mix_steps.map(s => s.label);
		expect(labels.some(l => /Terra Vega/.test(l))).toBe(true);
		expect(labels.some(l => /Terra Flores/.test(l))).toBe(false);
	});

	it('Bloom W3: Terra Flores aktiv, Terra Vega nicht', () => {
		const r = calculate(inputTerra({ phase: 'Bloom', woche: 3, tag: 1 }));
		const labels = r.mix_steps.map(s => s.label);
		expect(labels.some(l => /Terra Flores/.test(l))).toBe(true);
		expect(labels.some(l => /Terra Vega/.test(l))).toBe(false);
	});

	it('Bloom W5: PK 13-14 aktiv (Peak)', () => {
		const r = calculate(inputTerra({ phase: 'Bloom', woche: 5, tag: 1 }));
		const labels = r.mix_steps.map(s => s.label);
		expect(labels.some(l => /PK 13-14/.test(l))).toBe(true);
	});

	it('Flush: ec_ziel 0 im Schema, sehr wenig Produkte', () => {
		// ec_soll wird durch LW-Anteil > 0 sein wenn kein RO; daher direkt am Schema prüfen
		const flushRow = cannaTerra.schema.find(r => r.phase === 'Flush' && r.woche === 1)!;
		expect(flushRow.ec_ziel).toBe(0);
		expect(Object.keys(flushRow.dosierungen).length).toBe(0);
	});
});

describe('CANNA Terra — Mix-Reihenfolge (Default-Mix)', () => {
	it('Wasser zuerst, EC zuletzt, pH vorletzter', () => {
		const r = calculate(inputTerra({ phase: 'Bloom', woche: 3, tag: 1 }));
		const labels = r.mix_steps.map(s => s.label);
		expect(labels[0]).toMatch(/Wasser/);
		expect(labels[labels.length - 1]).toMatch(/EC/);
		expect(labels[labels.length - 2]).toMatch(/pH/);
	});
});

describe('CANNA Terra — Module-Hooks', () => {
	it('weekNotes Veg W1: Substrat-vorgedüngt-Hinweis', () => {
		const notes = cannaTerra.module?.weekNotes?.('Veg', 1);
		expect(notes?.some(n => /vorgedüngt/i.test(n))).toBe(true);
	});

	it('weekNotes Bloom W4: PK 13-14 Hinweis', () => {
		const notes = cannaTerra.module?.weekNotes?.('Bloom', 4);
		expect(notes?.some(n => /PK 13-14/.test(n))).toBe(true);
	});

	it('weekNotes Bloom W7: Pre-Flush Hinweis', () => {
		const notes = cannaTerra.module?.weekNotes?.('Bloom', 7);
		expect(notes?.some(n => /Pre-Flush/i.test(n))).toBe(true);
	});

	it('weekNotes Flush: nur klares Wasser', () => {
		const notes = cannaTerra.module?.weekNotes?.('Flush', 1);
		expect(notes?.some(n => /Wasser/i.test(n))).toBe(true);
	});

	it('validateInput coco: warnt vor falscher Line', () => {
		const r = cannaTerra.module?.validateInput?.({
			feedline_id: 'canna-terra',
			wasserprofil: 'Mainz Petersaue',
			phase: 'Veg', woche: 1, tag: 1, strain: 'T',
			reservoir_L: 10, faktor_modus: 'Manuell', faktor_manuell: 100,
			calmag_typ: 'A', ec_einheit: 'mS/cm', medium: 'coco',
		});
		expect(r?.warnings.some(w => /Coco A\+B/.test(w))).toBe(true);
	});

	it('validateInput hydro: warnt vor DWC', () => {
		const r = cannaTerra.module?.validateInput?.({
			feedline_id: 'canna-terra',
			wasserprofil: 'Mainz Petersaue',
			phase: 'Veg', woche: 1, tag: 1, strain: 'T',
			reservoir_L: 10, faktor_modus: 'Manuell', faktor_manuell: 100,
			calmag_typ: 'A', ec_einheit: 'mS/cm', medium: 'hydro',
		});
		expect(r?.warnings.some(w => /DWC|Hydro/.test(w))).toBe(true);
	});

	it('validateInput erde: keine Warnung', () => {
		const r = cannaTerra.module?.validateInput?.({
			feedline_id: 'canna-terra',
			wasserprofil: 'Mainz Petersaue',
			phase: 'Veg', woche: 1, tag: 1, strain: 'T',
			reservoir_L: 10, faktor_modus: 'Manuell', faktor_manuell: 100,
			calmag_typ: 'A', ec_einheit: 'mS/cm', medium: 'erde',
		});
		expect(r?.warnings).toEqual([]);
	});

	it('recommendedAddons enthält Cannazym + Boost', () => {
		const addons = cannaTerra.module?.recommendedAddons?.();
		expect(addons?.some(a => /Cannazym/.test(a.name))).toBe(true);
		expect(addons?.some(a => /Boost/.test(a.name))).toBe(true);
	});
});
