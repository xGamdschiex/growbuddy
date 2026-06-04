<script lang="ts">
	import { xpStore } from '$lib/stores/xp';
	import { t } from '$lib/i18n';
	import { isPro, limits } from '$lib/stores/pro';
	import { getAllFeedLines, getFeedLine } from '$lib/calc/feedlines/registry';
	import { WASSER_PROFILE } from '$lib/calc/schema';
	import type { FeedLine } from '$lib/calc/feedlines/types';
	import { getWochenForPhase } from '$lib/calc/feedlines/types';
	import { calculate } from '$lib/calc/nutrients';
	import type { CalcResult } from '$lib/calc/nutrients';
	import { lookupWaterValues, type WaterValues } from '$lib/utils/water-lookup';
	import { growStore } from '$lib/stores/grow';
	import { authStore } from '$lib/stores/auth';
	import { syncStore } from '$lib/stores/sync';
	import { toastStore } from '$lib/stores/toast';
	import { calcStore, type CalcState } from '$lib/stores/calc';
	import { hapticSuccess } from '$lib/utils/haptic';
	import { toMsPerCm } from '$lib/calc/units';
	import { currentPhasePosition } from '$lib/utils/phase';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let tr = $state<(k: string) => string>((k) => k);
	let userIsPro = $state(true);
	let lim = $state<any>({});

	onMount(() => {
		const subs = [
			t.subscribe(v => tr = v),
			isPro.subscribe(v => userIsPro = v),
			limits.subscribe(v => lim = v),
		];
		return () => subs.forEach(u => u());
	});
	const allFeedlines = getAllFeedLines();
	let feedlines = $derived(userIsPro ? allFeedlines : allFeedlines.slice(0, lim.max_feedlines ?? 2));

	// Calc-State aus Store laden & mit Store synchronisieren
	let calcState = $state<CalcState>({
		feedline_id: 'athena-pro', phase: 'Veg', woche: 1, tag: 1, reservoir: 10,
		medium: 'coco', system: 'topf', hat_ro: false, ec_einheit: 'mS/cm',
		wasserprofil: 'Mainz Petersaue',
		custom_ca: 50, custom_mg: 10, custom_ec: 0.3, custom_ph: 7.0,
		calmag_typ: 'A', faktor_modus: 'Auto', faktor_manuell: 100,
		einfach_modus: true, ever_used: false,
	});
	// Initial load
	$effect(() => {
		const unsub = calcStore.subscribe(s => { calcState = s; });
		return unsub;
	});

	function updateState(patch: Partial<CalcState>) {
		calcStore.patch(patch);
	}

	let isCustomWater = $derived(calcState.wasserprofil === 'Benutzerdefiniert');
	let stadtInput = $state('');
	let lookupLoading = $state(false);
	let lookupResult = $state<WaterValues | null>(null);
	let lookupError = $state('');

	async function lookupCity() {
		if (!stadtInput.trim()) return;
		lookupLoading = true;
		lookupError = '';
		lookupResult = null;
		try {
			const values = await lookupWaterValues(stadtInput.trim());
			lookupResult = values;
			updateState({
				wasserprofil: 'Benutzerdefiniert',
				custom_ca: Math.round(values.ca),
				custom_mg: Math.round(values.mg),
				custom_ec: Math.round(values.ec * 100) / 100,
				custom_ph: Math.round(values.ph * 10) / 10,
			});
		} catch (e) {
			lookupError = e instanceof Error ? e.message : 'Fehler beim Abrufen';
		} finally {
			lookupLoading = false;
		}
	}

	let feedline = $derived(getFeedLine(calcState.feedline_id));
	let phasen = $derived(feedline ? feedline.phasen.map(p => p.name) : []);
	let wochen = $derived(feedline ? getWochenForPhase(feedline, calcState.phase) : []);

	function switchFeedline(id: string) {
		const line = getFeedLine(id);
		if (line) {
			updateState({
				feedline_id: id,
				phase: line.phasen[0]?.name ?? 'Veg',
				woche: 1,
				tag: 1,
			});
		}
	}

	let result: CalcResult | null = $state(null);
	let error: string | null = $state(null);
	let xpAwarded = false;

	// Apply-Dialog State
	let growState = $state<any>({ grows: [], checkins: [] });
	$effect(() => growStore.subscribe(v => { growState = v; }));
	let activeGrows = $derived((growState?.grows ?? []).filter((g: any) => g.status === 'active'));
	let authUser = $state<any>(null);
	$effect(() => authStore.subscribe(a => { authUser = a?.user ?? null; }));

	// Auto-Fill: heutige Position im aktiven Grow (v1.3.34 — Lauri-Logik).
	// Berechnet aus phaseBoundaries: aktuelle Phase + heutiger W/T basierend auf Phase-Start.
	// Bei manuellem Override (User ändert phase/woche/tag selbst) → autoFill aus.
	let autoFillFromGrow = $state(true);
	$effect(() => {
		if (!autoFillFromGrow) return;
		const grow = activeGrows[0];
		if (!grow?.started_at) return;
		const checkins = (growState?.checkins ?? []) as any[];
		const pos = currentPhasePosition(grow, checkins);
		if (
			calcState.phase !== pos.phase ||
			calcState.woche !== pos.week ||
			calcState.tag !== pos.day
		) {
			updateState({ phase: pos.phase, woche: pos.week, tag: pos.day });
		}
	});

	let showApply = $state(false);
	let applyGrowId = $state<string>('');

	function openApply() {
		if (activeGrows.length === 0) {
			toastStore.error('Kein aktiver Grow — erstelle zuerst einen Grow');
			return;
		}
		applyGrowId = activeGrows[0].id;
		showApply = true;
	}

	function applyAsCheckin() {
		if (!result || !applyGrowId) return;
		const grow = activeGrows.find((g: any) => g.id === applyGrowId);
		if (!grow) return;

		const nutrient_ml = result.dosierungen
			.filter(d => d.product.einheit === 'mL')
			.reduce((sum, d) => sum + d.menge_tank, 0)
			+ (result.calmag.calmag_mL_total ?? 0)
			+ (result.calmag.mono_mg_mL_total ?? 0)
			+ (result.cleanse_mL_tank ?? 0);

		const gramProducts = result.dosierungen
			.filter(d => d.product.einheit === 'g')
			.map(d => `${d.product.name}: ${d.menge_tank}g`)
			.join(', ');
		const notes = [
			`🧪 ${result.feedline.name} ${calcState.phase} W${calcState.woche}T${calcState.tag}`,
			`EC-Soll: ${result.ec_soll} ${calcState.ec_einheit}, pH: ${result.ph_ziel}`,
			gramProducts ? `Pulver: ${gramProducts}` : '',
		].filter(Boolean).join(' · ');

		growStore.addCheckIn({
			grow_id: grow.id,
			phase: calcState.phase,
			week: calcState.woche,
			day: calcState.tag,
			photo_data: null,
			photos_data: [],
			temp: null,
			rh: null,
			vpd: null,
			ec_measured: result.ec_soll ? toMsPerCm(result.ec_soll, calcState.ec_einheit) : null,
			ph_measured: null,
			watered: true,
			nutrients_given: true,
			water_ml: Math.round(calcState.reservoir * 1000),
			nutrient_ml: Math.round(nutrient_ml * 10) / 10,
			training: null,
			notes,
		});

		hapticSuccess();
		toastStore.success('Check-in angelegt — Nährlösung dokumentiert');

		if (authUser) {
			syncStore.push(authUser.id, growState).catch(() => {});
		}

		showApply = false;
		setTimeout(() => goto(`/grow/${grow.id}`), 400);
	}

	// Effective total_weeks: User-Override > aktiver Grow Strain (flowering_weeks) > undefined (Schema-Default)
	let effectiveTotalWeeks = $derived.by(() => {
		// 1. Wenn User im Calc explizit eine Bloom-Dauer setzt → verwenden
		if (calcState.bloom_weeks && calcState.bloom_weeks > 0) return calcState.bloom_weeks;
		// 2. Wenn Auto-Fill vom aktiven Grow + Bloom-Phase → flowering_weeks vom ersten Strain holen
		if (autoFillFromGrow && calcState.phase === 'Bloom') {
			const grow = activeGrows[0];
			const entries = (grow?.strains ?? []) as Array<{ flowering_weeks?: number; plant_count?: number }>;
			if (entries.length > 0) {
				// Gewichteter Durchschnitt der flowering_weeks (Multi-Strain) — gerundet
				const total = entries.reduce((s, e) => s + (e.plant_count || 0), 0);
				if (total > 0) {
					const wAvg = entries.reduce((s, e) => s + (e.flowering_weeks ?? 0) * (e.plant_count || 0), 0) / total;
					if (wAvg > 0) return Math.round(wAvg);
				}
			}
		}
		return undefined; // Schema-Default verwenden
	});

	$effect(() => {
		try {
			result = calculate({
				feedline_id: calcState.feedline_id,
				wasserprofil: calcState.wasserprofil,
				phase: calcState.phase,
				woche: calcState.woche,
				tag: calcState.tag,
				strain: '',
				reservoir_L: calcState.reservoir,
				faktor_modus: calcState.faktor_modus,
				faktor_manuell: calcState.faktor_manuell,
				calmag_typ: calcState.calmag_typ,
				ec_einheit: calcState.ec_einheit,
				medium: calcState.medium,
				system: calcState.system,
				hat_ro: calcState.hat_ro,
				total_weeks: effectiveTotalWeeks,
				custom_wasser: isCustomWater
					? { ca: calcState.custom_ca, mg: calcState.custom_mg, ec: calcState.custom_ec, ph: calcState.custom_ph }
					: undefined,
			});
			error = null;
			if (!xpAwarded) { xpAwarded = true; xpStore.awardCalcUse(); }
			if (!calcState.ever_used) calcStore.markUsed();
		} catch (e) {
			result = null;
			error = e instanceof Error ? e.message : String(e);
		}
	});

	// Helper: Stretch-Strategie übersetzen
	function stretchLabel(strategy: string): string {
		if (strategy === 'repeat_last') return tr('calc.stretch_repeat_last');
		if (strategy === 'repeat_peak') return tr('calc.stretch_repeat_peak');
		if (strategy === 'hold_ec') return tr('calc.stretch_hold_ec');
		if (strategy === 'peak_held') return tr('calc.stretch_peak_held');
		if (strategy === 'fade_shifted') return tr('calc.stretch_fade_shifted');
		return strategy;
	}
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-5 pb-8">
	<div class="flex items-start justify-between">
		<div>
			<h1 class="text-xl font-bold">{tr('calc.title')}</h1>
			<p class="text-gb-text-muted text-sm">{tr('calc.subtitle')}</p>
		</div>
		<!-- Modus-Toggle: Einfach / Voll (v1.3.80: 24→44px Touch-Target — primärer State-Switcher) -->
		<button
			onclick={() => calcStore.toggleEinfach()}
			class="text-xs px-4 rounded-full border shrink-0 ml-3 flex items-center justify-center font-medium
				{calcState.einfach_modus ? 'bg-gb-green/20 border-gb-green text-gb-green' : 'bg-gb-surface border-gb-border text-gb-text-muted'}"
			style="min-height:44px"
			aria-label="Modus wechseln"
		>
			{calcState.einfach_modus ? '⚡ ' + tr('calc.einfach_modus') : '⚙️ ' + tr('calc.voll_modus')}
		</button>
	</div>

	{#if calcState.einfach_modus && !calcState.ever_used}
		<div class="bg-gb-green/10 border border-gb-green/20 rounded-xl p-3 text-xs text-gb-text-muted">
			<p class="font-medium text-gb-green mb-1">👋 {tr('calc.quickstart_title')}</p>
			<p>{tr('calc.quickstart_desc')}</p>
		</div>
	{/if}

	<!-- Feedline -->
	<div>
		<div class="flex items-baseline justify-between mb-1">
			<label for="calc-feedline" class="text-xs text-gb-text-muted">{tr('calc.feedline')}</label>
			<a href="/calc/schema?line={calcState.feedline_id}" class="text-[11px] text-gb-info hover:underline">📋 Schema-Tabelle</a>
		</div>
		<select id="calc-feedline" value={calcState.feedline_id} onchange={(e) => switchFeedline(e.currentTarget.value)} class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-3 text-sm">
			{#each feedlines as fl}
				<option value={fl.id}>{fl.name} ({fl.hersteller})</option>
			{/each}
		</select>
		{#if !userIsPro && allFeedlines.length > feedlines.length}
			<a href="/pro" class="block mt-2 text-xs text-gb-accent hover:underline">
				🔒 +{allFeedlines.length - feedlines.length} {tr('pro.feat_feedlines')} — {tr('grow.unlock_pro')}
			</a>
		{/if}
	</div>

	<!-- Phase / Woche / Tag (auto aus aktivem Grow, manuell überschreibbar) -->
	<div class="grid grid-cols-3 gap-3">
		<div>
			<label for="calc-phase" class="block text-xs text-gb-text-muted mb-1">{tr('calc.phase')}</label>
			<select id="calc-phase" value={calcState.phase} onchange={(e) => { autoFillFromGrow = false; updateState({ phase: e.currentTarget.value, woche: 1 }); }} class="w-full bg-gb-surface border border-gb-border rounded-lg px-2 py-3 text-sm">
				{#each phasen as p}
					<option value={p}>{p}</option>
				{/each}
			</select>
		</div>
		<div>
			<label for="calc-week" class="block text-xs text-gb-text-muted mb-1">{tr('calc.week')}</label>
			<select id="calc-week" value={calcState.woche} onchange={(e) => { autoFillFromGrow = false; updateState({ woche: Number(e.currentTarget.value) }); }} class="w-full bg-gb-surface border border-gb-border rounded-lg px-2 py-3 text-sm">
				{#each wochen as w}
					<option value={w}>{w}</option>
				{/each}
			</select>
		</div>
		<div>
			<label for="calc-day" class="block text-xs text-gb-text-muted mb-1">{tr('calc.day')}</label>
			<select id="calc-day" value={calcState.tag} onchange={(e) => { autoFillFromGrow = false; updateState({ tag: Number(e.currentTarget.value) }); }} class="w-full bg-gb-surface border border-gb-border rounded-lg px-2 py-3 text-sm">
				{#each [1,2,3,4,5,6,7] as d}
					<option value={d}>{d}</option>
				{/each}
			</select>
		</div>
	</div>
	{#if !autoFillFromGrow && activeGrows.length > 0}
		<button onclick={() => { autoFillFromGrow = true; }} class="text-[11px] text-gb-info hover:underline -mt-2 mb-1">
			↻ Wieder mit Grow synchronisieren
		</button>
	{/if}

	<!-- Bloom-Dauer (für Sativas/Hazes mit 10–13W Blüte) — nur in Bloom-Phase relevant -->
	{#if calcState.phase === 'Bloom' && feedline}
		{@const schemaWochen = feedline.phasen.find(p => p.name === 'Bloom')?.schema_wochen ?? 9}
		{@const maxWochen = feedline.phasen.find(p => p.name === 'Bloom')?.max_wochen ?? 12}
		<div class="bg-gb-surface rounded-lg p-3">
			<div class="flex items-baseline justify-between mb-1">
				<label for="calc-bloom-weeks" class="text-xs text-gb-text-muted">{tr('calc.total_weeks_label')}</label>
				<span class="text-[11px] text-gb-text-muted">Schema: {schemaWochen}W · Max: {maxWochen}W</span>
			</div>
			<div class="flex items-center gap-2">
				<input
					id="calc-bloom-weeks"
					type="range"
					min={schemaWochen}
					max={maxWochen}
					step="1"
					value={calcState.bloom_weeks || effectiveTotalWeeks || schemaWochen}
					oninput={(e) => updateState({ bloom_weeks: Number(e.currentTarget.value) })}
					class="flex-1 accent-gb-accent"
				/>
				<span class="text-sm font-semibold w-12 text-right">{calcState.bloom_weeks || effectiveTotalWeeks || schemaWochen}W</span>
			</div>
			<p class="text-[11px] text-gb-text-muted mt-1 leading-snug">{tr('calc.total_weeks_hint')}</p>
			{#if calcState.bloom_weeks && calcState.bloom_weeks > 0}
				<button onclick={() => updateState({ bloom_weeks: 0 })} class="text-[11px] text-gb-info hover:underline mt-1">
					↻ Auto (aus Grow/Schema)
				</button>
			{/if}
		</div>
	{/if}

	<!-- Reservoir + Medium -->
	<div class="grid grid-cols-2 gap-3">
		<div>
			<label for="calc-reservoir" class="block text-xs text-gb-text-muted mb-1">{tr('calc.reservoir')}</label>
			<input id="calc-reservoir" type="number" value={calcState.reservoir} oninput={(e) => updateState({ reservoir: Number(e.currentTarget.value) })} min="1" max="1000" step="1"
				class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-3 text-sm" />
		</div>
		<div>
			<label for="calc-medium" class="block text-xs text-gb-text-muted mb-1">{tr('calc.medium')}</label>
			<select id="calc-medium" value={calcState.medium} onchange={(e) => updateState({ medium: e.currentTarget.value as any })} class="w-full bg-gb-surface border border-gb-border rounded-lg px-2 py-3 text-sm">
				<option value="coco">{tr('grow.medium_coco')}</option>
				<option value="hydro">{tr('grow.medium_hydro')}</option>
				<option value="erde">{tr('grow.medium_soil')}</option>
			</select>
		</div>
	</div>

	<!-- Anbausystem (nur im Voll-Modus ODER wenn nicht topf) -->
	{#if !calcState.einfach_modus || calcState.system !== 'topf'}
	<div>
		<span class="block text-xs text-gb-text-muted mb-1">{tr('calc.system_label')}</span>
		<!-- v1.3.80: Pro-locked options bekommen 🔒-Prefix — sonst sieht User nur opacity-50 ohne Grund -->
		<div class="grid grid-cols-4 gap-2">
			{#each [
				{ val: 'topf', label: '🪴 Topf', pro: false },
				{ val: 'autopot', label: '💧 AutoPot', pro: true },
				{ val: 'dwc', label: '🫧 DWC', pro: true },
				{ val: 'rdwc', label: '♻️ RDWC', pro: true }
			] as opt}
				<button
					onclick={() => {
						if (opt.pro && !userIsPro) {
							goto('/pro');
							return;
						}
						updateState({ system: opt.val as any });
					}}
					class="px-2 py-2 rounded-lg text-xs font-medium border relative
						{calcState.system === opt.val ? 'bg-gb-green/20 border-gb-green text-gb-green' : 'bg-gb-surface border-gb-border text-gb-text-muted'}
						{opt.pro && !userIsPro ? 'opacity-60' : ''}"
					aria-label={opt.pro && !userIsPro ? `${opt.label} (Pro-Feature)` : opt.label}
				>
					{#if opt.pro && !userIsPro}
						<span class="absolute -top-1 -right-1 text-[10px] bg-gb-accent text-white rounded-full w-4 h-4 flex items-center justify-center" aria-hidden="true">🔒</span>
					{/if}
					{opt.label}
				</button>
			{/each}
		</div>
		{#if calcState.system !== 'topf'}
			<p class="text-xs text-gb-text-muted mt-1">
				{#if calcState.system === 'autopot'}{tr('calc.system_hint_autopot')}
				{:else if calcState.system === 'dwc'}{tr('calc.system_hint_dwc')}
				{:else if calcState.system === 'rdwc'}{tr('calc.system_hint_rdwc')}
				{/if}
			</p>
		{/if}
	</div>
	{/if}

	<!-- ═════ VOLL-MODUS ═════ -->
	<!-- v1.3.80: Custom Chevron-Marker statt Text-Hinweis; rotiert via CSS bei [open] -->
	{#if !calcState.einfach_modus}
		<details class="calc-advanced bg-gb-surface/50 rounded-xl border border-gb-border">
			<summary class="px-4 py-3 text-sm font-medium cursor-pointer select-none flex items-center justify-between gap-2"
				style="min-height:48px">
				<span>⚙️ {tr('calc.advanced_options')}</span>
				<span class="calc-chevron text-gb-text-muted text-base leading-none" aria-hidden="true">›</span>
			</summary>
			<div class="p-4 pt-0 space-y-5">

				<!-- RO Toggle -->
				<label class="flex items-center gap-3 bg-gb-bg rounded-lg px-3 py-3">
					<input type="checkbox" checked={calcState.hat_ro} onchange={(e) => updateState({ hat_ro: e.currentTarget.checked })} class="accent-gb-green w-4 h-4" />
					<span class="text-sm">{tr('calc.ro_water')}</span>
				</label>

				<!-- Wasserprofil / Standort -->
				<div class="space-y-3">
					<div>
						<label for="calc-city" class="block text-xs text-gb-text-muted mb-1">{tr('calc.city_lookup')}</label>
						<div class="flex gap-2">
							<input id="calc-city" type="text" bind:value={stadtInput} placeholder={tr('calc.city_placeholder')}
								onkeydown={(e) => { if (e.key === 'Enter') lookupCity(); }}
								class="flex-1 bg-gb-bg border border-gb-border rounded-lg px-3 py-3 text-sm" />
							<button onclick={lookupCity} disabled={lookupLoading || !stadtInput.trim()}
								class="bg-gb-green text-gb-bg font-semibold px-4 py-2.5 rounded-lg text-sm disabled:opacity-50 shrink-0">
								{lookupLoading ? '...' : tr('calc.lookup_btn')}
							</button>
						</div>
					</div>

					{#if lookupResult}
						<div class="bg-gb-green/10 border border-gb-green/20 rounded-lg p-3 text-sm">
							<p class="font-medium text-gb-green">{tr('calc.lookup_found')}</p>
							<p class="text-xs text-gb-text-muted mt-1">Ca: {lookupResult.ca} · Mg: {lookupResult.mg} · EC: {lookupResult.ec} · pH: {lookupResult.ph}</p>
							<p class="text-xs text-gb-text-muted">{lookupResult.source} {lookupResult.note ? `— ${lookupResult.note}` : ''}</p>
						</div>
					{/if}

					{#if lookupError}
						<p class="text-xs text-gb-danger">{lookupError}</p>
					{/if}

					<div>
						<label for="calc-waterprofile" class="block text-xs text-gb-text-muted mb-1">{tr('calc.water_profile')}</label>
						<select id="calc-waterprofile" value={calcState.wasserprofil} onchange={(e) => updateState({ wasserprofil: e.currentTarget.value })} class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 py-3 text-sm">
							{#each WASSER_PROFILE as p}
								<option value={p.name}>{p.name}</option>
							{/each}
							<option value="Benutzerdefiniert">{tr('calc.custom_water')}</option>
						</select>
					</div>
				</div>
				{#if isCustomWater}
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label for="calc-ca" class="block text-xs text-gb-text-muted mb-1">Ca (mg/L)</label>
							<input id="calc-ca" type="number" value={calcState.custom_ca} oninput={(e) => updateState({ custom_ca: Number(e.currentTarget.value) })} min="0" max="300" step="1"
								class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 py-3 text-sm" />
						</div>
						<div>
							<label for="calc-mg" class="block text-xs text-gb-text-muted mb-1">Mg (mg/L)</label>
							<input id="calc-mg" type="number" value={calcState.custom_mg} oninput={(e) => updateState({ custom_mg: Number(e.currentTarget.value) })} min="0" max="100" step="1"
								class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 py-3 text-sm" />
						</div>
						<div>
							<label for="calc-customec" class="block text-xs text-gb-text-muted mb-1">EC (mS/cm)</label>
							<input id="calc-customec" type="number" value={calcState.custom_ec} oninput={(e) => updateState({ custom_ec: Number(e.currentTarget.value) })} min="0" max="3" step="0.01"
								class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 py-3 text-sm" />
						</div>
						<div>
							<label for="calc-ph" class="block text-xs text-gb-text-muted mb-1">pH</label>
							<input id="calc-ph" type="number" value={calcState.custom_ph} oninput={(e) => updateState({ custom_ph: Number(e.currentTarget.value) })} min="4" max="9" step="0.1"
								class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 py-3 text-sm" />
						</div>
					</div>
					<p class="text-xs text-gb-text-muted -mt-2">{tr('calc.custom_water_hint')}</p>
				{/if}

				<!-- EC-Einheit Selector -->
				<div>
					<span class="block text-xs text-gb-text-muted mb-1">EC-Einheit</span>
					<div class="grid grid-cols-3 gap-2">
						{#each [{v:'mS/cm',l:'mS/cm'},{v:'ppm500',l:'ppm (500)'},{v:'ppm700',l:'ppm (700)'}] as opt}
							<button
								onclick={() => updateState({ ec_einheit: opt.v as any })}
								class="px-3 py-2 rounded-lg text-xs font-medium border {calcState.ec_einheit === opt.v ? 'bg-gb-green/20 border-gb-green text-gb-green' : 'bg-gb-bg border-gb-border text-gb-text-muted'}"
							>{opt.l}</button>
						{/each}
					</div>
				</div>

				<!-- Faktor -->
				<div>
					<div class="flex items-center gap-3 mb-2">
						<span class="text-xs text-gb-text-muted">{tr('calc.factor_label')}</span>
						<button
							onclick={() => updateState({ faktor_modus: calcState.faktor_modus === 'Auto' ? 'Manuell' : 'Auto' })}
							class="text-xs px-2 py-0.5 rounded {calcState.faktor_modus === 'Auto' ? 'bg-gb-green/20 text-gb-green' : 'bg-gb-surface-2 text-gb-text-muted'}"
						>
							{calcState.faktor_modus === 'Auto' ? tr('calc.auto') : tr('calc.manual')}
						</button>
					</div>
					{#if calcState.faktor_modus === 'Manuell'}
						<input type="range" min="20" max="100" step="1" value={calcState.faktor_manuell} oninput={(e) => updateState({ faktor_manuell: Number(e.currentTarget.value) })}
							class="w-full accent-gb-green" />
						<p class="text-xs text-gb-text-muted text-right">{calcState.faktor_manuell}%</p>
					{/if}
				</div>
			</div>
		</details>
	{/if}

	<!-- Error -->
	{#if error}
		<div class="bg-gb-danger/10 border border-gb-danger/20 rounded-lg p-3 text-sm text-gb-danger">
			{error}
		</div>
	{/if}

	<!-- Ergebnis -->
	{#if result}
		<!-- Stretch-Hinweis -->
		{#if result.stretch_info}
			<div class="bg-gb-accent/10 border border-gb-accent/20 rounded-lg p-3 text-xs text-gb-accent">
				ℹ️ {tr('calc.stretch_hint').replace('{requested}', String(result.stretch_info.requested_woche)).replace('{used}', String(result.stretch_info.used_woche)).replace('{strategy}', stretchLabel(result.stretch_info.strategy))}
			</div>
		{/if}

		<!-- EC / pH Header -->
		<div class="grid grid-cols-2 gap-3">
			<div class="bg-gb-surface rounded-xl p-4 text-center">
				<p class="text-xs text-gb-text-muted">{tr('calc.ec_target')}</p>
				<p class="text-2xl font-bold text-gb-green">{result.ec_soll}</p>
				<p class="text-xs text-gb-text-muted">{calcState.ec_einheit}</p>
			</div>
			<div class="bg-gb-surface rounded-xl p-4 text-center">
				<p class="text-xs text-gb-text-muted">{tr('calc.ph_target')}</p>
				<p class="text-2xl font-bold text-gb-accent">{result.ph_ziel}</p>
			</div>
		</div>

		<!-- EC-Richtwert bei organischen Lines -->
		{#if result.ec_ist_richtwert}
			<div class="bg-gb-warning/10 border border-gb-warning/20 rounded-lg p-3 text-xs text-gb-warning">
				⚠️ {tr('calc.ec_richtwert')}
			</div>
		{/if}

		<!-- Faktor Info -->
		<div class="bg-gb-surface rounded-xl p-3 flex justify-between text-sm">
			<span class="text-gb-text-muted">{tr('calc.factor_label')}</span>
			<span class="font-medium">{result.faktor_aktiv}%</span>
		</div>

		<!-- EC Budget Warnung -->
		{#if result.ec_budget_warnung}
			<div class="bg-gb-warning/10 border border-gb-warning/20 rounded-lg p-3 text-sm text-gb-warning">
				{result.ec_budget_warnung}
			</div>
		{/if}

		<!-- Dosierungen -->
		<div class="space-y-2">
			<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">{tr('calc.dosages')}</h2>
			{#each result.dosierungen as d}
				<div class="bg-gb-surface rounded-xl p-3 flex justify-between items-center">
					<div>
						<p class="font-medium text-sm">{d.product.name}</p>
						<p class="text-xs text-gb-text-muted">{d.menge_schema} {d.product.einheit}/{d.product.pro}</p>
					</div>
					<p class="text-lg font-bold text-gb-green">{d.display}</p>
				</div>
			{/each}

			<!-- Cleanse -->
			{#if result.cleanse_mL_tank > 0}
				<div class="bg-gb-surface rounded-xl p-3 flex justify-between items-center">
					<div>
						<p class="font-medium text-sm">Cleanse</p>
						<p class="text-xs text-gb-text-muted">{result.cleanse_mL_per_10L} mL/10L</p>
					</div>
					<p class="text-lg font-bold text-gb-green">{result.cleanse_mL_tank} mL</p>
				</div>
			{/if}

			<!-- CalMag -->
			{#if result.calmag.calmag_mL_total > 0}
				<div class="bg-gb-surface rounded-xl p-3 flex justify-between items-center">
					<div>
						<p class="font-medium text-sm">CalMag</p>
						<p class="text-xs text-gb-text-muted">{result.calmag.calmag_mLpL} mL/L</p>
					</div>
					<p class="text-lg font-bold text-gb-accent">{result.calmag.calmag_mL_total} mL</p>
				</div>
			{/if}
		</div>

		<!-- Mix Steps -->
		<div class="space-y-2">
			<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">{tr('calc.mix_order')}</h2>
			{#each result.mix_steps as step}
				<div class="bg-gb-surface rounded-xl p-3 flex items-start gap-3">
					<span class="bg-gb-green/20 text-gb-green text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">{step.nr}</span>
					<div class="flex-1 min-w-0">
						<p class="font-medium text-sm">{step.label}</p>
						<p class="text-xs text-gb-text-muted">{step.detail}</p>
					</div>
					<p class="text-sm font-medium text-gb-text shrink-0">{step.menge}</p>
				</div>
			{/each}
		</div>

		<!-- Apply als Check-in (v1.3.80: Hint VOR dem Button als Beschreibung statt awkward -mt-2 darunter) -->
		<div class="space-y-2 pt-1">
			<p class="text-xs text-gb-text-muted text-center px-2">
				Tippe um automatisch einen Check-in mit Wasser- &amp; Düngermengen für deinen aktiven Grow anzulegen.
			</p>
			<button
				onclick={openApply}
				class="w-full bg-gb-green text-gb-bg font-semibold px-4 py-3.5 rounded-xl text-sm shadow-lg shadow-gb-green/20 active:scale-[0.98] transition-transform"
			>
				🧪 Nährlösung angemischt &amp; gegeben
			</button>
		</div>
	{/if}
</div>

<!-- Apply-Modal -->
{#if showApply}
	<div
		class="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center px-4 pt-4 pb-24 sm:p-4"
		role="dialog"
		aria-modal="true"
		onclick={() => (showApply = false)}
		onkeydown={(e) => e.key === 'Escape' && (showApply = false)}
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="bg-gb-surface rounded-2xl p-5 w-full max-w-sm space-y-4 border border-gb-border max-h-[85vh] overflow-y-auto"
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<div>
				<h3 class="font-bold text-lg">Als Check-in anlegen</h3>
				<p class="text-xs text-gb-text-muted mt-1">
					Ein Check-in wird für den gewählten Grow erstellt — mit Wassermenge, Düngermenge und Schema-Notiz.
				</p>
			</div>

			<div>
				<label for="calc-applygrow" class="block text-xs text-gb-text-muted mb-1">Grow auswählen</label>
				<select
					id="calc-applygrow"
					bind:value={applyGrowId}
					class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 py-3 text-sm"
				>
					{#each activeGrows as g}
						<option value={g.id}>{g.name || g.strain} — {g.phase}</option>
					{/each}
				</select>
			</div>

			<div class="bg-gb-bg rounded-lg p-3 text-xs space-y-1">
				<div class="flex justify-between"><span class="text-gb-text-muted">Wasser:</span><span class="font-medium">{calcState.reservoir} L</span></div>
				<div class="flex justify-between"><span class="text-gb-text-muted">EC-Soll:</span><span class="font-medium">{result?.ec_soll} {calcState.ec_einheit}</span></div>
				<div class="flex justify-between"><span class="text-gb-text-muted">pH-Ziel:</span><span class="font-medium">{result?.ph_ziel}</span></div>
				<div class="flex justify-between"><span class="text-gb-text-muted">Phase/Woche/Tag:</span><span class="font-medium">{calcState.phase} W{calcState.woche}T{calcState.tag}</span></div>
			</div>

			<!-- v1.3.80: Modal-Buttons auf 44px (Konsistenz zu CheckInForm v1.3.79) -->
			<div class="flex gap-2">
				<button
					onclick={() => (showApply = false)}
					class="flex-1 bg-gb-surface-2 text-gb-text px-4 rounded-lg text-sm font-medium"
					style="min-height:44px"
				>
					Abbrechen
				</button>
				<button
					onclick={applyAsCheckin}
					disabled={!applyGrowId}
					class="flex-1 bg-gb-green text-gb-bg px-4 rounded-lg text-sm font-semibold disabled:opacity-50"
					style="min-height:44px"
				>
					Anlegen
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* v1.3.80: Custom-Chevron für die Voll-Modus details/summary — rotiert bei [open] */
	.calc-advanced summary::-webkit-details-marker { display: none; }
	.calc-advanced summary { list-style: none; }
	.calc-chevron {
		display: inline-block;
		transition: transform 0.2s ease;
	}
	.calc-advanced[open] .calc-chevron {
		transform: rotate(90deg);
	}
</style>
