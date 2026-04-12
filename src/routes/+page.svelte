<script lang="ts">
	import { growStore, activeGrows, harvestedGrows, totalHarvests } from '$lib/stores/grow';
	import { t } from '$lib/i18n';
	import type { Grow, CheckIn } from '$lib/stores/grow';

	interface GrowState { grows: (Grow & { checkins: CheckIn[] })[] }

	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
	let storeVal = $derived.by(() => { let v: GrowState = { grows: [] }; growStore.subscribe(x => v = x)(); return v; });
	let active = $derived.by(() => { let v: Grow[] = []; activeGrows.subscribe(x => v = x)(); return v; });
	let harvested = $derived.by(() => { let v: Grow[] = []; harvestedGrows.subscribe(x => v = x)(); return v; });
	let harvestCount = $derived.by(() => { let v = 0; totalHarvests.subscribe(x => v = x)(); return v; });

	let streak = $derived.by(() => {
		const allCheckins = storeVal.grows
			.flatMap((g: any) => g.checkins || [])
			.map((c: any) => c.created_at.slice(0, 10))
			.sort()
			.reverse();

		if (allCheckins.length === 0) return 0;

		const unique = [...new Set(allCheckins)];
		const today = new Date().toISOString().slice(0, 10);

		const startDate = unique[0];
		if (!startDate) return 0;

		const diffDays = Math.floor((new Date(today).getTime() - new Date(startDate).getTime()) / 86400000);
		if (diffDays > 1) return 0;

		let s = 1;
		for (let i = 1; i < unique.length; i++) {
			const prev = new Date(unique[i - 1]!);
			const curr = new Date(unique[i]!);
			const diff = Math.floor((prev.getTime() - curr.getTime()) / 86400000);
			if (diff === 1) { s++; } else { break; }
		}
		return s;
	});
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">{tr('home.title')}</h1>
			<p class="text-gb-text-muted text-sm">{tr('home.subtitle')}</p>
		</div>
		<div class="w-10 h-10 rounded-full bg-gb-surface-2 flex items-center justify-center">
			<svg class="w-5 h-5 text-gb-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 22V16m0 0c-2-4-6-6-10-6 4 0 8-2 10-6 2 4 6 6 10 6-4 0-8 2-10 6z" />
			</svg>
		</div>
	</div>

	<!-- Quick Stats -->
	<div class="grid grid-cols-3 gap-3">
		<div class="bg-gb-surface rounded-xl p-3 text-center">
			<p class="text-2xl font-bold text-gb-green">{active.length}</p>
			<p class="text-xs text-gb-text-muted">{tr('home.active_grows')}</p>
		</div>
		<div class="bg-gb-surface rounded-xl p-3 text-center">
			<p class="text-2xl font-bold">{harvestCount}</p>
			<p class="text-xs text-gb-text-muted">{tr('home.harvests')}</p>
		</div>
		<div class="bg-gb-surface rounded-xl p-3 text-center">
			<p class="text-2xl font-bold text-gb-warning">{streak}</p>
			<p class="text-xs text-gb-text-muted">{tr('home.streak')}</p>
		</div>
	</div>

	<!-- Aktive Grows -->
	{#if active.length > 0}
		<div class="space-y-2">
			<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">{tr('home.active_grows_title')}</h2>
			{#each active as grow}
				{@const days = Math.floor((Date.now() - new Date(grow.started_at).getTime()) / 86400000)}
				{@const lastCheckin = grow.checkins.length > 0 ? grow.checkins[grow.checkins.length - 1] : null}
				<a href="/grow/{grow.id}" class="block bg-gb-surface rounded-xl p-4 hover:bg-gb-surface-2 transition-colors">
					<div class="flex items-center justify-between mb-2">
						<div>
							<p class="font-semibold">{grow.name}</p>
							<p class="text-xs text-gb-text-muted">{grow.strain} · {grow.strain_type === 'auto' ? 'Auto' : 'Photo'}</p>
						</div>
						<span class="text-xs bg-gb-green/10 text-gb-green px-2 py-1 rounded-full">Tag {days}</span>
					</div>
					{#if lastCheckin}
						<div class="flex gap-3 text-xs text-gb-text-muted">
							{#if lastCheckin.phase}
								<span class="capitalize">{lastCheckin.phase}</span>
							{/if}
							{#if lastCheckin.temp}
								<span>{lastCheckin.temp}°C</span>
							{/if}
							{#if lastCheckin.rh}
								<span>{lastCheckin.rh}% RH</span>
							{/if}
							{#if lastCheckin.vpd}
								<span>VPD {lastCheckin.vpd.toFixed(2)}</span>
							{/if}
						</div>
					{:else}
						<p class="text-xs text-gb-text-muted">{tr('home.no_checkin')}</p>
					{/if}
				</a>
			{/each}
		</div>
	{/if}

	<!-- {tr('home.quick_actions')} -->
	<div class="space-y-2">
		<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">{tr('home.quick_actions')}</h2>
		<div class="grid grid-cols-2 gap-3">
			<a href="/grow/new" class="bg-gb-green/10 border border-gb-green/20 rounded-xl p-4 hover:bg-gb-green/20 transition-colors">
				<svg class="w-6 h-6 text-gb-green mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 5v14m-7-7h14" />
				</svg>
				<p class="font-medium text-sm">{tr('home.new_grow')}</p>
				<p class="text-xs text-gb-text-muted">{tr('home.start_grow')}</p>
			</a>
			<a href="/calc" class="bg-gb-accent/10 border border-gb-accent/20 rounded-xl p-4 hover:bg-gb-accent/20 transition-colors">
				<svg class="w-6 h-6 text-gb-accent mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M9 3h6m-5 0v6.5L4 18a1 1 0 001 1h14a1 1 0 001-1l-6-8.5V3m-4 0h4" />
				</svg>
				<p class="font-medium text-sm">{tr('home.calc')}</p>
				<p class="text-xs text-gb-text-muted">{tr('home.calc_sub')}</p>
			</a>
			<a href="/tools/vpd" class="bg-gb-info/10 border border-gb-info/20 rounded-xl p-4 hover:bg-gb-info/20 transition-colors">
				<svg class="w-6 h-6 text-gb-info mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<p class="font-medium text-sm">{tr('home.vpd')}</p>
				<p class="text-xs text-gb-text-muted">{tr('home.vpd_sub')}</p>
			</a>
			<a href="/tools/dli" class="bg-gb-warning/10 border border-gb-warning/20 rounded-xl p-4 hover:bg-gb-warning/20 transition-colors">
				<svg class="w-6 h-6 text-gb-warning mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="5" />
					<path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
				</svg>
				<p class="font-medium text-sm">{tr('home.dli')}</p>
				<p class="text-xs text-gb-text-muted">{tr('home.dli_sub')}</p>
			</a>
		</div>
	</div>

	<!-- {tr('home.last_harvests')} -->
	{#if harvested.length > 0}
		<div class="space-y-2">
			<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">{tr('home.last_harvests')}</h2>
			{#each harvested.slice(0, 3) as grow}
				<a href="/grow/{grow.id}" class="block bg-gb-surface rounded-xl p-4 hover:bg-gb-surface-2 transition-colors">
					<div class="flex items-center justify-between">
						<div>
							<p class="font-semibold">{grow.name}</p>
							<p class="text-xs text-gb-text-muted">{grow.strain}</p>
						</div>
						<div class="text-right">
							{#if grow.yield_g}
								<p class="font-bold text-gb-green">{grow.yield_g}g</p>
							{/if}
							{#if grow.grow_score}
								<p class="text-xs text-gb-text-muted">Score: {grow.grow_score}/100</p>
							{/if}
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}

	<!-- Empty State -->
	{#if active.length === 0 && harvested.length === 0}
		<div class="bg-gb-surface rounded-xl p-6 text-center">
			<svg class="w-12 h-12 text-gb-text-muted mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
				<path d="M12 22V16m0 0c-2-4-6-6-10-6 4 0 8-2 10-6 2 4 6 6 10 6-4 0-8 2-10 6z" />
			</svg>
			<p class="text-gb-text-muted text-sm mb-3">{tr('home.no_grows')}</p>
			<a href="/grow/new" class="inline-block bg-gb-green text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-gb-green/80 transition-colors">
				{tr('home.first_grow')}
			</a>
		</div>
	{/if}
</div>
