/**
 * Grow-Stats — Pure Aggregations für die Detail-Page.
 *
 * Alle Funktionen sind seiteneffekt-frei und null-safe. Empty-Input
 * gibt sinnvolle Defaults zurueck (avg=null, n=0, etc.) statt zu crashen.
 */

import type { CheckIn } from '$lib/stores/grow';

// ─── BASIC METRIC STATS ─────────────────────────────────────────────────

export interface MetricStats {
	avg: number | null;
	min: number | null;
	max: number | null;
	n: number;
}

const EMPTY_STATS: MetricStats = { avg: null, min: null, max: null, n: 0 };

/** Min/Avg/Max für eine Liste Zahlen. Null-Werte werden ignoriert. */
export function metricStats(values: Array<number | null | undefined>): MetricStats {
	const clean = values.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
	if (clean.length === 0) return EMPTY_STATS;
	const sum = clean.reduce((a, b) => a + b, 0);
	return {
		avg: sum / clean.length,
		min: Math.min(...clean),
		max: Math.max(...clean),
		n: clean.length,
	};
}

// ─── PHASE-SPLIT STATS ──────────────────────────────────────────────────

export type CheckinNumKey = 'temp' | 'rh' | 'vpd' | 'ec_measured' | 'ph_measured';

/**
 * Aggregat pro Phase: { Veg: stats, Bloom: stats, Flush: stats, ... }.
 * Nur Phasen mit ≥1 Datenpunkt werden zurückgegeben.
 */
export function metricPerPhase(
	checkins: CheckIn[],
	key: CheckinNumKey,
): Record<string, MetricStats> {
	const groups = new Map<string, Array<number | null | undefined>>();
	for (const c of checkins) {
		const v = (c as any)[key] as number | null | undefined;
		if (typeof v !== 'number') continue;
		const ph = c.phase || 'Unknown';
		if (!groups.has(ph)) groups.set(ph, []);
		groups.get(ph)!.push(v);
	}
	const out: Record<string, MetricStats> = {};
	for (const [phase, values] of groups.entries()) {
		out[phase] = metricStats(values);
	}
	return out;
}

// ─── STRESS-DAYS (Optimal-Range-Check) ──────────────────────────────────

export interface RangeTarget {
	min: number;
	max: number;
}

export interface StressCount {
	/** Tage mit gemessenem Wert (= Datenpunkten) */
	total: number;
	/** Tage im Optimal-Bereich */
	ok: number;
	/** Tage außerhalb (zu hoch oder zu niedrig) */
	stress: number;
	/** Prozent der OK-Tage (0-100), null wenn total=0 */
	okPercent: number | null;
}

const EMPTY_STRESS: StressCount = { total: 0, ok: 0, stress: 0, okPercent: null };

/**
 * Zählt wie viele Check-in-Tage einen Wert im Range hatten (ok) bzw. außerhalb (stress).
 * Phase-spezifische Targets werden via `targetsByPhase` reingegeben.
 * Datenpunkte ohne Wert oder ohne Phasen-Target werden ignoriert.
 */
export function stressDays(
	checkins: CheckIn[],
	key: CheckinNumKey,
	targetsByPhase: Record<string, RangeTarget>,
): StressCount {
	let total = 0;
	let ok = 0;
	for (const c of checkins) {
		const v = (c as any)[key] as number | null | undefined;
		if (typeof v !== 'number' || Number.isNaN(v)) continue;
		const t = targetsByPhase[c.phase];
		if (!t) continue;
		total++;
		if (v >= t.min && v <= t.max) ok++;
	}
	if (total === 0) return EMPTY_STRESS;
	return {
		total,
		ok,
		stress: total - ok,
		okPercent: Math.round((ok / total) * 100),
	};
}

// ─── CHECK-IN CONSISTENCY ───────────────────────────────────────────────

export interface ConsistencyStats {
	/** Anzahl Kalendertage mit mind. einem Check-in seit Grow-Start */
	daysWithCheckin: number;
	/** Anzahl Kalendertage seit Grow-Start (inkl. heute) */
	totalDays: number;
	/** OK-Quote in Prozent (0-100), null wenn totalDays=0 */
	percent: number | null;
	/** Tage seit letztem Check-in (0 = heute) */
	daysSinceLastCheckin: number | null;
}

/**
 * Konsistenz-Berechnung: wie zuverlässig wurde geloggt?
 * Nutzt local-date-keys (YYYY-MM-DD) damit DST-Wechsel nicht stört.
 *
 * `nowIso` Optional — für deterministische Tests.
 */
export function checkinConsistency(
	checkins: CheckIn[],
	growStartIso: string,
	nowIso?: string,
): ConsistencyStats {
	const start = new Date(growStartIso);
	const now = nowIso ? new Date(nowIso) : new Date();
	if (Number.isNaN(start.getTime()) || Number.isNaN(now.getTime())) {
		return { daysWithCheckin: 0, totalDays: 0, percent: null, daysSinceLastCheckin: null };
	}

	const startKey = toLocalDateKey(start);
	const nowKey = toLocalDateKey(now);
	// totalDays inkl. start + heute
	const totalDays = diffDays(startKey, nowKey) + 1;
	if (totalDays <= 0) {
		return { daysWithCheckin: 0, totalDays: 0, percent: null, daysSinceLastCheckin: null };
	}

	const uniqueDays = new Set<string>();
	let latest: number | null = null;
	for (const c of checkins) {
		const d = new Date(c.created_at);
		if (Number.isNaN(d.getTime())) continue;
		uniqueDays.add(toLocalDateKey(d));
		const t = d.getTime();
		if (latest === null || t > latest) latest = t;
	}

	const daysWithCheckin = uniqueDays.size;
	const percent = Math.round((daysWithCheckin / totalDays) * 100);
	const daysSinceLastCheckin = latest === null
		? null
		: diffDays(toLocalDateKey(new Date(latest)), nowKey);

	return { daysWithCheckin, totalDays, percent, daysSinceLastCheckin };
}

// ─── HELPERS (lokal, DST-safe) ──────────────────────────────────────────

function toLocalDateKey(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function diffDays(aKey: string, bKey: string): number {
	// Parse YYYY-MM-DD als UTC um DST zu vermeiden
	const a = Date.UTC(
		Number(aKey.slice(0, 4)),
		Number(aKey.slice(5, 7)) - 1,
		Number(aKey.slice(8, 10)),
	);
	const b = Date.UTC(
		Number(bKey.slice(0, 4)),
		Number(bKey.slice(5, 7)) - 1,
		Number(bKey.slice(8, 10)),
	);
	return Math.round((b - a) / 86400000);
}
