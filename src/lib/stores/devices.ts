/**
 * Geräte-Store — Lampe/Abluft über die Raspberry-Pi-Bridge (v1.4.24).
 *
 * Die App spricht nie selbst Bluetooth: Die Bridge neben dem Zelt gleicht Status, Messwerte
 * und Befehle über Supabase-Funktionen ab (siehe supabase-schema.sql, Block GERÄTE-RELAY).
 * Quelle der Wahrheit ist die Datenbank → hier wird nichts lokal gespeichert.
 * Kein Cloud-Zugriff ohne Login und keiner im Nur-lokal-Modus.
 */

import { writable, get } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { authStore } from '$lib/stores/auth';
import { privacyStore } from '$lib/stores/privacy';
import { bridgeOnline, historyWindow, type HistoryPoint, type HistoryRange } from '$lib/utils/devices';

export type DeviceAction = 'power' | 'level';
export type DeviceGate = 'loading' | 'ok' | 'login' | 'local';

export interface DeviceInfo {
	key: string;
	kind: 'lamp' | 'fan';
	model: string;
	/** Bridge erreichbar UND Gerät meldet sich gerade (Status jünger als 30 s) */
	online: boolean;
	/** Bridge hat eine eigene Verbindung zum Gerät → Befehle möglich */
	linked: boolean;
	/** Lampe: an. Abluft: läuft gerade (die Automatik des Lüfters schaltet selbst). */
	on: boolean | null;
	level: number | null;
	/** "auto" = Zeitschaltung/Automatik des Geräts aktiv, "cmd" = abgeschaltet */
	mode: 'auto' | 'cmd' | null;
	firmware: string | null;
	min: number;
	max: number;
	/** Was die Bridge für dieses Modell freigibt (nur am echten Gerät bestätigte Befehle) */
	caps: { power: boolean; level: boolean };
	rpm: number | null;
	tempC: number | null;
	rh: number | null;
	clockSkewS: number | null;
}

export interface BridgeInfo {
	id: string;
	name: string;
	growId: string | null;
	lastSeen: number | null;
	online: boolean;
	/** Restsekunden der Bluetooth-Pause, 0 = läuft */
	pausedS: number;
	/** Messzeilen, die auf dem Pi noch auf Übertragung warten */
	buffered: number | null;
}

export interface PendingCommand {
	seq: number;
	id: string | null;
	value: number;
	since: number;
}

export interface DevicesState {
	gate: DeviceGate;
	loaded: boolean;
	error: string | null;
	/** DB-Zeit des letzten Abrufs (s) */
	now: number;
	bridge: BridgeInfo | null;
	devices: DeviceInfo[];
	/** Schlüssel: `${deviceKey}:${action}` */
	pending: Record<string, PendingCommand>;
}

export interface CommandResult {
	ok: boolean;
	reason?: string;
}

export interface DeviceHistory {
	points: HistoryPoint[];
	fromS: number;
	toS: number;
	bucketS: number;
}

export const INITIAL_DEVICES_STATE: DevicesState = {
	gate: 'loading',
	loaded: false,
	error: null,
	now: 0,
	bridge: null,
	devices: [],
	pending: {},
};

const POLL_MS = 3000;
const PENDING_TIMEOUT_MS = 25_000;

export function pendingKey(deviceKey: string, action: DeviceAction): string {
	return `${deviceKey}:${action}`;
}

