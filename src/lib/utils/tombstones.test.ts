import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory localStorage-Mock (vitest default = node, kein DOM)
const memStore = new Map<string, string>();
vi.stubGlobal('window', {});
vi.stubGlobal('localStorage', {
	getItem: (k: string) => memStore.get(k) ?? null,
	setItem: (k: string, v: string) => { memStore.set(k, v); },
	removeItem: (k: string) => { memStore.delete(k); },
	clear: () => memStore.clear(),
});

import { tombstones } from './tombstones';

beforeEach(() => {
	memStore.clear();
});

describe('tombstones', () => {
	it('initial leer', () => {
		expect(tombstones.get()).toEqual({ checkins: [], grows: [] });
	});

	it('addCheckin fügt einmalig hinzu (kein Duplikat)', () => {
		tombstones.addCheckin('c1');
		tombstones.addCheckin('c1');
		expect(tombstones.get().checkins).toEqual(['c1']);
	});

	it('addGrow funktioniert analog', () => {
		tombstones.addGrow('g1');
		tombstones.addGrow('g2');
		tombstones.addGrow('g1');
		expect(tombstones.get().grows).toEqual(['g1', 'g2']);
	});

	it('addCheckins batched, ignoriert Duplikate', () => {
		tombstones.addCheckin('c1');
		tombstones.addCheckins(['c1', 'c2', 'c3']);
		expect(tombstones.get().checkins).toEqual(['c1', 'c2', 'c3']);
	});

	it('addCheckins([]) no-op', () => {
		tombstones.addCheckin('c1');
		tombstones.addCheckins([]);
		expect(tombstones.get().checkins).toEqual(['c1']);
	});

	it('clearCheckins entfernt IDs', () => {
		tombstones.addCheckins(['c1', 'c2', 'c3']);
		tombstones.clearCheckins(['c1', 'c3']);
		expect(tombstones.get().checkins).toEqual(['c2']);
	});

	it('clearGrows analog', () => {
		tombstones.addGrow('g1');
		tombstones.addGrow('g2');
		tombstones.clearGrows(['g1']);
		expect(tombstones.get().grows).toEqual(['g2']);
	});

	it('isCheckinDeleted / isGrowDeleted', () => {
		tombstones.addCheckin('c1');
		tombstones.addGrow('g1');
		expect(tombstones.isCheckinDeleted('c1')).toBe(true);
		expect(tombstones.isCheckinDeleted('c2')).toBe(false);
		expect(tombstones.isGrowDeleted('g1')).toBe(true);
		expect(tombstones.isGrowDeleted('g2')).toBe(false);
	});

	it('clearAll setzt komplett zurück', () => {
		tombstones.addCheckin('c1');
		tombstones.addGrow('g1');
		tombstones.clearAll();
		expect(tombstones.get()).toEqual({ checkins: [], grows: [] });
	});

	it('get() ist defensive Copy — mutation am Ergebnis ändert State nicht', () => {
		tombstones.addCheckin('c1');
		const snap = tombstones.get();
		snap.checkins.push('c2');
		expect(tombstones.get().checkins).toEqual(['c1']);
	});

	it('persist über localStorage', () => {
		tombstones.addCheckin('c1');
		tombstones.addGrow('g1');
		const raw = localStorage.getItem('growbuddy_tombstones');
		expect(raw).toBeTruthy();
		const parsed = JSON.parse(raw!);
		expect(parsed).toEqual({ checkins: ['c1'], grows: ['g1'] });
	});

	it('robust gegen corruptes localStorage', () => {
		localStorage.setItem('growbuddy_tombstones', '{not valid json');
		expect(tombstones.get()).toEqual({ checkins: [], grows: [] });
		// Nach Lesen wieder schreibbar
		tombstones.addCheckin('c1');
		expect(tombstones.get().checkins).toEqual(['c1']);
	});

	it('robust gegen partielles Schema', () => {
		localStorage.setItem('growbuddy_tombstones', JSON.stringify({ checkins: 'not-array' }));
		expect(tombstones.get()).toEqual({ checkins: [], grows: [] });
	});
});
