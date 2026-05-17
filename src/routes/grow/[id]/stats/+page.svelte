<script lang="ts">
	/**
	 * Grow-Stats-Sub-Page: vollstaendige Detail-Statistiken pro Grow.
	 * Aufgerufen von grow/[id] via "Vollstaendige Statistik" Link.
	 *
	 * Reuse: src/lib/utils/grow-stats.ts (pure functions, getestet).
	 */
	import { page } from '$app/stores';
	import { growStore } from '$lib/stores/grow';
	import { isPro } from '$lib/stores/pro';
	import type { CheckIn } from '$lib/stores/grow';
	import { phaseDaysSummary } from '$lib/utils/phase';
	import {
		metricStats,
		metricPerPhase,
		stressDays,
		checkinConsistency,
		type MetricStats,
	} from '$lib/utils/grow-stats';
	import MiniChart from '$lib/components/MiniChart.svelte';
	import MultiSeriesChart, { type ChartSeries } from '$lib/components/MultiSeriesChart.svelte';
	import HealthCard from '$lib/components/HealthCard.svelte';
	import { phaseTargetSegments, targetFor } from '$lib/utils/phase-targets';
	import { CHART_COLORS } from '$lib/utils/chart-colors';
	import { calcNutrientUsage, productSeriesCumulative } from '$lib/utils/nutrient-usage';
	import { onMount } from 'svelte';

	let growId = $derived($page.params.id);
	let growState = $state<any>({ grows: [], checkins: [] });
	let grow = $derived(growState?.grows?.find((g: any) => g.id === growId));
	let userIsPro = $state(false);

	onMount(() => {
		const subs = [
			growStore.subscribe(v => growState = v),
			isPro.subscribe(v => userIsPro = v),
		];
		return () => subs.forEach(u => u());
	});

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

	// Chart-Series (Temp/RH/Wasser/Dünger) — auf Stats-Page (Übersicht hat VPD/EC/pH)
	function dayOf(c: CheckIn): number {
		if (!grow) return 1;
		// Math.max(1,…): Check-in vor started_at (z.B. nach Startdatum-Edit) darf X-Achse nicht brechen
		return Math.max(1, Math.floor((new Date(c.created_at).getTime() - new Date(grow.started_at).getTime()) / 86400000) + 1);
	}
	function seriesFrom(key: 'temp' | 'rh' | 'vpd' | 'ec_measured' | 'ph_measured') {
		const filtered = chronCheckins.filter((c: CheckIn) => (c as any)[key] != null);
		return {
			values: filtered.map((c: CheckIn) => (c as any)[key] as number),
			days: filtered.map(dayOf),
		};
	}
	let tempSeries = $derived(seriesFrom('temp'));
	let rhSeries = $derived(seriesFrom('rh'));
	let vpdSeries = $derived(seriesFrom('vpd'));
	let ecSeries = $derived(seriesFrom('ec_measured'));
	let phSeries = $derived(seriesFrom('ph_measured'));
	let waterSeries = $derived.by(() => {
		const filtered = chronCheckins.filter((c: CheckIn) => c.water_ml != null && (c.water_ml as number) > 0);
		let cum = 0;
		const points = filtered.map((c: CheckIn) => {
			cum += (c.water_ml as number) / 1000;
			return { day: dayOf(c), value: Math.round(cum * 10) / 10 };
		});
		return { values: points.map((p: { day: number; value: number }) => p.value), days: points.map((p: { day: number; value: number }) => p.day) };
	});
	let nutrientSeries = $derived.by(() => {
		const filtered = chronCheckins.filter((c: CheckIn) => c.nutrient_ml != null && (c.nutrient_ml as number) > 0);
		return { values: filtered.map((c: CheckIn) => c.nutrient_ml as number), days: filtered.map(dayOf) };
	});

	// Phase-Marker für Charts (gleicher Algorithmus wie auf Übersicht)
	function markersFor(serieDays: number[]): { atIndex: number; label: string }[] {
		if (!serieDays.length) return [];
		const out: { atIndex: number; label: string }[] = [];
		let lastPhase: string | null = null;
		serieDays.forEach((d: number, i: number) => {
			const ci = chronCheckins.find((c: CheckIn) => dayOf(c) === d);
			const ph = (ci?.phase as string) || '';
			if (ph && ph !== lastPhase) {
				if (lastPhase !== null) out.push({ atIndex: i, label: ph });
				lastPhase = ph;
			}
		});
		return out;
	}
	let tempMarkers = $derived(markersFor(tempSeries.days));
	let rhMarkers = $derived(markersFor(rhSeries.days));
	let waterMarkers = $derived(markersFor(waterSeries.days));
	let nutrientMarkers = $derived(markersFor(nutrientSeries.days));

	// Phase-Targets via zentralisiertem util (siehe lib/utils/phase-targets.ts)
	let tempPhaseTargets = $derived(phaseTargetSegments('temp', chronCheckins, tempSeries.days, dayOf));
	let rhPhaseTargets = $derived(phaseTargetSegments('rh', chronCheckins, rhSeries.days, dayOf));
	let vpdPhaseTargets = $derived(phaseTargetSegments('vpd', chronCheckins, vpdSeries.days, dayOf));
	let ecPhaseTargets = $derived(phaseTargetSegments('ec', chronCheckins, ecSeries.days, dayOf));
	let phPhaseTargets = $derived(phaseTargetSegments('ph', chronCheckins, phSeries.days, dayOf));

	// MultiSeriesChart: alle 7 Metriken zur Auswahl. phaseTargets wird nur sichtbar
	// wenn der User NUR diese eine Series anwählt (sonst Multi-Y-Skala-Konflikt).
	let allSeries: ChartSeries[] = $derived([
		{ key: 'temp', label: 'Temp', color: CHART_COLORS.temp, unit: '°C', values: tempSeries.values, days: tempSeries.days, phaseTargets: tempPhaseTargets },
		{ key: 'rh', label: 'RH', color: CHART_COLORS.rh, unit: '%', values: rhSeries.values, days: rhSeries.days, phaseTargets: rhPhaseTargets },
		{ key: 'vpd', label: 'VPD', color: CHART_COLORS.vpd, unit: ' kPa', values: vpdSeries.values, days: vpdSeries.days, phaseTargets: vpdPhaseTargets },
		{ key: 'ec', label: 'EC', color: CHART_COLORS.ec, unit: '', values: ecSeries.values, days: ecSeries.days, phaseTargets: ecPhaseTargets },
		{ key: 'ph', label: 'pH', color: CHART_COLORS.ph, unit: '', values: phSeries.values, days: phSeries.days, phaseTargets: phPhaseTargets },
		{ key: 'water', label: 'Wasser', color: CHART_COLORS.water, unit: ' L', values: waterSeries.values, days: waterSeries.days },
		{ key: 'nutrient', label: 'Dünger', color: CHART_COLORS.nutrient, unit: ' mL', values: nutrientSeries.values, days: nutrientSeries.days },
	]);
	// Default-aktive Metriken: VPD + EC + Wasser (häufigste Health-Indikatoren)
	let enabledKeys = $state<string[]>(['vpd', 'ec', 'water']);
	function toggleKey(key: string) {
		enabledKeys = enabledKeys.includes(key)
			? enabledKeys.filter(k => k !== key)
			: [...enabledKeys, key];
	}
	// Series die mind. 2 Datenpunkte haben (sonst nicht sinnvoll plotbar)
	let plottableSeries = $derived(allSeries.filter(s => s.values.length >= 2));

	let allPhases = $derived(Array.from(new Set([
		...Object.keys(tempPerPhase), ...Object.keys(rhPerPhase),
		...Object.keys(vpdPerPhase), ...Object.keys(ecPerPhase), ...Object.keys(phPerPhase),
	])));

	// v1.4.1: Düngerverbrauch — hochgerechnet aus Wassergaben + Feedline-Schema
	let nutrientUsage = $derived(grow ? calcNutrientUsage(grow, growState?.checkins ?? []) : null);
	let nutrientMaxTotal = $derived(nutrientUsage ? Math.max(0, ...nutrientUsage.byProduct.map(p => p.total)) : 0);
	let selectedProductKey = $state<string | null>(null);
	// Default: erstes Produkt (= meistgenutztes)
	$effect(() => {
		if (nutrientUsage && nutrientUsage.byProduct.length > 0 && selectedProductKey === null) {
			selectedProductKey = nutrientUsage.byProduct[0].key;
		}
	});
	let selectedProductSeries = $derived.by(() => {
		if (!nutrientUsage || !selectedProductKey) return { days: [], values: [] };
		return productSeriesCumulative(nutrientUsage.history, selectedProductKey);
	});
	let selectedProduct = $derived(
		nutrientUsage?.byProduct.find(p => p.key === selectedProductKey) ?? null
	);
	// Kategorie-Farben (visuelle Trennung base vs. supplement vs. ...)
	function categoryColor(kat: string): string {
		if (kat === 'base') return CHART_COLORS.nutrient;
		if (kat === 'supplement') return CHART_COLORS.water;
		if (kat === 'booster') return CHART_COLORS.vpd;
		if (kat === 'stimulator') return CHART_COLORS.ec;
		return CHART_COLORS.rh;
	}
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
			<!-- Health-Card (Komponente, geteilt mit grow/[id]) -->
			{#if consistency}
				<HealthCard {consistency} {vpdStress} />
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

			<!-- v1.4.2: Wasser & Dünger — ein Block (war: 'Verbrauch' + 'Düngerverbrauch' separat) -->
			<div class="space-y-2">
				<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide flex items-center justify-between gap-2">
					<span>Wasser &amp; Dünger</span>
					{#if nutrientUsage?.feedline}
						<span class="text-[10px] font-normal normal-case tracking-normal text-gb-text-muted truncate ml-2 max-w-[60%]" title={nutrientUsage.feedline.name}>{nutrientUsage.feedline.name}</span>
					{/if}
				</h2>

				<!-- Top-Tiles: Wasser-Total + Düng-Count -->
				<div class="grid grid-cols-2 gap-2">
					<div class="bg-gb-surface rounded-xl p-3">
						<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">💧 Wasser</p>
						<p class="text-xl font-bold text-gb-info mt-0.5">{(totalWaterMl / 1000).toFixed(1)}<span class="text-xs font-normal text-gb-text-muted ml-1">L</span></p>
					</div>
					<div class="bg-gb-surface rounded-xl p-3">
						<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">🧪 Düng-Check-ins</p>
						<p class="text-xl font-bold mt-0.5">{nutrientUsage?.n_fertigated_checkins ?? nutrientCheckins}<span class="text-xs font-normal text-gb-text-muted ml-1">×</span></p>
					</div>
				</div>

				<!-- Düngerverbrauch (wenn Feedline gesetzt) -->
				{#if nutrientUsage?.feedline}
					{#if nutrientUsage.byProduct.length === 0}
						<div class="bg-gb-surface rounded-xl p-4 space-y-2">
							<p class="text-sm text-gb-text-muted">Noch keine Düngung berechnet.</p>
							<p class="text-[11px] text-gb-text-muted leading-relaxed">
								Beim Check-in 💧 <span class="text-gb-text">Gegossen</span> +
								🧪 <span class="text-gb-text">Gedüngt</span> aktivieren und <span class="text-gb-text">Wassermenge (mL)</span> eintragen.
								Wir rechnen aus dem Düngerschema hoch.
							</p>
						</div>
					{:else}
						<!-- Total über alle Phasen, kompakte Bars -->
						<div class="bg-gb-surface rounded-xl p-3 space-y-2.5">
							<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">Gesamt</p>
							{#each nutrientUsage.byProduct as p}
								{@const widthPct = nutrientMaxTotal > 0 ? (p.total / nutrientMaxTotal) * 100 : 0}
								{@const isSelected = selectedProductKey === p.key}
								{@const color = categoryColor(p.kategorie)}
								<button type="button" onclick={() => selectedProductKey = p.key}
									class="w-full text-left space-y-1 group" style="min-height:44px">
									<div class="flex items-baseline justify-between gap-2">
										<span class="text-sm font-medium truncate {isSelected ? 'text-gb-text' : 'text-gb-text-muted group-hover:text-gb-text'}">{p.name}</span>
										<span class="text-sm font-bold tabular-nums {isSelected ? 'text-gb-text' : 'text-gb-text-muted'}">
											{p.total.toFixed(p.einheit === 'g' ? 1 : 0)}<span class="text-[10px] font-normal text-gb-text-muted ml-0.5">{p.einheit}</span>
										</span>
									</div>
									<div class="flex items-center gap-2">
										<div class="flex-1 h-1.5 bg-gb-bg rounded-full overflow-hidden">
											<div class="h-full transition-all" style="width: {widthPct}%; background: {color}; opacity: {isSelected ? 1 : 0.55};"></div>
										</div>
										<span class="text-[10px] text-gb-text-muted whitespace-nowrap tabular-nums">{p.n_checkins}×</span>
									</div>
								</button>
							{/each}
						</div>

						<!-- v1.4.2: Aufschlüsselung pro Phase (Veg vs Bloom vs ...) — nur wenn mehrere Phasen -->
						{#if nutrientUsage.byPhase.length >= 2}
							{#each nutrientUsage.byPhase as ph}
								{@const phMax = Math.max(0, ...ph.products.map(pp => pp.total))}
								<details class="bg-gb-surface rounded-xl overflow-hidden">
									<summary class="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none" style="min-height:44px">
										<div class="flex items-baseline gap-2 min-w-0">
											<span class="text-sm font-semibold">{ph.phase}</span>
											<span class="text-[11px] text-gb-text-muted">{ph.n_checkins}× · {ph.water_l.toFixed(1)} L</span>
										</div>
										<span class="text-gb-text-muted text-xs phase-chev">▸</span>
									</summary>
									<div class="px-3 pb-3 space-y-1.5">
										{#each ph.products as pp}
											{@const wPct = phMax > 0 ? (pp.total / phMax) * 100 : 0}
											{@const c = categoryColor(pp.kategorie)}
											<div class="space-y-0.5">
												<div class="flex items-baseline justify-between gap-2">
													<span class="text-xs text-gb-text-muted truncate">{pp.name}</span>
													<span class="text-xs font-semibold tabular-nums">{pp.total.toFixed(pp.einheit === 'g' ? 1 : 0)} {pp.einheit}</span>
												</div>
												<div class="h-1 bg-gb-bg rounded-full overflow-hidden">
													<div class="h-full" style="width: {wPct}%; background: {c}; opacity: 0.7;"></div>
												</div>
											</div>
										{/each}
									</div>
								</details>
							{/each}
						{/if}

						<!-- Hinweise -->
						<div class="text-[11px] text-gb-text-muted leading-relaxed px-1 space-y-1">
							{#if nutrientUsage.n_skipped_checkins > 0}
								<p><span class="text-gb-warning">{nutrientUsage.n_skipped_checkins} Check-in{nutrientUsage.n_skipped_checkins !== 1 ? 's' : ''} übersprungen</span> (Phase/Woche nicht im Schema).</p>
							{/if}
							<p class="opacity-80">EC-Skalierung: <code>ec_measured / ec_ziel</code> (clamped 0.3–1.2×). Ohne EC → 100 %.</p>
						</div>

						<!-- Verlauf-Chart für gewähltes Produkt (kumuliert) -->
						{#if selectedProduct && selectedProductSeries.values.length >= 2}
							<MiniChart
								data={selectedProductSeries.values}
								days={selectedProductSeries.days}
								color={categoryColor(selectedProduct.kategorie)}
								label="{selectedProduct.name} kumulativ"
								unit=" {selectedProduct.einheit}"
								showMinMax
							/>
						{/if}
					{/if}
				{:else if totalNutrientMl > 0}
					<!-- Fallback: keine Feedline gesetzt, aber User loggt nutrient_ml manuell -->
					<div class="bg-gb-surface rounded-xl p-3 space-y-1">
						<div class="flex items-baseline justify-between">
							<p class="text-xs text-gb-text-muted">🧪 Nährstoff (mL, manuell)</p>
							<p class="text-lg font-bold">{totalNutrientMl.toFixed(0)} <span class="text-xs font-normal text-gb-text-muted">mL</span></p>
						</div>
						<p class="text-[11px] text-gb-text-muted">Ohne Düngerlinie können wir nicht pro Produkt aufschlüsseln. Weise dem Grow eine Linie zu für Pro-Produkt-Stats.</p>
					</div>
				{/if}
			</div>

			<!-- v1.4.2: Pro Phase — Ø Werte + Tage zusammengeführt -->
			{#if allPhases.length >= 1 && (allPhases.length >= 2 || phaseDays.length > 0)}
				<div class="space-y-2">
					<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Pro Phase</h2>
					<div class="bg-gb-surface rounded-xl p-3 overflow-x-auto">
						<table class="w-full text-xs">
							<thead>
								<tr class="text-gb-text-muted text-[10px] uppercase tracking-wide">
									<th class="text-left font-medium pb-2">Phase</th>
									<th class="text-right font-medium pb-2">Tage</th>
									<th class="text-right font-medium pb-2">Temp</th>
									<th class="text-right font-medium pb-2">RH</th>
									<th class="text-right font-medium pb-2">VPD</th>
									<th class="text-right font-medium pb-2">EC</th>
									<th class="text-right font-medium pb-2">pH</th>
								</tr>
							</thead>
							<tbody>
								{#each allPhases as phase}
									{@const days = phaseDays.find(p => p.phase === phase)?.days}
									<tr class="border-t border-gb-border/50">
										<td class="py-1.5 font-medium">{phase}</td>
										<td class="text-right text-gb-text-muted tabular-nums">{days !== undefined ? `${days}d` : '—'}</td>
										<td class="text-right text-gb-text-muted tabular-nums">{tempPerPhase[phase]?.avg !== null && tempPerPhase[phase] !== undefined ? `${tempPerPhase[phase].avg!.toFixed(1)}°` : '—'}</td>
										<td class="text-right text-gb-text-muted tabular-nums">{rhPerPhase[phase]?.avg !== null && rhPerPhase[phase] !== undefined ? `${rhPerPhase[phase].avg!.toFixed(0)}%` : '—'}</td>
										<td class="text-right text-gb-text-muted tabular-nums">{vpdPerPhase[phase]?.avg !== null && vpdPerPhase[phase] !== undefined ? vpdPerPhase[phase].avg!.toFixed(2) : '—'}</td>
										<td class="text-right text-gb-text-muted tabular-nums">{ecPerPhase[phase]?.avg !== null && ecPerPhase[phase] !== undefined ? ecPerPhase[phase].avg!.toFixed(2) : '—'}</td>
										<td class="text-right text-gb-text-muted tabular-nums">{phPerPhase[phase]?.avg !== null && phPerPhase[phase] !== undefined ? phPerPhase[phase].avg!.toFixed(1) : '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			<!-- Multi-Series Combined-Chart (v1.3.58): alle 7 Metriken überlagert, Pills zum Toggle -->
			{#if plottableSeries.length >= 2}
				<div class="space-y-2">
					<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Alle Werte überlagert</h2>
					<div class="bg-gb-surface rounded-xl p-3">
						<div class="flex flex-wrap gap-1.5 mb-3">
							{#each plottableSeries as s}
								{@const active = enabledKeys.includes(s.key)}
								<button type="button" onclick={() => toggleKey(s.key)}
									class="text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors flex items-center gap-1.5 {active ? 'border-transparent text-white' : 'border-gb-border text-gb-text-muted bg-gb-bg/50 hover:text-gb-text'}"
									style={active ? `background-color: ${s.color}` : ''}>
									<span class="w-1.5 h-1.5 rounded-full" style="background-color: {active ? CHART_COLORS.textOnDark : s.color}"></span>
									{s.label}
								</button>
							{/each}
						</div>
					</div>
					<MultiSeriesChart series={allSeries} {enabledKeys} />
					<p class="text-[10px] text-gb-text-muted px-2">
						Werte sind pro Metrik einzeln skaliert (jede Linie nutzt ihren eigenen Min/Max-Range).
						So bleiben Verläufe vergleichbar, auch bei sehr unterschiedlichen Größen (Temp vs. Wasser).
					</p>
				</div>
			{/if}

			<!-- Verlaufsgrafiken (v1.3.57: Temp/RH/Wasser/Dünger — VPD/EC/pH sind auf Übersicht) -->
			{#if tempSeries.values.length >= 2 || rhSeries.values.length >= 2 || waterSeries.values.length >= 2 || nutrientSeries.values.length >= 2}
				<div class="space-y-2">
					<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide flex items-center gap-2">
						Verlaufsgrafiken
						{#if !userIsPro}
							<span class="text-[10px] bg-gb-accent/20 text-gb-accent px-2 py-0.5 rounded-full font-normal">Pro</span>
						{/if}
					</h2>
					{#if userIsPro}
						{#if tempSeries.values.length >= 2}
							<MiniChart data={tempSeries.values} days={tempSeries.days} phaseMarkers={tempMarkers}
								phaseTargets={tempPhaseTargets} showMinMax
								color={CHART_COLORS.temp} label="Temperatur" unit="°C" />
						{/if}
						{#if rhSeries.values.length >= 2}
							<MiniChart data={rhSeries.values} days={rhSeries.days} phaseMarkers={rhMarkers}
								phaseTargets={rhPhaseTargets} showMinMax
								color={CHART_COLORS.rh} label="Luftfeuchte" unit="%" />
						{/if}
						{#if waterSeries.values.length >= 2}
							<MiniChart data={waterSeries.values} days={waterSeries.days} phaseMarkers={waterMarkers}
								showMinMax color={CHART_COLORS.water} label="Wasser kumulativ" unit=" L" />
						{/if}
						{#if nutrientSeries.values.length >= 2}
							<MiniChart data={nutrientSeries.values} days={nutrientSeries.days} phaseMarkers={nutrientMarkers}
								showMinMax color={CHART_COLORS.nutrient} label="Dünger" unit=" mL" />
						{/if}
					{:else}
						<div class="bg-gradient-to-br from-gb-accent/15 to-gb-accent/5 border border-gb-accent/30 rounded-xl p-4">
							<div class="flex items-start gap-3">
								<div class="text-2xl">📊</div>
								<div class="flex-1">
									<p class="font-semibold text-sm">4 Charts mit Pro</p>
									<p class="text-xs text-gb-text-muted mt-1 leading-relaxed">
										Temperatur, Luftfeuchte, Wasser-Verbrauch und Dünger über die Zeit — alle mit Phasen-Targets, Tap-Tooltips und Min/Max-Markern.
									</p>
									<a href="/pro" class="inline-block mt-3 bg-gb-accent text-white font-semibold text-xs px-4 py-2 rounded-lg"
										style="min-height:36px; display:inline-flex; align-items:center;">
										Pro freischalten
									</a>
								</div>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	{/if}
</div>

<style>
	/* v1.4.2: details/summary Polish — Default-Marker weg, Chevron rotiert beim Aufklappen */
	details > summary { list-style: none; }
	details > summary::-webkit-details-marker { display: none; }
	.phase-chev { transition: transform 0.2s ease; display: inline-block; }
	details[open] .phase-chev { transform: rotate(90deg); }
</style>
