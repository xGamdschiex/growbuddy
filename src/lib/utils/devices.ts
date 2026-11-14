/**
 * Geräte (Lampe/Abluft über die Pi-Bridge) — reine Hilfsfunktionen, ohne Supabase.
 * Zeiten sind Sekunden seit Epoch nach DB-Uhr, nicht nach Handy-Uhr.
 */

export type HistoryRange = '24h' | '7d' | '30d';

export interface HistoryPoint {
	t: number;
	temp_c: number | null;
	rh: number | null;
	fan_pct: number | null;
	fan_rpm: number | null;
	lamp_pct: number | null;
	lamp_on: boolean | null;
}

/** Die Bridge meldet sich spätestens alle 10 s; nach 90 s Funkstille gilt sie als offline. */
export const BRIDGE_ONLINE_S = 90;

export function bridgeOnline(lastSeenS: number | null | undefined, nowS: number, maxAgeS = BRIDGE_ONLINE_S): boolean {
	return typeof lastSeenS === 'number' && nowS - lastSeenS <= maxAgeS;
}

/** Kopplungscode-Eingabe: nur Buchstaben/Ziffern, groß, höchstens 8 Zeichen. */
export function normalizePairCode(input: string): string {
	return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function formatPairCode(input: string): string {
	const c = normalizePairCode(input);
	return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

export function clampLevel(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, Math.round(value)));
}

/** Zeitraum → Spanne + Raster: höchstens 360 Punkte, nie feiner als die 5-Minuten-Zeilen der Bridge. */
export function pickBucket(range: HistoryRange): { spanS: number; bucketS: number } {
	if (range === '24h') return { spanS: 86400, bucketS: 300 };
	if (range === '7d') return { spanS: 7 * 86400, bucketS: 1800 };
	return { spanS: 30 * 86400, bucketS: 7200 };
}

/** Fenster [from, to) am Raster ausgerichtet; `to` ist das Ende des gerade laufenden Rasters. */
export function historyWindow(nowS: number, range: HistoryRange): { fromS: number; toS: number; bucketS: number } {
	const { spanS, bucketS } = pickBucket(range);
	const toS = (Math.floor(nowS / bucketS) + 1) * bucketS;
	return { fromS: toS - spanS, toS, bucketS };
}

/** Legt Messpunkte ins feste Zeitraster. Fehlende Slots bleiben null → Lücke statt durchgezogener Linie. */
export function fillGaps<T extends { t: number }>(points: T[], fromS: number, toS: number, bucketS: number): (T | null)[] {
	const n = Math.max(0, Math.round((toS - fromS) / bucketS));
	const slots: (T | null)[] = new Array(n).fill(null);
	for (const p of points) {
		const i = Math.floor((p.t - fromS) / bucketS);
		if (i >= 0 && i < n) slots[i] = p;
	}
	return slots;
}

export interface ChartBox {
	width: number;
	height: number;
	padX: number;
	padTop: number;
	padBottom: number;
}

/** Wertebereich mit etwas Luft; null, wenn es keinen einzigen Wert gibt. */
export function yDomain(values: (number | null)[]): { min: number; max: number } | null {
	let min = Infinity;
	let max = -Infinity;
	for (const v of values) {
		if (v === null || !Number.isFinite(v)) continue;
		if (v < min) min = v;
		if (v > max) max = v;
	}
	if (min === Infinity) return null;
	const pad = (max - min || Math.abs(max) || 1) * 0.08;
	return { min: min - pad, max: max + pad };
}

export function xAt(i: number, n: number, box: ChartBox): number {
	return box.padX + (n <= 1 ? 0.5 : i / (n - 1)) * (box.width - 2 * box.padX);
}

export function yAt(v: number, domain: { min: number; max: number }, box: ChartBox): number {
	const h = box.height - box.padTop - box.padBottom;
	return box.padTop + (1 - (v - domain.min) / (domain.max - domain.min || 1)) * h;
}

/** SVG-Pfad der Reihe. Bei null wird abgesetzt; ein einzelner Punkt zwischen Lücken bleibt als Tupfer sichtbar. */
export function linePath(values: (number | null)[], domain: { min: number; max: number }, box: ChartBox): string {
	const n = values.length;
	let d = '';
	let run = 0;
	for (let i = 0; i < n; i++) {
		const v = values[i];
		if (v === null || !Number.isFinite(v)) {
			if (run === 1) d += ' l0.01 0';
			run = 0;
			continue;
		}
		d += `${d ? ' ' : ''}${run === 0 ? 'M' : 'L'}${xAt(i, n, box).toFixed(1)} ${yAt(v, domain, box).toFixed(1)}`;
		run++;
	}
	if (run === 1) d += ' l0.01 0';
	return d;
}

/** Nächster vorhandener Wert zu einer Position 0..1 auf der x-Achse (für den Tipp-Tooltip). */
export function nearestIndex(values: (number | null)[], ratio: number): number | null {
	const n = values.length;
	if (n === 0) return null;
	const at = Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1))));
	for (let off = 0; off < n; off++) {
		if (at - off >= 0 && values[at - off] !== null) return at - off;
		if (at + off < n && values[at + off] !== null) return at + off;
	}
	return null;
}
