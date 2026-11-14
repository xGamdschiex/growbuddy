import { describe, it, expect } from 'vitest';
import {
	bridgeOnline, clampLevel, fillGaps, formatPairCode, historyWindow, linePath,
	nearestIndex, normalizePairCode, pickBucket, xAt, yAt, yDomain,
} from './devices';

const BOX = { width: 320, height: 150, padX: 10, padTop: 10, padBottom: 20 };

describe('bridgeOnline', () => {
	it('online bis 90 s nach der letzten Meldung', () => {
		expect(bridgeOnline(1000, 1090)).toBe(true);
		expect(bridgeOnline(1000, 1091)).toBe(false);
	});
	it('nie gemeldet = offline', () => {
		expect(bridgeOnline(null, 1000)).toBe(false);
		expect(bridgeOnline(undefined, 1000)).toBe(false);
	});
});

describe('Kopplungscode', () => {
	it('normalisiert Eingaben', () => {
		expect(normalizePairCode(' abcd-efgh ')).toBe('ABCDEFGH');
		expect(normalizePairCode('ab cd ef gh 99')).toBe('ABCDEFGH');
		expect(normalizePairCode('ä!?')).toBe('');
	});
	it('formatiert mit Bindestrich', () => {
		expect(formatPairCode('abcdefgh')).toBe('ABCD-EFGH');
		expect(formatPairCode('abc')).toBe('ABC');
		expect(formatPairCode('abcde')).toBe('ABCD-E');
	});
});

describe('clampLevel', () => {
	it('klemmt und rundet', () => {
		expect(clampLevel(3, 10, 100)).toBe(10);
		expect(clampLevel(150, 25, 100)).toBe(100);
		expect(clampLevel(49.6, 25, 100)).toBe(50);
	});
});

describe('Zeitraster', () => {
	it('bleibt je Zeitraum unter 500 Punkten (Server-Limit) und nie feiner als 5 min', () => {
		for (const r of ['24h', '7d', '30d'] as const) {
			const { spanS, bucketS } = pickBucket(r);
			expect(spanS / bucketS).toBeLessThanOrEqual(360);
			expect(bucketS).toBeGreaterThanOrEqual(300);
		}
	});
	it('richtet das Fenster am Raster aus und schließt das laufende Raster ein', () => {
		const w = historyWindow(1_800_000_123, '24h');
		expect(w.toS).toBe(1_800_000_300);
		expect(w.fromS).toBe(1_800_000_300 - 86400);
		expect(w.toS % w.bucketS).toBe(0);
		expect(historyWindow(1_800_000_000, '24h').toS).toBe(1_800_000_300);
	});
	it('fillGaps lässt fehlende Slots leer', () => {
		const pts = [{ t: 1000, v: 1 }, { t: 1600, v: 3 }, { t: 9999, v: 9 }, { t: 400, v: 0 }];
		const slots = fillGaps(pts, 1000, 2200, 300);
		expect(slots.map((p) => p?.v ?? null)).toEqual([1, null, 3, null]);
	});
});

describe('Diagramm-Geometrie', () => {
	it('yDomain: null ohne Werte, sonst mit Luft', () => {
		expect(yDomain([null, null])).toBeNull();
		const d = yDomain([20, null, 30])!;
		expect(d.min).toBeLessThan(20);
		expect(d.max).toBeGreaterThan(30);
		const flat = yDomain([24, 24])!;
		expect(flat.max).toBeGreaterThan(flat.min);
	});
	it('xAt/yAt bilden auf die Zeichenfläche ab', () => {
		expect(xAt(0, 5, BOX)).toBe(10);
		expect(xAt(4, 5, BOX)).toBe(310);
		expect(yAt(10, { min: 0, max: 10 }, BOX)).toBe(10);
		expect(yAt(0, { min: 0, max: 10 }, BOX)).toBe(130);
	});
	it('linePath setzt bei Lücken ab', () => {
		const d = linePath([1, 2, null, 3, 4], { min: 0, max: 5 }, BOX);
		expect(d.match(/M/g)?.length).toBe(2);
		expect(d.match(/L/g)?.length).toBe(2);
	});
	it('linePath zeigt Einzelpunkte zwischen Lücken', () => {
		const d = linePath([null, 2, null, 3], { min: 0, max: 5 }, BOX);
		expect(d.match(/M/g)?.length).toBe(2);
		expect(d.match(/l0\.01 0/g)?.length).toBe(2);
		expect(linePath([null, null], { min: 0, max: 1 }, BOX)).toBe('');
	});
	it('nearestIndex findet den nächsten vorhandenen Wert', () => {
		expect(nearestIndex([null, 2, null, null, 5], 0)).toBe(1);
		expect(nearestIndex([null, 2, null, null, 5], 1)).toBe(4);
		expect(nearestIndex([null, 2, null, null, 5], 0.5)).toBe(1);
		expect(nearestIndex([null, null], 0.5)).toBeNull();
		expect(nearestIndex([], 0.5)).toBeNull();
	});
});
