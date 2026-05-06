/**
 * Unit-Tests für Phase-Logik (Lauri-Konvention).
 *
 * Kern-Annahmen die hier getestet werden:
 * - daysInPhase(W,T) = (W-1)*7 + T  → W1T4=4, W3T4=18
 * - phase_start = dayKey(checkin.created_at) - daysInPhase * 1d
 * - Phase-Boundaries nutzen JÜNGSTEN Check-in pro Phase (User-Korrekturen gewinnen)
 * - Σ phaseDaysSummary = totalGrowDays
 */

import { describe, it, expect } from 'vitest';
import {
	daysInPhase,
	phaseStartFromCheckin,
	phaseBoundaries,
	phaseDaysSummary,
	totalGrowDays,
	currentPhasePosition,
	dayKey,
} from './phase';
import type { Grow, CheckIn } from '$lib/stores/grow';

const DAY = 86400000;

function makeGrow(started_at: string, id = 'g1'): Grow {
	return {
		id,
		name: 'Test',
		strain: 'OG',
		strain_type: 'photo',
		medium: 'coco',
		space: '',
		feedline_id: 'athena-pro',
		light_info: '',
		plant_count: 1,
		status: 'active',
		started_at,
		harvested_at: null,
		yield_g: null,
		grow_score: null,
		notes: '',
		updated_at: started_at,
	} as Grow;
}

function makeCheckin(grow_id: string, created_at: string, phase: string, week: number, day: number, id?: string): CheckIn {
	return {
		id: id ?? `c-${created_at}-${phase}`,
		grow_id,
		created_at,
		phase,
		week,
		day,
		updated_at: created_at,
	} as CheckIn;
}

/** Tage zurück von heute (lokal Mitternacht) als ISO-String */
function todayMinusDays(d: number): string {
	return new Date(dayKey(Date.now()) - d * DAY).toISOString();
}

describe('daysInPhase', () => {
	it('W1T1 = 1', () => expect(daysInPhase(1, 1)).toBe(1));
	it('W1T4 = 4 (Lauri: W1 nur Tage, keine Wochen-Mult)', () => expect(daysInPhase(1, 4)).toBe(4));
	it('W1T7 = 7', () => expect(daysInPhase(1, 7)).toBe(7));
	it('W2T1 = 8', () => expect(daysInPhase(2, 1)).toBe(8));
	it('W2T7 = 14', () => expect(daysInPhase(2, 7)).toBe(14));
	it('W3T4 = 18 (Lauri-Beispiel)', () => expect(daysInPhase(3, 4)).toBe(18));
	it('W5T2 = 30', () => expect(daysInPhase(5, 2)).toBe(30));
});

describe('phaseStartFromCheckin', () => {
	it('W1T1 heute → phase_start = gestern', () => {
		const today = dayKey(Date.now());
		const c = makeCheckin('g1', new Date(today).toISOString(), 'Veg', 1, 1);
		expect(phaseStartFromCheckin(c)).toBe(today - DAY);
	});

	it('W3T4 heute → phase_start = vor 18 Tagen', () => {
		const today = dayKey(Date.now());
		const c = makeCheckin('g1', new Date(today).toISOString(), 'Veg', 3, 4);
		expect(phaseStartFromCheckin(c)).toBe(today - 18 * DAY);
	});
});

describe('phaseBoundaries', () => {
	it('keine Check-ins → Veg mit grow.started_at', () => {
		const grow = makeGrow(todayMinusDays(5));
		const result = phaseBoundaries(grow, []);
		expect(result).toHaveLength(1);
		expect(result[0].phase).toBe('Veg');
		expect(result[0].start_ms).toBe(dayKey(Date.now()) - 5 * DAY);
	});

	it('ein Bloom-CI W1T1 heute → Bloom als erste Phase, Start = gestern', () => {
		const grow = makeGrow(todayMinusDays(10));
		const ci = makeCheckin('g1', new Date(dayKey(Date.now())).toISOString(), 'Bloom', 1, 1);
		const result = phaseBoundaries(grow, [ci]);
		expect(result).toHaveLength(1);
		expect(result[0].phase).toBe('Bloom');
		expect(result[0].start_ms).toBe(dayKey(Date.now()) - 1 * DAY);
	});

	it('User-Bug-Reproduktion v1.3.34 (Bug-fix v1.3.35)', () => {
		// Alter Bloom-CI vor 7d mit W1T1 (= System dachte: Bloom-Start vor 8d)
		// Heute: User loggt nochmal Bloom W1T1 → System soll heute = Tag 1 sagen
		const grow = makeGrow(todayMinusDays(20));
		const oldCI = makeCheckin('g1', todayMinusDays(7), 'Bloom', 1, 1, 'old');
		const newCI = makeCheckin('g1', new Date(dayKey(Date.now())).toISOString(), 'Bloom', 1, 1, 'new');
		const result = phaseBoundaries(grow, [oldCI, newCI]);
		expect(result).toHaveLength(1);
		expect(result[0].phase).toBe('Bloom');
		// Jüngster CI (newCI) gewinnt → Bloom-Start = gestern
		expect(result[0].start_ms).toBe(dayKey(Date.now()) - 1 * DAY);
	});

	it('Veg + Bloom mit Phase-Wechsel', () => {
		const grow = makeGrow(todayMinusDays(20));
		const vegCI = makeCheckin('g1', todayMinusDays(15), 'Veg', 1, 5, 'veg-1');
		const bloomCI = makeCheckin('g1', todayMinusDays(5), 'Bloom', 1, 1, 'bloom-1');
		const result = phaseBoundaries(grow, [vegCI, bloomCI]);
		expect(result).toHaveLength(2);
		expect(result[0].phase).toBe('Veg');
		// Veg-Start = vegCI_date - 5d = vor 20 Tagen
		expect(result[0].start_ms).toBe(dayKey(Date.now()) - 20 * DAY);
		expect(result[1].phase).toBe('Bloom');
		// Bloom-Start = bloomCI_date - 1d = vor 6 Tagen
		expect(result[1].start_ms).toBe(dayKey(Date.now()) - 6 * DAY);
	});
});

