/**
 * Cloud-Sync Store — Synchronisiert Grows + Check-ins mit Supabase.
 * Offline-first: localStorage ist immer die Quelle der Wahrheit.
 * Sync ist ein manueller oder optionaler Push/Pull.
 */

import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { uploadCheckinPhoto, uploadCheckinPhotos } from '$lib/utils/storage';
import type { GrowState, Grow, CheckIn } from '$lib/stores/grow';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncState {
	status: SyncStatus;
	last_synced: string | null;
	error: string | null;
}

const STORAGE_KEY = 'growbuddy_sync';

function loadSyncState(): SyncState {
	if (typeof window === 'undefined') return { status: 'idle', last_synced: null, error: null };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { status: 'idle', last_synced: null, error: null };
		return JSON.parse(raw);
	} catch {
		return { status: 'idle', last_synced: null, error: null };
	}
}

function createSyncStore() {
	const { subscribe, set, update } = writable<SyncState>(loadSyncState());

	// Sync-State persistieren
	subscribe(state => {
		if (typeof window !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		}
	});

	return {
		subscribe,

		/** Push: Lokale Daten → Supabase (upsert) */
		async push(userId: string, state: GrowState): Promise<boolean> {
			set({ status: 'syncing', last_synced: null, error: null });
			try {
				// Grows upserten (ohne lokale Felder)
				if (state.grows.length > 0) {
					const growRows = state.grows.map(g => ({
						id: g.id,
						user_id: userId,
						name: g.name,
						strain: g.strain,
						strain_type: g.strain_type,
						medium: g.medium,
						space: g.space,
						feedline_id: g.feedline_id,
						light_info: g.light_info,
						plant_count: g.plant_count,
						status: g.status,
						started_at: g.started_at,
						harvested_at: g.harvested_at,
						yield_g: g.yield_g,
						grow_score: g.grow_score,
						notes: g.notes,
					}));
					const { error } = await supabase.from('grows').upsert(growRows, { onConflict: 'id' });
					if (error) throw error;
				}

				// Check-ins upserten — Fotos via Storage hochladen, Metadata in DB
				if (state.checkins.length > 0) {
					const checkinRows = await Promise.all(state.checkins.map(async c => {
						// Mehrere Fotos uploaden (bevorzugt), sonst Legacy-Einzel
						const rawPhotos = (c.photos_data ?? []).filter(p => p?.startsWith('data:'));
						let photoUrls: string[] = [];
						let photoUrl: string | null = c.photo_url ?? null;
						if (rawPhotos.length > 0) {
							photoUrls = await uploadCheckinPhotos(userId, c.id, rawPhotos);
							if (photoUrls.length > 0) photoUrl = photoUrls[0];
						} else if (c.photo_data && c.photo_data.startsWith('data:')) {
							const url = await uploadCheckinPhoto(userId, c.id, c.photo_data);
							if (url) {
								photoUrl = url;
								photoUrls = [url];
							}
						}
						const hasPhoto = photoUrls.length > 0 || !!photoUrl;
						return {
							id: c.id,
							user_id: userId,
							grow_id: c.grow_id,
							phase: c.phase,
							week: c.week,
							day: c.day,
							temp: c.temp,
							rh: c.rh,
							vpd: c.vpd,
							ec_measured: c.ec_measured,
							ph_measured: c.ph_measured,
							watered: c.watered,
							nutrients_given: c.nutrients_given,
							water_ml: c.water_ml ?? null,
							nutrient_ml: c.nutrient_ml ?? null,
							training: c.training,
							notes: c.notes,
							created_at: c.created_at,
							has_photo: hasPhoto,
							photo_url: photoUrl,
							photo_urls: photoUrls,
						};
					}));
					const { error } = await supabase.from('checkins').upsert(checkinRows, { onConflict: 'id' });
					if (error) throw error;
				}

				const now = new Date().toISOString();
				set({ status: 'success', last_synced: now, error: null });
				return true;
			} catch (e: any) {
				set({ status: 'error', last_synced: null, error: e.message ?? 'Sync fehlgeschlagen' });
				return false;
			}
		},

		/** Pull: Supabase → Lokale Daten (merge) */
		async pull(userId: string): Promise<GrowState | null> {
			set({ status: 'syncing', last_synced: null, error: null });
			try {
				const { data: grows, error: gErr } = await supabase
					.from('grows')
					.select('*')
					.eq('user_id', userId);
				if (gErr) throw gErr;

				const { data: checkins, error: cErr } = await supabase
					.from('checkins')
					.select('*')
					.eq('user_id', userId);
				if (cErr) throw cErr;

				const now = new Date().toISOString();
				set({ status: 'success', last_synced: now, error: null });

				return {
					grows: (grows ?? []).map((g: any): Grow => ({
						id: g.id,
						name: g.name ?? '',
						strain: g.strain,
						strain_type: g.strain_type,
						medium: g.medium,
						space: g.space,
						feedline_id: g.feedline_id,
						light_info: g.light_info ?? '',
						plant_count: g.plant_count,
						status: g.status,
						started_at: g.started_at,
						harvested_at: g.harvested_at,
						yield_g: g.yield_g,
						grow_score: g.grow_score,
						notes: g.notes ?? '',
					})),
					checkins: (checkins ?? []).map((c: any): CheckIn => ({
						id: c.id,
						grow_id: c.grow_id,
						phase: c.phase,
						week: c.week,
						day: c.day,
						photo_data: null, // Base64 bleibt lokal, Cloud nutzt photo_url
						photos_data: [],
						photo_url: c.photo_url ?? null,
						temp: c.temp,
						rh: c.rh,
						vpd: c.vpd,
						ec_measured: c.ec_measured,
						ph_measured: c.ph_measured,
						watered: c.watered,
						nutrients_given: c.nutrients_given,
						water_ml: c.water_ml ?? null,
						nutrient_ml: c.nutrient_ml ?? null,
						training: c.training,
						notes: c.notes ?? '',
						created_at: c.created_at,
					})),
				};
			} catch (e: any) {
				set({ status: 'error', last_synced: null, error: e.message ?? 'Pull fehlgeschlagen' });
				return null;
			}
		},

		reset() {
			set({ status: 'idle', last_synced: null, error: null });
		},
	};
}

export const syncStore = createSyncStore();
export const syncStatus = derived(syncStore, $s => $s.status);
export const lastSynced = derived(syncStore, $s => $s.last_synced);
