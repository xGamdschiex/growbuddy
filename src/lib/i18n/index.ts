/**
 * i18n — Lightweight Übersetzungssystem.
 * Kein externes Package. Svelte Store + Record<string, string>.
 */

import { writable, derived } from 'svelte/store';
import { de } from './de';
import { en } from './en';

export type Locale = 'de' | 'en';
export type TranslationKey = keyof typeof de;

const translations: Record<Locale, Record<string, string>> = { de, en };

const STORAGE_KEY = 'growbuddy_locale';

function getInitialLocale(): Locale {
	if (typeof window === 'undefined') return 'de';
	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved === 'de' || saved === 'en') return saved;
	// Browser-Sprache checken
	const lang = navigator.language.slice(0, 2);
	return lang === 'de' ? 'de' : 'en';
}

export const locale = writable<Locale>(getInitialLocale());

locale.subscribe(l => {
	if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, l);
});

/** Übersetzungsfunktion */
export const t = derived(locale, $l => {
	return (key: string, params?: Record<string, string | number>): string => {
		let text = translations[$l]?.[key] ?? translations.de[key] ?? key;
		if (params) {
			for (const [k, v] of Object.entries(params)) {
				text = text.replace(`{${k}}`, String(v));
			}
		}
		return text;
	};
});
