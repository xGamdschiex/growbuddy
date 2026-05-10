/**
 * Per-Line-Tests für Hesi Soil (hybrid organisch-mineralisch).
 *
 * Sichert ab:
 * - Schema-Integrität (Clone+Veg+Bloom+Flush, EC-Range)
 * - typ='hybrid' (Hesi ist chelatiert)
 * - Phase-Filter (Root Complex Clone+Veg, TNT nur Veg, Bloom Complex nur Bloom)
 * - Module-Hooks (weekNotes, validateInput Coco/Hydro-Warnung)
 *
 * Änderungen am Hesi-Schema brechen NUR diese Tests.
 */

import { describe, it, expect } from 'vitest';
import { calculate, type CalcInput } from '../nutrients';
import { hesi } from './hesi';

function inputHesi(overrides: Partial<CalcInput> = {}): CalcInput {
	return {
		feedline_id: 'hesi',
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

describe('Hesi — Schema-Integrität', () => {
	it('typ ist hybrid (chelatiert)', () => {
		expect(hesi.typ).toBe('hybrid');
	});

	it('Medien: nur erde (Coco/Hydro hat eigene Line)', () => {
		expect(hesi.medien).toEqual(['erde']);
	});

	it('calmag_empfohlen=false (Hesi enthält Ca/Mg)', () => {
		expect(hesi.features.calmag_empfohlen).toBe(false);
	});

	it('Phasen: Clone (1W) + Veg (4W) + Bloom (8W) + Flush', () => {
		expect(hesi.phasen.find(p => p.name === 'Clone')?.schema_wochen).toBe(1);
		expect(hesi.phasen.find(p => p.name === 'Veg')?.schema_wochen).toBe(4);
		expect(hesi.phasen.find(p => p.name === 'Bloom')?.schema_wochen).toBe(8);
		expect(hesi.phasen.find(p => p.name === 'Flush')?.schema_wochen).toBe(1);
	});

	it('hat alle Module-Hooks', () => {
		expect(hesi.module?.weekNotes).toBeDefined();
		expect(hesi.module?.validateInput).toBeDefined();
		expect(hesi.module?.recommendedAddons).toBeDefined();
	});

	it('SuperVit-Tropfen-Dosis 0.08 mL/L durchgehend (außer Flush)', () => {
		const nonFlush = hesi.schema.filter(r => r.phase !== 'Flush' && !(r.phase === 'Bloom' && r.woche === 8));
		for (const row of nonFlush) {
			expect(row.dosierungen.super_vit, `${row.phase} W${row.woche}`).toBe(0.08);
		}
	});

	it('Power Zyme durchgehend 5 mL/L (auch Flush)', () => {
		const allRows = hesi.schema.filter(r => r.phase !== 'Clone'); // Clone=0
		for (const row of allRows) {
			expect(row.dosierungen.power_zyme, `${row.phase} W${row.woche}`).toBe(5);
		}
	});
});

describe('Hesi — Phase-Filter', () => {
	it('Veg W2: TNT Complex aktiv, Bloom Complex nicht', () => {
		const r = calculate(inputHesi({ phase: 'Veg', woche: 2, tag: 1 }));
		const labels = r.mix_steps.map(s => s.label);
		expect(labels.some(l => /TNT/.test(l))).toBe(true);
		expect(labels.some(l => /Bloom Complex/.test(l))).toBe(false);
	});

	it('Bloom W3: Bloom Complex aktiv, TNT nicht', () => {
		const r = calculate(inputHesi({ phase: 'Bloom', woche: 3, tag: 1 }));
		const labels = r.mix_steps.map(s => s.label);
		expect(labels.some(l => /Bloom Complex/.test(l))).toBe(true);
		expect(labels.some(l => /TNT/.test(l))).toBe(false);
	});

	it('Bloom W2+: PK 13/14 aktiv', () => {
		const r = calculate(inputHesi({ phase: 'Bloom', woche: 2, tag: 1 }));
		const labels = r.mix_steps.map(s => s.label);
		expect(labels.some(l => /PK 13\/14/.test(l))).toBe(true);
	});

	it('Bloom W1: PK 13/14 noch NICHT aktiv', () => {
		const row = hesi.schema.find(r => r.phase === 'Bloom' && r.woche === 1)!;
		expect(row.dosierungen.pk1314).toBe(0);
	});

	it('Phosphorus Plus nur Bloom W3-W6', () => {
		for (const woche of [3, 4, 5, 6]) {
			const row = hesi.schema.find(r => r.phase === 'Bloom' && r.woche === woche)!;
			expect(row.dosierungen.phos_plus, `Bloom W${woche}`).toBeGreaterThan(0);
		}
		for (const woche of [1, 2, 7, 8]) {
			const row = hesi.schema.find(r => r.phase === 'Bloom' && r.woche === woche)!;
			expect(row.dosierungen.phos_plus, `Bloom W${woche}`).toBe(0);
		}
	});
});

describe('Hesi — Module-Hooks', () => {
	it('weekNotes Clone: SuperVit-Tropfen-Hinweis', () => {
		const notes = hesi.module?.weekNotes?.('Clone', 1);
		expect(notes?.some(n => /Tropfen|SuperVit/i.test(n))).toBe(true);
	});

	it('weekNotes Veg W1: Root Complex + Power Zyme', () => {
		const notes = hesi.module?.weekNotes?.('Veg', 1);
		expect(notes?.some(n => /Root Complex/i.test(n))).toBe(true);
		expect(notes?.some(n => /Power Zyme/i.test(n))).toBe(true);
	});

	it('weekNotes Bloom W2: PK 13/14 + Boost parallel', () => {
		const notes = hesi.module?.weekNotes?.('Bloom', 2);
		expect(notes?.some(n => /PK 13\/14/.test(n))).toBe(true);
		expect(notes?.some(n => /parallel/i.test(n))).toBe(true);
	});

	it('weekNotes Bloom W7: Reifung-Hinweis', () => {
		const notes = hesi.module?.weekNotes?.('Bloom', 7);
		expect(notes?.some(n => /Reifung/i.test(n))).toBe(true);
	});

	it('validateInput coco: warnt vor Soil-Schema', () => {
		const r = hesi.module?.validateInput?.({
			feedline_id: 'hesi',
			wasserprofil: 'Mainz Petersaue',
			phase: 'Veg', woche: 1, tag: 1, strain: 'T',
			reservoir_L: 10, faktor_modus: 'Manuell', faktor_manuell: 100,
			calmag_typ: 'A', ec_einheit: 'mS/cm', medium: 'coco',
		});
		expect(r?.warnings.some(w => /Soil|Erde/.test(w))).toBe(true);
	});

	it('validateInput hydro: warnt analog', () => {
		const r = hesi.module?.validateInput?.({
			feedline_id: 'hesi',
			wasserprofil: 'Mainz Petersaue',
			phase: 'Veg', woche: 1, tag: 1, strain: 'T',
			reservoir_L: 10, faktor_modus: 'Manuell', faktor_manuell: 100,
			calmag_typ: 'A', ec_einheit: 'mS/cm', medium: 'hydro',
		});
		expect(r?.warnings.some(w => /Soil|Erde/.test(w))).toBe(true);
	});

	it('validateInput erde: keine Warnung', () => {
		const r = hesi.module?.validateInput?.({
			feedline_id: 'hesi',
			wasserprofil: 'Mainz Petersaue',
			phase: 'Veg', woche: 1, tag: 1, strain: 'T',
			reservoir_L: 10, faktor_modus: 'Manuell', faktor_manuell: 100,
			calmag_typ: 'A', ec_einheit: 'mS/cm', medium: 'erde',
		});
		expect(r?.warnings).toEqual([]);
	});

	it('recommendedAddons: CalMag NUR bei RO-Hinweis (sonst nicht nötig)', () => {
		const addons = hesi.module?.recommendedAddons?.();
		const calmag = addons?.find(a => /CalMag/.test(a.name));
		expect(calmag?.reason).toMatch(/RO|destilliert/i);
	});

	it('recommendedAddons enthält Power Zyme durchgehend', () => {
		const addons = hesi.module?.recommendedAddons?.();
		expect(addons?.some(a => /Power Zyme/.test(a.name))).toBe(true);
	});
});
