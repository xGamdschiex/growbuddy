/**
 * Safe localStorage Wrapper — Detektiert Quota-Exceeded Fehler
 * und zeigt Toast statt still zu scheitern. Wichtig wenn Fotos (Base64)
 * den localStorage-Quota (~5-10 MB) sprengen.
 */

import { toastStore } from '$lib/stores/toast';

let quotaWarned = false;

export function safeSetItem(key: string, value: string): boolean {
	if (typeof window === 'undefined') return false;
	try {
		localStorage.setItem(key, value);
		quotaWarned = false;
		return true;
	} catch (e: any) {
		const isQuota =
			e?.name === 'QuotaExceededError' ||
			e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
			e?.code === 22 ||
			e?.code === 1014;
		if (isQuota && !quotaWarned) {
			quotaWarned = true;
			try {
				toastStore.warning('Speicher voll — bitte Backup exportieren');
			} catch {
				// Store evtl. noch nicht bereit, ignorieren
			}
		}
		return false;
	}
}

export function safeGetItem(key: string): string | null {
	if (typeof window === 'undefined') return null;
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}
