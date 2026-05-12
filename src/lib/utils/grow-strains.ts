/**
 * Multi-Strain-Helper.
 *
 * Ab v1.3.65 unterstützt ein Grow optional ein `strains`-Array.
 * Wenn nicht gesetzt → synthesiert aus `grow.strain` + `grow.plant_count` (Legacy).
 *
 * Beim Speichern: `strains` array setzen, `strain` als joined-Display-String,
 * `plant_count` als Summe (für Legacy-Code der noch auf Top-Level greift).
 */

import type { Grow, GrowStrainEntry } from '$lib/stores/grow';

/** Default-Blütezeit pro Strain-Typ (User kann pro Strain überschreiben). */
export const DEFAULT_FLOWERING_WEEKS = {
	auto: 5,   // Auto: ~5 Wochen Bloom (10-12 Wo Gesamtzyklus)
	photo: 9,  // Photo: ~9 Wochen Bloom typisch
} as const;

/**
 * Gibt die Strain-Liste eines Grows zurück.
 * - Mit `strains`-Array: nutze das
 * - Ohne: synthesiere [{ strain: grow.strain, plant_count: grow.plant_count }]
 */
export function getStrainEntries(grow: Pick<Grow, 'strain' | 'plant_count' | 'strains'>): GrowStrainEntry[] {
	if (grow.strains && grow.strains.length > 0) {
		return grow.strains.filter(s => s.strain && s.strain.trim() && s.plant_count > 0);
	}
	if (!grow.strain) return [];
	return [{ strain: grow.strain, plant_count: Math.max(1, grow.plant_count ?? 1) }];
}

/** Liefert flowering_weeks für einen Strain (mit Fallback auf Default). */
export function getFloweringWeeks(entry: GrowStrainEntry, strainType: 'auto' | 'photo'): number {
	if (typeof entry.flowering_weeks === 'number' && entry.flowering_weeks > 0) {
		return entry.flowering_weeks;
	}
	return DEFAULT_FLOWERING_WEEKS[strainType];
}

/** Gesamt-Pflanzenzahl (Summe aller Strain-Entries). */
export function totalPlantCount(grow: Pick<Grow, 'strain' | 'plant_count' | 'strains'>): number {
	const entries = getStrainEntries(grow);
	if (entries.length === 0) return 0;
	return entries.reduce((sum, e) => sum + (e.plant_count || 0), 0);
}

/**
 * Display-String für Grow-Liste/Detail.
 * Beispiele:
 *   1 Strain  → "Strawberry Gummies"
 *   2 Strains → "Strawberry Gummies ×2 · Don Mega ×1"
 *   4+ Strains kompakt → "4 Strains (5 Pflanzen)"
 */
export function summarizeStrains(grow: Pick<Grow, 'strain' | 'plant_count' | 'strains'>, opts: { maxLength?: number } = {}): string {
	const entries = getStrainEntries(grow);
	if (entries.length === 0) return grow.strain ?? '';
	if (entries.length === 1) {
		const e = entries[0];
		return e.plant_count > 1 ? `${e.strain} ×${e.plant_count}` : e.strain;
	}
	// 2+ Strains
	const max = opts.maxLength ?? 60;
	const parts = entries.map(e => `${e.strain} ×${e.plant_count}`);
	const joined = parts.join(' · ');
	if (joined.length <= max) return joined;
	// Zu lang → kompakt: "N Strains (Σ Pflanzen)"
	return `${entries.length} Strains (${totalPlantCount(grow)} Pflanzen)`;
}

/**
 * Joined-Display-Strain für Legacy-Feld `grow.strain`.
 * Wird beim Save in den Form-Routen gesetzt.
 * Beispiel: "Strawberry Gummies, Don Mega, White Runtz"
 */
export function joinedStrainName(entries: GrowStrainEntry[]): string {
	const cleaned = entries.filter(e => e.strain && e.strain.trim() && e.plant_count > 0);
	if (cleaned.length === 0) return '';
	if (cleaned.length === 1) return cleaned[0].strain;
	return cleaned.map(e => e.strain).join(', ');
}

/** Validierung: mind. 1 Strain mit Plant-Count >= 1. */
export function validateStrains(entries: GrowStrainEntry[]): { ok: boolean; error?: string } {
	const cleaned = entries.filter(e => e.strain && e.strain.trim() && e.plant_count > 0);
	if (cleaned.length === 0) return { ok: false, error: 'Mindestens 1 Strain mit ≥1 Pflanze' };
	for (const e of cleaned) {
		if (e.plant_count > 50) return { ok: false, error: `Plant-Count > 50 für "${e.strain}"` };
	}
	return { ok: true };
}
