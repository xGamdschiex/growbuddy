/**
 * Geräte-Store Tests — Supabase ist gemockt (src/lib/supabase.ts braucht sonst Env-Variablen).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('$lib/supabase', () => ({ supabase: { rpc: h.rpc } }));
vi.mock('$lib/stores/auth', async () => {
	const { writable } = await import('svelte/store');
	return { authStore: writable({ user: null, session: null, loading: true }) };
});
vi.mock('$lib/stores/privacy', async () => {
	const { writable } = await import('svelte/store');
	return { privacyStore: writable({ localOnly: false }) };
});

import { authStore } from '$lib/stores/auth';
import { privacyStore } from '$lib/stores/privacy';
import { devicesStore, pendingKey } from './devices';

const auth = authStore as unknown as { set: (v: unknown) => void };
const privacy = privacyStore as unknown as { set: (v: unknown) => void };

const NOW = 1_800_000_000;
function poll(over: Record<string, unknown> = {}, commands: unknown[] = []) {
	return {
		data: {
			now: NOW,
			bridge: { id: 'b1', name: 'Zelt', grow_id: null, last_seen: NOW - 4, pause_until: null, info: { buffered: 0 } },
			devices: [
				{ device_key: 'L1', kind: 'lamp', name: 'MARS', state: { online: true, linked: true, on: true, level: 36, mode: 'auto', fw: '3.4', min: 10, max: 100, caps: { power: false, level: false }, model: 'MARS' } },
				{ device_key: 'F1', kind: 'fan', name: 'MZF002', state: { online: true, linked: true, on: true, level: 45, mode: 'auto', auto: true, rpm: 1800, temp_c: 24.5, rh: 58, caps: { power: false, level: true } } },
			],
			commands,
			...over,
		},
		error: null,
	};
}

function login() {
	auth.set({ user: { id: 'u1' }, session: {}, loading: false });
}

describe('devicesStore', () => {
	beforeEach(() => {
		h.rpc.mockReset();
		privacy.set({ localOnly: false });
		auth.set({ user: null, session: null, loading: false });
	});

	it('ohne Login: kein Cloud-Zugriff', async () => {
		expect(get(devicesStore).gate).toBe('login');
		await devicesStore.refresh();
		expect((await devicesStore.send('F1', 'level', 50)).ok).toBe(false);
		expect((await devicesStore.claim('ABCDEFGH')).ok).toBe(false);
		expect(await devicesStore.history('24h')).toBeNull();
		expect(h.rpc).not.toHaveBeenCalled();
	});

	it('Nur-lokal-Modus: kein Cloud-Zugriff, auch eingeloggt', async () => {
		login();
		privacy.set({ localOnly: true });
		expect(get(devicesStore).gate).toBe('local');
		await devicesStore.refresh();
		expect((await devicesStore.send('F1', 'level', 50)).ok).toBe(false);
		expect((await devicesStore.pause(10)).ok).toBe(false);
		expect(h.rpc).not.toHaveBeenCalled();
	});

	it('Wechsel in den Nur-lokal-Modus verwirft angezeigte Daten', async () => {
		login();
		h.rpc.mockResolvedValue(poll());
		await devicesStore.refresh();
		expect(get(devicesStore).bridge?.id).toBe('b1');
		privacy.set({ localOnly: true });
		expect(get(devicesStore).bridge).toBeNull();
		expect(get(devicesStore).devices).toEqual([]);
	});

	it('bildet den Abruf ab und meldet der Bridge, dass jemand zuschaut', async () => {
		login();
		h.rpc.mockResolvedValue(poll());
		await devicesStore.refresh();
		expect(h.rpc).toHaveBeenCalledWith('device_poll', { p_watch: true });
		const s = get(devicesStore);
		expect(s.bridge).toMatchObject({ id: 'b1', online: true, pausedS: 0 });
		const lamp = s.devices.find((d) => d.kind === 'lamp')!;
		const fan = s.devices.find((d) => d.kind === 'fan')!;
		expect(lamp).toMatchObject({ key: 'L1', online: true, linked: true, level: 36, mode: 'auto', firmware: '3.4', caps: { power: false, level: false } });
		expect(fan).toMatchObject({ tempC: 24.5, rh: 58, rpm: 1800, min: 25, mode: 'auto', caps: { power: false, level: true } });
	});

	it('Bridge offline → Geräte gelten als nicht erreichbar, auch wenn der letzte Status "online" sagt', async () => {
		login();
		h.rpc.mockResolvedValue(poll({ bridge: { id: 'b1', name: 'Zelt', last_seen: NOW - 600, pause_until: null, info: {} } }));
		await devicesStore.refresh();
		const s = get(devicesStore);
		expect(s.bridge?.online).toBe(false);
		expect(s.devices.every((d) => !d.online && !d.linked)).toBe(true);
	});

	it('Pause wird als Restzeit nach DB-Uhr geliefert', async () => {
		login();
		h.rpc.mockResolvedValue(poll({ bridge: { id: 'b1', name: 'Zelt', last_seen: NOW, pause_until: NOW + 300, info: {} } }));
		await devicesStore.refresh();
		expect(get(devicesStore).bridge?.pausedS).toBe(300);
	});

	it('Befehl: wartet auf die Bestätigung der Bridge', async () => {
		login();
		h.rpc.mockResolvedValueOnce(poll());
		await devicesStore.refresh();

		h.rpc.mockResolvedValueOnce({ data: 'cmd-1', error: null }); // device_command
		h.rpc.mockResolvedValueOnce(poll({}, [{ id: 'cmd-1', status: 'sent', error: null }])); // erster Abruf: unterwegs
		const result = devicesStore.send('F1', 'level', 45);
		await vi.waitFor(() => expect(get(devicesStore).pending[pendingKey('F1', 'level')]?.id).toBe('cmd-1'));
		expect(h.rpc).toHaveBeenCalledWith('device_command', { p_bridge: 'b1', p_device_key: 'F1', p_action: 'level', p_value: 45 });
		await vi.waitFor(() => expect(h.rpc).toHaveBeenCalledTimes(3));

		h.rpc.mockResolvedValueOnce(poll({}, [{ id: 'cmd-1', status: 'done', error: null }]));
		await devicesStore.refresh();
		expect(await result).toEqual({ ok: true });
		expect(get(devicesStore).pending).toEqual({});
	});

	it('Befehl: Ablehnung der Bridge kommt mit Grund zurück', async () => {
		login();
		h.rpc.mockResolvedValueOnce(poll());
		await devicesStore.refresh();
		h.rpc.mockResolvedValueOnce({ data: 'cmd-2', error: null });
		h.rpc.mockResolvedValueOnce(poll({}, [{ id: 'cmd-2', status: 'failed', error: 'no confirmation' }]));
		expect(await devicesStore.send('F1', 'level', 45)).toEqual({ ok: false, reason: 'no confirmation' });
		expect(get(devicesStore).pending).toEqual({});
	});

	it('Befehl: Fehler der Datenbank (z. B. nicht freigegeben) sofort zurück', async () => {
		login();
		h.rpc.mockResolvedValueOnce(poll());
		await devicesStore.refresh();
		h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'unsupported' } });
		expect(await devicesStore.send('L1', 'level', 50)).toEqual({ ok: false, reason: 'unsupported' });
		expect(get(devicesStore).pending).toEqual({});
	});

	it('neuer Reglerwert löst den noch offenen ab', async () => {
		login();
		h.rpc.mockResolvedValueOnce(poll());
		await devicesStore.refresh();
		h.rpc.mockResolvedValueOnce({ data: 'cmd-a', error: null });
		h.rpc.mockResolvedValue(poll({}, [{ id: 'cmd-a', status: 'sent', error: null }]));
		const first = devicesStore.send('F1', 'level', 40);
		await vi.waitFor(() => expect(get(devicesStore).pending[pendingKey('F1', 'level')]?.id).toBe('cmd-a'));
		h.rpc.mockResolvedValueOnce({ data: 'cmd-b', error: null });
		const second = devicesStore.send('F1', 'level', 50);
		expect(await first).toEqual({ ok: false, reason: 'superseded' });
		await vi.waitFor(() => expect(get(devicesStore).pending[pendingKey('F1', 'level')]?.id).toBe('cmd-b'));
		expect(get(devicesStore).pending[pendingKey('F1', 'level')].value).toBe(50);
		h.rpc.mockResolvedValue(poll({}, [{ id: 'cmd-b', status: 'done', error: null }]));
		await devicesStore.refresh();
		expect(await second).toEqual({ ok: true });
	});

	it('schnelle Reglerwerte: nacheinander senden, Zwischenwerte auslassen, der letzte gewinnt', async () => {
		login();
		h.rpc.mockResolvedValueOnce(poll());
		await devicesStore.refresh();

		const sent: number[] = [];
		let release: (v: unknown) => void = () => {};
		h.rpc.mockImplementation((fn: string, params: { p_value: number }) => {
			if (fn !== 'device_command') return Promise.resolve(poll({}, [{ id: 'cmd-45', status: 'done', error: null }]));
			sent.push(params.p_value);
			// erster Aufruf hängt im Netz, während der Regler weiterbewegt wird
			return sent.length === 1 ? new Promise((r) => (release = r)) : Promise.resolve({ data: `cmd-${params.p_value}`, error: null });
		});
		const results = [devicesStore.send('F1', 'level', 41)];
		await vi.waitFor(() => expect(sent).toEqual([41]));
		results.push(...[42, 43, 44, 45].map((v) => devicesStore.send('F1', 'level', v)));
		await new Promise((r) => setTimeout(r, 20));
		expect(sent).toEqual([41]); // solange der erste Aufruf läuft, geht nichts Weiteres raus
		release({ data: 'cmd-41', error: null });
		await vi.waitFor(() => expect(sent).toEqual([41, 45])); // 42–44 wurden nie gesendet
		const settled = await Promise.all(results); // der Abruf nach dem Senden meldet cmd-45 als erledigt
		expect(settled.slice(0, 4).every((r) => r.reason === 'superseded')).toBe(true);
		expect(settled[4]).toEqual({ ok: true });
		expect(get(devicesStore).pending).toEqual({});
	});

	it('Verlauf fragt ein am Raster ausgerichtetes Fenster ab', async () => {
		login();
		h.rpc.mockResolvedValueOnce(poll());
		await devicesStore.refresh();
		h.rpc.mockResolvedValueOnce({ data: [{ t: NOW - 300, temp_c: 24, rh: 55, fan_pct: 40, fan_rpm: 1700, lamp_pct: 60, lamp_on: true }], error: null });
		const hist = await devicesStore.history('24h');
		expect(hist).toMatchObject({ bucketS: 300, toS: NOW + 300, fromS: NOW + 300 - 86400 });
		expect(hist?.points).toHaveLength(1);
		expect(h.rpc).toHaveBeenLastCalledWith('device_history', {
			p_bridge: 'b1',
			p_from: new Date((NOW + 300 - 86400) * 1000).toISOString(),
			p_to: new Date((NOW + 300) * 1000).toISOString(),
			p_bucket_s: 300,
		});
	});

	it('Netzwerkfehler beim Abruf: Fehler anzeigen, Daten behalten', async () => {
		login();
		h.rpc.mockResolvedValueOnce(poll());
		await devicesStore.refresh();
		h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } });
		await devicesStore.refresh();
		const s = get(devicesStore);
		expect(s.error).toBe('Failed to fetch');
		expect(s.bridge?.id).toBe('b1');
	});

	it('koppeln, pausieren, entkoppeln rufen die passenden Funktionen', async () => {
		login();
		h.rpc.mockResolvedValue(poll());
		expect((await devicesStore.claim('ABCDEFGH')).ok).toBe(true);
		expect(h.rpc).toHaveBeenCalledWith('bridge_claim', { p_pair_code: 'ABCDEFGH' });
		await devicesStore.pause(10);
		expect(h.rpc).toHaveBeenCalledWith('device_pause', { p_bridge: 'b1', p_minutes: 10 });
		await devicesStore.assignGrow('g1');
		expect(h.rpc).toHaveBeenCalledWith('device_assign_grow', { p_bridge: 'b1', p_grow: 'g1' });
		await devicesStore.unpair();
		expect(h.rpc).toHaveBeenCalledWith('device_unpair', { p_bridge: 'b1' });
	});
});
