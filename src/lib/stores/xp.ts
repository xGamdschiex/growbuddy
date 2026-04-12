/**
 * XP & Level Store — Gamification basierend auf echten Grow-Aktionen.
 * Level 1-9, XP durch Check-ins, Harvests, Streaks, Tool-Nutzung.
 * localStorage persistent.
 */

import { writable, derived } from 'svelte/store';
import { toastStore } from './toast';

// ─── TYPES ──────────────────────────────────────────────────────────────

export interface XPEvent {
	type: XPAction;
	amount: number;
	description: string;
	created_at: string;
}

export type XPAction =
	| 'checkin'           // Täglicher Check-in: 10 XP
	| 'checkin_photo'     // Check-in mit Foto: +5 XP
	| 'checkin_full'      // Check-in mit allen Daten: +10 XP
	| 'grow_start'        // Neuen Grow starten: 20 XP
	| 'harvest'           // Ernte: 50 XP
	| 'harvest_good'      // Score >= 70: +30 XP
	| 'harvest_great'     // Score >= 90: +50 XP
	| 'streak_7'          // 7-Tage Streak: 25 XP
	| 'streak_30'         // 30-Tage Streak: 100 XP
	| 'calc_use'          // Düngerrechner benutzt: 5 XP
	| 'tool_use'          // VPD/DLI Tool benutzt: 5 XP
	| 'first_grow'        // Allererstes Grow: 50 XP Bonus
	| 'achievement';      // Achievement freigeschaltet: variabel

export interface XPState {
	total_xp: number;
	events: XPEvent[];
	// Tracking für Duplikat-Vermeidung
	daily_checkins: Record<string, number>;  // "2026-04-12": count
	streaks_awarded: number[];               // [7, 30] — welche Streak-Meilensteine vergeben
	first_grow_awarded: boolean;
}

// ─── LEVEL CONFIG ───────────────────────────────────────────────────────

export const LEVELS = [
	{ level: 1, name: 'Keimling',       min_xp: 0,    icon: '🌱' },
	{ level: 2, name: 'Setzling',       min_xp: 100,  icon: '🌿' },
	{ level: 3, name: 'Anfänger',       min_xp: 300,  icon: '☘️' },
	{ level: 4, name: 'Gärtner',        min_xp: 600,  icon: '🪴' },
	{ level: 5, name: 'Erfahren',       min_xp: 1000, icon: '🌳' },
	{ level: 6, name: 'Fortgeschritten', min_xp: 1600, icon: '🌲' },
	{ level: 7, name: 'Experte',        min_xp: 2500, icon: '🏆' },
	{ level: 8, name: 'Meister',        min_xp: 4000, icon: '👨‍🌾' },
	{ level: 9, name: 'Großmeister',    min_xp: 6000, icon: '🧙' },
] as const;

export const XP_REWARDS: Record<XPAction, number> = {
	checkin: 10,
	checkin_photo: 5,
	checkin_full: 10,
	grow_start: 20,
	harvest: 50,
	harvest_good: 30,
	harvest_great: 50,
	streak_7: 25,
	streak_30: 100,
	calc_use: 5,
	tool_use: 5,
	first_grow: 50,
	achievement: 0, // variabel
};

// ─── HELPERS ────────────────────────────────────────────────────────────

export function getLevelForXP(xp: number) {
	let current = LEVELS[0];
	for (const lvl of LEVELS) {
		if (xp >= lvl.min_xp) current = lvl;
		else break;
	}
	return current;
}

export function getProgressToNext(xp: number): { current: number; needed: number; percent: number } {
	const level = getLevelForXP(xp);
	const idx = LEVELS.findIndex(l => l.level === level.level);
	const next = LEVELS[idx + 1];

	if (!next) return { current: 0, needed: 0, percent: 100 }; // Max Level

	const current = xp - level.min_xp;
	const needed = next.min_xp - level.min_xp;
	const percent = Math.min(100, Math.round((current / needed) * 100));

	return { current, needed, percent };
}

// ─── STORE ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'growbuddy_xp';

const DEFAULTS: XPState = {
	total_xp: 0,
	events: [],
	daily_checkins: {},
	streaks_awarded: [],
	first_grow_awarded: false,
};

function loadState(): XPState {
	if (typeof window === 'undefined') return DEFAULTS;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULTS;
		return { ...DEFAULTS, ...JSON.parse(raw) };
	} catch {
		return DEFAULTS;
	}
}

