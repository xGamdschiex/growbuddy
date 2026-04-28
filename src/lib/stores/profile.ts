/**
 * Profile Store — Public-Profile pro User (Phase 2 Community).
 * Pseudonymes Username-System; Profil wird per Trigger bei Signup angelegt.
 */

import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { authStore } from '$lib/stores/auth';

export interface Profile {
	id: string;
	username: string;
	bio: string;
	avatar_url: string | null;
	created_at: string;
	updated_at: string;
}

interface ProfileState {
	me: Profile | null;
	loading: boolean;
}

const DEFAULTS: ProfileState = { me: null, loading: false };

function createProfileStore() {
	const { subscribe, set, update } = writable<ProfileState>(DEFAULTS);

	async function loadMyProfile(userId: string) {
		update(s => ({ ...s, loading: true }));
		const { data, error } = await supabase
			.from('profiles')
			.select('id, username, bio, avatar_url, created_at, updated_at')
			.eq('id', userId)
			.maybeSingle();
		if (error) {
			console.error('Profile load failed', error);
			update(s => ({ ...s, loading: false }));
			return;
		}
		set({ me: (data as Profile | null) ?? null, loading: false });
	}

	// Bei Auth-Change Profile (re-)laden
	if (typeof window !== 'undefined') {
		authStore.subscribe(s => {
			if (s.user) loadMyProfile(s.user.id);
			else set(DEFAULTS);
		});
	}

	return {
		subscribe,
		reload: loadMyProfile,
		async updateUsername(username: string): Promise<{ error: string | null }> {
			const trimmed = username.trim();
			if (!/^[A-Za-z][A-Za-z0-9_]{2,19}$/.test(trimmed)) {
				return { error: '3–20 Zeichen, Start mit Buchstabe, nur a-z A-Z 0-9 _' };
			}
			const { data: auth } = await supabase.auth.getUser();
			if (!auth.user) return { error: 'Nicht eingeloggt' };
			const { error } = await supabase
				.from('profiles')
				.update({ username: trimmed, updated_at: new Date().toISOString() })
				.eq('id', auth.user.id);
			if (error) return { error: error.code === '23505' ? 'Username vergeben' : error.message };
			await loadMyProfile(auth.user.id);
			return { error: null };
		},
		async updateBio(bio: string): Promise<{ error: string | null }> {
			const { data: auth } = await supabase.auth.getUser();
			if (!auth.user) return { error: 'Nicht eingeloggt' };
			const { error } = await supabase
				.from('profiles')
				.update({ bio: bio.slice(0, 280), updated_at: new Date().toISOString() })
				.eq('id', auth.user.id);
			if (error) return { error: error.message };
			await loadMyProfile(auth.user.id);
			return { error: null };
		},
		async updateAvatar(dataUrl: string | null): Promise<{ error: string | null }> {
			const { data: auth } = await supabase.auth.getUser();
			if (!auth.user) return { error: 'Nicht eingeloggt' };
			// Cap auf ~50KB damit Profile-Row nicht aufbläht
			if (dataUrl && dataUrl.length > 60_000) {
				return { error: 'Bild zu groß — max 50KB nach Komprimierung' };
			}
			const { error } = await supabase
				.from('profiles')
				.update({ avatar_url: dataUrl, updated_at: new Date().toISOString() })
				.eq('id', auth.user.id);
			if (error) return { error: error.message };
			await loadMyProfile(auth.user.id);
			return { error: null };
		},
	};
}

export const profileStore = createProfileStore();
export const myProfile = derived(profileStore, $s => $s.me);
export const myUsername = derived(profileStore, $s => $s.me?.username ?? null);
