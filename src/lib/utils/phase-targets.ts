/**
 * Phase-spezifische Soll-Bereiche für Klima- und Substrat-Metriken.
 *
 * Quelle: GrowDad/AthenaAg/HSE-Recommendations 2024. Bei Konflikten zwischen Quellen
 * wurde die konservative Variante gewählt (mehr Range für tolerantere Strains).
 *
 * Nutzung:
 *  - targetFor('vpd', 'Bloom') → { min, max }
 *  - phaseTargetSegments(...) → Segmente pro Phase für MiniChart phaseTargets-Prop
 */

export const PHASE_TARGETS = {
	vpd: { Veg: { min: 0.8, max: 1.2 }, Bloom: { min: 1.2, max: 1.5 }, Flush: { min: 1.0, max: 1.4 } },
	temp: { Veg: { min: 22, max: 28 }, Bloom: { min: 20, max: 26 }, Flush: { min: 18, max: 24 } },
	rh: { Veg: { min: 55, max: 70 }, Bloom: { min: 40, max: 55 }, Flush: { min: 35, max: 50 } },
	ec: { Veg: { min: 1.0, max: 1.6 }, Bloom: { min: 1.6, max: 2.2 }, Flush: { min: 0.0, max: 0.4 } },
	ph: { Veg: { min: 5.8, max: 6.3 }, Bloom: { min: 5.8, max: 6.3 }, Flush: { min: 5.8, max: 6.3 } },
} as const;

export type MetricKey = keyof typeof PHASE_TARGETS;

/** Liefert das Target-Band für eine Metric+Phase oder null. */
export function targetFor(metric: MetricKey, phase: string | null | undefined): { min: number; max: number } | null {
	if (!phase) return null;
	const m = PHASE_TARGETS[metric];
	return (m as Record<string, { min: number; max: number }>)[phase] ?? null;
}

/** Klassifiziert Wert als 'low' | 'in' | 'high' relativ zum Phase-Soll. null wenn kein Target. */
export function classifyValue(metric: MetricKey, phase: string | null | undefined, value: number): 'low' | 'in' | 'high' | null {
	const t = targetFor(metric, phase);
	if (!t) return null;
	if (value < t.min) return 'low';
	if (value > t.max) return 'high';
	return 'in';
}

/**
 * Berechnet segmentierte Phase-Targets für MiniChart.
 * Gibt Indizes in der serieDays-Reihenfolge zurück, an denen sich das Target ändert
 * (also Phasenübergänge — z.B. Veg→Bloom).
 *
 * Erwartet Check-ins mit einem `phase`-Feld und eine `dayOf`-Funktion die die Day-Position
 * eines Check-ins berechnet (typisch: dayOf(c) = Tage seit grow.started_at).
 */
export function phaseTargetSegments<T extends { phase?: string | null }>(
	metric: MetricKey,
	checkins: T[],
	serieDays: number[],
	dayOf: (c: T) => number,
): Array<{ atIndex: number; min: number; max: number }> {
	if (!serieDays.length) return [];
	const segs: Array<{ atIndex: number; min: number; max: number }> = [];
	let lastPhase: string | null = null;
	serieDays.forEach((d, i) => {
		const ci = checkins.find((c) => dayOf(c) === d);
		const ph = (ci?.phase as string) || 'Veg';
		if (ph !== lastPhase) {
			const t = targetFor(metric, ph);
			if (t) segs.push({ atIndex: i, min: t.min, max: t.max });
			lastPhase = ph;
		}
	});
	return segs;
}

/**
 * Berechnet "In-Range-Rate" für eine Metric über alle Check-ins.
 * Nutzt jeweils das Target der Phase, in der der Check-in war.
 * Returns: { total, inRange, low, high, rate (0..1) }
 */
export function inRangeStats<T extends { phase?: string | null }>(
	metric: MetricKey,
	values: Array<{ ci: T; value: number }>,
): { total: number; inRange: number; low: number; high: number; rate: number } {
	let inRange = 0, low = 0, high = 0, total = 0;
	for (const { ci, value } of values) {
		const cls = classifyValue(metric, ci.phase, value);
		if (cls === null) continue;
		total++;
		if (cls === 'in') inRange++;
		else if (cls === 'low') low++;
		else high++;
	}
	return { total, inRange, low, high, rate: total ? inRange / total : 0 };
}
