/**
 * Zentrale Chart-Farben — Single Source of Truth.
 *
 * Diese Farben werden direkt als SVG `fill`/`stroke` verwendet, daher als Hex
 * (CSS-vars sind in SVG-Attributen unhandlich). Spiegelt die `@theme`-Tokens
 * aus `app.css`. Bei Änderungen IMMER beide Stellen anpassen.
 *
 * Verwendung:
 *   import { CHART_COLORS } from '$lib/utils/chart-colors';
 *   { color: CHART_COLORS.vpd, ... }
 */
export const CHART_COLORS = {
	// In @theme als Token vorhanden
	vpd: '#22c55e',      // = gb-green
	ec: '#a855f7',       // = gb-accent
	ph: '#ef4444',       // = gb-danger
	temp: '#f59e0b',     // = gb-warning
	rh: '#3b82f6',       // = gb-info
	water: '#0ea5e9',    // = gb-water
	nutrient: '#84cc16', // = gb-nutrient
	// Strukturell — für Stroke/Outline auf dunklem Background
	bgStroke: '#0a0a0a', // = gb-bg
	textOnDark: '#f5f5f5', // = gb-text (z.B. aktiver Indikator-Punkt)
} as const;

export type ChartColorKey = keyof typeof CHART_COLORS;