function num(v: unknown): number | null {
	return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function mapDevice(raw: any, bridgeUp: boolean): DeviceInfo {
	const st = raw?.state ?? {};
	const kind: 'lamp' | 'fan' = raw?.kind === 'fan' ? 'fan' : 'lamp';
	return {
		key: String(raw?.device_key ?? ''),
		kind,
		model: String(st.model ?? raw?.name ?? ''),
		online: bridgeUp && st.online === true,
		linked: bridgeUp && st.linked === true,
		on: typeof st.on === 'boolean' ? st.on : null,
		level: num(st.level),
		mode: st.mode === 'auto' || st.mode === 'cmd' ? st.mode : null,
		firmware: typeof st.fw === 'string' ? st.fw : null,
		min: num(st.min) ?? (kind === 'fan' ? 25 : 10),
		max: num(st.max) ?? 100,
		caps: { power: st.caps?.power === true, level: st.caps?.level === true },
		rpm: num(st.rpm),
		tempC: num(st.temp_c),
		rh: num(st.rh),
		clockSkewS: num(st.clock_skew_s),
	};
}

function createDevicesStore() {
	const store = writable<DevicesState>(INITIAL_DEVICES_STATE);
	const { subscribe, update } = store;
	const resolvers = new Map<number, (r: CommandResult) => void>();
	const sending = new Map<string, Promise<void>>();
	let seq = 0;
	let userId: string | null = null;
	let authLoading = true;
	let localOnly = false;
	let inFlight = false;
	let watchers = 0;
	let timer: ReturnType<typeof setInterval> | null = null;

	function settle(s: number, result: CommandResult): void {
		resolvers.get(s)?.(result);
		resolvers.delete(s);
	}

	function applyGate(): void {
		const gate: DeviceGate = localOnly ? 'local' : authLoading ? 'loading' : userId ? 'ok' : 'login';
		const prev = get(store);
		if (prev.gate === gate) return;
		if (gate === 'ok') {
			update((s) => ({ ...s, gate }));
			if (watchers > 0) void refresh();
			return;
		}
		// Kein Zugriff mehr → nichts Altes anzeigen, offene Befehle beenden
		for (const p of Object.values(prev.pending)) settle(p.seq, { ok: false, reason: 'offline' });
		store.set({ ...INITIAL_DEVICES_STATE, gate });
	}

	authStore.subscribe((a) => {
		userId = a.user?.id ?? null;
		authLoading = a.loading;
		applyGate();
	});
	privacyStore.subscribe((p) => {
		localOnly = p.localOnly;
		applyGate();
	});

	function apply(data: any): void {
		const now = num(data?.now) ?? Date.now() / 1000;
		const b = data?.bridge ?? null;
		let bridge: BridgeInfo | null = null;
		let devices: DeviceInfo[] = [];
		if (b) {
			const lastSeen = num(b.last_seen);
			const pauseUntil = num(b.pause_until);
			const online = bridgeOnline(lastSeen, now);
			bridge = {
				id: String(b.id),
				name: String(b.name ?? ''),
				growId: typeof b.grow_id === 'string' ? b.grow_id : null,
				lastSeen,
				online,
				pausedS: pauseUntil !== null && pauseUntil > now ? Math.ceil(pauseUntil - now) : 0,
				buffered: num(b.info?.buffered),
			};
			devices = (Array.isArray(data.devices) ? data.devices : []).map((d: any) => mapDevice(d, online));
		}

		// Offene Befehle gegen die Rückmeldung der Bridge abgleichen
		const cmds = new Map<string, any>((Array.isArray(data?.commands) ? data.commands : []).map((c: any) => [String(c.id), c]));
		const before = get(store).pending;
		const done: Array<[string, PendingCommand, CommandResult]> = [];
		for (const [key, p] of Object.entries(before)) {
			const c = p.id ? cmds.get(p.id) : undefined;
			if (c?.status === 'done') done.push([key, p, { ok: true }]);
			else if (c?.status === 'failed') done.push([key, p, { ok: false, reason: String(c.error ?? 'failed') }]);
			else if (Date.now() - p.since > PENDING_TIMEOUT_MS) done.push([key, p, { ok: false, reason: 'timeout' }]);
		}
		update((s) => {
			const pending = { ...s.pending };
			for (const [key, p] of done) if (pending[key]?.seq === p.seq) delete pending[key];
			return { ...s, loaded: true, error: null, now, bridge, devices, pending };
		});
		for (const [, p, result] of done) settle(p.seq, result);
	}

	async function refresh(): Promise<void> {
		if (get(store).gate !== 'ok' || inFlight) return;
		inFlight = true;
		try {
			const { data, error } = await supabase.rpc('device_poll', { p_watch: true });
			if (get(store).gate !== 'ok') return; // inzwischen ausgeloggt oder Nur-lokal
			if (error) update((s) => ({ ...s, loaded: true, error: error.message }));
			else apply(data);
		} catch (e) {
			update((s) => ({ ...s, loaded: true, error: e instanceof Error ? e.message : String(e) }));
		} finally {
			inFlight = false;
		}
	}

	async function call(fn: string, params: Record<string, unknown>): Promise<CommandResult> {
		if (get(store).gate !== 'ok') return { ok: false, reason: 'gate' };
		try {
			const { error } = await supabase.rpc(fn, params);
			if (error) return { ok: false, reason: error.message };
		} catch (e) {
			return { ok: false, reason: e instanceof Error ? e.message : String(e) };
		}
		await refresh();
		return { ok: true };
	}

	function onVisible(): void {
		if (document.visibilityState !== 'hidden') void refresh();
	}

	return {
		subscribe,
		refresh,

		/** Abruf alle 3 s, solange die Seite offen und sichtbar ist. Rückgabe: Stop-Funktion. */
		start(): () => void {
			watchers++;
			if (watchers === 1 && typeof document !== 'undefined') {
				void refresh();
				timer = setInterval(onVisible, POLL_MS);
				document.addEventListener('visibilitychange', onVisible);
			}
			let stopped = false;
			return () => {
				if (stopped) return;
				stopped = true;
				watchers--;
				if (watchers === 0 && typeof document !== 'undefined') {
					if (timer) clearInterval(timer);
					timer = null;
					document.removeEventListener('visibilitychange', onVisible);
				}
			};
		},

		/** Bridge per Kopplungscode ans Konto binden. */
		claim(code: string): Promise<CommandResult> {
			return call('bridge_claim', { p_pair_code: code });
		},

		/**
		 * Befehl einreihen. Das Promise löst erst auf, wenn die Bridge ihn bestätigt oder abgelehnt hat
		 * (oder nach 25 s ohne Antwort). Ein neuer Befehl gleicher Art löst den alten ab ("superseded").
		 */
		async send(deviceKey: string, action: DeviceAction, value: number): Promise<CommandResult> {
			const s = get(store);
			if (s.gate !== 'ok' || !s.bridge) return { ok: false, reason: 'offline' };
			const key = pendingKey(deviceKey, action);
			const prev = s.pending[key];
			if (prev) settle(prev.seq, { ok: false, reason: 'superseded' });
			const mySeq = ++seq;
			const result = new Promise<CommandResult>((resolve) => resolvers.set(mySeq, resolve));
			update((st) => ({ ...st, pending: { ...st.pending, [key]: { seq: mySeq, id: null, value, since: Date.now() } } }));

			const fail = (reason: string) => {
				update((st) => {
					if (st.pending[key]?.seq !== mySeq) return st;
					const pending = { ...st.pending };
					delete pending[key];
					return { ...st, pending };
				});
				settle(mySeq, { ok: false, reason });
			};
			// Je Gerät/Aktion immer nur ein Aufruf gleichzeitig, sonst können sich schnelle Reglerwerte
			// im Netz überholen. Wer in der Warteschlange schon abgelöst wurde, sendet gar nicht erst.
			const bridgeId = s.bridge.id;
			const turn = (sending.get(key) ?? Promise.resolve()).then(async () => {
				if (get(store).pending[key]?.seq !== mySeq) return;
				try {
					const { data, error } = await supabase.rpc('device_command', {
						p_bridge: bridgeId,
						p_device_key: deviceKey,
						p_action: action,
						p_value: Math.round(value),
					});
					if (error) {
						fail(error.message);
						return;
					}
					update((st) =>
						st.pending[key]?.seq === mySeq
							? { ...st, pending: { ...st.pending, [key]: { ...st.pending[key], id: String(data) } } }
							: st,
					);
					void refresh();
				} catch (e) {
					fail(e instanceof Error ? e.message : String(e));
				}
			});
			sending.set(key, turn);
			return result;
		},

		/** Verlauf, serverseitig auf das Raster des Zeitraums verdichtet. */
		async history(range: HistoryRange): Promise<DeviceHistory | null> {
			const s = get(store);
			if (s.gate !== 'ok' || !s.bridge) return null;
			const w = historyWindow(s.now || Date.now() / 1000, range);
			try {
				const { data, error } = await supabase.rpc('device_history', {
					p_bridge: s.bridge.id,
					p_from: new Date(w.fromS * 1000).toISOString(),
					p_to: new Date(w.toS * 1000).toISOString(),
					p_bucket_s: w.bucketS,
				});
				if (error || !Array.isArray(data)) return null;
				return { points: data as HistoryPoint[], ...w };
			} catch {
				return null;
			}
		},

		/** Bluetooth für N Minuten freigeben (0 = fortsetzen). */
		pause(minutes: number): Promise<CommandResult> {
			const id = get(store).bridge?.id;
			return id ? call('device_pause', { p_bridge: id, p_minutes: minutes }) : Promise.resolve({ ok: false, reason: 'offline' });
		},

		assignGrow(growId: string | null): Promise<CommandResult> {
			const id = get(store).bridge?.id;
			return id ? call('device_assign_grow', { p_bridge: id, p_grow: growId }) : Promise.resolve({ ok: false, reason: 'offline' });
		},

		unpair(): Promise<CommandResult> {
			const id = get(store).bridge?.id;
			return id ? call('device_unpair', { p_bridge: id }) : Promise.resolve({ ok: false, reason: 'offline' });
		},
	};
}

export const devicesStore = createDevicesStore();
