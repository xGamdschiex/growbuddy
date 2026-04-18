/**
 * Grow Store — Offline-first mit localStorage
 * Verwaltet aktive und abgeschlossene Grows + Check-ins.
 * Wird später optional mit Supabase synchronisiert.
 */

import { writable, derived } from 'svelte/store';
import type { Medium, GrowPhase } from '$lib/data/science';

// ─── TYPES ──────────────────────────────────────────────────────────────

export type StrainType = 'auto' | 'photo';
export type GrowStatus = 'active' | 'harvested' | 'abandoned';

export interface Grow {
	id: string;
	name: string;
	strain: string;
	strain_type: StrainType;
	medium: Medium;
	space: string;           // z.B. '60x60', '80x80', 'outdoor'
	feedline_id: string;
	light_info: string;      // z.B. 'LED 150W', 'Sonne'
	plant_count: number;
	status: GrowStatus;
	started_at: string;      // ISO date
	harvested_at: string | null;
	yield_g: number | null;
	grow_score: number | null;
	notes: string;
}

export interface CheckIn {
	id: string;
	grow_id: string;
	phase: string;
	week: number;
	day: number;
	photo_data: string | null;   // base64 data URL (legacy, single photo)
	photos_data: string[];       // base64 array, max 5
	photo_url?: string | null;   // Signed URL von Supabase Storage (nach Sync)
	temp: number | null;
	rh: number | null;
	vpd: number | null;
	ec_measured: number | null;
	ph_measured: number | null;
	watered: boolean;
	nutrients_given: boolean;
	water_ml: number | null;     // Wassermenge in mL (optional)
	nutrient_ml: number | null;  // Düngermenge in mL (optional, Gesamt)
	training: string | null;     // 'lst', 'topping', etc.
	notes: string;
	created_at: string;          // ISO date
}

export interface GrowState {
	grows: Grow[];
	checkins: CheckIn[];
}

// ─── DEFAULTS ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'growbuddy_grows';

const DEFAULTS: GrowState = {
	grows: [],
	checkins: [],
};

function loadState(): GrowState {
	if (typeof window === 'undefined') return DEFAULTS;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULTS;
		const parsed = JSON.parse(raw);
		// Migrate old check-ins without photos_data / water_ml / nutrient_ml
		if (parsed.checkins) {
			parsed.checkins = parsed.checkins.map((c: any) => ({
				photos_data: [],
				water_ml: null,
				nutrient_ml: null,
				...c,
			}));
		}
		return { ...DEFAULTS, ...parsed };
	} catch {
		return DEFAULTS;
	}
}

function saveState(state: GrowState): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ─── STORE ──────────────────────────────────────────────────────────────

function createGrowStore() {
	const { subscribe, set, update } = writable<GrowState>(loadState());

	// Auto-save bei jeder Änderung
	subscribe((state) => saveState(state));

	return {
		subscribe,

		/** Kompletten State ersetzen (für Cloud-Sync Merge) */
		replaceState(newState: GrowState): void {
			set(newState);
		},

		addGrow(grow: Omit<Grow, 'id' | 'status' | 'harvested_at' | 'yield_g' | 'grow_score'>): string {
			const id = crypto.randomUUID();
			const newGrow: Grow = {
				...grow,
				id,
				status: 'active',
				harvested_at: null,
				yield_g: null,
				grow_score: null,
			};
			update(s => ({ ...s, grows: [...s.grows, newGrow] }));
			return id;
		},

		updateGrow(id: string, patch: Partial<Grow>): void {
			update(s => ({
				...s,
				grows: s.grows.map(g => g.id === id ? { ...g, ...patch } : g),
			}));
		},

		harvestGrow(id: string, yield_g: number): void {
			update(s => ({
				...s,
				grows: s.grows.map(g => g.id === id ? {
					...g,
					status: 'harvested' as GrowStatus,
					harvested_at: new Date().toISOString(),
					yield_g,
				} : g),
			}));
		},

		abandonGrow(id: string): void {
			update(s => ({
				...s,
				grows: s.grows.map(g => g.id === id ? {
					...g,
					status: 'abandoned' as GrowStatus,
				} : g),
			}));
		},

		deleteGrow(id: string): void {
			update(s => ({
				grows: s.grows.filter(g => g.id !== id),
				checkins: s.checkins.filter(c => c.grow_id !== id),
			}));
		},

		addCheckIn(checkin: Omit<CheckIn, 'id' | 'created_at'>): string {
			const id = crypto.randomUUID();
			const newCheckin: CheckIn = {
				...checkin,
				id,
				created_at: new Date().toISOString(),
			};
			update(s => ({ ...s, checkins: [...s.checkins, newCheckin] }));
			return id;
		},

		updateCheckIn(id: string, patch: Partial<Omit<CheckIn, 'id' | 'grow_id' | 'created_at'>>): void {
			update(s => ({
				...s,
				checkins: s.checkins.map(c => c.id === id ? { ...c, ...patch } : c),
			}));
		},

		deleteCheckIn(id: string): void {
			update(s => ({
				...s,
				checkins: s.checkins.filter(c => c.id !== id),
			}));
		},

		getCheckInsForGrow(state: GrowState, growId: string): CheckIn[] {
			return state.checkins
				.filter(c => c.grow_id === growId)
				.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
		},
	};
}

export const growStore = createGrowStore();

// ─── DERIVED ────────────────────────────────────────────────────────────

export const activeGrows = derived(growStore, $s => $s.grows.filter(g => g.status === 'active'));
export const harvestedGrows = derived(growStore, $s => $s.grows.filter(g => g.status === 'harvested'));
export const totalGrows = derived(growStore, $s => $s.grows.length);
export const totalHarvests = derived(growStore, $s => $s.grows.filter(g => g.status === 'harvested').length);
