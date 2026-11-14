<script lang="ts">
	/**
	 * Geräte (v1.4.24) — Lampe + Abluft über die Raspberry-Pi-Bridge.
	 * Die App spricht kein Bluetooth: Status, Befehle und Verlauf laufen über Supabase.
	 * Freigegeben ist nur, was die Bridge für das Modell als sicher meldet (caps).
	 */
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n';
	import { devicesStore, INITIAL_DEVICES_STATE, pendingKey } from '$lib/stores/devices';
	import type { DeviceHistory, DeviceInfo, DevicesState } from '$lib/stores/devices';
	import { growStore, activeGrows } from '$lib/stores/grow';
	import type { Grow, GrowState } from '$lib/stores/grow';
	import { toastStore } from '$lib/stores/toast';
	import { calcVPD } from '$lib/data/science';
	import { classifyValue, targetFor } from '$lib/utils/phase-targets';
	import type { MetricKey } from '$lib/utils/phase-targets';
	import { currentPhasePosition } from '$lib/utils/phase';
	import { CHART_COLORS } from '$lib/utils/chart-colors';
	import { hapticLight, hapticSuccess, hapticError } from '$lib/utils/haptic';
	import { fillGaps, formatPairCode, linePath, nearestIndex, normalizePairCode, xAt, yAt, yDomain } from '$lib/utils/devices';
	import type { HistoryRange } from '$lib/utils/devices';
	import Skeleton from '$lib/components/Skeleton.svelte';

	type Tr = (key: string, params?: Record<string, string | number>) => string;
	type Metric = 'temp' | 'rh' | 'vpd';

	let tr = $state<Tr>((k) => k);
	let dev = $state<DevicesState>(INITIAL_DEVICES_STATE);
	let grows = $state<GrowState>({ grows: [], checkins: [] });
	let active = $state<Grow[]>([]);

	onMount(() => {
		const subs = [
			t.subscribe((v) => (tr = v)),
			devicesStore.subscribe((v) => (dev = v)),
			growStore.subscribe((v) => (grows = v)),
			activeGrows.subscribe((v) => (active = v)),
			devicesStore.start(),
		];
		return () => subs.forEach((u) => u());
	});

	let lamp = $derived(dev.devices.find((d) => d.kind === 'lamp') ?? null);
	let fan = $derived(dev.devices.find((d) => d.kind === 'fan') ?? null);

	// ─── Klima + Zielwerte ───────────────────────────────────────────────
	// Zielwerte kommen aus der Phase des zugeordneten Grows (bei genau einem aktiven Grow implizit).
	let grow = $derived(
		(dev.bridge?.growId ? active.find((g) => g.id === dev.bridge?.growId) : null) ?? (active.length === 1 ? active[0] : null),
	);
	let phase = $derived(grow ? currentPhasePosition(grow, grows.checkins).phase : null);
	let tempC = $derived(fan?.online ? fan.tempC : null);
	let rh = $derived(fan?.online ? fan.rh : null);
	let vpd = $derived(tempC !== null && rh !== null ? calcVPD(tempC, rh) : null);
	// Bei ausgeschaltetem Licht gelten die Tag-Zielwerte nicht → dann gar nicht bewerten.
	let lightsOff = $derived(lamp?.online === true && lamp.on === false);
	let vpdTarget = $derived(phase ? targetFor('vpd', phase) : null);
	let ratingHint = $derived.by(() => {
		if (!phase) return '';
		if (lightsOff) return tr('devices.no_rating_night');
		if (!vpdTarget) return tr('devices.no_rating_phase', { phase });
		return tr('devices.target', { min: vpdTarget.min, max: vpdTarget.max, phase });
	});

	function tone(metric: MetricKey, value: number | null): string {
		const c = value !== null && phase && !lightsOff ? classifyValue(metric, phase, value) : null;
		return c === 'in' ? 'text-gb-green' : c === 'low' ? 'text-gb-info' : c === 'high' ? 'text-gb-danger' : 'text-gb-text';
	}

	// ─── Steuerung ───────────────────────────────────────────────────────
	let drag = $state<Record<string, number>>({});

	function shownLevel(d: DeviceInfo): number {
		return drag[d.key] ?? dev.pending[pendingKey(d.key, 'level')]?.value ?? d.level ?? d.min;
	}

	function canControl(d: DeviceInfo): boolean {
		return d.online && d.linked && d.caps.level && !dev.error && dev.bridge?.online === true && dev.bridge.pausedS === 0;
	}

	const REASONS: Record<string, string> = {
		offline: 'devices.reason_offline',
		timeout: 'devices.reason_timeout',
		paused: 'devices.reason_paused',
		'no confirmation': 'devices.reason_noconfirm',
		'rate limit': 'devices.reason_rate',
		unsupported: 'devices.reason_unsupported',
	};

	async function commitLevel(d: DeviceInfo, value: number) {
		const rest = { ...drag };
		delete rest[d.key];
		drag = rest;
		hapticLight();
		const res = await devicesStore.send(d.key, 'level', value);
		if (res.ok) {
			hapticSuccess();
		} else if (res.reason !== 'superseded') {
			hapticError();
			const key = res.reason ? REASONS[res.reason] : undefined;
			toastStore.warning(tr('devices.cmd_failed', { reason: key ? tr(key) : (res.reason ?? '?') }));
		}
	}

	// ─── Kopplung ────────────────────────────────────────────────────────
	let code = $state('');
	let pairing = $state(false);
	let pairMsg = $state<string | null>(null);

	async function pair() {
		const c = normalizePairCode(code);
		if (c.length !== 8 || pairing) return;
		pairing = true;
		pairMsg = null;
		const res = await devicesStore.claim(c);
		pairing = false;
		if (res.ok) {
			code = '';
			hapticSuccess();
			toastStore.success(tr('devices.pair_ok'));
		} else {
			hapticError();
			pairMsg = tr(res.reason === 'invalid code' ? 'devices.pair_bad' : 'devices.cloud_error');
		}
	}

	// ─── Verlauf ─────────────────────────────────────────────────────────
	const BOX = { width: 320, height: 150, padX: 10, padTop: 12, padBottom: 20 };
	const METRICS: Record<Metric, { color: string; unit: string; digits: number; label: string }> = {
		temp: { color: CHART_COLORS.temp, unit: '°C', digits: 1, label: 'devices.metric_temp' },
		rh: { color: CHART_COLORS.rh, unit: '%', digits: 0, label: 'devices.metric_rh' },
		vpd: { color: CHART_COLORS.vpd, unit: ' kPa', digits: 2, label: 'devices.metric_vpd' },
	};
	const RANGES: HistoryRange[] = ['24h', '7d', '30d'];

	let range = $state<HistoryRange>('24h');
	let metric = $state<Metric>('temp');
	let hist = $state<DeviceHistory | null>(null);
	let hover = $state<number | null>(null);
	let bridgeId = $derived(dev.bridge?.id ?? null);
	let slot = $derived(Math.floor(dev.now / 300)); // alle 5 min kommt eine neue Zeile
	let histReq = 0;

	$effect(() => {
		const id = bridgeId;
		const r = range;
		void slot;
		if (!id) {
			hist = null;
			return;
		}
		const my = ++histReq;
		devicesStore.history(r).then((h) => {
			if (my === histReq) hist = h;
		});
	});

	let chart = $derived.by(() => {
		if (!hist) return null;
		const slots = fillGaps(hist.points, hist.fromS, hist.toS, hist.bucketS);
		const values = slots.map((p) => {
			if (!p) return null;
			if (metric === 'temp') return p.temp_c;
			if (metric === 'rh') return p.rh;
			return p.temp_c !== null && p.rh !== null ? calcVPD(p.temp_c, p.rh) : null;
		});
		const domain = yDomain(values);
		return { values, domain, path: domain ? linePath(values, domain, BOX) : '' };
	});

	function slotTime(i: number): number {
		return hist ? hist.fromS + i * hist.bucketS : 0;
	}

	function clock(s: number): string {
		return new Date(s * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
	}

	function day(s: number): string {
		return new Date(s * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
	}

	function axisLabel(i: number): string {
		return range === '24h' ? clock(slotTime(i)) : day(slotTime(i));
	}

	function pick(e: PointerEvent) {
		if (!chart) return;
		const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * BOX.width;
		hover = nearestIndex(chart.values, (x - BOX.padX) / (BOX.width - 2 * BOX.padX));
	}

	// ─── Bridge ──────────────────────────────────────────────────────────
	let confirmUnpair = $state(false);
	let busy = $state(false);

	async function run(action: () => Promise<{ ok: boolean }>) {
		if (busy) return;
		busy = true;
		hapticLight();
		const res = await action();
		busy = false;
		if (!res.ok) toastStore.warning(tr('devices.cloud_error'));
	}

	function lastSeenText(s: number): string {
		return dev.now - s > 86400 ? `${day(s)} ${clock(s)}` : clock(s);
	}
</script>

{#snippet deviceCard(d: DeviceInfo)}
	{@const pending = !!dev.pending[pendingKey(d.key, 'level')]}
	<div class="bg-gb-surface rounded-xl p-4 space-y-3 {d.online ? '' : 'opacity-60'}">
		<div class="flex items-center justify-between gap-2">
			<div class="min-w-0">
				<p class="font-semibold">{d.kind === 'lamp' ? '💡' : '🌀'} {tr(d.kind === 'lamp' ? 'devices.lamp' : 'devices.fan')}</p>
				<p class="text-xs text-gb-text-muted truncate">{d.model}{d.firmware ? ` · v${d.firmware}` : ''}</p>
			</div>
			{#if d.online && d.on !== null}
				<span class="text-xs px-2 py-1 rounded-full font-semibold shrink-0 {d.on ? 'bg-gb-green/15 text-gb-green' : 'bg-gb-surface-2 text-gb-text-muted'}">
					{#if d.kind === 'lamp'}{tr(d.on ? 'devices.on' : 'devices.off')}{:else}{tr(d.on ? 'devices.fan_running' : 'devices.fan_idle')}{/if}
				</span>
			{/if}
		</div>

		{#if !d.online}
			<p class="text-sm text-gb-text-muted">{tr('devices.dev_offline')}</p>
		{:else}
			<div>
				<div class="flex justify-between text-sm mb-2">
					<span class="text-gb-text-muted">{tr(d.kind === 'lamp' ? 'devices.brightness' : 'devices.fan_speed')}</span>
					<span class="font-medium">
						{shownLevel(d)}%{#if pending}<span class="text-xs text-gb-text-muted font-normal"> · {tr('devices.pending')}</span>{/if}
					</span>
				</div>
				{#if d.caps.level}
					<input type="range" min={d.min} max={d.max} step="1" value={shownLevel(d)}
						disabled={!canControl(d)}
						aria-label={tr(d.kind === 'lamp' ? 'devices.brightness' : 'devices.fan_speed')}
						oninput={(e) => (drag = { ...drag, [d.key]: Number(e.currentTarget.value) })}
						onchange={(e) => commitLevel(d, Number(e.currentTarget.value))}
						class="w-full accent-gb-green disabled:opacity-50" style="min-height:44px" />
				{:else}
					<div class="h-2 rounded-full bg-gb-surface-2 overflow-hidden">
						<div class="h-full bg-gb-green/60" style="width: {d.level ?? 0}%"></div>
					</div>
				{/if}
			</div>

			{#if d.kind === 'fan' && d.rpm !== null}
				<p class="text-xs text-gb-text-muted">{tr('devices.rpm', { rpm: d.rpm })}</p>
			{/if}

			{#if d.mode === 'cmd'}
				<p class="text-sm bg-gb-danger/10 border border-gb-danger/30 text-gb-danger rounded-lg p-3">
					⚠️ {tr(d.kind === 'lamp' ? 'devices.lamp_manual' : 'devices.fan_manual')}
				</p>
			{:else if d.mode === 'auto'}
				<p class="text-xs text-gb-green">✓ {tr(d.kind === 'lamp' ? 'devices.lamp_auto' : 'devices.fan_auto')}</p>
			{/if}

			{#if d.kind === 'lamp' && !d.caps.level}
				<p class="text-xs text-gb-text-muted">{tr('devices.lamp_locked')}</p>
			{:else if d.caps.level && !d.linked}
				<p class="text-xs text-gb-warning">{tr('devices.no_link')}</p>
			{/if}

			{#if d.clockSkewS !== null && Math.abs(d.clockSkewS) >= 120}
				<p class="text-xs text-gb-warning">⚠️ {tr('devices.clock_warn', { min: Math.round(Math.abs(d.clockSkewS) / 60) })}</p>
			{/if}
		{/if}
	</div>
{/snippet}

<div class="px-4 pt-6 max-w-lg mx-auto space-y-5 pb-24">
	<div>
		<a href="/tools" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; {tr('nav.tools')}</a>
		<h1 class="text-xl font-bold mt-2">{tr('devices.title')}</h1>
		<p class="text-gb-text-muted text-sm">{tr('devices.subtitle')}</p>
	</div>

	{#if dev.gate === 'loading' || (dev.gate === 'ok' && !dev.loaded)}
		<Skeleton lines={3} />
	{:else if dev.gate === 'login'}
		<div class="bg-gb-surface rounded-xl p-5 text-center space-y-3">
			<p class="text-sm text-gb-text-muted">{tr('devices.gate_login')}</p>
			<a href="/profile" class="inline-block bg-gb-green text-gb-bg font-semibold text-sm px-5 py-3 rounded-lg">{tr('devices.gate_login_btn')}</a>
		</div>
	{:else if dev.gate === 'local'}
		<div class="bg-gb-surface rounded-xl p-5 text-center space-y-3">
			<p class="text-sm text-gb-text-muted">{tr('devices.gate_local')}</p>
			<a href="/settings" class="inline-block bg-gb-surface-2 text-gb-text font-semibold text-sm px-5 py-3 rounded-lg">{tr('devices.gate_local_btn')}</a>
		</div>
	{:else if !dev.bridge && dev.error}
		<div class="bg-gb-danger/10 border border-gb-danger/30 rounded-xl p-4 text-sm text-gb-danger">{tr('devices.cloud_error')}</div>
	{:else if !dev.bridge}
		<!-- Kopplung -->
		<form class="bg-gb-surface rounded-xl p-5 space-y-3" onsubmit={(e) => { e.preventDefault(); pair(); }}>
			<div>
				<p class="font-semibold">{tr('devices.pair_title')}</p>
				<p class="text-sm text-gb-text-muted mt-1">{tr('devices.pair_hint')}</p>
			</div>
			<input type="text" value={formatPairCode(code)} oninput={(e) => { code = normalizePairCode(e.currentTarget.value); pairMsg = null; }}
				placeholder="ABCD-EFGH" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="9"
				aria-label={tr('devices.pair_title')}
				class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 text-center text-lg font-mono tracking-widest" style="min-height:48px" />
			{#if pairMsg}<p class="text-sm text-gb-danger">{pairMsg}</p>{/if}
			<button type="submit" disabled={normalizePairCode(code).length !== 8 || pairing}
				class="w-full bg-gb-green text-gb-bg font-semibold rounded-xl disabled:opacity-50" style="min-height:48px">
				{tr('devices.pair_btn')}
			</button>
		</form>
	{:else}
		{#if dev.error}
			<div class="bg-gb-danger/10 border border-gb-danger/30 rounded-xl p-3 text-sm text-gb-danger">{tr('devices.cloud_error')}</div>
		{/if}

		<!-- Bridge-Status -->
		<div class="flex items-center gap-2 text-sm">
			<span aria-hidden="true" class="w-2.5 h-2.5 rounded-full shrink-0 {dev.bridge.pausedS > 0 ? 'bg-gb-warning' : dev.bridge.online ? 'bg-gb-green' : 'bg-gb-danger'}"></span>
			<span class={dev.bridge.online ? 'text-gb-text-muted' : 'text-gb-danger'}>
				{#if dev.bridge.pausedS > 0}
					{tr('devices.paused', { min: Math.ceil(dev.bridge.pausedS / 60) })}
				{:else if dev.bridge.online}
					{tr('devices.bridge_online')}
				{:else if dev.bridge.lastSeen !== null}
					{tr('devices.bridge_offline', { t: lastSeenText(dev.bridge.lastSeen) })}
				{:else}
					{tr('devices.bridge_never')}
				{/if}
			</span>
		</div>

		<!-- Klima -->
		<div class="bg-gb-surface rounded-xl p-4">
			<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide mb-3">{tr('devices.climate')}</h2>
			{#if tempC !== null || rh !== null}
				<div class="grid grid-cols-3 gap-2 text-center">
					<div>
						<p class="text-2xl font-bold {tone('temp', tempC)}">{tempC !== null ? tempC.toFixed(1) : '–'}<span class="text-sm font-medium">°C</span></p>
						<p class="text-xs text-gb-text-muted">{tr('devices.metric_temp')}</p>
					</div>
					<div>
						<p class="text-2xl font-bold {tone('rh', rh)}">{rh !== null ? rh.toFixed(0) : '–'}<span class="text-sm font-medium">%</span></p>
						<p class="text-xs text-gb-text-muted">{tr('devices.metric_rh')}</p>
					</div>
					<div>
						<p class="text-2xl font-bold {tone('vpd', vpd)}">{vpd !== null ? vpd.toFixed(2) : '–'}<span class="text-sm font-medium ml-0.5">kPa</span></p>
						<p class="text-xs text-gb-text-muted">{tr('devices.metric_vpd')}</p>
					</div>
				</div>
				{#if ratingHint}<p class="text-xs text-gb-text-muted mt-3 text-center">{ratingHint}</p>{/if}
			{:else}
				<p class="text-sm text-gb-text-muted">{tr('devices.no_values')}</p>
			{/if}
		</div>

		{#if lamp}{@render deviceCard(lamp)}{/if}
		{#if fan}{@render deviceCard(fan)}{/if}

		<!-- Verlauf -->
		<div class="bg-gb-surface rounded-xl p-4 space-y-3">
			<div class="flex items-center justify-between gap-2">
				<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">{tr('devices.history')}</h2>
				<div class="flex gap-1">
					{#each RANGES as r}
						<button onclick={() => { range = r; hover = null; }}
							class="px-3 rounded-lg text-xs transition-colors {range === r ? 'bg-gb-green text-gb-bg font-semibold' : 'bg-gb-surface-2 text-gb-text-muted'}"
							style="min-height:36px">{tr(`devices.range_${r}`)}</button>
					{/each}
				</div>
			</div>
			<div class="grid grid-cols-3 gap-2">
				{#each Object.entries(METRICS) as [key, m]}
					<button onclick={() => { metric = key as Metric; hover = null; }}
						class="rounded-lg text-xs transition-colors {metric === key ? 'font-semibold text-gb-text' : 'text-gb-text-muted'} bg-gb-surface-2"
						style="min-height:40px; {metric === key ? `box-shadow: inset 0 -2px 0 ${m.color}` : ''}">{tr(m.label)}</button>
				{/each}
			</div>

			{#if chart?.domain}
				{@const m = METRICS[metric]}
				{@const n = chart.values.length}
				{@const hv = hover !== null ? chart.values[hover] : null}
				<div class="flex items-baseline justify-between text-xs text-gb-text-muted">
					<span>{chart.domain.max.toFixed(m.digits)}{m.unit}</span>
					{#if hover !== null && hv !== null}
						<span><span class="font-semibold" style="color: {m.color}">{hv.toFixed(m.digits)}{m.unit}</span> · {range === '24h' ? '' : day(slotTime(hover)) + ' '}{clock(slotTime(hover))}</span>
					{/if}
				</div>
				<svg viewBox="0 0 {BOX.width} {BOX.height}" class="w-full select-none touch-none" style="height: {BOX.height}px"
					role="img" aria-label="{tr('devices.history')}: {tr(m.label)}"
					onpointerdown={pick} onpointermove={(e) => { if (e.pointerType !== 'mouse' || e.buttons) pick(e); }}
					onpointerleave={() => (hover = null)} onpointercancel={() => (hover = null)}>
					<line x1={BOX.padX} x2={BOX.width - BOX.padX} y1={BOX.height - BOX.padBottom} y2={BOX.height - BOX.padBottom}
						stroke="currentColor" class="text-gb-border" stroke-width="1" />
					<path d={chart.path} fill="none" stroke={m.color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					{#if hover !== null && hv !== null}
						<line x1={xAt(hover, n, BOX)} x2={xAt(hover, n, BOX)} y1={BOX.padTop} y2={BOX.height - BOX.padBottom} stroke={m.color} stroke-width="1" opacity="0.4" />
						<circle cx={xAt(hover, n, BOX)} cy={yAt(hv, chart.domain, BOX)} r="4" fill={m.color} stroke={CHART_COLORS.bgStroke} stroke-width="2" />
					{/if}
					<text x={BOX.padX} y={BOX.height - 5} font-size="9" class="fill-gb-text-muted">{axisLabel(0)}</text>
					<text x={BOX.width / 2} y={BOX.height - 5} font-size="9" text-anchor="middle" class="fill-gb-text-muted">{axisLabel(Math.floor(n / 2))}</text>
					<text x={BOX.width - BOX.padX} y={BOX.height - 5} font-size="9" text-anchor="end" class="fill-gb-text-muted">{axisLabel(n - 1)}</text>
				</svg>
				<p class="text-xs text-gb-text-muted">{chart.domain.min.toFixed(m.digits)}{m.unit}</p>
			{:else if hist}
				<p class="text-sm text-gb-text-muted py-6 text-center">{tr('devices.history_empty')}</p>
			{:else}
				<div class="h-24 rounded-lg bg-gb-surface-2 animate-pulse"></div>
			{/if}
		</div>

		<!-- Bridge -->
		<div class="space-y-2">
			<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">{tr('devices.bridge')}</h2>
			<div class="bg-gb-surface rounded-xl p-4 space-y-4">
				{#if active.length > 1}
					<div>
						<label for="dev-grow" class="block text-xs text-gb-text-muted mb-1">{tr('devices.assign')}</label>
						<select id="dev-grow" value={dev.bridge.growId ?? ''} disabled={busy}
							onchange={(e) => { const v = e.currentTarget.value; run(() => devicesStore.assignGrow(v || null)); }}
							class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 text-sm" style="min-height:44px">
							<option value="">{tr('devices.assign_none')}</option>
							{#each active as g}<option value={g.id}>{g.name}</option>{/each}
						</select>
					</div>
				{/if}

				<div class="space-y-2">
					<p class="font-medium text-sm">{tr('devices.pause_title')}</p>
					<p class="text-xs text-gb-text-muted">{tr('devices.pause_hint')}</p>
					{#if dev.bridge.pausedS > 0}
						<button onclick={() => run(() => devicesStore.pause(0))} disabled={busy}
							class="w-full bg-gb-green text-gb-bg font-semibold rounded-xl text-sm disabled:opacity-50" style="min-height:44px">{tr('devices.resume')}</button>
					{:else}
						<button onclick={() => run(() => devicesStore.pause(10))} disabled={busy || !dev.bridge.online}
							class="w-full bg-gb-surface-2 text-gb-text font-medium rounded-xl text-sm disabled:opacity-50" style="min-height:44px">{tr('devices.pause_btn', { min: 10 })}</button>
					{/if}
					<p class="text-xs text-gb-text-dim">{tr('devices.emergency')}</p>
				</div>

				{#if (dev.bridge.buffered ?? 0) >= 3}
					<p class="text-xs text-gb-text-muted">{tr('devices.buffered', { n: dev.bridge.buffered ?? 0 })}</p>
				{/if}

				<button onclick={() => (confirmUnpair = true)} class="w-full text-gb-danger text-sm font-medium" style="min-height:44px">{tr('devices.unpair')}</button>
			</div>
		</div>
	{/if}
</div>

{#if confirmUnpair}
	<div class="fixed inset-0 bg-black/60 z-[200] flex items-end sm:items-center justify-center p-4"
		onclick={() => (confirmUnpair = false)}
		onkeydown={(e) => { if (e.key === 'Escape') confirmUnpair = false; }}
		role="presentation">
		<div class="bg-gb-surface w-full max-w-sm rounded-2xl p-5 space-y-4"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog" aria-modal="true" tabindex="-1">
			<div>
				<p class="font-semibold text-base">{tr('devices.unpair_title')}</p>
				<p class="text-sm text-gb-text-muted mt-2">{tr('devices.unpair_text')}</p>
			</div>
			<div class="flex gap-3 pt-1">
				<button onclick={() => (confirmUnpair = false)}
					class="flex-1 bg-gb-bg border border-gb-border text-gb-text font-medium rounded-xl" style="min-height:48px">{tr('general.cancel')}</button>
				<button onclick={() => { confirmUnpair = false; run(() => devicesStore.unpair()); }}
					class="flex-1 bg-gb-danger text-white font-medium rounded-xl" style="min-height:48px">{tr('devices.unpair')}</button>
			</div>
		</div>
	</div>
{/if}
