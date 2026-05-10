<script lang="ts">
	/**
	 * Grow-Stats-Sub-Page: vollstaendige Detail-Statistiken pro Grow.
	 * Aufgerufen von grow/[id] via "Vollstaendige Statistik" Link.
	 *
	 * Reuse: src/lib/utils/grow-stats.ts (pure functions, getestet).
	 */
	import { page } from '$app/stores';
	import { growStore } from '$lib/stores/grow';
	import type { CheckIn } from '$lib/stores/grow';
	import { phaseDaysSummary } from '$lib/utils/phase';
	import {
		metricStats,
		metricPerPhase,
		stressDays,
		checkinConsistency,
		type MetricStats,
	} from '$lib/utils/grow-stats';
	import { onMount } from 'svelte';

	let growId = $derived($page.params.id);
	let growState = $state<any>({ grows: [], checkins: [] });
	let grow = $derived(growState?.grows?.find((g: any) => g.id === growId));

	onMount(() => growStore.subscribe(v => growState = v));

	// Chrono-sortierte Check-ins dieses Grows
	let chronCheckins = $derived(
		(growState?.checkins ?? [])
			.filter((c: CheckIn) => c.grow_id === growId)
			.sort((a: CheckIn, b: CheckIn) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
	);

	// Phase-Targets fuer VPD-Stress-Berechnung (gleich wie auf grow/[id])
	const VPD_TARGETS = {
		Veg: { min: 0.8, max: 1.2 },
		Bloom: { min: 1.2, max: 1.5 },
		Flush: { min: 1.0, max: 1.4 },
	} as const;

	let tempStats: MetricStats = $derived(metricStats(chronCheckins.map((c: CheckIn) => c.temp)));
	let rhStats: MetricStats = $derived(metricStats(chronCheckins.map((c: CheckIn) => c.rh)));
	let vpdStats: MetricStats = $derived(metricStats(chronCheckins.map((c: CheckIn) => c.vpd)));
	let ecStats: MetricStats = $derived(metricStats(chronCheckins.map((c: CheckIn) => c.ec_measured)));
	let phStats: MetricStats = $derived(metricStats(chronCheckins.map((c: CheckIn) => c.ph_measured)));
	let tempPerPhase = $derived(metricPerPhase(chronCheckins, 'temp'));
	let rhPerPhase = $derived(metricPerPhase(chronCheckins, 'rh'));
	let vpdPerPhase = $derived(metricPerPhase(chronCheckins, 'vpd'));
	let ecPerPhase = $derived(metricPerPhase(chronCheckins, 'ec_measured'));
	let phPerPhase = $derived(metricPerPhase(chronCheckins, 'ph_measured'));

	let vpdStress = $derived(stressDays(chronCheckins, 'vpd', VPD_TARGETS));
	let consistency = $derived(grow ? checkinConsistency(chronCheckins, grow.started_at) : null);

	let totalWaterMl = $derived(
		chronCheckins.filter((c: CheckIn) => c.water_ml != null).reduce((s: number, c: CheckIn) => s + (c.water_ml as number), 0)
	);
	let totalNutrientMl = $derived(
		chronCheckins.filter((c: CheckIn) => c.nutrient_ml != null).reduce((s: number, c: CheckIn) => s + (c.nutrient_ml as number), 0)
	);
	let nutrientCheckins = $derived(
		chronCheckins.filter((c: CheckIn) => c.nutrient_ml != null && (c.nutrient_ml as number) > 0).length
	);

	let phaseDays = $derived(grow ? phaseDaysSummary(grow, chronCheckins) : []);
	let allPhases = $derived(Array.from(new Set([
		...Object.keys(tempPerPhase), ...Object.keys(rhPerPhase),
		...Object.keys(vpdPerPhase), ...Object.keys(ecPerPhase), ...Object.keys(phPerPhase),
	])));
</script>

<svelte:head><title>Statistik · {grow?.name ?? 'Grow'}</title></svelte:head>

<div class="px-4 pt-6 max-w-lg mx-auto pb-24 space-y-5">
	{#if !grow}
		<a href="/grow" class="text-gb-text-muted text-sm">&larr; Grows</a>
		<p class="text-gb-text-muted text-sm bg-gb-surface rounded-xl p-4 text-center">
			Grow nicht gefunden.
		</p>
	{:else}
		<div>
			<a href="/grow/{grow.id}" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; {grow.name}</a>
			<h1 class="text-2xl font-bold mt-1">📊 Statistik</h1>
			<p class="text-xs text-gb-text-muted mt-1">{chronCheckins.length} Check-in{chronCheckins.length !== 1 ? 's' : ''} ausgewertet</p>
		</div>

		{#if chronCheckins.length === 0}
			<div class="bg-gb-surface rounded-xl p-6 text-center">
				<p class="text-3xl mb-3">📈</p>
				<p class="text-sm text-gb-text-muted">Noch keine Daten — leg ein paar Check-ins an, dann erscheint hier deine Auswertung.</p>
			</div>
		{:else}
			<!-- Health-Card (volle Breite, prominent) -->
			{#if consistency}
				<div class="bg-gb-surface rounded-xl p-4 space-y-3">
					<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Health</h2>
					<div class="grid grid-cols-3 gap-2">
						<div class="text-center">
							<p class="text-2xl font-bold {consistency.percent !== null && consistency.percent >= 80 ? 'text-gb-green' : consistency.percent !== null && consistency.percent >= 50 ? 'text-gb-warning' : 'text-gb-text-muted'}">
								{consistency.percent ?? '—'}{consistency.percent !== null ? '%' : ''}
							</p>
							<p class="text-[10px] text-gb-text-muted leading-tight mt-0.5">Konsistenz<br/><span class="text-[9px]">{consistency.daysWithCheckin}/{consistency.totalDays} Tage</span></p>
						</div>
						<div class="text-center">
							{#if vpdStress.total > 0}
								<p class="text-2xl font-bold {vpdStress.okPercent !== null && vpdStress.okPercent >= 70 ? 'text-gb-green' : vpdStress.okPercent !== null && vpdStress.okPercent >= 40 ? 'text-gb-warning' : 'text-gb-danger'}">
									{vpdStress.okPercent}%
								</p>
								<p class="text-[10px] text-gb-text-muted leading-tight mt-0.5">VPD optimal<br/><span class="text-[9px]">{vpdStress.ok}/{vpdStress.total} Tage</span></p>
							{:else}
								<p class="text-2xl font-bold text-gb-text-muted">—</p>
								<p class="text-[10px] text-gb-text-muted leading-tight mt-0.5">VPD optimal<br/><span class="text-[9px]">noch keine Daten</span></p>
							{/if}
						</div>
						<div class="text-center">
							{#if consistency.daysSinceLastCheckin !== null}
								<p class="text-2xl font-bold {consistency.daysSinceLastCheckin === 0 ? 'text-gb-green' : consistency.daysSinceLastCheckin <= 2 ? 'text-gb-text' : 'text-gb-warning'}">
									{consistency.daysSinceLastCheckin === 0 ? 'heute' : `${consistency.daysSinceLastCheckin}d`}
								</p>
								<p class="text-[10px] text-gb-text-muted leading-tight mt-0.5">letzter<br/>Check-in</p>
							{:else}
								<p class="text-2xl font-bold text-gb-text-muted">—</p>
								<p class="text-[10px] text-gb-text-muted leading-tight mt-0.5">letzter<br/>Check-in</p>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			<!-- Klima + Wasser-Werte als Grid -->
			<div class="space-y-2">
				<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Klima &amp; Werte</h2>
				<div class="grid grid-cols-2 gap-2">
					{#if tempStats.avg !== null}
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-xs text-gb-text-muted">Temp</p>
							<p class="text-lg font-bold">Ø {tempStats.avg.toFixed(1)}°C</p>
							<p class="text-[10px] text-gb-text-muted">{tempStats.min!.toFixed(1)} – {tempStats.max!.toFixed(1)}°C</p>
						</div>
					{/if}
					{#if rhStats.avg !== null}
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-xs text-gb-text-muted">RH</p>
							<p class="text-lg font-bold">Ø {rhStats.avg.toFixed(0)}%</p>
							<p class="text-[10px] text-gb-text-muted">{rhStats.min!.toFixed(0)} – {rhStats.max!.toFixed(0)}%</p>
						</div>
					{/if}
					{#if vpdStats.avg !== null}
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-xs text-gb-text-muted">VPD</p>
							<p class="text-lg font-bold text-gb-green">Ø {vpdStats.avg.toFixed(2)} kPa</p>
							<p class="text-[10px] text-gb-text-muted">{vpdStats.min!.toFixed(2)} – {vpdStats.max!.toFixed(2)}</p>
						</div>
					{/if}
					{#if ecStats.avg !== null}
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-xs text-gb-text-muted">EC</p>
							<p class="text-lg font-bold">Ø {ecStats.avg.toFixed(2)}</p>
							<p class="text-[10px] text-gb-text-muted">{ecStats.min!.toFixed(2)} – {ecStats.max!.toFixed(2)}</p>
						</div>
					{/if}
					{#if phStats.avg !== null}
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-xs text-gb-text-muted">pH</p>
							<p class="text-lg font-bold">Ø {phStats.avg.toFixed(1)}</p>
							<p class="text-[10px] text-gb-text-muted">{phStats.min!.toFixed(1)} – {phStats.max!.toFixed(1)}</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- Wasser + Dünger mit Erklärung -->
			<div class="space-y-2">
				<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Verbrauch</h2>
				{#if totalWaterMl > 0}
					<div class="bg-gb-surface rounded-xl p-4 space-y-1">
						<div class="flex items-baseline justify-between">
							<p class="text-xs text-gb-text-muted">💧 Wasser total</p>
							<p class="text-2xl font-bold text-gb-info">{(totalWaterMl / 1000).toFixed(1)} L</p>
						</div>
						<p class="text-[11px] text-gb-text-muted leading-relaxed">
							Summe aller im Daily-Check-in eingetragenen Wassermengen ("Wasser ml").
						</p>
					</div>
				{:else}
					<div class="bg-gb-surface rounded-xl p-4">
						<p class="text-xs text-gb-text-muted">💧 Wasser total</p>
						<p class="text-sm text-gb-text-muted mt-1">Noch keine Wasser-Mengen geloggt — beim Daily-Check-in unter "Wasser ml" eintragen.</p>
					</div>
				{/if}

				{#if totalNutrientMl > 0}
					<div class="bg-gb-surface rounded-xl p-4 space-y-1">
						<div class="flex items-baseline justify-between">
							<p class="text-xs text-gb-text-muted">🧪 Dünger total (mL)</p>
							<p class="text-2xl font-bold">{totalNutrientMl.toFixed(0)} mL</p>
						</div>
						<p class="text-[11px] text-gb-text-muted leading-relaxed">
							Summe aller im Daily-Check-in eingetragenen Nährstoff-Mengen aus dem Feld
							"Nährstoff ml". Nutze das nur wenn du beim Gießen die Düngermenge separat mitloggst —
							typischerweise = Wasser × EC-faktor / Dünger-Konzentration.
							Erscheint nur wenn du das Feld füllst (aktuell {nutrientCheckins} von {chronCheckins.length} Check-ins).
						</p>
					</div>
				{/if}
			</div>

			<!-- Phase-Sub-Stats Tabelle -->
			{#if allPhases.length >= 2}
				<div class="space-y-2">
					<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Ø pro Phase</h2>
					<div class="bg-gb-surface rounded-xl p-3 overflow-x-auto">
						<table class="w-full text-xs">
							<thead>
								<tr class="text-gb-text-muted text-[10px] uppercase tracking-wide">
									<th class="text-left font-medium pb-2">Phase</th>
									<th class="text-right font-medium pb-2">Temp</th>
									<th class="text-right font-medium pb-2">RH</th>
									<th class="text-right font-medium pb-2">VPD</th>
									<th class="text-right font-medium pb-2">EC</th>
									<th class="text-right font-medium pb-2">pH</th>
								</tr>
							</thead>
							<tbody>
								{#each allPhases as phase}
									<tr class="border-t border-gb-border/50">
										<td class="py-1.5 font-medium">{phase}</td>
										<td class="text-right text-gb-text-muted">{tempPerPhase[phase]?.avg !== null && tempPerPhase[phase] !== undefined ? `${tempPerPhase[phase].avg!.toFixed(1)}°` : '—'}</td>
										<td class="text-right text-gb-text-muted">{rhPerPhase[phase]?.avg !== null && rhPerPhase[phase] !== undefined ? `${rhPerPhase[phase].avg!.toFixed(0)}%` : '—'}</td>
										<td class="text-right text-gb-text-muted">{vpdPerPhase[phase]?.avg !== null && vpdPerPhase[phase] !== undefined ? vpdPerPhase[phase].avg!.toFixed(2) : '—'}</td>
										<td class="text-right text-gb-text-muted">{ecPerPhase[phase]?.avg !== null && ecPerPhase[phase] !== undefined ? ecPerPhase[phase].avg!.toFixed(2) : '—'}</td>
										<td class="text-right text-gb-text-muted">{phPerPhase[phase]?.avg !== null && phPerPhase[phase] !== undefined ? phPerPhase[phase].avg!.toFixed(1) : '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			<!-- Tage pro Phase -->
			{#if phaseDays.length > 0}
				<div class="space-y-2">
					<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Tage pro Phase</h2>
					<div class="bg-gb-surface rounded-xl p-3">
						<div class="flex flex-wrap gap-2">
							{#each phaseDays as pd}
								<span class="bg-gb-bg px-3 py-1.5 rounded-lg text-xs">
									<span class="text-gb-text-muted">{pd.phase}:</span> <span class="font-semibold">{pd.days}d</span>
								</span>
							{/each}
						</div>
					</div>
				</div>
			{/if}
		{/if}
	{/if}
</div>
