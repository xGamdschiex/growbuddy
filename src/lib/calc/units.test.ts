import { describe, it, expect } from 'vitest';
import { fromMsPerCm, toMsPerCm, convertEC, unitFactor, formatEC } from './units';

describe('EC unit conversion', () => {
	it('mS/cm → ppm500', () => {
		expect(fromMsPerCm(1.5, 'ppm500')).toBe(750);
	});
	it('mS/cm → ppm700', () => {
		expect(fromMsPerCm(1.5, 'ppm700')).toBe(1050);
	});
	it('ppm500 → mS/cm', () => {
		expect(toMsPerCm(750, 'ppm500')).toBeCloseTo(1.5, 5);
	});
	it('ppm700 → ppm500 round-trip', () => {
		const v = convertEC(1400, 'ppm700', 'ppm500');
		expect(v).toBeCloseTo(1000, 5);
	});
	it('mS/cm identity', () => {
		expect(convertEC(2.0, 'mS/cm', 'mS/cm')).toBe(2.0);
	});
	it('unitFactor returns multiplier', () => {
		expect(unitFactor('mS/cm')).toBe(1);
		expect(unitFactor('ppm500')).toBe(500);
		expect(unitFactor('ppm700')).toBe(700);
	});
	it('formatEC rounds mS/cm to 2 decimals', () => {
		expect(formatEC(1.234, 'mS/cm')).toBe('1.23 mS/cm');
	});
	it('formatEC rounds ppm to integer', () => {
		expect(formatEC(749.6, 'ppm500')).toBe('750 ppm500');
	});
	it('edge-case: 0 value', () => {
		expect(fromMsPerCm(0, 'ppm500')).toBe(0);
		expect(toMsPerCm(0, 'ppm700')).toBe(0);
	});
});
