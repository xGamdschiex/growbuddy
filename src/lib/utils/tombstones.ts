/**
 * Tombstones — lokal getrackte IDs von gelöschten Grows/Check-ins.
 *
 * Problem ohne Tombstones: Wenn User lokal löscht, wird der Eintrag aus dem
 * lokalen State entfernt. Beim nächsten Cloud-Pull kommt er aus Supabase
 * zurück, weil die Lösch-Info nirgends persistiert war. → Geister-Wiederkehr.
 *
 * Lösung: Beim lokalen Löschen ID in `growbuddy_tombstones` eintragen.
 *  - Merge-Code (layout + profile pullSync) filtert Cloud-Items mit
 *    Tombstone-IDs heraus.
 *  - syncStore.push schickt DELETE-Calls an Supabase, bei Erfolg werden
 *    die Tombstones gelöscht.
 *
 * Funktioniert offline (Tombstone bleibt, wird beim nächsten Push gecleared).
 */

const KEY = 'growbuddy_tombstones';

export interface TombstoneState {
	checkins: string[];
	grows: string[];
}

const EMPTY: TombstoneState = { checkins: [], grows: [] };

function load(): TombstoneState {
	if (typeof window === 'undefined') return EMPTY;
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return { checkins: [], grows: [] };
		const parsed = JSON.parse(raw);
		return {
			checkins: Array.isArray(parsed.checkins) ? parsed.checkins : [],
			grows: Array.isArray(parsed.grows) ? parsed.grows : [],
		};
	} catch {
		return { checkins: [], grows: [] };
	}
}

function save(t: TombstoneState): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(KEY, JSON.stringify(t));
	} catch {
		// Quota / private mode — fail silent
	}
}

export const tombstones = {
	/** Snapshot der aktuellen Tombstones (defensive Copy). */
	get(): TombstoneState {
		const t = load();
		return { checkins: [...t.checkins], grows: [...t.grows] };
	},

	addCheckin(id: string): void {
		const t = load();
		if (!t.checkins.includes(id)) {
			t.checkins.push(id);
			save(t);
		}
	},

	addGrow(id: string): void {
		const t = load();
		if (!t.grows.includes(id)) {
			t.grows.push(id);
			save(t);
		}
	},

	/** Mehrere CheckIn-IDs hinzufügen (z.B. Cascade beim deleteGrow). */
	addCheckins(ids: string[]): void {
		if (ids.length === 0) return;
		const t = load();
		let changed = false;
		for (const id of ids) {
			if (!t.checkins.includes(id)) {
				t.checkins.push(id);
				changed = true;
			}
		}
		if (changed) save(t);
	},

	/** Nach erfolgreichem Cloud-Delete: Tombstones entfernen. */
	clearCheckins(ids: string[]): void {
		if (ids.length === 0) return;
		const t = load();
		const set = new Set(ids);
		t.checkins = t.checkins.filter((id) => !set.has(id));
		save(t);
	},

	clearGrows(ids: string[]): void {
		if (ids.length === 0) return;
		const t = load();
		const set = new Set(ids);
		t.grows = t.grows.filter((id) => !set.has(id));
		save(t);
	},

	/** Komplett zurücksetzen (z.B. nach Account-Wechsel oder "Alles löschen"). */
	clearAll(): void {
		save({ checkins: [], grows: [] });
	},

	isCheckinDeleted(id: string): boolean {
		return load().checkins.includes(id);
	},

	isGrowDeleted(id: string): boolean {
		return load().grows.includes(id);
	},
};
