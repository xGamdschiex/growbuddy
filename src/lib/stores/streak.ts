/**
 * Streak Store — Täglicher Check-in-Streak mit Grace-Period und Multiplier.
 * Streak basiert auf allen Check-ins (grow-übergreifend, ein Check-in/Tag reicht).
 * Grace-Period: 1 Tag Pause pro Woche erlaubt — Streak bleibt intakt.
 */

import { writable, derived } from 'svelte/store';
import { growStore } from './grow';
import type { CheckIn } from './grow';

// ─── TYPES ──────────────────────────────────────────────────────────────

export interface StreakState {
	longest_streak: number;
	milestones_awarded: number[];   // [7, 30, 100] — vergebene Meilensteine
	grace_used_date: string | null; // "2026-04-15" — Grace-Period am Datum X verbraucht
}

// ─── CONFIG ─────────────────────────────────────────────────────────────

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365] as const;

/** XP-Multiplier basierend auf Streak-Länge */
export function getStreakMultiplier(streak: number): number {
	if (streak >= 30) return 3;
	if (streak >= 14) return 2.5;
	if (streak >= 7) return 2;
	if (streak >= 3) return 1.5;
	return 1;
}

// ─── HELPERS ────────────────────────────────────────────────────────────

function toDateKey(isoString: string): string {
	return isoString.slice(0, 10); // "2026-04-17"
}

function todayKey(): string {
	return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
	return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

/**
 * Berechnet den aktuellen Streak aus den Check-ins.
 * Grace-Period: 1 Tag Lücke ist erlaubt, wenn grace_used_date nicht dieselbe Woche ist.
 */
export function calculateStreak(checkins: CheckIn[], graceUsedDate: string | null): {
	current: number;
	graceActive: boolean;       // gerade Grace-Period in Anspruch genommen
	lastCheckinDate: string | null;
} {
	if (checkins.length === 0) return { current: 0, graceActive: false, lastCheckinDate: null };

	// Unique Check-in-Tage, absteigend sortiert
	const uniqueDays = [...new Set(checkins.map(c => toDateKey(c.created_at)))]
		.sort()
		.reverse();

	const today = todayKey();
	const lastDay = uniqueDays[0]!;

	// Start-Bedingung: letzter Check-in muss heute oder gestern sein
	// Mit Grace: auch vorgestern akzeptiert wenn Grace unbenutzt für diese Woche
	const daysSinceLast = daysBetween(lastDay, today);

	if (daysSinceLast > 2) return { current: 0, graceActive: false, lastCheckinDate: lastDay };

	// Grace-Check: Wenn letzter Check-in vorgestern, prüfe ob Grace verfügbar
	let graceActive = false;
	if (daysSinceLast === 2) {
		const graceInSameWeek = graceUsedDate && daysBetween(graceUsedDate, today) < 7;
		if (graceInSameWeek) return { current: 0, graceActive: false, lastCheckinDate: lastDay };
		graceActive = true;
	}

	// Streak zählen: aufeinanderfolgende Tage, max 1 Lücke erlaubt (=Grace)
	let streak = 1;
	let graceUsedInStreak = graceActive;

	for (let i = 1; i < uniqueDays.length; i++) {
		const gap = daysBetween(uniqueDays[i]!, uniqueDays[i - 1]!);
		if (gap === 1) {
			streak++;
		} else if (gap === 2 && !graceUsedInStreak) {
			streak++;
			graceUsedInStreak = true;
		} else {
			break;
		}
	}

	return { current: streak, graceActive, lastCheckinDate: lastDay };
}

// ─── STORE ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'growbuddy_streak';

const DEFAULTS: StreakState = {
	longest_streak: 0,
	milestones_awarded: [],
	grace_used_date: null,
};

function loadState(): StreakState {
	if (typeof window === 'undefined') return DEFAULTS;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULTS;
		return { ...DEFAULTS, ...JSON.parse(raw) };
	} catch {
		return DEFAULTS;
	}
}

function createStreakStore() {
	const { subscribe, set, update } = writable<StreakState>(loadState());

	subscribe(state => {
		if (typeof window !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		}
	});

	return {
		subscribe,

		/** Grace-Period nutzen — markiert heutiges Datum als Grace-Verbrauch */
		useGrace(): void {
			update(s => ({ ...s, grace_used_date: todayKey() }));
		},

		/** Longest Streak aktualisieren wenn nötig */
		updateLongest(current: number): void {
			update(s => current > s.longest_streak ? { ...s, longest_streak: current } : s);
		},

		/** Milestone als vergeben markieren */
		markMilestone(milestone: number): void {
			update(s => s.milestones_awarded.includes(milestone)
				? s
				: { ...s, milestones_awarded: [...s.milestones_awarded, milestone] }
			);
		},

		/** Pending Milestones ermitteln (noch nicht vergeben, aber erreicht) */
		pendingMilestones(state: StreakState, current: number): number[] {
			return STREAK_MILESTONES.filter(m => current >= m && !state.milestones_awarded.includes(m));
		},

		reset(): void {
			set(DEFAULTS);
		},
	};
}

export const streakStore = createStreakStore();

// ─── DERIVED ────────────────────────────────────────────────────────────

/** Aktueller Streak (reaktiv aus Check-ins + Grace) */
export const currentStreak = derived(
	[growStore, streakStore],
	([$grow, $streak]) => calculateStreak($grow.checkins, $streak.grace_used_date)
);

/** Hat der User heute schon einen Check-in gemacht? */
export const hasCheckinToday = derived(growStore, $grow => {
	const today = todayKey();
	return $grow.checkins.some(c => toDateKey(c.created_at) === today);
});

/** Aktueller XP-Multiplier basierend auf Streak */
export const streakMultiplier = derived(currentStreak, $s => getStreakMultiplier($s.current));

/** Ist der Streak in Gefahr? (kein Check-in heute, Streak > 0) */
export const streakInDanger = derived(
	[currentStreak, hasCheckinToday],
	([$streak, $today]) => !$today && $streak.current > 0
);
