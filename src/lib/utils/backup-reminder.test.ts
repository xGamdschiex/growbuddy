/**
 * Backup-Reminder-Tests: Schwellwerte + Cooldown.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { shouldShowBackupReminder, markBackupDone, markReminderShown } from './backup-reminder';

class MemStorage implements Storage {
	private store = new Map<string, string>();
	get length(): number { return this.store.size; }
	clear(): void { this.store.clear(); }
	getItem(key: string): string | null { return this.store.get(key) ?? null; }
	key(i: number): string | null { return Array.from(this.store.keys())[i] ?? null; }
	removeItem(key: string): void { this.store.delete(key); }
	setItem(key: string, value: string): void { this.store.set(key, String(value)); }
}

const DAY_MS = 86400000;

beforeEach(() => {
	(globalThis as any).localStorage = new MemStorage();
});

describe('shouldShowBackupReminder — Schwellwerte', () => {
	it('weniger als 5 Check-ins: nie Toast', () => {
		expect(shouldShowBackupReminder(0)).toBe(false);
		expect(shouldShowBackupReminder(4)).toBe(false);
	});

	it('5+ Check-ins, kein Export: zeigt Toast', () => {
		expect(shouldShowBackupReminder(5)).toBe(true);
		expect(shouldShowBackupReminder(100)).toBe(true);
	});

	it('5+ Check-ins, Export gerade gemacht: kein Toast', () => {
		markBackupDone();
		expect(shouldShowBackupReminder(10)).toBe(false);
	});

	it('5+ Check-ins, Export vor 6 Tagen: kein Toast (unter Schwelle)', () => {
		const sixDaysAgo = new Date(Date.now() - 6 * DAY_MS).toISOString();
		localStorage.setItem('growbuddy_last_export', sixDaysAgo);
		expect(shouldShowBackupReminder(10)).toBe(false);
	});

	it('5+ Check-ins, Export vor 8 Tagen: zeigt Toast', () => {
		const eightDaysAgo = new Date(Date.now() - 8 * DAY_MS).toISOString();
		localStorage.setItem('growbuddy_last_export', eightDaysAgo);
		expect(shouldShowBackupReminder(10)).toBe(true);
	});
});

describe('shouldShowBackupReminder — Cooldown', () => {
	it('Toast gerade gezeigt: kein zweiter Toast (Cooldown aktiv)', () => {
		markReminderShown();
		expect(shouldShowBackupReminder(10)).toBe(false);
	});

	it('Toast vor 8 Tagen gezeigt: Cooldown abgelaufen, neuer Toast', () => {
		const eightDaysAgo = new Date(Date.now() - 8 * DAY_MS).toISOString();
		localStorage.setItem('growbuddy_last_reminded', eightDaysAgo);
		expect(shouldShowBackupReminder(10)).toBe(true);
	});

	it('markBackupDone setzt Export-Timestamp und unterbricht Reminder', () => {
		const eightDaysAgo = new Date(Date.now() - 8 * DAY_MS).toISOString();
		localStorage.setItem('growbuddy_last_export', eightDaysAgo);
		expect(shouldShowBackupReminder(10)).toBe(true);

		markBackupDone(); // setzt jetzigen Timestamp
		expect(shouldShowBackupReminder(10)).toBe(false);
	});
});

describe('shouldShowBackupReminder — Edge Cases', () => {
	it('kaputter ISO-String in last_export: behandelt wie nie-exportiert', () => {
		localStorage.setItem('growbuddy_last_export', 'kaputt');
		expect(shouldShowBackupReminder(10)).toBe(true);
	});

	it('kaputter ISO in last_reminded: kein Cooldown, Toast moeglich', () => {
		localStorage.setItem('growbuddy_last_reminded', 'kaputt');
		expect(shouldShowBackupReminder(10)).toBe(true);
	});
});
