<script lang="ts">
	import { xpStore } from '$lib/stores/xp';
	import { getAllFeedLines, getFeedLine } from '$lib/calc/feedlines/registry';
	import type { FeedLine } from '$lib/calc/feedlines/types';
	import { getWochenForPhase } from '$lib/calc/feedlines/types';
	import { calculate } from '$lib/calc/nutrients';
	import type { CalcResult } from '$lib/calc/nutrients';

	const feedlines = getAllFeedLines();

	let feedlineId = $state('athena-pro');
	let phase = $state('Veg');
	let woche = $state(1);
	let tag = $state(1);
	let reservoir = $state(10);
	let faktorModus = $state<'Auto' | 'Manuell'>('Auto');
	let faktorManuell = $state(100);
	let calmagTyp = $state<'A' | 'B'>('A');
	let ecEinheit = $state<'mS/cm' | 'ppm500' | 'ppm700'>('mS/cm');
	let wasserprofil = $state('Mainz_Hechtsheim');
	let medium = $state<'hydro' | 'coco' | 'erde'>('coco');
	let hatRo = $state(true);

	let feedline = $derived(getFeedLine(feedlineId));
	let phasen = $derived(feedline ? feedline.phasen.map(p => p.name) : []);
	let wochen = $derived(feedline ? getWochenForPhase(feedline, phase) : []);

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
		<h1 class="text-xl font-bold">Düngerrechner</h1>
		<p class="text-gb-text-muted text-sm">Präzise Nährstoff-Berechnung</p>
	</div>

	<!-- Feedline Auswahl -->
	<div>
		<label class="block text-xs text-gb-text-muted mb-1">Düngerlinie</label>
		<select bind:value={feedlineId} class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm">
			{#each feedlines as fl}
				<option value={fl.id}>{fl.name} ({fl.hersteller})</option>
			{/each}
		</select>
	</div>

	<!-- Phase / Woche / Tag -->
	<div class="grid grid-cols-3 gap-3">
		<div>
			<label class="block text-xs text-gb-text-muted mb-1">Phase</label>
			<select bind:value={phase} class="w-full bg-gb-surface border border-gb-border rounded-lg px-2 py-2.5 text-sm">
				{#each phasen as p}
					<option value={p}>{p}</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="block text-xs text-gb-text-muted mb-1">Woche</label>
			<select bind:value={woche} class="w-full bg-gb-surface border border-gb-border rounded-lg px-2 py-2.5 text-sm">
				{#each wochen as w}
					<option value={w}>{w}</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="block text-xs text-gb-text-muted mb-1">Tag</label>
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
			<label class="block text-xs text-gb-text-muted mb-1">Reservoir (L)</label>
			<input type="number" bind:value={reservoir} min="1" max="1000" step="1"
				class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
		</div>
		<div>
			<label class="block text-xs text-gb-text-muted mb-1">Medium</label>
			<select bind:value={medium} class="w-full bg-gb-surface border border-gb-border rounded-lg px-2 py-2.5 text-sm">
				<option value="coco">Kokos</option>
				<option value="hydro">Hydro</option>
				<option value="erde">Erde</option>
			</select>
		</div>
	</div>

	<!-- RO Toggle -->
	<label class="flex items-center gap-3 bg-gb-surface rounded-lg px-3 py-3">
		<input type="checkbox" bind:checked={hatRo} class="accent-gb-green w-4 h-4" />
		<span class="text-sm">Osmose-Wasser vorhanden</span>
	</label>

	<!-- Faktor -->
	<div>
		<div class="flex items-center gap-3 mb-2">
			<label class="text-xs text-gb-text-muted">Faktor</label>
			<button
				onclick={() => faktorModus = faktorModus === 'Auto' ? 'Manuell' : 'Auto'}
				class="text-xs px-2 py-0.5 rounded {faktorModus === 'Auto' ? 'bg-gb-green/20 text-gb-green' : 'bg-gb-surface-2 text-gb-text-muted'}"
			>
				{faktorModus}
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
				<p class="text-xs text-gb-text-muted">EC Soll</p>
				<p class="text-2xl font-bold text-gb-green">{result.ec_soll}</p>
				<p class="text-xs text-gb-text-muted">{ecEinheit}</p>
			</div>
			<div class="bg-gb-surface rounded-xl p-4 text-center">
				<p class="text-xs text-gb-text-muted">pH Ziel</p>
				<p class="text-2xl font-bold text-gb-accent">{result.ph_ziel}</p>
			</div>
		</div>

		<!-- Faktor Info -->
		<div class="bg-gb-surface rounded-xl p-3 flex justify-between text-sm">
			<span class="text-gb-text-muted">Faktor</span>
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
			<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Dosierungen</h2>
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
			<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Mischreihenfolge</h2>
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
