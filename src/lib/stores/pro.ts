/**
 * Pro Store — Verwaltet Free/Pro-Tier, Feature-Gates und Abo-Status.
 * Aktuell localStorage-basiert, später Stripe + Supabase.
 */

import { writable, derived } from 'svelte/store';

// ─── TYPES ──────────────────────────────────────────────────────────────

export type Tier = 'free' | 'pro' | 'csc';

export interface ProState {
	tier: Tier;
	subscribed_at: string | null;
	expires_at: string | null;         // null = kein Ablauf (lifetime oder aktiv)
	stripe_customer_id: string | null;  // später für Stripe
	trial_used: boolean;                // 7-Tage Trial einmalig
	trial_ends_at: string | null;
}

// ─── FEATURE GATES ──────────────────────────────────────────────────────

export interface FeatureLimits {
	max_active_grows: number;
	max_feedlines: number;
	ai_diagnosis: boolean;
	cloud_sync: boolean;
	pdf_export: boolean;
	advanced_charts: boolean;
	all_achievements: boolean;
	push_reminders: boolean;
	community_access: boolean;
}

export const TIER_LIMITS: Record<Tier, FeatureLimits> = {
	free: {
		max_active_grows: 1,
		max_feedlines: 2,
		ai_diagnosis: false,
		cloud_sync: false,
		pdf_export: false,
		advanced_charts: false,
		all_achievements: false,
		push_reminders: false,
		community_access: false,
	},
	pro: {
		max_active_grows: Infinity,
		max_feedlines: Infinity,
		ai_diagnosis: true,
		cloud_sync: true,
		pdf_export: true,
		advanced_charts: true,
		all_achievements: true,
		push_reminders: true,
		community_access: true,
	},
	csc: {
		max_active_grows: Infinity,
		max_feedlines: Infinity,
		ai_diagnosis: true,
		cloud_sync: true,
		pdf_export: true,
		advanced_charts: true,
		all_achievements: true,
		push_reminders: true,
		community_access: true,
	},
};

export const PRICING = {
	pro_monthly: 4.99,
	pro_yearly: 39.99,  // 33% Ersparnis
	csc_monthly: 29.99,
	currency: 'EUR',
} as const;

// ─── STORE ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'growbuddy_pro';

const DEFAULTS: ProState = {
	tier: 'free',
	subscribed_at: null,
	expires_at: null,
	stripe_customer_id: null,
	trial_used: false,
	trial_ends_at: null,
};

function loadState(): ProState {
	if (typeof window === 'undefined') return DEFAULTS;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULTS;
		const state = { ...DEFAULTS, ...JSON.parse(raw) };
		// Trial abgelaufen?
		if (state.trial_ends_at && new Date(state.trial_ends_at) < new Date()) {
			if (state.tier === 'pro' && !state.stripe_customer_id) {
				state.tier = 'free';
			}
		}
		return state;
	} catch {
		return DEFAULTS;
	}
}

function saveState(state: ProState): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createProStore() {
	const { subscribe, set, update } = writable<ProState>(loadState());
	subscribe(saveState);

	return {
		subscribe,

		/** 7-Tage Trial starten (einmalig) */
		startTrial(): boolean {
			let success = false;
			update(s => {
				if (s.trial_used) return s;
				success = true;
				const ends = new Date();
				ends.setDate(ends.getDate() + 7);
				return {
					...s,
					tier: 'pro',
					trial_used: true,
					trial_ends_at: ends.toISOString(),
					subscribed_at: new Date().toISOString(),
				};
			});
			return success;
		},

		/** Pro aktivieren (nach Stripe-Zahlung) */
		activatePro(stripeCustomerId?: string): void {
			update(s => ({
				...s,
				tier: 'pro',
				subscribed_at: new Date().toISOString(),
				expires_at: null,
				stripe_customer_id: stripeCustomerId ?? null,
				trial_ends_at: null,
			}));
		},

		/** Downgrade auf Free */
		downgrade(): void {
			update(s => ({
				...s,
				tier: 'free',
				expires_at: new Date().toISOString(),
				stripe_customer_id: null,
			}));
		},

		/** Feature-Check */
		canUse(feature: keyof FeatureLimits, state: ProState): boolean {
			const limits = TIER_LIMITS[state.tier];
			const val = limits[feature];
			return typeof val === 'boolean' ? val : true;
		},

		reset(): void {
			set(DEFAULTS);
		},
	};
}

export const proStore = createProStore();

// ─── DERIVED ────────────────────────────────────────────────────────────

export const currentTier = derived(proStore, $s => $s.tier);
export const isPro = derived(proStore, $s => $s.tier === 'pro' || $s.tier === 'csc');
export const limits = derived(proStore, $s => TIER_LIMITS[$s.tier]);
export const isTrialing = derived(proStore, $s =>
	$s.trial_ends_at !== null && new Date($s.trial_ends_at) > new Date()
);
