/**
 * Backup/Restore Roundtrip-Tests.
 *
 * Sichert: Export → Import → identische localStorage-Daten.
 * Fokus auf Mary-Jane-Sprint: User darf Daten verlieren, wenn Backup kaputt ist.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { exportBackup, importBackup } from './backup';

// Simple localStorage Mock (jsdom-frei)
class MemStorage implements Storage {
	private store = new Map<string, string>();
	get length(): number { return this.store.size; }
	clear(): void { this.store.clear(); }
	getItem(key: string): string | null { return this.store.get(key) ?? null; }
	key(i: number): string | null { return Array.from(this.store.keys())[i] ?? null; }
	removeItem(key: string): void { this.store.delete(key); }
	setItem(key: string, value: string): void { this.store.set(key, String(value)); }
}

beforeEach(() => {
	(globalThis as any).localStorage = new MemStorage();
});

describe('Backup — Export/Import Roundtrip', () => {
	it('Export → Import: Daten unverändert', () => {
		const grows = { grows: [{ id: 'g1', name: 'Test' }], checkins: [] };
		const xp = { total_xp: 1234, events: [] };
		localStorage.setItem('growbuddy_grows', JSON.stringify(grows));
		localStorage.setItem('growbuddy_xp', JSON.stringify(xp));

		const json = exportBackup();
		expect(json).toContain('growbuddy_grows');
		expect(json).toContain('growbuddy_xp');

		// Cleare und re-importiere
		localStorage.clear();
		const result = importBackup(json);

		expect(result.success).toBe(true);
		expect(result.keys).toBe(2);
		expect(JSON.parse(localStorage.getItem('growbuddy_grows')!)).toEqual(grows);
		expect(JSON.parse(localStorage.getItem('growbuddy_xp')!)).toEqual(xp);
	});

	it('Export ohne Daten: leeres data-Objekt, valides JSON', () => {
		const json = exportBackup();
		const parsed = JSON.parse(json);
		expect(parsed.version).toBeDefined();
		expect(parsed.created_at).toBeDefined();
		expect(parsed.data).toEqual({});
	});

	it('Import: ungültiges JSON → success=false, error-Message', () => {
		const result = importBackup('das ist kein JSON');
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it('Import: JSON ohne version/data → success=false', () => {
		const result = importBackup('{"foo": "bar"}');
		expect(result.success).toBe(false);
		expect(result.error).toMatch(/Format/i);
	});

	it('Import: unbekannte Keys werden ignoriert (Whitelist-Schutz)', () => {
		const backup = {
			version: '1.0.0',
			created_at: new Date().toISOString(),
			data: {
				growbuddy_grows: { grows: [], checkins: [] },
				malicious_key: 'should-not-be-restored',
				another_unknown: { evil: true },
			},
		};
		localStorage.clear();
		const result = importBackup(JSON.stringify(backup));

		expect(result.success).toBe(true);
		expect(result.keys).toBe(1); // nur growbuddy_grows
		expect(localStorage.getItem('malicious_key')).toBeNull();
		expect(localStorage.getItem('another_unknown')).toBeNull();
	});

	it('Roundtrip mit allen BACKUP_KEYS: alle bekannten Keys werden restored', () => {
		const allKeys = {
			growbuddy_grows: { grows: [{ id: 'g1' }], checkins: [{ id: 'c1' }] },
			growbuddy_xp: { total_xp: 999 },
			growbuddy_pro: { is_pro: true },
			growbuddy_onboarding: { completed: true },
			growbuddy_reminders: { enabled: true, time: '19:00' },
			growbuddy_locale: 'de',
			growbuddy_drying_start: '2026-05-01',
			growbuddy_curing_start: '2026-05-08',
		};
		for (const [k, v] of Object.entries(allKeys)) {
			localStorage.setItem(k, JSON.stringify(v));
		}

		const json = exportBackup();
		localStorage.clear();
		const result = importBackup(json);

		expect(result.success).toBe(true);
		expect(result.keys).toBe(Object.keys(allKeys).length);
		for (const [k, v] of Object.entries(allKeys)) {
			const raw = localStorage.getItem(k)!;
			// String-Werte werden vom Backup als String restored (ohne JSON.stringify Wrapper)
			const restored = typeof v === 'string' ? raw : JSON.parse(raw);
			expect(restored).toEqual(v);
		}
	});

	it('Strings (nicht-JSON) werden auch korrekt restored', () => {
		// Falls jemand mal einen Key direkt als String speichert
		localStorage.setItem('growbuddy_locale', 'en');
		const json = exportBackup();
		localStorage.clear();
		const result = importBackup(json);
		expect(result.success).toBe(true);
		expect(localStorage.getItem('growbuddy_locale')).toBe('en');
	});
});
