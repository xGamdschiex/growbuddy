<script lang="ts">
	import { growStore } from '$lib/stores/grow';
	import type { Grow, CheckIn, GrowState } from '$lib/stores/grow';
	import { isPro } from '$lib/stores/pro';
	import { t } from '$lib/i18n';

	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
	let state = $derived.by(() => { let v: GrowState = { grows: [], checkins: [] }; growStore.subscribe(x => v = x)(); return v; });
	let userIsPro = $derived.by(() => { let v = false; isPro.subscribe(x => v = x)(); return v; });

	type StrainStat = {
		strain: string;
		runs: number;
		harvested: number;
		avg_yield_per_plant: number | null;
		best_yield_per_plant: number | null;
		avg_duration_days: number | null;
		avg_score: number | null;
	};

	function durationDays(g: Grow): number | null {
		if (!g.harvested_at) return null;
		const d = (new Date(g.harvested_at).getTime() - new Date(g.started_at).getTime()) / 86400000;
		return d > 0 ? Math.round(d) : null;
	}

	let strainStats = $derived.by<StrainStat[]>(() => {
		const map = new Map<string, Grow[]>();
		for (const g of state.grows) {
			const key = (g.strain || 'Unbekannt').trim();
			if (!key) continue;
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(g);
		}
		const out: StrainStat[] = [];
		for (const [strain, grows] of map.entries()) {
			const harvested = grows.filter(g => g.status === 'harvested' && g.yield_g != null);
			const yieldsPerPlant = harvested
				.map(g => (g.yield_g != null && g.plant_count > 0) ? (g.yield_g / g.plant_count) : null)
				.filter((v): v is number => v != null);
			const durations = harvested.map(durationDays).filter((v): v is number => v != null);
			const scores = grows.map(g => g.grow_score).filter((v): v is number => v != null);
			out.push({
				strain,
				runs: grows.length,
				harvested: harvested.length,
				avg_yield_per_plant: yieldsPerPlant.length ? yieldsPerPlant.reduce((a, b) => a + b, 0) / yieldsPerPlant.length : null,
				best_yield_per_plant: yieldsPerPlant.length ? Math.max(...yieldsPerPlant) : null,
				avg_duration_days: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
				avg_score: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
			});
		}
		out.sort((a, b) => {
			if (a.harvested !== b.harvested) return b.harvested - a.harvested;
			return (b.avg_yield_per_plant ?? 0) - (a.avg_yield_per_plant ?? 0);
		});
		return out;
	});

	let totals = $derived.by(() => {
		const grows = state.grows;
		const harvested = grows.filter(g => g.status === 'harvested' && g.yield_g != null);
		const totalYield = harvested.reduce((s, g) => s + (g.yield_g ?? 0), 0);
		const totalCheckins = state.checkins.length;
		const uniqueStrains = strainStats.length;
		const avgScore = grows.map(g => g.grow_score).filter((v): v is number => v != null);
		return {
			grows: grows.length,
			harvested: harvested.length,
			totalYield,
			totalCheckins,
			uniqueStrains,
			avgScore: avgScore.length ? avgScore.reduce((a, b) => a + b, 0) / avgScore.length : null,
		};
	});

	let activePhase = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const c of state.checkins) {
			counts.set(c.phase, (counts.get(c.phase) ?? 0) + 1);
		}
		return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
	});
</script>

