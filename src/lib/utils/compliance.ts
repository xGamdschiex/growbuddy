/**
 * Compliance — Pflanzen-Limit nach Haushalts-Größe (DE KCanG).
 *
 * §9 KCanG: Privatanbau bis zu 3 lebende Pflanzen gleichzeitig **pro volljähriger
 * Person** im Haushalt. Mehrere Erwachsene → Limit skaliert (2 → 6, 3 → 9 …).
 *
 * Reine, seiteneffektfreie Funktionen — testbar ohne Store/DOM.
 * KEINE Rechtsberatung; nur ein Hilfs-Richtwert.
 */

export const PLANTS_PER_ADULT = 3;

export interface ComplianceStatus {
	/** Volljährige im Haushalt (min. 1). */
	adults: number;
	/** Erlaubte lebende Pflanzen = PLANTS_PER_ADULT × adults. */
	limit: number;
	/** Aktuelle Pflanzen in aktiven Grows. */
	current: number;
	/** current > limit. */
	over: boolean;
	/** limit − current (kann negativ sein). */
	remaining: number;
}

/** Erwachsene normalisieren: Ganzzahl, min. 1 (der Grower selbst). */
export function normalizeAdults(adults: number): number {
	const a = Number.isFinite(adults) ? Math.floor(adults) : 1;
	return Math.max(1, a);
}

/** Erlaubte Pflanzenzahl für eine Haushalts-Größe. */
export function plantLimit(adults: number): number {
	return PLANTS_PER_ADULT * normalizeAdults(adults);
}

/** Summe der Pflanzen über (aktive) Grows — robust gegen null/undefined/Negativ. */
export function sumPlants(grows: { plant_count?: number | null }[]): number {
	return grows.reduce((sum, g) => {
		const n = Math.floor(Number(g.plant_count));
		return sum + (Number.isFinite(n) && n > 0 ? n : 0);
	}, 0);
}

/**
 * Compliance-Status für die aktiven Grows + Haushalts-Größe.
 * @param activeGrows  nur Grows mit status==='active' übergeben (lebende Pflanzen)
 * @param adults       Volljährige im Haushalt
 */
export function complianceCheck(
	activeGrows: { plant_count?: number | null }[],
	adults: number,
): ComplianceStatus {
	const a = normalizeAdults(adults);
	const limit = PLANTS_PER_ADULT * a;
	const current = sumPlants(activeGrows);
	return {
		adults: a,
		limit,
		current,
		over: current > limit,
		remaining: limit - current,
	};
}
