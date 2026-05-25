/**
 * Grow Store — Offline-first mit localStorage
 * Verwaltet aktive und abgeschlossene Grows + Check-ins.
 * Wird später optional mit Supabase synchronisiert.
 */

import { writable, derived } from 'svelte/store';
import type { Medium, GrowPhase } from '$lib/data/science';
import { safeSetItem } from '$lib/utils/storage-safe';
import { tombstones } from '$lib/utils/tombstones';
import { putPhoto, getPhoto, deletePhotos, newPhotoId } from '$lib/utils/photo-store';

// ─── TYPES ──────────────────────────────────────────────────────────────

export type StrainType = 'auto' | 'photo';
export type GrowStatus = 'active' | 'harvested' | 'abandoned';
export type GrowSystem = 'topf' | 'autopot' | 'dwc' | 'rdwc';

/** Ein einzelner Strain im Multi-Strain-Grow. */
export interface GrowStrainEntry {
	strain: string;
	plant_count: number;
	/** Blütezeit in Wochen — pro Strain wegen unterschiedlicher Sorten. Default: 9 (photo) / 5 (auto). */
	flowering_weeks?: number;
}

export interface Grow {
	id: string;
	name: string;
	strain: string;          // Legacy: erster Strain oder zusammengefasster Display-String
	strain_type: StrainType;
	medium: Medium;
	space: string;           // z.B. '60x60', '80x80', 'outdoor' ODER custom 'WxH' (z.B. '130x80')
	feedline_id: string;
	light_info: string;      // z.B. 'LED 150W', 'Sonne'
	plant_count: number;     // Legacy: Summe aller Pflanzen (= Σ strains[].plant_count wenn strains gesetzt)
	/** Multi-Strain-Liste (v1.3.65+). Wenn nicht gesetzt: synthetisiert aus `strain` + `plant_count`. */
	strains?: GrowStrainEntry[];
	status: GrowStatus;
	started_at: string;      // ISO date
	harvested_at: string | null;
	yield_g: number | null;
	grow_score: number | null;
	notes: string;
	// Neu: Anbausystem + Substratverhältnis
	system?: GrowSystem;                // default 'topf'
	coco_perlite_ratio?: number;        // % Kokos (0-100), Rest = Perlite. Default 70.
	/** Public im Community-Feed sichtbar (Phase 2) */
	is_public?: boolean;
	/** Last-Write-Wins Merge-Key für Sync */
	updated_at?: string;
}

export interface CheckIn {
	id: string;
	grow_id: string;
	phase: string;
	week: number;
	day: number;
	photo_data: string | null;   // base64 data URL (legacy, single photo)
	photos_data: string[];       // base64 array (im Speicher; persistiert via photo_ids/IndexedDB)
	/** Lokale Foto-Referenzen in IndexedDB (v1.4.11+) — ersetzt Base64-in-localStorage. */
	photo_ids?: string[];
	photo_url?: string | null;   // Signed URL von Supabase Storage (Single, legacy)
	photo_urls?: string[];       // Signed URL Array von Supabase Storage (nach Sync)
	temp: number | null;
	rh: number | null;
	vpd: number | null;
	ec_measured: number | null;
	ph_measured: number | null;
	watered: boolean;
	nutrients_given: boolean;
	water_ml: number | null;     // Wassermenge in mL (optional)
	nutrient_ml: number | null;  // Düngermenge in mL (optional, Gesamt)
	is_public?: boolean;         // Public im Community-Feed sichtbar (Phase 2)
	training: string | null;     // 'lst', 'topping', etc.
	notes: string;
	created_at: string;          // ISO date
	/** Last-Write-Wins Merge-Key für Sync */
	updated_at?: string;
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
		// Migrate old check-ins without photos_data / water_ml / nutrient_ml / updated_at
		if (parsed.checkins) {
			parsed.checkins = (parsed.checkins as Partial<CheckIn>[]).map((c) => ({
				photos_data: [],
				water_ml: null,
				nutrient_ml: null,
				...c,
				updated_at: c.updated_at ?? c.created_at ?? new Date().toISOString(),
			}));
		}
		if (parsed.grows) {
			parsed.grows = (parsed.grows as Partial<Grow>[]).map((g) => ({
				...g,
				updated_at: g.updated_at ?? g.started_at ?? new Date().toISOString(),
			}));
		}
		return { ...DEFAULTS, ...parsed };
	} catch {
		return DEFAULTS;
	}
}

