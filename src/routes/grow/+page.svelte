<script lang="ts">
	import { growStore, activeGrows, harvestedGrows } from '$lib/stores/grow';
	import type { Grow } from '$lib/stores/grow';

	let active = $derived.by(() => { let v: Grow[] = []; activeGrows.subscribe(x => v = x)(); return v; });
	let harvested = $derived.by(() => { let v: Grow[] = []; harvestedGrows.subscribe(x => v = x)(); return v; });
	let hasGrows = $derived(active.length > 0 || harvested.length > 0);

	function daysSince(dateStr: string): number {
		return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
	}
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-xl font-bold">Meine Grows</h1>
			<p class="text-gb-text-muted text-sm">{active.length} aktiv · {harvested.length} geerntet</p>
		</div>
		<a href="/grow/new" class="bg-gb-green text-black font-semibold text-sm px-4 py-2 rounded-lg hover:bg-gb-green-light transition-colors">
			+ Neu
		</a>
	</div>

	{#if !hasGrows}
		<!-- Empty State -->
		<div class="bg-gb-surface rounded-xl p-8 text-center">
			<svg class="w-16 h-16 text-gb-border mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
				<path d="M12 22V16m0 0c-2-4-6-6-10-6 4 0 8-2 10-6 2 4 6 6 10 6-4 0-8 2-10 6z" />
			</svg>
			<p class="text-gb-text-muted mb-4">Noch keine Grows angelegt</p>
			<a href="/grow/new" class="inline-block bg-gb-green text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-gb-green-light transition-colors">
				Ersten Grow starten
			</a>
		</div>
	{:else}
		<!-- Aktive Grows -->
		{#if active.length > 0}
			<div class="space-y-3">
				<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Aktiv</h2>
				{#each active as grow}
					<a href="/grow/{grow.id}" class="block bg-gb-surface rounded-xl p-4 hover:bg-gb-surface-2 transition-colors">
						<div class="flex justify-between items-start">
							<div>
								<p class="font-medium">{grow.name}</p>
								<p class="text-sm text-gb-text-muted">{grow.strain} · {grow.medium} · {grow.plant_count} Pflanze{grow.plant_count > 1 ? 'n' : ''}</p>
							</div>
							<div class="text-right">
								<p class="text-gb-green font-bold">Tag {daysSince(grow.started_at)}</p>
								<p class="text-xs text-gb-text-muted">{grow.strain_type === 'auto' ? 'Auto' : 'Photo'}</p>
							</div>
						</div>
					</a>
				{/each}
			</div>
		{/if}

		<!-- Geerntete Grows -->
		{#if harvested.length > 0}
			<div class="space-y-3">
				<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Geerntet</h2>
				{#each harvested as grow}
					<a href="/grow/{grow.id}" class="block bg-gb-surface rounded-xl p-4 hover:bg-gb-surface-2 transition-colors opacity-70">
						<div class="flex justify-between items-start">
							<div>
								<p class="font-medium">{grow.name}</p>
								<p class="text-sm text-gb-text-muted">{grow.strain}</p>
							</div>
							{#if grow.yield_g}
								<p class="text-gb-green font-bold">{grow.yield_g}g</p>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>
