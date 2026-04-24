/**
 * Calc Store — Persistiert die letzte Düngerrechner-Auswahl.
 * Nutzt localStorage. User muss nicht jedes Mal alles neu wählen.
 */

import { writable } from 'svelte/store';
import { safeSetItem } from '$lib/utils/storage-safe';

export interface CalcState {
	feedline_id: string;
	phase: string;
	woche: number;
	tag: number;
	reservoir: number;
	medium: 'hydro' | 'coco' | 'erde';
	system: 'topf' | 'autopot' | 'dwc' | 'rdwc';
	hat_ro: boolean;
	ec_einheit: 'mS/cm' | 'ppm500' | 'ppm700';
	wasserprofil: string;
	custom_ca: number;
	custom_mg: number;
	custom_ec: number;
	custom_ph: number;
	calmag_typ: 'A' | 'B';
	faktor_modus: 'Auto' | 'Manuell';
	faktor_manuell: number;
	/** Einfach-Modus: Blendet Fortgeschrittene Optionen aus. */
	einfach_modus: boolean;
	/** Ob User schon mal den Rechner benutzt hat */
	ever_used: boolean;
}

const STORAGE_KEY = 'growbuddy_calc';

const DEFAULT: CalcState = {
	feedline_id: 'athena-pro',
	phase: 'Veg',
	woche: 1,
	tag: 1,
	reservoir: 10,
	medium: 'coco',
	system: 'topf',
	hat_ro: false,
	ec_einheit: 'mS/cm',
	wasserprofil: 'Mainz Petersaue',
	custom_ca: 50,
	custom_mg: 10,
	custom_ec: 0.3,
	custom_ph: 7.0,
	calmag_typ: 'A',
	faktor_modus: 'Auto',
	faktor_manuell: 100,
	einfach_modus: true,
	ever_used: false,
};

function loadState(): CalcState {
	if (typeof window === 'undefined') return DEFAULT;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			// Erststart: Wenn Nicht-DE-Locale, RO-Wasser als sichere Default setzen
			// (Mainz-Profil passt nur für DE-User).
			const lang = typeof navigator !== 'undefined' ? navigator.language : '';
			if (lang && !lang.toLowerCase().startsWith('de')) {
				return { ...DEFAULT, hat_ro: true, wasserprofil: 'Benutzerdefiniert' };
			}
			return DEFAULT;
		}
		const parsed = JSON.parse(raw);
		return { ...DEFAULT, ...parsed };
	} catch {
		return DEFAULT;
	}
}

function createCalcStore() {
	const { subscribe, set, update } = writable<CalcState>(loadState());

	subscribe(state => {
		safeSetItem(STORAGE_KEY, JSON.stringify(state));
	});

	return {
		subscribe,
		update,
		/** Partielles Update einzelner Felder */
		patch(partial: Partial<CalcState>) {
			update(s => ({ ...s, ...partial }));
		},
		/** Markiert den ersten Use (wechselt nach Einfach→Voll wenn User reagiert) */
		markUsed() {
			update(s => ({ ...s, ever_used: true }));
		},
		toggleEinfach() {
			update(s => ({ ...s, einfach_modus: !s.einfach_modus }));
		},
		reset() {
			set({ ...DEFAULT, einfach_modus: true, ever_used: false });
		},
	};
}

export const calcStore = createCalcStore();
