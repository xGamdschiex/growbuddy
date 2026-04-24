import { describe, it, expect } from 'vitest';
import { calcAutoFaktor, calcFaktor } from './factor';
import type { SchemaRow } from './schema';

const schemaVeg: SchemaRow = {
	phase: 'Veg', woche: 1,
	fmin: 50, fmax: 70,
	ec_ziel: 1.2, ph_ziel: 5.8,
	ca_ziel: 120, mg_ziel: 50,
} as any;

describe('calcAutoFaktor', () => {
	it('Tag 1 = fmin', () => {
		expect(calcAutoFaktor(50, 70, 1)).toBe(50);
	});
	it('Tag 7 = fmax', () => {
		expect(calcAutoFaktor(50, 70, 7)).toBe(70);
	});
	it('Tag 4 = Mittelwert', () => {
		expect(calcAutoFaktor(50, 70, 4)).toBe(60);
	});
	it('Tag < 1 wird auf 1 geclampt', () => {
		expect(calcAutoFaktor(50, 70, 0)).toBe(50);
		expect(calcAutoFaktor(50, 70, -5)).toBe(50);
	});
	it('Tag > 7 wird auf 7 geclampt', () => {
		expect(calcAutoFaktor(50, 70, 10)).toBe(70);
	});
	it('prevWeekFmax hebt fmin an (kein Rücksprung)', () => {
		// Vorwoche endete bei 62%, aktuelle Woche 50→70 → start bei 62
		expect(calcAutoFaktor(50, 70, 1, 62)).toBe(62);
	});
	it('prevWeekFmax nicht angewendet bei Taper', () => {
		// fmax sinkt (70 → 60) → kein Smoothing
		expect(calcAutoFaktor(40, 60, 1, 70)).toBe(40);
	});
});

describe('calcFaktor', () => {
	it('Auto-Modus nutzt auto_pct', () => {
		const r = calcFaktor({ modus: 'Auto', manuell_pct: 99, tag: 4, schema: schemaVeg });
		expect(r.aktiv_pct).toBe(60);
		expect(r.auto_pct).toBe(60);
		expect(r.modus).toBe('Auto');
	});
	it('Manuell-Modus clampt 20-100', () => {
		expect(calcFaktor({ modus: 'Manuell', manuell_pct: 150, tag: 1, schema: schemaVeg }).aktiv_pct).toBe(100);
		expect(calcFaktor({ modus: 'Manuell', manuell_pct: 5, tag: 1, schema: schemaVeg }).aktiv_pct).toBe(20);
		expect(calcFaktor({ modus: 'Manuell', manuell_pct: 75, tag: 1, schema: schemaVeg }).aktiv_pct).toBe(75);
	});
});