describe('phaseDaysSummary', () => {
	it('keine Check-ins, Grow heute → Veg 0 (User hat noch keinen CI)', () => {
		const grow = makeGrow(todayMinusDays(0));
		const result = phaseDaysSummary(grow, []);
		expect(result).toHaveLength(1);
		expect(result[0].phase).toBe('Veg');
		// (today - today) / 1d = 0
		expect(result[0].days).toBe(0);
	});

	it('User-Bug v1.3.37: Bloom W2T1 → Subline "Bloom 8" (NICHT 9)', () => {
		const grow = makeGrow(todayMinusDays(20));
		const ci = makeCheckin('g1', new Date(dayKey(Date.now())).toISOString(), 'Bloom', 2, 1);
		const result = phaseDaysSummary(grow, [ci]);
		expect(result[result.length - 1].phase).toBe('Bloom');
		// daysInPhase(2,1) = 8 → Bloom-Tage = 8, nicht 9
		expect(result[result.length - 1].days).toBe(8);
	});

	it('Veg+Bloom: Σ = totalGrowDays', () => {
		const grow = makeGrow(todayMinusDays(20));
		const vegCI = makeCheckin('g1', todayMinusDays(15), 'Veg', 1, 5, 'veg-1');
		const bloomCI = makeCheckin('g1', todayMinusDays(5), 'Bloom', 1, 1, 'bloom-1');
		const summary = phaseDaysSummary(grow, [vegCI, bloomCI]);
		const total = totalGrowDays(grow, [vegCI, bloomCI]);
		const sum = summary.reduce((s, p) => s + p.days, 0);
		expect(sum).toBe(total);
	});
});

describe('currentPhasePosition', () => {
	it('Bloom W1T1 heute → heutige Position W1T1', () => {
		const grow = makeGrow(todayMinusDays(10));
		const ci = makeCheckin('g1', new Date(dayKey(Date.now())).toISOString(), 'Bloom', 1, 1);
		const pos = currentPhasePosition(grow, [ci]);
		expect(pos.phase).toBe('Bloom');
		expect(pos.week).toBe(1);
		expect(pos.day).toBe(1);
		expect(pos.daysIn).toBe(1);
	});

	it('Bloom W2T3 vor 5d → heutige Position W3T1 (8d in Bloom: 5+3)', () => {
		const grow = makeGrow(todayMinusDays(20));
		const ci = makeCheckin('g1', todayMinusDays(5), 'Bloom', 2, 3, 'bloom-w2t3');
		const pos = currentPhasePosition(grow, [ci]);
		// Bloom-Start = -5d - daysInPhase(2,3) = -5d - 10d = -15d
		// daysIn heute = 15d
		// W=ceil(15/7)=3, T=((15-1)%7)+1 = 14%7+1 = 0+1 = 1
		expect(pos.phase).toBe('Bloom');
		expect(pos.daysIn).toBe(15);
		expect(pos.week).toBe(3);
		expect(pos.day).toBe(1);
	});

	it('Calc-Wunsch: gestern Bloom W2T3 → heute Bloom W2T4', () => {
		const grow = makeGrow(todayMinusDays(20));
		const ci = makeCheckin('g1', todayMinusDays(1), 'Bloom', 2, 3, 'bloom-w2t3');
		const pos = currentPhasePosition(grow, [ci]);
		// Bloom-Start = -1d - 10d = -11d
		// daysIn heute = 11d
		// W=ceil(11/7)=2, T=((11-1)%7)+1 = 10%7+1 = 3+1 = 4
		expect(pos.phase).toBe('Bloom');
		expect(pos.week).toBe(2);
		expect(pos.day).toBe(4);
	});
});
