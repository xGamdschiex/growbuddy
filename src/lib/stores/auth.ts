/**
 * Auth Store — Supabase Auth mit Magic Link + Google OAuth.
 * Offline-first: App funktioniert ohne Login, Login ist optional für Cloud-Sync.
 *
 * Native (Capacitor): Custom-Scheme `growbuddy://auth/callback`
 *   → AppUrlOpen Listener empfängt Hash-Token → setSession()
 * Web: `${origin}/auth/callback` Route mit getSession()
 */

import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

const NATIVE_CALLBACK = 'growbuddy://auth/callback';
const VERCEL_CALLBACK = 'https://growbuddy-app.vercel.app/auth/callback';

function getRedirectUrl(): string {
	if (Capacitor.isNativePlatform()) return NATIVE_CALLBACK;
	if (typeof window !== 'undefined') return `${window.location.origin}/auth/callback`;
	return VERCEL_CALLBACK;
}

function parseAuthCodeFromUrl(url: string): string | null {
	try {
		const u = new URL(url);
		// PKCE: code als Query-Parameter (?code=...)
		const code = u.searchParams.get('code');
		if (code) return code;
		// Fallback: Hash-Fragment (legacy implicit flow, kommt auf Android oft nicht durch)
		const hash = u.hash.startsWith('#') ? u.hash.slice(1) : u.hash;
		const params = new URLSearchParams(hash);
		return params.get('code');
	} catch {}
	return null;
}

function parseImplicitTokens(url: string): { access_token: string; refresh_token: string } | null {
	try {
		const u = new URL(url);
		const hash = u.hash.startsWith('#') ? u.hash.slice(1) : u.hash;
		const params = new URLSearchParams(hash);
		const access_token = params.get('access_token');
		const refresh_token = params.get('refresh_token');
		if (access_token && refresh_token) return { access_token, refresh_token };
	} catch {}
	return null;
}

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

	// AppUrlOpen-Listener wird in +layout.svelte registriert (frühere Mount-Garantie)

	// SSR-safe: nur im Browser initialisieren
	if (typeof window !== 'undefined') {
		init();
	}

	return {
		subscribe,

		/** Magic Link Login (E-Mail) */
		async loginWithEmail(email: string): Promise<{ error: string | null }> {
			const { error } = await supabase.auth.signInWithOtp({
				email,
				options: { emailRedirectTo: getRedirectUrl() },
			});
			return { error: error?.message ?? null };
		},

		/** Google OAuth Login */
		async loginWithGoogle(): Promise<{ error: string | null }> {
			if (Capacitor.isNativePlatform()) {
				const { data, error } = await supabase.auth.signInWithOAuth({
					provider: 'google',
					options: { redirectTo: NATIVE_CALLBACK, skipBrowserRedirect: true },
				});
				if (error) return { error: error.message };
				if (data?.url) {
					await Browser.open({ url: data.url, presentationStyle: 'popover' });
				}
				return { error: null };
			}
			const { error } = await supabase.auth.signInWithOAuth({
				provider: 'google',
				options: { redirectTo: getRedirectUrl() },
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