<svelte:head><title>Insights — GrowBuddy</title></svelte:head>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-5 pb-24">
	<div>
		<a href="/" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; Home</a>
		<h1 class="text-2xl font-bold mt-1">📊 Insights</h1>
		<p class="text-sm text-gb-text-muted mt-1">Was deine Grows dir erzählen.</p>
	</div>

	<!-- Totals -->
	<div class="grid grid-cols-2 gap-3">
		<div class="bg-gb-surface rounded-xl p-3">
			<p class="text-xs text-gb-text-muted">Gesamt Grows</p>
			<p class="text-2xl font-bold mt-1">{totals.grows}</p>
			<p class="text-[11px] text-gb-text-muted">{totals.harvested} geerntet</p>
		</div>
		<div class="bg-gb-surface rounded-xl p-3">
			<p class="text-xs text-gb-text-muted">Σ Yield</p>
			<p class="text-2xl font-bold mt-1">{totals.totalYield.toFixed(0)}<span class="text-sm font-normal text-gb-text-muted ml-1">g</span></p>
			<p class="text-[11px] text-gb-text-muted">{totals.uniqueStrains} Strains</p>
		</div>
		<div class="bg-gb-surface rounded-xl p-3">
			<p class="text-xs text-gb-text-muted">Check-ins</p>
			<p class="text-2xl font-bold mt-1">{totals.totalCheckins}</p>
		</div>
		<div class="bg-gb-surface rounded-xl p-3">
			<p class="text-xs text-gb-text-muted">Ø Grow-Score</p>
			<p class="text-2xl font-bold mt-1">{totals.avgScore !== null ? totals.avgScore.toFixed(0) : '—'}</p>
		</div>
	</div>

	<!-- Strain-Stats -->
	<div class="space-y-2">
		<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Pro Strain</h2>
		{#if strainStats.length === 0}
			<p class="text-gb-text-muted text-sm bg-gb-surface rounded-xl p-4 text-center">
				Noch keine Grows angelegt. Sobald du erste Grows erntest, erscheinen hier deine Strain-Stats.
			</p>
		{:else}
			<div class="space-y-2">
				{#each strainStats as s, i}
					<div class="bg-gb-surface rounded-xl p-3 space-y-2">
						<div class="flex items-baseline justify-between gap-2">
							<div class="flex items-baseline gap-2 min-w-0">
								<span class="text-xs text-gb-text-muted">#{i + 1}</span>
								<p class="font-semibold truncate">{s.strain}</p>
							</div>
							<span class="text-[11px] text-gb-text-muted whitespace-nowrap">{s.runs} Run{s.runs !== 1 ? 's' : ''}</span>
						</div>
						<div class="grid grid-cols-3 gap-2 text-xs">
							<div>
								<p class="text-gb-text-muted text-[10px]">Ø Yield/Pflanze</p>
								<p class="font-semibold">{s.avg_yield_per_plant !== null ? s.avg_yield_per_plant.toFixed(0) + 'g' : '—'}</p>
							</div>
							<div>
								<p class="text-gb-text-muted text-[10px]">Best</p>
								<p class="font-semibold">{s.best_yield_per_plant !== null ? s.best_yield_per_plant.toFixed(0) + 'g' : '—'}</p>
							</div>
							<div>
								<p class="text-gb-text-muted text-[10px]">Ø Dauer</p>
								<p class="font-semibold">{s.avg_duration_days !== null ? s.avg_duration_days + 'd' : '—'}</p>
							</div>
						</div>
						{#if s.avg_score !== null}
							<div class="flex items-center gap-2">
								<div class="flex-1 h-1.5 bg-gb-bg rounded-full overflow-hidden">
									<div class="h-full bg-gb-accent" style="width: {Math.max(0, Math.min(100, s.avg_score))}%"></div>
								</div>
								<span class="text-[10px] text-gb-text-muted whitespace-nowrap">Score {s.avg_score.toFixed(0)}</span>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Phase-Verteilung -->
	{#if activePhase.length > 0}
		<div class="space-y-2">
			<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Check-ins nach Phase</h2>
			<div class="bg-gb-surface rounded-xl p-3 space-y-2">
				{#each activePhase as [phase, count]}
					{@const max = activePhase[0][1]}
					<div class="flex items-center gap-2">
						<span class="text-xs w-16 truncate">{phase}</span>
						<div class="flex-1 h-2 bg-gb-bg rounded-full overflow-hidden">
							<div class="h-full bg-gb-accent" style="width: {(count / max) * 100}%"></div>
						</div>
						<span class="text-xs text-gb-text-muted w-8 text-right">{count}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Pro Teaser für Predict -->
	{#if !userIsPro && strainStats.length > 0}
		<div class="bg-gradient-to-br from-gb-accent/15 to-gb-accent/5 border border-gb-accent/30 rounded-xl p-4">
			<div class="flex items-start gap-3">
				<div class="text-2xl">🔮</div>
				<div class="flex-1">
					<p class="font-semibold text-sm">Harvest-Predict in Pro</p>
					<p class="text-xs text-gb-text-muted mt-1 leading-relaxed">
						Basierend auf deinen Grow-Daten: erwarteter Yield, optimale Dauer, Schwächen pro Strain.
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
