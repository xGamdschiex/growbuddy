/**
 * Phase-Logik — zentrale Helper für Phase-Tage-Berechnung.
 *
 * Kern-Idee (Lauri-Logik 2026-05-06):
 * - User-Check-in Wxx Tyy ist Source-of-Truth für Phase-Position
 * - daysInPhase(W, T) = (W-1)*7 + T  → W1T4 = 4 Tage, W3T4 = 18 Tage
 * - phase_start = dayKey(checkin.created_at) - daysInPhase * 1d
 * - Erste Phase: Start aus erstem Check-in zurückgerechnet,
 *   Fallback grow.started_at wenn noch kein Check-in
 * - Folge-Phase: Start aus erstem Check-in dieser Phase zurückgerechnet
 *
 * Anwendung:
 * - grow/[id] Header + Subline: Σ phaseDays = Header-Zahl (garantiert konsistent)
 * - calc Auto-Fill: aktuelle Phase + heutiger W/T basierend auf Phase-Start
 */

import type { Grow, CheckIn } from '$lib/stores/grow';

const DAY_MS = 86400000;

/** Gibt Mitternacht-Zeitstempel des Datums in lokaler Zeit zurück (für day-only-Granularität). */
export function dayKey(ms: number): number {
	const d = new Date(ms);
	return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Tage in Phase basierend auf Check-in W/T (W1T4 = 4, W3T4 = 18). */
export function daysInPhase(week: number, day: number): number {
	return (week - 1) * 7 + day;
}

/** Rechnet aus Check-in (W/T + Datum) den Phase-Start zurück. */
export function phaseStartFromCheckin(c: CheckIn): number {
	const din = daysInPhase(c.week, c.day);
	return dayKey(new Date(c.created_at).getTime()) - din * DAY_MS;
}

export interface PhaseBoundary {
	phase: string;
	start_ms: number;
}

/**
 * Phase-Boundaries chronologisch sortiert.
 * - Erste Phase: Start aus erstem Check-in zurückgerechnet (oder grow.started_at fallback)
 * - Folge-Phasen: Start aus erstem Check-in dieser Phase zurückgerechnet
 */
export function phaseBoundaries(grow: Grow, checkins: CheckIn[]): PhaseBoundary[] {
	const sorted = checkins
		.filter((c) => c.grow_id === grow.id)
		.sort(
			(a, b) =>
				new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
		);

	if (sorted.length === 0) {
		return [
			{ phase: 'Veg', start_ms: dayKey(new Date(grow.started_at).getTime()) },
		];
	}

	const out: PhaseBoundary[] = [];
	// Erste Phase: Start aus erstem Check-in zurückgerechnet
	out.push({ phase: sorted[0].phase, start_ms: phaseStartFromCheckin(sorted[0]) });

	// Folge-Phasen: nur bei Phase-Wechsel
	for (let i = 1; i < sorted.length; i++) {
		const c = sorted[i];
		const last = out[out.length - 1];
		if (c.phase !== last.phase) {
			out.push({ phase: c.phase, start_ms: phaseStartFromCheckin(c) });
		}
	}

	return out;
}

export interface PhaseSummary {
	phase: string;
	days: number;
}

/**
 * Tage pro Phase (Subline + Header-Σ).
 * Letzte Phase: bis heute (inklusive heute → +1d in Berechnung).
 * Folge-Phase-Start ist gleichzeitig Vorgänger-Phase-Ende.
 */
export function phaseDaysSummary(grow: Grow, checkins: CheckIn[]): PhaseSummary[] {
	const bounds = phaseBoundaries(grow, checkins);
	if (bounds.length === 0) return [];

	const today = dayKey(Date.now());
	const map = new Map<string, number>();

	for (let i = 0; i < bounds.length; i++) {
		const start = bounds[i].start_ms;
		// End: nächster Phase-Start, oder heute+1d für letzte aktive Phase
		const end =
			i + 1 < bounds.length
				? bounds[i + 1].start_ms
				: today + DAY_MS; // bis Ende heute (exklusiver heutiger Tag-Anfang +1d)
		const days = Math.max(0, Math.floor((end - start) / DAY_MS));
		map.set(bounds[i].phase, (map.get(bounds[i].phase) ?? 0) + days);
	}

	return Array.from(map.entries()).map(([phase, days]) => ({ phase, days }));
}

/** Σ aller Phase-Tage = Header-Zahl. Konsistent mit Subline. */
export function totalGrowDays(grow: Grow, checkins: CheckIn[]): number {
	const summary = phaseDaysSummary(grow, checkins);
	if (summary.length === 0) {
		return Math.max(
			0,
			Math.floor((Date.now() - new Date(grow.started_at).getTime()) / DAY_MS)
		);
	}
	return summary.reduce((s, p) => s + p.days, 0);
}

export interface CurrentPosition {
	phase: string;
	week: number;
	day: number;
	daysIn: number;
}

/**
 * Heutige Position in der aktuellen Phase (für Calc Auto-Fill).
 * - Aktuelle Phase = letzte Phase deren start_ms <= today
 * - daysIn = (today - phase_start) / day  (Lauri-Logik, NICHT +1)
 * - W = ceil(daysIn/7), T = ((daysIn-1) % 7) + 1
 */
export function currentPhasePosition(grow: Grow, checkins: CheckIn[]): CurrentPosition {
	const bounds = phaseBoundaries(grow, checkins);
	const today = dayKey(Date.now());

	let current = bounds[0];
	for (const b of bounds) {
		if (b.start_ms <= today) current = b;
	}

	const daysIn = Math.max(1, Math.floor((today - current.start_ms) / DAY_MS));
	const week = Math.max(1, Math.ceil(daysIn / 7));
	const day = ((daysIn - 1) % 7) + 1;
	return { phase: current.phase, week, day, daysIn };
}
