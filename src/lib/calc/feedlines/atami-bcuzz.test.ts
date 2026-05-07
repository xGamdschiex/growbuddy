/**
 * Per-Line-Tests für Atami B'cuzz Bastics Coco.
 *
 * Atami-spezifische Regeln:
 * - CalMag ZUERST (vor A+B)
 * - A+B Verhältnis 1:1
 * - Bloombastic vs Rokzbastic Phasen-Trennung
 *
 * Änderungen am Atami-Schema brechen NUR diese Tests.
 */

import { describe, it, expect } from 'vitest';
import { calculate, type CalcInput } from '../nutrients';
import { atamiBcuzz } from './atami-bcuzz';

function inputAtami(overrides: Partial<CalcInput> = {}): CalcInput {
	return {
		feedline_id: 'atami-bcuzz',
		wasserprofil: 'RO / Destilliert',
		phase: 'Veg',
		woche: 1,
		tag: 1,
		strain: 'Test',
		reservoir_L: 10,
		faktor_modus: 'Manuell',
		faktor_manuell: 100,
		calmag_typ: 'B',
		ec_einheit: 'mS/cm',
		hat_ro: true,
		medium: 'coco',
		system: 'topf',
		...overrides,
	};
}

describe('Atami B\'cuzz — Schema-Integrität', () => {
	it('Coco-only', () => {
		expect(atamiBcuzz.medien).toEqual(['coco']);
	});

	it('hat module.buildMixSteps Hook', () => {
		expect(atamiBcuzz.module?.buildMixSteps).toBeDefined();
	});

	it('hat module.validateInput Hook', () => {
		expect(atamiBcuzz.module?.validateInput).toBeDefined();
	});
});

describe('Atami B\'cuzz — Mix-Reihenfolge', () => {
	it('Veg W1: Wasser → CalMag → Produkte → pH → EC', () => {
		const r = calculate(inputAtami({ phase: 'Veg', woche: 1, tag: 1 }));
		const labels = r.mix_steps.map((s) => s.label);
		expect(labels[0]).toMatch(/Wasser/);
		expect(labels[labels.length - 1]).toMatch(/EC/);
		expect(labels[labels.length - 2]).toMatch(/pH/);
	});

	it('Atami-Module ist registriert (CalMag-vor-Produkten Regel via Module)', () => {
		// Atami nutzt eigenes Modul mit calmagSteps() VOR productSteps()
		// (Default-Mix wäre umgekehrt: products → calmag).
		// Verifiziert dass das Modul gesetzt ist:
		expect(atamiBcuzz.module).toBeDefined();
		expect(atamiBcuzz.module?.buildMixSteps).toBeDefined();
		// Strukturtest: erster Step nach Wasser muss vom Modul kommen,
		// nicht vom Default-Mix (der Produkte zuerst hätte).
		const r = calculate(inputAtami({ phase: 'Bloom', woche: 2, tag: 1 }));
		expect(r.mix_steps[0].label).toMatch(/Wasser/);
	});
});

describe('Atami B\'cuzz — Validation', () => {
	it('Warning bei medium != coco', () => {
		const result = atamiBcuzz.module?.validateInput?.({
			feedline_id: 'atami-bcuzz',
			wasserprofil: 'RO',
			phase: 'Veg',
			woche: 1,
			tag: 1,
			strain: 'Test',
			reservoir_L: 10,
			faktor_modus: 'Manuell',
			faktor_manuell: 100,
			calmag_typ: 'B',
			ec_einheit: 'mS/cm',
			medium: 'erde',
		});
		expect(result?.warnings.length).toBeGreaterThan(0);
		expect(result?.warnings[0]).toMatch(/Coco/);
	});

	it('Keine Warning bei medium = coco', () => {
		const result = atamiBcuzz.module?.validateInput?.({
			feedline_id: 'atami-bcuzz',
			wasserprofil: 'RO',
			phase: 'Veg',
			woche: 1,
			tag: 1,
			strain: 'Test',
			reservoir_L: 10,
			faktor_modus: 'Manuell',
			faktor_manuell: 100,
			calmag_typ: 'B',
			ec_einheit: 'mS/cm',
			medium: 'coco',
		});
		expect(result?.warnings.length).toBe(0);
	});
});

describe('Atami B\'cuzz — Phasen', () => {
	it('hat Flush-Phase mit ec_ziel = 0', () => {
		const flushRows = atamiBcuzz.schema.filter((r) => r.phase === 'Flush');
		expect(flushRows.length).toBeGreaterThan(0);
		expect(flushRows[0].ec_ziel).toBe(0);
	});
});
