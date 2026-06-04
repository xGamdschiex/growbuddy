/**
 * FeedLine-Overrides Store — User-spezifische Anpassungen der Hersteller-Schema-Werte.
 *
 * Format:
 *   {
 *     "athena-pro": {
 *       "Bloom": {
 *         "5": { ec_ziel: 3.2, dosierungen: { bloom: 22.0 } }
 *       }
 *     }
 *   }
 *
 * Die Overrides werden beim Schema-Lookup automatisch über die Original-Werte gemergt
 * (siehe `getEffectiveFeedLine` in registry).
 *
 * Strategie:
 * - Override == Partial<FeedSchemaRow> → nur überschriebene Felder werden ersetzt
 * - Original-Schema bleibt unverändert
 * - Reset → Override löschen → Original-Wert greift wieder
 *
 * Persistence: localStorage Schlüssel `growbuddy_feedline_overrides`,
 * auch im Backup/Restore enthalten.
 */

import { writable } from 'svelte/store';
import { safeSetItem } from '$lib/utils/storage-safe';
import type { FeedSchemaRow } from '$lib/calc/feedlines/types';

// ─── TYPES ───────────────────────────────────────────────────────────────

export type SchemaRowOverride = Partial<Omit<FeedSchemaRow, 'phase' | 'woche'>>;

export type OverridesState = Record<string, Record<string, Record<number, SchemaRowOverride>>>;
// {lineId → {phase → {woche → patch}}}

const STORAGE_KEY = 'growbuddy_feedline_overrides';
/** Aktuelle Format-Version. Bei Schema-Änderungen erhöhen + Migration in `migrate()` ergänzen. */
const CURRENT_VERSION = 1;

const EMPTY: OverridesState = {};

/**
 * Migriert importierten State auf das aktuelle Format.
 * - Akzeptiert: `{version, overrides}` (v1+), oder raw `{lineId: {...}}` (legacy/inline)
 * - Returns null bei invalidem Format.
 *
 * Wenn künftig FeedSchemaRow ein Feld bekommt, hier per version-Switch migrieren:
 *   if (version < 2) { for (lineId in overrides) for (phase in ...) ... rename/add fields }
 */
function migrate(parsed: any): OverridesState | null {
	if (typeof parsed !== 'object' || parsed === null) return null;
	// v1+ Format: hat `version` + `overrides`
	const version: number = typeof parsed.version === 'number' ? parsed.version : 1;
	const incoming: any = parsed.overrides ?? parsed;
	if (typeof incoming !== 'object' || incoming === null) return null;
	// Sanity-Validate: jeder lineId-Wert muss ein Object sein
	for (const lineId of Object.keys(incoming)) {
		if (typeof incoming[lineId] !== 'object' || incoming[lineId] === null) return null;
	}
	// Aktuell keine Migration nötig — Future-proof: hier per `if (version < 2)` ergänzen
	void version;
	return incoming as OverridesState;
}

function loadState(): OverridesState {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined') return EMPTY;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return EMPTY;
		return JSON.parse(raw);
	} catch {
		return EMPTY;
	}
}

// ─── STORE ───────────────────────────────────────────────────────────────