function saveState(state: XPState): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createXPStore() {
	const { subscribe, set, update } = writable<XPState>(loadState());

	subscribe((state) => saveState(state));

	function addXP(action: XPAction, description: string, amount?: number): void {
		const xp = amount ?? XP_REWARDS[action];
		if (xp <= 0) return;

		update(s => {
			const newTotal = s.total_xp + xp;
			const oldLevel = getLevelForXP(s.total_xp);
			const newLevel = getLevelForXP(newTotal);

			// Toast für XP
			if (typeof window !== 'undefined') {
				toastStore.xp(xp, description);
				// Level-Up Toast
				if (newLevel.level > oldLevel.level) {
					setTimeout(() => toastStore.achievement(`Level ${newLevel.level} — ${newLevel.name}!`), 500);
				}
			}

			return {
				...s,
				total_xp: newTotal,
				events: [...s.events, {
					type: action,
					amount: xp,
					description,
					created_at: new Date().toISOString(),
				}],
			};
		});
	}

	return {
		subscribe,

		/** Check-in XP vergeben (max 3x pro Tag) */
		awardCheckIn(hasPhoto: boolean, isFull: boolean): void {
			const today = new Date().toISOString().slice(0, 10);
			let state: XPState = DEFAULTS;
			subscribe(s => state = s)();

			const todayCount = state.daily_checkins[today] || 0;
			if (todayCount >= 3) return; // Max 3 Check-ins pro Tag

			update(s => ({
				...s,
				daily_checkins: { ...s.daily_checkins, [today]: todayCount + 1 },
			}));

			addXP('checkin', 'Check-in durchgeführt');
			if (hasPhoto) addXP('checkin_photo', 'Foto im Check-in');
			if (isFull) addXP('checkin_full', 'Vollständiger Check-in');
		},

		/** Grow-Start XP */
		awardGrowStart(isFirst: boolean): void {
			addXP('grow_start', 'Neuen Grow gestartet');
			if (isFirst) {
				let state: XPState = DEFAULTS;
				subscribe(s => state = s)();
				if (!state.first_grow_awarded) {
					update(s => ({ ...s, first_grow_awarded: true }));
					addXP('first_grow', 'Allererstes Grow gestartet!');
				}
			}
		},

		/** Harvest XP (mit Bonus für guten Score) */
		awardHarvest(score: number | null): void {
			addXP('harvest', 'Ernte eingefahren');
			if (score !== null && score >= 90) {
				addXP('harvest_great', `Grow Score ${score} — Exzellent!`);
			} else if (score !== null && score >= 70) {
				addXP('harvest_good', `Grow Score ${score} — Gut!`);
			}
		},

		/** Streak-Meilensteine prüfen */
		checkStreak(streak: number): void {
			let state: XPState = DEFAULTS;
			subscribe(s => state = s)();

			if (streak >= 7 && !state.streaks_awarded.includes(7)) {
				update(s => ({ ...s, streaks_awarded: [...s.streaks_awarded, 7] }));
				addXP('streak_7', '7-Tage Check-in Streak!');
			}
			if (streak >= 30 && !state.streaks_awarded.includes(30)) {
				update(s => ({ ...s, streaks_awarded: [...s.streaks_awarded, 30] }));
				addXP('streak_30', '30-Tage Check-in Streak!');
			}
		},

		/** Tool-Nutzung XP (max 1x pro Tool pro Tag) */
		awardToolUse(tool: string): void {
			const today = new Date().toISOString().slice(0, 10);
			let state: XPState = DEFAULTS;
			subscribe(s => state = s)();

			const key = `tool_${tool}_${today}`;
			if (state.daily_checkins[key]) return;

			update(s => ({
				...s,
				daily_checkins: { ...s.daily_checkins, [key]: 1 },
			}));

			addXP('tool_use', `${tool} benutzt`);
		},

		/** Calc-Nutzung XP (max 1x pro Tag) */
		awardCalcUse(): void {
			const today = new Date().toISOString().slice(0, 10);
			let state: XPState = DEFAULTS;
			subscribe(s => state = s)();

			if (state.daily_checkins[`calc_${today}`]) return;

			update(s => ({
				...s,
				daily_checkins: { ...s.daily_checkins, [`calc_${today}`]: 1 },
			}));

			addXP('calc_use', 'Düngerrechner benutzt');
		},

		/** Achievement-XP */
		awardAchievement(name: string, xp: number): void {
			addXP('achievement', `Achievement: ${name}`, xp);
		},

		/** Reset (Dev-Funktion) */
		reset(): void {
			set(DEFAULTS);
		},
	};
}

export const xpStore = createXPStore();

// ─── DERIVED ────────────────────────────────────────────────────────────

export const currentLevel = derived(xpStore, $s => getLevelForXP($s.total_xp));
export const xpProgress = derived(xpStore, $s => getProgressToNext($s.total_xp));
