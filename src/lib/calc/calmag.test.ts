import { describe, it, expect } from 'vitest';
import { calcHahnPct, calcCalMag } from './calmag';
import type { SchemaRow, WasserProfil } from './schema';

const schema: SchemaRow = {
	phase: 'Veg', woche: 2,
	fmin: 55, fmax: 70,
	ec_ziel: 1.2, ph_ziel: 5.8,
	ca_ziel: 150, mg_ziel: 60,
} as any;

const mainz: WasserProfil = {
	name: 'Mainz Petersaue',
	ca: 100, mg: 20, ec: 0.7, ph: 7.4, haerte: 18,
} as any;

const ro: WasserProfil = {
	name: 'RO Wasser',
	ca: 0, mg: 0, ec: 0.01, ph: 6.5, haerte: 0,
} as any;

describe('calcHahnPct', () => {
	it('RO → 100% Hahn (nicht limitiert)', () => {
		expect(calcHahnPct(schema, ro)).toBe(100);
	});
	it('Mainz Ca=100 / Ziel 150 → 100% (schema limitiert nicht)', () => {
		expect(calcHahnPct(schema, mainz)).toBe(100);
	});
	it('Wasser mit Ca > Ziel → reduzierter Hahn-Anteil', () => {
		const hart: WasserProfil = { ...mainz, ca: 200 };
		const pct = calcHahnPct(schema, hart);
		expect(pct).toBeLessThan(100);
		expect(pct).toBeGreaterThan(0);
	});
});

describe('calcCalMag', () => {
	it('RO: viel CalMag nötig für Ca-Ziel', () => {
		const r = calcCalMag({
			schema, profil: ro, hahn_pct: 100, reservoir_L: 10, typ: 'A',
		});
		expect(r.calmag_mLpL).toBeGreaterThan(0);
		expect(r.ca_ist).toBeCloseTo(schema.ca_ziel, 0);
	});
	it('Ca:Mg Ratio im Zielfenster', () => {
		const r = calcCalMag({
			schema, profil: mainz, hahn_pct: 100, reservoir_L: 10, typ: 'A',
		});
		expect(r.camg_ratio).toBeGreaterThanOrEqual(1.8);
		expect(r.camg_ratio).toBeLessThanOrEqual(3.0);
	});
	it('Tank-Total = mLpL × reservoir_L', () => {
		const r = calcCalMag({
			schema, profil: ro, hahn_pct: 100, reservoir_L: 20, typ: 'A',
		});
		expect(r.calmag_mL_total).toBeCloseTo(r.calmag_mLpL * 20, 1);
	});
});
