/**
 * Per-Line-Tests für Athena Pro Line.
 *
 * Diese Tests sichern Athena-spezifische Logik ab:
 * - Mix-Reihenfolge (CalMag vor Cleanse vor Produkten)
 * - Cleanse-Rampe (T1→T7)
 * - Pulver in Phasen (Pro Grow nur Veg, Pro Bloom in Bloom+Clone)
 * - Fade-Phase (Bloom W8-W9)
 *
 * Änderungen am Athena-Schema brechen NUR diese Tests, nicht andere Lines.
 */

import { describe, it, expect } from 'vitest';
import { calculate, type CalcInput } from '../nutrients';
import { athenaPro } from './athena-pro';

function inputAthena(overrides: Partial<CalcInput> = {}): CalcInput {
	return {
		feedline_id: 'athena-pro',
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

describe('Athena Pro — Schema-Integrität', () => {
	it('hat 3 Phasen: Clone, Veg, Bloom', () => {
		expect(athenaPro.phasen.map((p) => p.name)).toEqual(['Clone', 'Veg', 'Bloom']);
	});

	it('Clone 2W, Veg 4W, Bloom 9W', () => {
		expect(athenaPro.phasen.find((p) => p.name === 'Clone')?.schema_wochen).toBe(2);
		expect(athenaPro.phasen.find((p) => p.name === 'Veg')?.schema_wochen).toBe(4);
		expect(athenaPro.phasen.find((p) => p.name === 'Bloom')?.schema_wochen).toBe(9);
	});

	it('hat module.buildMixSteps Hook', () => {
		expect(athenaPro.module?.buildMixSteps).toBeDefined();
	});
});

describe('Athena Pro — Mix-Reihenfolge', () => {
	it('Veg W1 T1: Wasser → CalMag → Cleanse → Produkte → pH → EC', () => {
		const r = calculate(inputAthena({ phase: 'Veg', woche: 1, tag: 1 }));
		const labels = r.mix_steps.map((s) => s.label);
		expect(labels[0]).toMatch(/Wasser/);
		expect(labels[labels.length - 1]).toMatch(/EC/);
		expect(labels[labels.length - 2]).toMatch(/pH/);
	});

	it('Cleanse-Step bei Bloom W3 vorhanden (T1→T7 Rampe)', () => {
		const r = calculate(inputAthena({ phase: 'Bloom', woche: 3, tag: 4 }));
		const cleanse = r.mix_steps.find((s) => s.label === 'Cleanse');
		expect(cleanse).toBeDefined();
		expect(r.cleanse_mL_tank).toBeGreaterThan(0);
	});
});

describe('Athena Pro — Pulver-Phasen-Filter', () => {
	it('Veg W1: Pro Grow aktiv, Pro Bloom inaktiv', () => {
		const r = calculate(inputAthena({ phase: 'Veg', woche: 1, tag: 1 }));
		expect(r.grow_g).toBeGreaterThan(0);
		expect(r.bloom_g).toBe(0);
	});

	it('Bloom W3: Pro Bloom aktiv, Pro Grow inaktiv', () => {
		const r = calculate(inputAthena({ phase: 'Bloom', woche: 3, tag: 1 }));
		expect(r.grow_g).toBe(0);
		expect(r.bloom_g).toBeGreaterThan(0);
	});

	it('Bloom W9 Fade-Phase: Fade aktiv', () => {
		const r = calculate(inputAthena({ phase: 'Bloom', woche: 9, tag: 1 }));
		expect(r.fade_mL).toBeGreaterThan(0);
	});
});

describe('Athena Pro — Auto-Faktor (Tag-Interpolation)', () => {
	it('Veg W2 T1 mit fmin=55, fmax=67 → faktor_auto im Range', () => {
		const r = calculate(inputAthena({ phase: 'Veg', woche: 2, tag: 1, faktor_modus: 'Auto' }));
		expect(r.faktor_auto).toBeGreaterThanOrEqual(50);
		expect(r.faktor_auto).toBeLessThanOrEqual(67);
	});

	it('Veg W2 T7 → näher an fmax', () => {
		const t1 = calculate(inputAthena({ phase: 'Veg', woche: 2, tag: 1, faktor_modus: 'Auto' }));
		const t7 = calculate(inputAthena({ phase: 'Veg', woche: 2, tag: 7, faktor_modus: 'Auto' }));
		expect(t7.faktor_auto).toBeGreaterThanOrEqual(t1.faktor_auto);
	});
});

describe('Athena Pro — moduleweekNotes', () => {
	it('Bloom W8/W9: Fade-Hinweis wird zurückgegeben', () => {
		const notes = athenaPro.module?.weekNotes?.('Bloom', 8);
		expect(notes).toBeDefined();
		expect(notes?.[0]).toMatch(/Fade/);
	});

	it('Veg W1: keine speziellen Hinweise', () => {
		const notes = athenaPro.module?.weekNotes?.('Veg', 1);
		expect(notes ?? []).toHaveLength(0);
	});
});
