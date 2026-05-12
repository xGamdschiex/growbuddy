/**
 * Safe localStorage Wrapper — Detektiert Quota-Exceeded Fehler
 * und zeigt Toast statt still zu scheitern. Wichtig wenn Fotos (Base64)
 * den localStorage-Quota (~5-10 MB) sprengen.
 */

import { toastStore } from '$lib/stores/toast';

let lastQuotaWarn = 0;

/** Schätzt verfügbaren localStorage-Quota in Bytes (Grobe Schätzung). */
export async function estimateStorageQuota(): Promise<{ used: number; quota: number; percent: number } | null> {
	if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
	try {
		const est = await navigator.storage.estimate();
		const used = est.usage ?? 0;
		const quota = est.quota ?? 0;
		return { used, quota, percent: quota > 0 ? (used / quota) * 100 : 0 };
	} catch {
		return null;
	}
}

export function safeSetItem(key: string, value: string): boolean {
	if (typeof window === 'undefined') return false;
	try {
		localStorage.setItem(key, value);
		return true;
	} catch (e: any) {
		const isQuota =
			e?.name === 'QuotaExceededError' ||
			e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
			e?.code === 22 ||
			e?.code === 1014;
		// Throttle Warnings: max 1× pro 30s, damit nicht spammed aber nicht ganz silent
		const now = Date.now();
		if (isQuota && now - lastQuotaWarn > 30_000) {
			lastQuotaWarn = now;
			try {
				toastStore.error(
					'Speicher voll: Backup exportieren oder alte Check-ins/Fotos löschen, sonst werden Änderungen nicht gespeichert',
				);
			} catch {
				// Store evtl. noch nicht bereit
			}
		} else if (!isQuota) {
			// Andere Fehler (z.B. SecurityError im Inkognito-Mode)
			try {
				toastStore.error('Speicher-Fehler: ' + (e?.name ?? 'unbekannt'));
			} catch {
				// ignore
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
