/**
 * Privacy Store — Datensparsamkeit / digitaler Fußabdruck.
 * `localOnly`: wenn true, wird NICHT mit der Cloud synchronisiert
 * (kein Auto-Pull/-Push) — alle Daten + Fotos bleiben auf dem Gerät.
 * Login bleibt bestehen; Sync kann jederzeit wieder eingeschaltet werden.
 */

import { writable } from 'svelte/store';
import { safeSetItem } from '$lib/utils/storage-safe';

const STORAGE_KEY = 'growbuddy_privacy';

export interface PrivacyState {
	localOnly: boolean;
}

const DEFAULTS: PrivacyState = { localOnly: false };

function load(): PrivacyState {
	if (typeof window === 'undefined') return DEFAULTS;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULTS;
		const p = JSON.parse(raw);
		return { localOnly: !!p?.localOnly };
	} catch {
		return DEFAULTS;
	}
}

function createPrivacyStore() {
	const { subscribe, set, update } = writable<PrivacyState>(load());

	subscribe((s) => safeSetItem(STORAGE_KEY, JSON.stringify(s)));

	return {
		subscribe,
		setLocalOnly(b: boolean): void {
			set({ localOnly: b });
		},
		toggle(): void {
			update((s) => ({ localOnly: !s.localOnly }));
		},
	};
}

export const privacyStore = createPrivacyStore();