function createOverridesStore() {
	const { subscribe, set, update } = writable<OverridesState>(loadState());

	subscribe(state => {
		safeSetItem(STORAGE_KEY, JSON.stringify(state));
	});

	return {
		subscribe,
		/** Override für eine Schema-Zeile setzen (merge auf vorhandenen Patch). */
		setRow(lineId: string, phase: string, woche: number, patch: SchemaRowOverride) {
			update(s => {
				const next: OverridesState = { ...s };
				if (!next[lineId]) next[lineId] = {};
				if (!next[lineId][phase]) next[lineId][phase] = {};
				const existing = next[lineId][phase][woche] ?? {};
				// Bei dosierungen tief mergen, sonst flach
				const merged: SchemaRowOverride = { ...existing, ...patch };
				if (patch.dosierungen) {
					merged.dosierungen = { ...(existing.dosierungen ?? {}), ...patch.dosierungen };
				}
				next[lineId][phase][woche] = merged;
				return next;
			});
		},
		/** Einzelnen Feld-Override entfernen. */
		clearField(lineId: string, phase: string, woche: number, field: keyof SchemaRowOverride) {
			update(s => {
				const next: OverridesState = JSON.parse(JSON.stringify(s));
				const row = next[lineId]?.[phase]?.[woche];
				if (!row) return s;
				delete row[field];
				// Leere Zwischenobjekte aufräumen
				if (Object.keys(row).length === 0) {
					delete next[lineId][phase][woche];
					if (Object.keys(next[lineId][phase]).length === 0) delete next[lineId][phase];
					if (Object.keys(next[lineId]).length === 0) delete next[lineId];
				}
				return next;
			});
		},
		/** Override für eine ganze Woche entfernen. */
		clearRow(lineId: string, phase: string, woche: number) {
			update(s => {
				const next: OverridesState = JSON.parse(JSON.stringify(s));
				if (next[lineId]?.[phase]?.[woche]) {
					delete next[lineId][phase][woche];
					if (Object.keys(next[lineId][phase]).length === 0) delete next[lineId][phase];
					if (Object.keys(next[lineId]).length === 0) delete next[lineId];
				}
				return next;
			});
		},
		/** Alle Overrides für eine Line entfernen. */
		clearLine(lineId: string) {
			update(s => {
				if (!s[lineId]) return s;
				const next = { ...s };
				delete next[lineId];
				return next;
			});
		},
		/** Komplett zurücksetzen. */
		reset() {
			set(EMPTY);
		},
		/** Aktuellen State als JSON exportieren. */
		exportJson(): string {
			let snapshot: OverridesState = EMPTY;
			const unsub = subscribe(s => { snapshot = s; });
			unsub();
			return JSON.stringify({ version: CURRENT_VERSION, overrides: snapshot, exported_at: new Date().toISOString() }, null, 2);
		},
		/** JSON importieren (mergen statt überschreiben). Unterstützt Migrations. */
		importJson(json: string): boolean {
			try {
				const parsed = JSON.parse(json);
				const incoming = migrate(parsed);
				if (incoming === null) return false;
				update(s => ({ ...s, ...incoming }));
				return true;
			} catch {
				return false;
			}
		},
	};
}

export const feedlineOverrides = createOverridesStore();

// ─── HELPER: Synchron lesen (ohne subscribe — für Calc-Engine) ───────────

let _cachedState: OverridesState = EMPTY;
// Subscribe unconditionally — funktioniert in Browser, Node (vitest), SSR.
// Initial-Load liest localStorage nur wenn vorhanden.
feedlineOverrides.subscribe(s => { _cachedState = s; });

/** Synchron alle Overrides lesen — für Calc-Engine ohne Subscribe-Overhead. */
export function getOverrides(): OverridesState {
	return _cachedState;
}

/** Override für eine einzelne Zeile bekommen oder leer. */
export function getRowOverride(lineId: string, phase: string, woche: number): SchemaRowOverride {
	return _cachedState[lineId]?.[phase]?.[woche] ?? {};
}

/**
 * Wendet User-Overrides auf eine Schema-Zeile an.
 * - `dosierungen` werden tief gemergt (Original-Werte bleiben außer für überschriebene Keys)
 * - Andere Felder werden flach überschrieben
 * - Wenn keine Overrides vorhanden → Original-Row zurückgeben (gleiche Referenz)
 */
export function applyRowOverride<R extends FeedSchemaRow>(lineId: string, row: R): R {
	const ov = getRowOverride(lineId, row.phase, row.woche);
	if (!ov || Object.keys(ov).length === 0) return row;
	const merged: R = { ...row, ...ov };
	if (ov.dosierungen) {
		merged.dosierungen = { ...row.dosierungen, ...ov.dosierungen };
	}
	return merged;
}

/** Prüft ob für eine Zeile Overrides existieren. */
export function hasRowOverride(lineId: string, phase: string, woche: number): boolean {
	const ov = _cachedState[lineId]?.[phase]?.[woche];
	return ov !== undefined && Object.keys(ov).length > 0;
}
