<script lang="ts">
	import { growStore, activeGrows, harvestedGrows } from '$lib/stores/grow';
	import { t } from '$lib/i18n';
	import { onMount } from 'svelte';
	import type { Grow, CheckIn } from '$lib/stores/grow';
	import { totalGrowDays, currentPhasePosition } from '$lib/utils/phase';
	import { phaseStyle } from '$lib/utils/phase-colors';
	import { summarizeStrains, totalPlantCount } from '$lib/utils/grow-strains';

	let tr = $state<(key: string, params?: Record<string, string | number>) => string>((k) => k);
	let active: Grow[] = $state([]);
	let harvested: Grow[] = $state([]);
	let allCheckins: CheckIn[] = $state([]);
	let hasGrows = $derived(active.length > 0 || harvested.length > 0);

	onMount(() => {
		const subs = [
			t.subscribe(v => tr = v),
			activeGrows.subscribe(v => active = v),
			harvestedGrows.subscribe(v => harvested = v),
			growStore.subscribe(v => allCheckins = v.checkins),
		];
		return () => subs.forEach(u => u());
	});

	function growDays(grow: Grow): number {
		return totalGrowDays(grow, allCheckins);
	}

	function checkinsFor(grow: Grow): CheckIn[] {
		return allCheckins.filter(c => c.grow_id === grow.id);
	}

	/** Letztes Check-in-Foto (data: oder URL) für Hero-Thumbnail */
	function latestPhoto(grow: Grow): string | null {
		const cis = checkinsFor(grow).sort(
			(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
		);
		for (const c of cis) {
			if (c.photos_data?.length && c.photos_data[0]) return c.photos_data[0];
			if (c.photo_data) return c.photo_data;
			if (c.photo_urls?.length && c.photo_urls[0]) return c.photo_urls[0];
			if (c.photo_url) return c.photo_url;
		}
		return null;
	}

	function currentPhase(grow: Grow): string {
		return currentPhasePosition(grow, checkinsFor(grow)).phase;
	}
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-xl font-bold">{tr('grow.title')}</h1>
			<p class="text-gb-text-muted text-sm">{tr('grow.active_sub', { active: active.length, harvested: harvested.length })}</p>
		</div>
		<a href="/grow/new" class="bg-gb-green text-gb-bg font-semibold text-sm px-4 py-2 rounded-lg hover:bg-gb-green-light transition-colors">
			{tr('grow.new_short')}
		</a>
	</div>

	{#if !hasGrows}
		<!-- Empty State -->
		<div class="bg-gb-surface rounded-xl p-8 text-center">
			<svg class="w-16 h-16 text-gb-border mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
				<path d="M12 22V16m0 0c-2-4-6-6-10-6 4 0 8-2 10-6 2 4 6 6 10 6-4 0-8 2-10 6z" />
			</svg>
			<p class="text-gb-text-muted mb-4">{tr('grow.no_grows')}</p>
			<a href="/grow/new" class="inline-block bg-gb-green text-gb-bg font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-gb-green-light transition-colors">
				{tr('grow.start_first')}
			</a>
		</div>
	{:else}
		<!-- Aktive Grows -->
		{#if active.length > 0}
			<div class="space-y-3">
				<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">{tr('grow.active')}</h2>
				{#each active as grow}
					{@const photo = latestPhoto(grow)}
					{@const phase = currentPhase(grow)}
					{@const ps = phaseStyle(phase)}
					<a href="/grow/{grow.id}" class="block bg-gb-surface rounded-xl overflow-hidden hover:bg-gb-surface-2 transition-colors">
						<div class="flex gap-3 p-3">
							<!-- Hero-Thumbnail -->
							<div class="w-20 h-20 rounded-lg shrink-0 overflow-hidden flex items-center justify-center {ps.bgSoft}">
								{#if photo}
									<img src={photo} alt={grow.name} class="w-full h-full object-cover" />
								{:else}
									<span class="text-3xl">{ps.emoji}</span>
								{/if}
							</div>
							<div class="flex-1 min-w-0 flex flex-col justify-between">
								<div>
									<div class="flex items-start justify-between gap-2">
										<p class="font-medium truncate">{grow.name}</p>
										<span class="shrink-0 text-xs font-bold text-gb-green">{tr('home.day', { days: growDays(grow) })}</span>
									</div>
									<p class="text-xs text-gb-text-muted truncate">{summarizeStrains(grow, { maxLength: 50 })} · {grow.medium} · {totalPlantCount(grow)} {totalPlantCount(grow) > 1 ? tr('grow.plants_plural') : tr('grow.plant')}</p>
								</div>
								<div class="flex items-center gap-2 mt-1">
									<span class="text-[11px] {ps.text} {ps.bgSoft} px-2 py-0.5 rounded-full font-medium">
										{ps.emoji} {phase}
									</span>
									<span class="text-[11px] text-gb-text-muted">{grow.strain_type === 'auto' ? 'Auto' : 'Photo'}</span>
								</div>
							</div>
						</div>
					</a>
				{/each}
			</div>
		{/if}

		<!-- Geerntete Grows -->
		{#if harvested.length > 0}
			<div class="space-y-3">
				<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">{tr('grow.harvested')}</h2>
				{#each harvested as grow}
					{@const photo = latestPhoto(grow)}
					<a href="/grow/{grow.id}" class="block bg-gb-surface rounded-xl overflow-hidden hover:bg-gb-surface-2 transition-colors">
						<div class="flex gap-3 p-3">
							<div class="w-20 h-20 rounded-lg shrink-0 overflow-hidden flex items-center justify-center bg-gb-surface-2">
								{#if photo}
									<img src={photo} alt={grow.name} class="w-full h-full object-cover" />
								{:else}
									<span class="text-3xl">🏆</span>
								{/if}
							</div>
							<div class="flex-1 min-w-0 flex flex-col justify-between">
								<div>
									<p class="font-medium truncate">{grow.name}</p>
									<p class="text-xs text-gb-text-muted truncate">{summarizeStrains(grow, { maxLength: 50 })}</p>
								</div>
								<div class="flex items-center gap-2 mt-1">
									{#if grow.yield_g}
										<span class="text-[11px] text-gb-green bg-gb-green/15 px-2 py-0.5 rounded-full font-medium">
											🏆 {grow.yield_g}g
										</span>
									{/if}
									{#if grow.grow_score != null}
										<span class="text-[11px] text-gb-text-muted">Score {grow.grow_score}</span>
									{/if}
								</div>
							</div>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>
