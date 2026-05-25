/**
 * Household Store — Haushalts-Größe für das Pflanzen-Limit (DE KCanG).
 * Offline-first, localStorage. Default: 1 Erwachsener (→ 3 Pflanzen erlaubt).
 *
 * Mehrere Volljährige im Haushalt → Limit skaliert (2 → 6, 3 → 9 …).
 */

import { writable, derived } from 'svelte/store';
import { safeSetItem } from '$lib/utils/storage-safe';
import { activeGrows } from './grow';
import { complianceCheck, normalizeAdults, type ComplianceStatus } from '$lib/utils/compliance';

const STORAGE_KEY = 'growbuddy_household';
const MAX_ADULTS = 20;

export interface HouseholdState {
	/** Volljährige (18+) im Haushalt. */
	adults: number;
}

const DEFAULTS: HouseholdState = { adults: 1 };

function load(): HouseholdState {
	if (typeof window === 'undefined') return DEFAULTS;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULTS;
		const parsed = JSON.parse(raw);
		return { adults: Math.min(MAX_ADULTS, normalizeAdults(Number(parsed?.adults))) };
	} catch {
		return DEFAULTS;
	}
}

function createHouseholdStore() {
	const { subscribe, set, update } = writable<HouseholdState>(load());

	subscribe((state) => safeSetItem(STORAGE_KEY, JSON.stringify(state)));

	return {
		subscribe,
		setAdults(n: number): void {
			set({ adults: Math.min(MAX_ADULTS, normalizeAdults(n)) });
		},
		increment(): void {
			update((s) => ({ adults: Math.min(MAX_ADULTS, s.adults + 1) }));
		},
		decrement(): void {
			update((s) => ({ adults: Math.max(1, s.adults - 1) }));
		},
	};
}

export const householdStore = createHouseholdStore();

/** Live Compliance-Status: aktive Grows × Haushalts-Größe. */
export const complianceStatus = derived(
	[activeGrows, householdStore],
	([$active, $hh]): ComplianceStatus => complianceCheck($active, $hh.adults),
);