function saveState(state: GrowState): void {
	// Fotos mit IndexedDB-Referenz (photo_ids) NICHT als Base64 in localStorage schreiben
	// — sonst Quota-Sprengung. Base64 bleibt im Speicher und liegt sicher in IndexedDB.
	const persisted: GrowState = {
		grows: state.grows,
		checkins: state.checkins.map(c =>
			(c.photo_ids && c.photo_ids.length)
				? { ...c, photo_data: null, photos_data: [] }
				: c
		),
	};
	safeSetItem(STORAGE_KEY, JSON.stringify(persisted));
}

// ─── STORE ──────────────────────────────────────────────────────────────

function createGrowStore() {
	const { subscribe, set, update } = writable<GrowState>(loadState());

	// Auto-save bei jeder Änderung
	subscribe((state) => saveState(state));

	// v1.4.11: Fotos einmalig von Base64-localStorage → IndexedDB migrieren und beim
	// App-Start wieder in den Speicher holen (Anzeige/Sync lesen weiter photos_data).
	// Läuft über die JEWEILS aktuelle State (kein Clobber eines parallelen Cloud-Pulls).
	async function runMigrateHydrate(): Promise<void> {
		if (typeof window === 'undefined') return;
		let snap: GrowState = { grows: [], checkins: [] };
		const u = subscribe(s => { snap = s; }); u();
		const patches = new Map<string, { photo_ids: string[]; photos_data: string[] }>();
		for (const c of snap.checkins) {
			const arrB64 = (c.photos_data ?? []).filter(p => p?.startsWith('data:'));
			const singleB64 = (!arrB64.length && c.photo_data && c.photo_data.startsWith('data:')) ? [c.photo_data] : [];
			const b64 = [...arrB64, ...singleB64];
			if ((!c.photo_ids || !c.photo_ids.length) && b64.length) {
				// Migration: Base64 → IndexedDB
				const ids: string[] = [];
				let ok = true;
				for (const b of b64) {
					const pid = newPhotoId();
					try { await putPhoto(pid, b); ids.push(pid); } catch { ok = false; break; }
				}
				if (ok) patches.set(c.id, { photo_ids: ids, photos_data: b64 });
				else if (ids.length) void deletePhotos(ids);
			} else if (c.photo_ids?.length && !(c.photos_data?.length)) {
				// Hydration: photo_ids vorhanden, Base64 nach Reload weg → aus IndexedDB laden
				const urls = (await Promise.all(c.photo_ids.map(getPhoto))).filter((x): x is string => !!x);
				if (urls.length) patches.set(c.id, { photo_ids: c.photo_ids, photos_data: urls });
			}
		}
		if (patches.size) {
			update(s => ({
				...s,
				checkins: s.checkins.map(c => {
					const p = patches.get(c.id);
					return p ? { ...c, photo_ids: p.photo_ids, photos_data: p.photos_data, photo_data: p.photos_data[0] ?? null } : c;
				}),
			}));
		}
	}
	if (typeof window !== 'undefined') setTimeout(runMigrateHydrate, 0);

	return {
		subscribe,

		/** Kompletten State ersetzen (für Cloud-Sync Merge) */
		replaceState(newState: GrowState): void {
			set(newState);
		},

		addGrow(grow: Omit<Grow, 'id' | 'status' | 'harvested_at' | 'yield_g' | 'grow_score'>): string {
			const id = crypto.randomUUID();
			const now = new Date().toISOString();
			const newGrow: Grow = {
				...grow,
				id,
				status: 'active',
				harvested_at: null,
				yield_g: null,
				grow_score: null,
				updated_at: now,
			};
			update(s => ({ ...s, grows: [...s.grows, newGrow] }));
			return id;
		},

		updateGrow(id: string, patch: Partial<Grow>): void {
			const now = new Date().toISOString();
			update(s => {
				const newGrows = s.grows.map(g => g.id === id ? { ...g, ...patch, updated_at: now } : g);
				// Wenn is_public geändert wurde → propagiere auf alle Check-ins des Grows
				let newCheckins = s.checkins;
				if (patch.is_public !== undefined) {
					newCheckins = s.checkins.map(c =>
						c.grow_id === id ? { ...c, is_public: patch.is_public, updated_at: now } : c
					);
				}
				return { ...s, grows: newGrows, checkins: newCheckins };
			});
		},

		harvestGrow(id: string, yield_g: number): void {
			const now = new Date().toISOString();
			update(s => ({
				...s,
				grows: s.grows.map(g => g.id === id ? {
					...g,
					status: 'harvested' as GrowStatus,
					harvested_at: now,
					yield_g,
					updated_at: now,
				} : g),
			}));
		},

		abandonGrow(id: string): void {
			const now = new Date().toISOString();
			update(s => ({
				...s,
				grows: s.grows.map(g => g.id === id ? {
					...g,
					status: 'abandoned' as GrowStatus,
					updated_at: now,
				} : g),
			}));
		},

		deleteGrow(id: string): void {
			// v1.4.7: Tombstone-Tracking → wird beim nächsten Cloud-Push als DELETE gesendet
			// (sonst kommt der Eintrag beim nächsten Pull aus Supabase zurück)
			update(s => {
				const ciForGrow = s.checkins.filter(c => c.grow_id === id);
				const ciIds = ciForGrow.map(c => c.id);
				const photoIds = ciForGrow.flatMap(c => c.photo_ids ?? []);
				tombstones.addGrow(id);
				tombstones.addCheckins(ciIds);
				if (photoIds.length) void deletePhotos(photoIds); // IndexedDB-Fotos aufräumen
				return {
					grows: s.grows.filter(g => g.id !== id),
					checkins: s.checkins.filter(c => c.grow_id !== id),
				};
			});
		},

		async addCheckIn(checkin: Omit<CheckIn, 'id' | 'created_at'>): Promise<string> {
			const id = crypto.randomUUID();
			const now = new Date().toISOString();
			// Base64-Fotos → IndexedDB (await: erst sicher speichern, DANN photo_ids setzen)
			const base64 = (checkin.photos_data ?? []).filter(p => p?.startsWith('data:'));
			let photo_ids = [...(checkin.photo_ids ?? [])];
			if (base64.length) {
				const ids: string[] = [];
				let ok = true;
				for (const b of base64) {
					const pid = newPhotoId();
					try { await putPhoto(pid, b); ids.push(pid); } catch { ok = false; break; }
				}
				// Nur wenn ALLE Fotos sicher in IDB → photo_ids setzen (sonst Base64-Fallback in localStorage)
				if (ok) photo_ids = [...photo_ids, ...ids];
				else if (ids.length) void deletePhotos(ids);
			}
			update(s => {
				// Erbt is_public vom zugehörigen Grow falls nicht explizit gesetzt
				const parentGrow = s.grows.find(g => g.id === checkin.grow_id);
				const newCheckin: CheckIn = {
					...checkin,
					id,
					created_at: now,
					updated_at: now,
					photo_ids,
					is_public: checkin.is_public ?? parentGrow?.is_public ?? false,
				};
				return { ...s, checkins: [...s.checkins, newCheckin] };
			});
			return id;
		},

		async updateCheckIn(id: string, patch: Partial<Omit<CheckIn, 'id' | 'grow_id' | 'created_at'>>): Promise<void> {
			const now = new Date().toISOString();
			// Wenn der Patch Fotos enthält: neue Base64 → IndexedDB, photo_ids neu setzen
			let newPhotoIds: string[] | null = null;
			if (patch.photos_data !== undefined) {
				const base64 = (patch.photos_data ?? []).filter(p => p?.startsWith('data:'));
				if (base64.length) {
					const ids: string[] = [];
					let ok = true;
					for (const b of base64) {
						const pid = newPhotoId();
						try { await putPhoto(pid, b); ids.push(pid); } catch { ok = false; break; }
					}
					if (ok) newPhotoIds = ids;
					else if (ids.length) void deletePhotos(ids);
				} else {
					newPhotoIds = []; // alle Fotos entfernt
				}
			}
			update(s => ({
				...s,
				checkins: s.checkins.map(c => {
					if (c.id !== id) return c;
					const merged: CheckIn = { ...c, ...patch, updated_at: now };
					if (newPhotoIds !== null) {
						const old = c.photo_ids ?? [];
						const toDelete = old.filter(o => !newPhotoIds!.includes(o));
						if (toDelete.length) void deletePhotos(toDelete);
						merged.photo_ids = newPhotoIds;
					}
					return merged;
				}),
			}));
		},

		deleteCheckIn(id: string): void {
			// v1.4.7: Tombstone-Tracking (siehe deleteGrow)
			tombstones.addCheckin(id);
			update(s => {
				const c = s.checkins.find(x => x.id === id);
				if (c?.photo_ids?.length) void deletePhotos(c.photo_ids); // IndexedDB-Fotos aufräumen
				return { ...s, checkins: s.checkins.filter(c => c.id !== id) };
			});
		},

		getCheckInsForGrow(state: GrowState, growId: string): CheckIn[] {
			return state.checkins
				.filter(c => c.grow_id === growId)
				.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
		},

		/**
		 * Demo-Daten für Mary-Jane-Demo: 1 aktiver 35-Tage-Grow + 14 Check-ins.
		 * Idempotent — mehrfacher Aufruf ersetzt alte Demo-Daten.
		 * Reset über `clearDemo()`.
		 */
		loadDemo(): void {
			update(s => {
				const purged: GrowState = {
					grows: s.grows.filter(g => g.id !== DEMO_GROW_ID),
					checkins: s.checkins.filter(c => c.grow_id !== DEMO_GROW_ID),
				};
				const { grow, checkins } = buildDemoData();
				return {
					grows: [...purged.grows, grow],
					checkins: [...purged.checkins, ...checkins],
				};
			});
		},

		/** Entfernt nur die Demo-Daten, lässt echte Grows + Check-ins unangetastet. */
		clearDemo(): void {
			update(s => ({
				grows: s.grows.filter(g => g.id !== DEMO_GROW_ID),
				checkins: s.checkins.filter(c => c.grow_id !== DEMO_GROW_ID),
			}));
		},

		/** True wenn aktuell ein Demo-Grow aktiv ist. */
		hasDemo(state: GrowState): boolean {
			return state.grows.some(g => g.id === DEMO_GROW_ID);
		},
	};
}

