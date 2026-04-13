/**
 * Auth Store — Supabase Auth mit Magic Link + Google OAuth.
 * Offline-first: App funktioniert ohne Login, Login ist optional für Cloud-Sync.
 */

import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthState {
	user: User | null;
	session: Session | null;
	loading: boolean;
}

const DEFAULTS: AuthState = {
	user: null,
	session: null,
	loading: true,
};

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>(DEFAULTS);

	// Session beim Start laden
	async function init() {
		try {
			const { data: { session } } = await supabase.auth.getSession();
			set({
				user: session?.user ?? null,
				session: session ?? null,
				loading: false,
			});
		} catch {
			set({ ...DEFAULTS, loading: false });
		}

		// Auth-State-Changes lauschen (Login, Logout, Token-Refresh)
		supabase.auth.onAuthStateChange((_event, session) => {
			set({
				user: session?.user ?? null,
				session: session ?? null,
				loading: false,
			});
		});
	}

	// SSR-safe: nur im Browser initialisieren
	if (typeof window !== 'undefined') {
		init();
	}

	return {
		subscribe,

		/** Magic Link Login (E-Mail) */
		async loginWithEmail(email: string): Promise<{ error: string | null }> {
			const redirectUrl = typeof window !== 'undefined'
				? `${window.location.origin}/auth/callback`
				: undefined;
			const { error } = await supabase.auth.signInWithOtp({
				email,
				options: { emailRedirectTo: redirectUrl },
			});
			return { error: error?.message ?? null };
		},

		/** Google OAuth Login */
		async loginWithGoogle(): Promise<{ error: string | null }> {
			const redirectUrl = typeof window !== 'undefined'
				? `${window.location.origin}/auth/callback`
				: undefined;
			const { error } = await supabase.auth.signInWithOAuth({
				provider: 'google',
				options: { redirectTo: redirectUrl },
			});
			return { error: error?.message ?? null };
		},

		/** Logout */
		async logout(): Promise<void> {
			await supabase.auth.signOut();
			set({ user: null, session: null, loading: false });
		},
	};
}

export const authStore = createAuthStore();

// Derived Helpers
export const currentUser = derived(authStore, $s => $s.user);
export const isLoggedIn = derived(authStore, $s => $s.user !== null);
export const authLoading = derived(authStore, $s => $s.loading);
