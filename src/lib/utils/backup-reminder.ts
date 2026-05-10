/**
 * Backup-Reminder — schützt Tester vor Datenverlust.
 *
 * Logik:
 * - Bei mind. MIN_CHECKINS Check-ins UND letztem Export ≥ STALE_DAYS Tage her
 *   (oder noch nie exportiert) wird einmal pro REMINDER_COOLDOWN_DAYS ein Toast gezeigt.
 * - Beim Export wird `growbuddy_last_export` gesetzt (von profile/+page.svelte).
 * - Beim Toast-Zeigen wird `growbuddy_last_reminded` gesetzt (Cooldown-Schutz).
 *
 * Storage-Keys (separate, damit Backup-Datei sie nicht enthält):
 * - growbuddy_last_export   — ISO-Date des letzten Exports
 * - growbuddy_last_reminded — ISO-Date der letzten Toast-Anzeige
 */

const KEY_LAST_EXPORT = 'growbuddy_last_export';
const KEY_LAST_REMINDED = 'growbuddy_last_reminded';

const MIN_CHECKINS = 5;
const STALE_DAYS = 7;
const REMINDER_COOLDOWN_DAYS = 7;
const DAY_MS = 86400000;

/** Markiert den jetzigen Zeitpunkt als letzten erfolgreichen Export. */
export function markBackupDone(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(KEY_LAST_EXPORT, new Date().toISOString());
}

/**
 * Prüft ob ein Backup-Reminder-Toast jetzt gezeigt werden sollte.
 * Wenn `true`, sollte der Caller toast zeigen UND `markReminderShown()` rufen.
 */
export function shouldShowBackupReminder(checkinCount: number): boolean {
	if (typeof localStorage === 'undefined') return false;
	if (checkinCount < MIN_CHECKINS) return false;

	const now = Date.now();
	const lastReminded = parseIso(localStorage.getItem(KEY_LAST_REMINDED));
	if (lastReminded && now - lastReminded < REMINDER_COOLDOWN_DAYS * DAY_MS) {
		return false; // Cooldown noch aktiv
	}

	const lastExport = parseIso(localStorage.getItem(KEY_LAST_EXPORT));
	if (!lastExport) return true; // noch nie exportiert
	return now - lastExport >= STALE_DAYS * DAY_MS;
}

/** Cooldown-Marker setzen (verhindert Spam wenn User Toast ignoriert). */
export function markReminderShown(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(KEY_LAST_REMINDED, new Date().toISOString());
}

function parseIso(s: string | null): number | null {
	if (!s) return null;
	const t = new Date(s).getTime();
	return Number.isNaN(t) ? null : t;
}
