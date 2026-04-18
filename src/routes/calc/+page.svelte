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

	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
	let userIsPro = $derived.by(() => { let v = false; isPro.subscribe(x => v = x)(); return v; });
	let lim = $derived.by(() => { let v: any = {}; limits.subscribe(x => v = x)(); return v; });
	const allFeedlines = getAllFeedLines();
	let feedlines = $derived(userIsPro ? allFeedlines : allFeedlines.slice(0, lim.max_feedlines ?? 2));

	let feedlineId = $state('athena-pro');
	let phase = $state('Veg');
	let woche = $state(1);
	let tag = $state(1);
	let reservoir = $state(10);
	let faktorModus = $state<'Auto' | 'Manuell'>('Auto');
	let faktorManuell = $state(100);
	let calmagTyp = $state<'A' | 'B'>('A');
	let ecEinheit = $state<'mS/cm' | 'ppm500' | 'ppm700'>('mS/cm');
	let wasserprofil = $state('Mainz Petersaue');
	let medium = $state<'hydro' | 'coco' | 'erde'>('coco');
	let hatRo = $state(false);
	// Custom Wasserprofil
	let customCa = $state(50);
	let customMg = $state(10);
	let customEc = $state(0.3);
	let customPh = $state(7.0);
	let isCustomWater = $derived(wasserprofil === 'Benutzerdefiniert');
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
			// Werte übernehmen
			wasserprofil = 'Benutzerdefiniert';
			customCa = Math.round(values.ca);
			customMg = Math.round(values.mg);
			customEc = Math.round(values.ec * 100) / 100;
			customPh = Math.round(values.ph * 10) / 10;
		} catch (e) {
			lookupError = e instanceof Error ? e.message : 'Fehler beim Abrufen';
		} finally {
			lookupLoading = false;
		}
	}

	let feedline = $derived(getFeedLine(feedlineId));
	let phasen = $derived(feedline ? feedline.phasen.map(p => p.name) : []);
	let wochen = $derived(feedline ? getWochenForPhase(feedline, phase) : []);

	// Phase/Woche Reset bei Feedline-Wechsel
	function switchFeedline(id: string) {
		feedlineId = id;
		const line = getFeedLine(id);
		if (line) {
			phase = line.phasen[0]?.name ?? 'Veg';
			woche = 1;
			tag = 1;
		}
	}

	let result: CalcResult | null = $state(null);
	let error: string | null = $state(null);
	let xpAwarded = false;

	$effect(() => {
		try {
			result = calculate({
				feedline_id: feedlineId,
				wasserprofil,
				phase,
				woche,
				tag,
				strain: '',
				reservoir_L: reservoir,
				faktor_modus: faktorModus,
				faktor_manuell: faktorManuell,
				calmag_typ: calmagTyp,
				ec_einheit: ecEinheit,
				medium,
				hat_ro: hatRo,
				custom_wasser: isCustomWater
					? { ca: customCa, mg: customMg, ec: customEc, ph: customPh }
					: undefined,
			});
			error = null;
			if (!xpAwarded) { xpAwarded = true; xpStore.awardCalcUse(); }
		} catch (e) {
			result = null;
			error = e instanceof Error ? e.message : String(e);
		}
	});
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-5">
	<div>
		<h1 class="text-xl font-bold">{tr('calc.title')}</h1>
		<p class="text-gb-text-muted text-sm">{tr('calc.subtitle')}</p>
	</div>

	<!-- Feedline Auswahl -->
	<div>
		<label class="block text-xs text-gb-text-muted mb-1">{tr('calc.feedline')}</label>
		<select value={feedlineId} onchange={(e) => switchFeedline(e.currentTarget.value)} class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm">
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
			<select bind:value={phase} class="w-full bg-gb-surface border border-gb-border rounded-lg px-2 py-2.5 text-sm">
				{#each phasen as p}
					<option value={p}>{p}</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="block text-xs text-gb-text-muted mb-1">{tr('calc.week')}</label>
			<select bind:value={woche} class="w-full bg-gb-surface border border-gb-border rounded-lg px-2 py-2.5 text-sm">
				{#each wochen as w}
					<option value={w}>{w}</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="block text-xs text-gb-text-muted mb-1">{tr('calc.day')}</label>
			<select bind:value={tag} class="w-full bg-gb-surface border border-gb-border rounded-lg px-2 py-2.5 text-sm">
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
			<input type="number" bind:value={reservoir} min="1" max="1000" step="1"
				class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
		</div>
		<div>
			<label class="block text-xs text-gb-text-muted mb-1">{tr('calc.medium')}</label>
			<select bind:value={medium} class="w-full bg-gb-surface border border-gb-border rounded-lg px-2 py-2.5 text-sm">
				<option value="coco">{tr('grow.medium_coco')}</option>
				<option value="hydro">{tr('grow.medium_hydro')}</option>
				<option value="erde">{tr('grow.medium_soil')}</option>
			</select>
		</div>
	</div>

	<!-- RO Toggle -->
	<label class="flex items-center gap-3 bg-gb-surface rounded-lg px-3 py-3">
		<input type="checkbox" bind:checked={hatRo} class="accent-gb-green w-4 h-4" />
		<span class="text-sm">{tr('calc.ro_water')}</span>
	</label>

	<!-- Wasserprofil / Standort -->
	<div class="space-y-3">
		<div>
			<label class="block text-xs text-gb-text-muted mb-1">{tr('calc.city_lookup')}</label>
			<div class="flex gap-2">
				<input type="text" bind:value={stadtInput} placeholder={tr('calc.city_placeholder')}
					onkeydown={(e) => { if (e.key === 'Enter') lookupCity(); }}
					class="flex-1 bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
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
			<select bind:value={wasserprofil} class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm">
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
				<input type="number" bind:value={customCa} min="0" max="300" step="1"
					class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
			</div>
			<div>
				<label class="block text-xs text-gb-text-muted mb-1">Mg (mg/L)</label>
				<input type="number" bind:value={customMg} min="0" max="100" step="1"
					class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
			</div>
			<div>
				<label class="block text-xs text-gb-text-muted mb-1">EC (mS/cm)</label>
				<input type="number" bind:value={customEc} min="0" max="3" step="0.01"
					class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
			</div>
			<div>
				<label class="block text-xs text-gb-text-muted mb-1">pH</label>
				<input type="number" bind:value={customPh} min="4" max="9" step="0.1"
					class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
			</div>
		</div>
		<p class="text-xs text-gb-text-muted -mt-3">{tr('calc.custom_water_hint')}</p>
	{/if}

	<!-- EC-Einheit Selector -->
	<div>
		<label class="block text-xs text-gb-text-muted mb-1">EC-Einheit</label>
		<div class="grid grid-cols-3 gap-2">
			{#each [{v:'mS/cm',l:'mS/cm'},{v:'ppm500',l:'ppm (500)'},{v:'ppm700',l:'ppm (700)'}] as opt}
				<button
					onclick={() => ecEinheit = opt.v as any}
					class="px-3 py-2 rounded-lg text-xs font-medium border {ecEinheit === opt.v ? 'bg-gb-green/20 border-gb-green text-gb-green' : 'bg-gb-surface border-gb-border text-gb-text-muted'}"
				>{opt.l}</button>
			{/each}
		</div>
	</div>

	<!-- Faktor -->
	<div>
		<div class="flex items-center gap-3 mb-2">
			<label class="text-xs text-gb-text-muted">{tr('calc.factor_label')}</label>
			<button
				onclick={() => faktorModus = faktorModus === 'Auto' ? 'Manuell' : 'Auto'}
				class="text-xs px-2 py-0.5 rounded {faktorModus === 'Auto' ? 'bg-gb-green/20 text-gb-green' : 'bg-gb-surface-2 text-gb-text-muted'}"
			>
				{faktorModus === 'Auto' ? tr('calc.auto') : tr('calc.manual')}
			</button>
		</div>
		{#if faktorModus === 'Manuell'}
			<input type="range" min="20" max="100" step="1" bind:value={faktorManuell}
				class="w-full accent-gb-green" />
			<p class="text-xs text-gb-text-muted text-right">{faktorManuell}%</p>
		{/if}
	</div>

	<!-- Error -->
	{#if error}
		<div class="bg-gb-danger/10 border border-gb-danger/20 rounded-lg p-3 text-sm text-gb-danger">
			{error}
		</div>
	{/if}

	<!-- Ergebnis -->
	{#if result}
		<!-- EC / pH Header -->
		<div class="grid grid-cols-2 gap-3">
			<div class="bg-gb-surface rounded-xl p-4 text-center">
				<p class="text-xs text-gb-text-muted">{tr('calc.ec_target')}</p>
				<p class="text-2xl font-bold text-gb-green">{result.ec_soll}</p>
				<p class="text-xs text-gb-text-muted">{ecEinheit}</p>
			</div>
			<div class="bg-gb-surface rounded-xl p-4 text-center">
				<p class="text-xs text-gb-text-muted">{tr('calc.ph_target')}</p>
				<p class="text-2xl font-bold text-gb-accent">{result.ph_ziel}</p>
			</div>
		</div>

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
	{/if}
</div>
