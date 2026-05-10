/**
 * Per-Line-Tests für GH Powder Feeding (3 Lines).
 *
 * Sichert:
 * - Schema-Integrität (Phasen, Wochen, EC-Range, Booster-Phase-Constraint)
 * - Module-Hooks pro Line (weekNotes, validateInput, recommendedAddons)
 * - GH Grow ist eine reine Veg-Line (KEIN Bloom im Schema)
 *
 * Änderungen an einem GH-Schema brechen NUR diese Tests.
 */

import { describe, it, expect } from 'vitest';
import { calculate, type CalcInput } from '../nutrients';
import { ghHybrids, ghShortFlowering, ghGrow } from './greenhouse-feeding';

function inputGH(feedline_id: string, overrides: Partial<CalcInput> = {}): CalcInput {
	return {
		feedline_id,
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

describe('GH Hybrids — Schema + Module', () => {
	it('typ mineral, alle 3 Medien', () => {
		expect(ghHybrids.typ).toBe('mineral');
		expect(ghHybrids.medien).toEqual(['hydro', 'coco', 'erde']);
	});

	it('Phasen: Veg 3W + Bloom 8W + Flush 1W', () => {
		expect(ghHybrids.phasen.find(p => p.name === 'Veg')?.schema_wochen).toBe(3);
		expect(ghHybrids.phasen.find(p => p.name === 'Bloom')?.schema_wochen).toBe(8);
		expect(ghHybrids.phasen.find(p => p.name === 'Flush')?.schema_wochen).toBe(1);
	});

	it('hat alle 3 Module-Hooks', () => {
		expect(ghHybrids.module?.weekNotes).toBeDefined();
		expect(ghHybrids.module?.validateInput).toBeDefined();
		expect(ghHybrids.module?.recommendedAddons).toBeDefined();
	});

	it('Booster PK+ nur in Bloom (Phase-Filter)', () => {
		const veg = calculate(inputGH('gh-hybrids', { phase: 'Veg', woche: 2, tag: 1 }));
		const bloom = calculate(inputGH('gh-hybrids', { phase: 'Bloom', woche: 4, tag: 1 }));
		expect(veg.mix_steps.some(s => /Booster PK\+/.test(s.label))).toBe(false);
		expect(bloom.mix_steps.some(s => /Booster PK\+/.test(s.label))).toBe(true);
	});

	it('weekNotes Bloom W4: Booster Peak', () => {
		const notes = ghHybrids.module?.weekNotes?.('Bloom', 4);
		expect(notes?.some(n => /Peak/i.test(n))).toBe(true);
	});

	it('weekNotes Bloom W8: Ripen-Hinweis', () => {
		const notes = ghHybrids.module?.weekNotes?.('Bloom', 8);
		expect(notes?.some(n => /Ripen/i.test(n))).toBe(true);
	});

	it('validateInput Coco: warnt vor Calcium-Defizit', () => {
		const r = ghHybrids.module?.validateInput?.({
			feedline_id: 'gh-hybrids',
			wasserprofil: 'Mainz Petersaue',
			phase: 'Veg', woche: 1, tag: 1, strain: 'T',
			reservoir_L: 10, faktor_modus: 'Manuell', faktor_manuell: 100,
			calmag_typ: 'A', ec_einheit: 'mS/cm', medium: 'coco',
		});
		expect(r?.warnings.some(w => /Calcium/i.test(w))).toBe(true);
	});

	it('recommendedAddons enthält Calcium + Booster + Enhancer', () => {
		const addons = ghHybrids.module?.recommendedAddons?.();
		expect(addons?.some(a => /Calcium/.test(a.name))).toBe(true);
		expect(addons?.some(a => /Booster/.test(a.name))).toBe(true);
		expect(addons?.some(a => /Enhancer/.test(a.name))).toBe(true);
	});
});

describe('GH Short Flowering — Schema + Module', () => {
	it('Phasen: Veg 2W + Bloom 7W (kürzer als Hybrids) + Flush 1W', () => {
		expect(ghShortFlowering.phasen.find(p => p.name === 'Veg')?.schema_wochen).toBe(2);
		expect(ghShortFlowering.phasen.find(p => p.name === 'Bloom')?.schema_wochen).toBe(7);
	});

	it('hat alle Module-Hooks', () => {
		expect(ghShortFlowering.module?.weekNotes).toBeDefined();
		expect(ghShortFlowering.module?.validateInput).toBeDefined();
		expect(ghShortFlowering.module?.recommendedAddons).toBeDefined();
	});

	it('Bloom W4: Booster Peak (im Schema 0.5 g/L)', () => {
		const r = calculate(inputGH('gh-short-flowering', { phase: 'Bloom', woche: 4, tag: 1 }));
		const booster = r.mix_steps.find(s => /Booster PK\+/.test(s.label));
		expect(booster).toBeDefined();
	});

	it('Bloom W7 (Ripen): minimale Düngung im Schema', () => {
		const row = ghShortFlowering.schema.find(r => r.phase === 'Bloom' && r.woche === 7);
		expect(row?.dosierungen.booster).toBe(0);
		expect(row?.dosierungen.short_fl).toBeLessThan(0.6);
	});

	it('weekNotes Bloom W7: Ripen', () => {
		const notes = ghShortFlowering.module?.weekNotes?.('Bloom', 7);
		expect(notes?.some(n => /Ripen/i.test(n))).toBe(true);
	});

	it('recommendedAddons vermerkt 1-Woche-kürzeres Booster-Fenster', () => {
		const addons = ghShortFlowering.module?.recommendedAddons?.();
		const booster = addons?.find(a => /Booster/.test(a.name));
		expect(booster?.reason).toMatch(/W6|kürzer/i);
	});
});

describe('GH Grow — reine Veg-Line', () => {
	it('Phasen: NUR Clone (2W) + Veg (4W), KEIN Bloom', () => {
		expect(ghGrow.phasen.map(p => p.name)).toEqual(['Clone', 'Veg']);
		expect(ghGrow.phasen.find(p => p.name === 'Bloom')).toBeUndefined();
	});

	it('hat module mit allen Hooks', () => {
		expect(ghGrow.module?.weekNotes).toBeDefined();
		expect(ghGrow.module?.validateInput).toBeDefined();
		expect(ghGrow.module?.recommendedAddons).toBeDefined();
	});

	it('weekNotes Clone: Wurzelbildung-Hinweis', () => {
		const notes = ghGrow.module?.weekNotes?.('Clone', 1);
		expect(notes?.some(n => /Wurzel/i.test(n))).toBe(true);
	});

	it('weekNotes Veg W4: Wechsel-zu-Hybrids-Empfehlung', () => {
		const notes = ghGrow.module?.weekNotes?.('Veg', 4);
		expect(notes?.some(n => /Hybrids|Short/i.test(n))).toBe(true);
	});

	it('validateInput: warnt wenn Bloom-Phase versucht wird', () => {
		const r = ghGrow.module?.validateInput?.({
			feedline_id: 'gh-grow',
			wasserprofil: 'Mainz Petersaue',
			phase: 'Bloom', woche: 1, tag: 1, strain: 'T',
			reservoir_L: 10, faktor_modus: 'Manuell', faktor_manuell: 100,
			calmag_typ: 'A', ec_einheit: 'mS/cm', medium: 'erde',
		});
		expect(r?.warnings.some(w => /reine Veg|Bloom.*wechseln/i.test(w))).toBe(true);
	});

	it('validateInput: Veg-Phase keine Bloom-Warnung', () => {
		const r = ghGrow.module?.validateInput?.({
			feedline_id: 'gh-grow',
			wasserprofil: 'Mainz Petersaue',
			phase: 'Veg', woche: 1, tag: 1, strain: 'T',
			reservoir_L: 10, faktor_modus: 'Manuell', faktor_manuell: 100,
			calmag_typ: 'A', ec_einheit: 'mS/cm', medium: 'erde',
		});
		expect(r?.warnings.some(w => /Bloom/.test(w))).toBe(false);
	});

	it('recommendedAddons enthält Hinweis auf Bloom-Line-Wechsel', () => {
		const addons = ghGrow.module?.recommendedAddons?.();
		expect(addons?.some(a => /Hybrids|Short Flowering/.test(a.name))).toBe(true);
	});
});

describe('GH — Cross-Line-Konsistenz', () => {
	it('Alle 3 Lines haben calmag_empfohlen=true (Pulver = wenig Ca)', () => {
		expect(ghHybrids.features.calmag_empfohlen).toBe(true);
		expect(ghShortFlowering.features.calmag_empfohlen).toBe(true);
		expect(ghGrow.features.calmag_empfohlen).toBe(true);
	});

	it('Hybrids und Short Flowering haben Booster, Grow nicht', () => {
		expect(ghHybrids.produkte.some(p => p.key === 'booster')).toBe(true);
		expect(ghShortFlowering.produkte.some(p => p.key === 'booster')).toBe(true);
		expect(ghGrow.produkte.some(p => p.key === 'booster')).toBe(false);
	});
});
