/**
 * Per-Line-Tests für BioBizz Organic (Light-Mix / Coco).
 *
 * BioBizz-Spezifika:
 * - Organisch (typ='organisch')
 * - EC ist nur Richtwert (ec_ist_richtwert=true im Result)
 * - Default-Mix (Produkte → CalMag, kein Custom-Modul)
 * - Microbes 1x/Woche
 *
 * Änderungen am BioBizz-Schema brechen NUR diese Tests.
 */

import { describe, it, expect } from 'vitest';
import { calculate, type CalcInput } from '../nutrients';
import { biobizz } from './biobizz';

function inputBiobizz(overrides: Partial<CalcInput> = {}): CalcInput {
	return {
		feedline_id: 'biobizz',
		wasserprofil: 'Mainz Petersaue',
		phase: 'Veg',
		woche: 1,
		tag: 1,
		strain: 'Test',
		reservoir_L: 10,
		faktor_modus: 'Manuell',
		faktor_manuell: 100,
		calmag_typ: 'BB',
		ec_einheit: 'mS/cm',
		hat_ro: false,
		medium: 'erde',
		system: 'topf',
		...overrides,
	};
}

describe('BioBizz — Schema-Integrität', () => {
	it('typ ist organisch', () => {
		expect(biobizz.typ).toBe('organisch');
	});

	it('Medien: erde + coco (kein hydro)', () => {
		expect(biobizz.medien).toContain('erde');
		expect(biobizz.medien).toContain('coco');
		expect(biobizz.medien).not.toContain('hydro');
	});

	it('hat module mit weekNotes + validateInput + recommendedAddons', () => {
		expect(biobizz.module).toBeDefined();
		expect(biobizz.module?.weekNotes).toBeDefined();
		expect(biobizz.module?.validateInput).toBeDefined();
		expect(biobizz.module?.recommendedAddons).toBeDefined();
	});
});

describe('BioBizz — Calc-Output', () => {
	it('ec_ist_richtwert=true (organisch)', () => {
		const r = calculate(inputBiobizz({ phase: 'Veg', woche: 2, tag: 1 }));
		expect(r.ec_ist_richtwert).toBe(true);
	});

	it('Mix-Reihenfolge Default: Wasser → Produkte → CalMag → pH → EC', () => {
		const r = calculate(inputBiobizz({ phase: 'Bloom', woche: 2, tag: 1 }));
		const labels = r.mix_steps.map((s) => s.label);
		expect(labels[0]).toMatch(/Wasser/);
		expect(labels[labels.length - 1]).toMatch(/EC/);
		expect(labels[labels.length - 2]).toMatch(/pH/);
	});

	it('keine EC-Budget-Reduktion bei LW (organisch)', () => {
		const r = calculate(inputBiobizz({ phase: 'Veg', woche: 2, tag: 1, hat_ro: false }));
		// Bei organisch: dosierfaktor wird NICHT durch lw_ec_anteil reduziert
		// → faktor_aktiv ≈ faktor_manuell (modulo system-faktor)
		expect(r.faktor_aktiv).toBeGreaterThan(80); // nicht stark reduziert
	});
});

describe('BioBizz — Module-Hooks', () => {
	it('weekNotes Bloom W6: CalMag-Hinweis', () => {
		const notes = biobizz.module?.weekNotes?.('Bloom', 6);
		expect(notes?.some((n) => n.includes('CalMag'))).toBe(true);
	});

	it('weekNotes Veg: Microbes-Hinweis', () => {
		const notes = biobizz.module?.weekNotes?.('Veg', 2);
		expect(notes?.some((n) => n.includes('Microbes'))).toBe(true);
	});

	it('validateInput: hydro warnt vor BioBizz', () => {
		const result = biobizz.module?.validateInput?.({
			feedline_id: 'biobizz',
			wasserprofil: 'Mainz Petersaue',
			phase: 'Veg',
			woche: 1,
			tag: 1,
			strain: 'T',
			reservoir_L: 10,
			faktor_modus: 'Manuell',
			faktor_manuell: 100,
			calmag_typ: 'BB',
			ec_einheit: 'mS/cm',
			medium: 'hydro',
		});
		expect(result?.warnings.some((w) => /DWC|Hydro/.test(w))).toBe(true);
	});

	it('validateInput: erde keine Warnung', () => {
		const result = biobizz.module?.validateInput?.({
			feedline_id: 'biobizz',
			wasserprofil: 'Mainz Petersaue',
			phase: 'Veg',
			woche: 1,
			tag: 1,
			strain: 'T',
			reservoir_L: 10,
			faktor_modus: 'Manuell',
			faktor_manuell: 100,
			calmag_typ: 'BB',
			ec_einheit: 'mS/cm',
			medium: 'erde',
		});
		// Eine ist_ec-Warnung wenn vorhanden, aber bei undefined keine
		expect(result?.warnings.length).toBe(0);
	});

	it('recommendedAddons enthält BioBizz CalMag', () => {
		const addons = biobizz.module?.recommendedAddons?.();
		expect(addons?.some((a) => a.name.includes('CalMag'))).toBe(true);
	});
});
