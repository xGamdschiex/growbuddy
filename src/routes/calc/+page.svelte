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
	import { goto } from '$app/navigation';

	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
	let userIsPro = $derived.by(() => { let v = false; isPro.subscribe(x => v = x)(); return v; });
	let lim = $derived.by(() => { let v: any = {}; limits.subscribe(x => v = x)(); return v; });
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
		return strategy;
	}
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-5 pb-8">
	<div class="flex items-start justify-between">
		<div>
			<h1 class="text-xl font-bold">{tr('calc.title')}</h1>
			<p class="text-gb-text-muted text-sm">{tr('calc.subtitle')}</p>
		</div>
		<!-- Modus-Toggle: Einfach / Voll -->
		<button
			onclick={() => calcStore.toggleEinfach()}
			class="text-xs px-3 py-1.5 rounded-full border shrink-0 ml-3
				{calcState.einfach_modus ? 'bg-gb-green/20 border-gb-green text-gb-green' : 'bg-gb-surface border-gb-border text-gb-text-muted'}"
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
		<label class="block text-xs text-gb-text-muted mb-1">{tr('calc.feedline')}</label>
		<select value={calcState.feedline_id} onchange={(e) => switchFeedline(e.currentTarget.value)} class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm">
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

	<!-- Phase / Woche / Tag -->
	<div class="grid grid-cols-3 gap-3">
		<div>
			<label class="block text-xs text-gb-text-muted mb-1">{tr('calc.phase')}</label>
			<select value={calcState.phase} onchange={(e) => updateState({ phase: e.currentTarget.value, woche: 1 })} class="w-full bg-gb-surface border border-gb-border rounded-lg px-2 py-2.5 text-sm">
				{#each phasen as p}
					<option value={p}>{p}</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="block text-xs text-gb-text-muted mb-1">{tr('calc.week')}</label>
			<select value={calcState.woche} onchange={(e) => updateState({ woche: Number(e.currentTarget.value) })} class="w-full bg-gb-surface border border-gb-border rounded-lg px-2 py-2.5 text-sm">
				{#each wochen as w}
					<option value={w}>{w}</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="block text-xs text-gb-text-muted mb-1">{tr('calc.day')}</label>
			<select value={calcState.tag} onchange={(e) => updateState({ tag: Number(e.currentTarget.value) })} class="w-full bg-gb-surface border border-gb-border rounded-lg px-2 py-2.5 text-sm">
				{#each [1,2,3,4,5,6,7] as d}
					<option value={d}>{d}</option>
				{/each}
			</select>
		</div>
	</div>

	<!-- Reservoir + Medium -->
	<div class="grid grid-cols-2 gap-3">
		<div>
			<label class="block text-xs text-gb-text-muted mb-1">{tr('calc.reservoir')}</label>
			<input type="number" value={calcState.reservoir} oninput={(e) => updateState({ reservoir: Number(e.currentTarget.value) })} min="1" max="1000" step="1"
				class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
		</div>
		<div>
			<label class="block text-xs text-gb-text-muted mb-1">{tr('calc.medium')}</label>
			<select value={calcState.medium} onchange={(e) => updateState({ medium: e.currentTarget.value as any })} class="w-full bg-gb-surface border border-gb-border rounded-lg px-2 py-2.5 text-sm">
				<option value="coco">{tr('grow.medium_coco')}</option>
				<option value="hydro">{tr('grow.medium_hydro')}</option>
				<option value="erde">{tr('grow.medium_soil')}</option>
			</select>
		</div>
	</div>

	<!-- Anbausystem (nur im Voll-Modus ODER wenn nicht topf) -->
	{#if !calcState.einfach_modus || calcState.system !== 'topf'}
	<div>
		<label class="block text-xs text-gb-text-muted mb-1">{tr('calc.system_label')}</label>
		<div class="grid grid-cols-4 gap-2">
			{#each [
				{ val: 'topf', label: '🪴 Topf', pro: false },
				{ val: 'autopot', label: '💧 AutoPot', pro: true },
				{ val: 'dwc', label: '🫧 DWC', pro: true },
				{ val: 'rdwc', label: '♻️ RDWC', pro: true }
			] as opt}
				<button
					onclick={() => {
						if (opt.pro && !userIsPro) return;
						updateState({ system: opt.val as any });
					}}
					disabled={opt.pro && !userIsPro}
					class="px-2 py-2 rounded-lg text-xs font-medium border
						{calcState.system === opt.val ? 'bg-gb-green/20 border-gb-green text-gb-green' : 'bg-gb-surface border-gb-border text-gb-text-muted'}
						{opt.pro && !userIsPro ? 'opacity-50 cursor-not-allowed' : ''}"
				>{opt.label}</button>
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
	{#if !calcState.einfach_modus}
		<details class="bg-gb-surface/50 rounded-xl border border-gb-border" open>
			<summary class="px-4 py-3 text-sm font-medium cursor-pointer select-none">
				⚙️ {tr('calc.advanced_options')}
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
						<label class="block text-xs text-gb-text-muted mb-1">{tr('calc.city_lookup')}</label>
						<div class="flex gap-2">
							<input type="text" bind:value={stadtInput} placeholder={tr('calc.city_placeholder')}
								onkeydown={(e) => { if (e.key === 'Enter') lookupCity(); }}
								class="flex-1 bg-gb-bg border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
							<button onclick={lookupCity} disabled={lookupLoading || !stadtInput.trim()}
								class="bg-gb-green text-black font-semibold px-4 py-2.5 rounded-lg text-sm disabled:opacity-50 shrink-0">
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
						<label class="block text-xs text-gb-text-muted mb-1">{tr('calc.water_profile')}</label>
						<select value={calcState.wasserprofil} onchange={(e) => updateState({ wasserprofil: e.currentTarget.value })} class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 py-2.5 text-sm">
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
							<label class="block text-xs text-gb-text-muted mb-1">Ca (mg/L)</label>
							<input type="number" value={calcState.custom_ca} oninput={(e) => updateState({ custom_ca: Number(e.currentTarget.value) })} min="0" max="300" step="1"
								class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
						</div>
						<div>
							<label class="block text-xs text-gb-text-muted mb-1">Mg (mg/L)</label>
							<input type="number" value={calcState.custom_mg} oninput={(e) => updateState({ custom_mg: Number(e.currentTarget.value) })} min="0" max="100" step="1"
								class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
						</div>
						<div>
							<label class="block text-xs text-gb-text-muted mb-1">EC (mS/cm)</label>
							<input type="number" value={calcState.custom_ec} oninput={(e) => updateState({ custom_ec: Number(e.currentTarget.value) })} min="0" max="3" step="0.01"
								class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
						</div>
						<div>
							<label class="block text-xs text-gb-text-muted mb-1">pH</label>
							<input type="number" value={calcState.custom_ph} oninput={(e) => updateState({ custom_ph: Number(e.currentTarget.value) })} min="4" max="9" step="0.1"
								class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
						</div>
					</div>
					<p class="text-xs text-gb-text-muted -mt-2">{tr('calc.custom_water_hint')}</p>
				{/if}

				<!-- EC-Einheit Selector -->
				<div>
					<label class="block text-xs text-gb-text-muted mb-1">EC-Einheit</label>
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
						<label class="text-xs text-gb-text-muted">{tr('calc.factor_label')}</label>
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

		<!-- Apply als Check-in -->
		<button
			onclick={openApply}
			class="w-full bg-gb-green text-black font-semibold px-4 py-3.5 rounded-xl text-sm shadow-lg shadow-gb-green/20 active:scale-[0.98] transition-transform"
		>
			🧪 Nährlösung angemischt & gegeben
		</button>
		<p class="text-xs text-gb-text-muted text-center -mt-2">
			Legt automatisch einen Check-in mit Wasser- & Düngermengen an.
		</p>
	{/if}
</div>

<!-- Apply-Modal -->
{#if showApply}
	<div
		class="fixed inset-0 z-[60] bg-black/80 flex items-end sm:items-center justify-center px-4 pt-4 pb-24 sm:p-4"
		role="dialog"
		aria-modal="true"
		onclick={() => (showApply = false)}
		onkeydown={(e) => e.key === 'Escape' && (showApply = false)}
		tabindex="-1"
	>
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
				<label class="block text-xs text-gb-text-muted mb-1">Grow auswählen</label>
				<select
					bind:value={applyGrowId}
					class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 py-2.5 text-sm"
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

			<div class="flex gap-2">
				<button
					onclick={() => (showApply = false)}
					class="flex-1 bg-gb-surface-2 text-gb-text px-4 py-2.5 rounded-lg text-sm font-medium"
				>
					Abbrechen
				</button>
				<button
					onclick={applyAsCheckin}
					disabled={!applyGrowId}
					class="flex-1 bg-gb-green text-black px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
				>
					Anlegen
				</button>
			</div>
		</div>
	</div>
{/if}
