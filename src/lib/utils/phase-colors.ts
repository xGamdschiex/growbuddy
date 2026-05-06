/**
 * Phase-Farb-Konvention (app-weit konsistent).
 * Tailwind-Klassen für Background, Text, Border + Emoji.
 */

export interface PhaseStyle {
	emoji: string;
	bg: string; // bg-...
	text: string; // text-...
	border: string; // border-...
	bgSoft: string; // bg-.../15 (Card-Hintergrund)
}

const STYLES: Record<string, PhaseStyle> = {
	Seedling: {
		emoji: '🌱',
		bg: 'bg-emerald-500',
		text: 'text-emerald-400',
		border: 'border-emerald-500/40',
		bgSoft: 'bg-emerald-500/15',
	},
	Veg: {
		emoji: '🌿',
		bg: 'bg-green-500',
		text: 'text-green-400',
		border: 'border-green-500/40',
		bgSoft: 'bg-green-500/15',
	},
	Bloom: {
		emoji: '🌸',
		bg: 'bg-orange-500',
		text: 'text-orange-400',
		border: 'border-orange-500/40',
		bgSoft: 'bg-orange-500/15',
	},
	Flush: {
		emoji: '💧',
		bg: 'bg-sky-500',
		text: 'text-sky-400',
		border: 'border-sky-500/40',
		bgSoft: 'bg-sky-500/15',
	},
	Dry: {
		emoji: '🍂',
		bg: 'bg-amber-600',
		text: 'text-amber-500',
		border: 'border-amber-600/40',
		bgSoft: 'bg-amber-600/15',
	},
	Cure: {
		emoji: '🫙',
		bg: 'bg-purple-500',
		text: 'text-purple-400',
		border: 'border-purple-500/40',
		bgSoft: 'bg-purple-500/15',
	},
};

const FALLBACK: PhaseStyle = {
	emoji: '🌿',
	bg: 'bg-gb-text-muted',
	text: 'text-gb-text-muted',
	border: 'border-gb-border',
	bgSoft: 'bg-gb-surface-2',
};

export function phaseStyle(phase: string | null | undefined): PhaseStyle {
	if (!phase) return FALLBACK;
	return STYLES[phase] ?? FALLBACK;
}

export function phaseEmoji(phase: string | null | undefined): string {
	return phaseStyle(phase).emoji;
}