// ─── DEMO-DATEN ─────────────────────────────────────────────────────────

const DEMO_GROW_ID = 'demo-mary-jane-grow';

/** Generiert plausible Demo-Daten: 35-Tage-Grow + 14 Check-ins. */
function buildDemoData(): { grow: Grow; checkins: CheckIn[] } {
	const now = Date.now();
	const dayMs = 86400000;
	const startedAt = new Date(now - 35 * dayMs).toISOString();
	const nowIso = new Date(now).toISOString();

	const grow: Grow = {
		id: DEMO_GROW_ID,
		name: 'Demo Mary Jane',
		strain: 'Northern Lights Auto',
		strain_type: 'auto',
		medium: 'soil',
		space: '60x60',
		feedline_id: 'biobizz',
		light_info: 'LED 150W',
		plant_count: 2,
		status: 'active',
		started_at: startedAt,
		harvested_at: null,
		yield_g: null,
		grow_score: null,
		notes: 'Demo-Grow für Mary-Jane-Messe — beliebig per Reset löschbar.',
		system: 'topf',
		coco_perlite_ratio: 70,
		is_public: false,
		updated_at: nowIso,
	};

	// 14 Check-ins über 35 Tage:
	// Veg W1-3 (Tag 1, 4, 7, 11, 15, 18, 21) → 7 CIs
	// Bloom W1-3 (Tag 22, 25, 28, 31, 33, 34, 35) → 7 CIs
	type CIDef = { day: number; phase: string; week: number; t: number; rh: number; ec: number; ph: number; notes: string; train: string | null };
	const defs: CIDef[] = [
		{ day: 1,  phase: 'Veg',   week: 1, t: 25.0, rh: 65, ec: 1.2, ph: 6.0, notes: 'Erste Blätter, sieht gesund aus.',          train: null },
		{ day: 4,  phase: 'Veg',   week: 1, t: 24.5, rh: 62, ec: 1.4, ph: 6.0, notes: 'Wachstum konstant.',                          train: null },
		{ day: 7,  phase: 'Veg',   week: 2, t: 25.0, rh: 60, ec: 1.6, ph: 6.1, notes: 'Erstes echtes Blattpaar entwickelt.',         train: null },
		{ day: 11, phase: 'Veg',   week: 2, t: 25.5, rh: 58, ec: 1.7, ph: 6.0, notes: 'Stamm wird stabiler.',                         train: 'LST' },
		{ day: 15, phase: 'Veg',   week: 3, t: 26.0, rh: 56, ec: 1.8, ph: 6.0, notes: 'LST-Tie-Down erfolgreich.',                    train: 'LST' },
		{ day: 18, phase: 'Veg',   week: 3, t: 25.5, rh: 55, ec: 1.9, ph: 6.1, notes: 'Side-Branches kommen.',                        train: null },
		{ day: 21, phase: 'Veg',   week: 3, t: 25.0, rh: 55, ec: 2.0, ph: 6.0, notes: 'Übergang Veg → Bloom steht bevor.',            train: null },
		{ day: 22, phase: 'Bloom', week: 1, t: 25.0, rh: 52, ec: 2.0, ph: 6.2, notes: 'Erste Pre-Flowers sichtbar.',                  train: null },
		{ day: 25, phase: 'Bloom', week: 1, t: 24.5, rh: 50, ec: 2.1, ph: 6.2, notes: 'Stretch beginnt.',                             train: null },
		{ day: 28, phase: 'Bloom', week: 2, t: 24.0, rh: 48, ec: 2.2, ph: 6.3, notes: 'Erste echte Buds.',                            train: null },
		{ day: 31, phase: 'Bloom', week: 2, t: 24.0, rh: 48, ec: 2.3, ph: 6.3, notes: 'Bloom-Booster auf 100%.',                       train: null },
		{ day: 33, phase: 'Bloom', week: 3, t: 23.5, rh: 45, ec: 2.4, ph: 6.4, notes: 'Buds dichten sich.',                           train: null },
		{ day: 34, phase: 'Bloom', week: 3, t: 23.5, rh: 45, ec: 2.4, ph: 6.4, notes: 'Erste Trichome milchig.',                      train: null },
		{ day: 35, phase: 'Bloom', week: 3, t: 23.0, rh: 44, ec: 2.5, ph: 6.4, notes: 'Bald in Late-Bloom-Phase.',                    train: null },
	];

	const checkins: CheckIn[] = defs.map((d, i) => {
		const createdAt = new Date(now - (35 - d.day) * dayMs).toISOString();
		// VPD: vereinfachte Berechnung über calcVPD-Formel-Konstanten
		const tempLeaf = d.t - 2;
		const svpAir = 0.6108 * Math.exp((17.27 * d.t) / (d.t + 237.3));
		const svpLeaf = 0.6108 * Math.exp((17.27 * tempLeaf) / (tempLeaf + 237.3));
		const vpd = Math.round((svpLeaf - svpAir * (d.rh / 100)) * 100) / 100;
		return {
			id: `${DEMO_GROW_ID}-ci-${i + 1}`,
			grow_id: DEMO_GROW_ID,
			phase: d.phase,
			week: d.week,
			day: d.day - (d.phase === 'Bloom' ? 21 : 0),
			photo_data: null,
			photos_data: [],
			temp: d.t,
			rh: d.rh,
			vpd,
			ec_measured: d.ec,
			ph_measured: d.ph,
			watered: true,
			nutrients_given: i % 2 === 0,
			water_ml: 1500,
			nutrient_ml: i % 2 === 0 ? 25 : null,
			is_public: false,
			training: d.train,
			notes: d.notes,
			created_at: createdAt,
			updated_at: createdAt,
		};
	});

	return { grow, checkins };
}

export const growStore = createGrowStore();

// ─── DERIVED ────────────────────────────────────────────────────────────

export const activeGrows = derived(growStore, $s => $s.grows.filter(g => g.status === 'active'));
export const harvestedGrows = derived(growStore, $s => $s.grows.filter(g => g.status === 'harvested'));
export const totalGrows = derived(growStore, $s => $s.grows.length);
export const totalHarvests = derived(growStore, $s => $s.grows.filter(g => g.status === 'harvested').length);
/** True wenn Demo-Grow aktiv ist (für globalen Demo-Banner). */
export const demoActive = derived(growStore, $s => $s.grows.some(g => g.id === DEMO_GROW_ID));
