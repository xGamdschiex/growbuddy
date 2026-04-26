<script lang="ts">
	import { growStore, activeGrows, harvestedGrows, totalHarvests } from '$lib/stores/grow';
	import { currentStreak, hasCheckinToday, streakMultiplier, streakInDanger } from '$lib/stores/streak';
	import { isLoggedIn } from '$lib/stores/auth';
	import { syncStore } from '$lib/stores/sync';
	import DailyCheckin from '$lib/components/DailyCheckin.svelte';
	import { t } from '$lib/i18n';
	import type { Grow, CheckIn } from '$lib/stores/grow';

	interface GrowState { grows: (Grow & { checkins: CheckIn[] })[] }

	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
	let storeVal = $derived.by(() => { let v: GrowState = { grows: [] }; growStore.subscribe(x => v = x)(); return v; });
	let active = $derived.by(() => { let v: Grow[] = []; activeGrows.subscribe(x => v = x)(); return v; });
	let harvested = $derived.by(() => { let v: Grow[] = []; harvestedGrows.subscribe(x => v = x)(); return v; });
	let harvestCount = $derived.by(() => { let v = 0; totalHarvests.subscribe(x => v = x)(); return v; });
	let loggedIn = $derived.by(() => { let v = false; isLoggedIn.subscribe(x => v = x)(); return v; });
	let sync = $derived.by(() => { let v: any = { status: 'idle' }; syncStore.subscribe(x => v = x)(); return v; });

	let streakInfo = $derived.by(() => { let v = { current: 0, graceActive: false, lastCheckinDate: null as string | null }; currentStreak.subscribe(x => v = x)(); return v; });
	let doneToday = $derived.by(() => { let v = false; hasCheckinToday.subscribe(x => v = x)(); return v; });
	let multiplier = $derived.by(() => { let v = 1; streakMultiplier.subscribe(x => v = x)(); return v; });
	let danger = $derived.by(() => { let v = false; streakInDanger.subscribe(x => v = x)(); return v; });

	let showCheckin = $state(false);

	function openCheckin() { showCheckin = true; }
	function closeCheckin() { showCheckin = false; }
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-5 pb-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">{tr('home.title')}</h1>
			<p class="text-gb-text-muted text-sm">{tr('home.subtitle')}</p>
		</div>
		<div class="flex items-center gap-2">
			<a href="/profile" aria-label="Cloud-Status"
				title={loggedIn ? (sync.status === 'syncing' ? 'Sync läuft…' : sync.status === 'error' ? 'Sync-Fehler' : 'Cloud aktiv') : 'Nicht eingeloggt — Daten nur lokal'}
				class="w-10 h-10 rounded-full flex items-center justify-center transition-colors
					{loggedIn ? (sync.status === 'error' ? 'bg-gb-danger/15 text-gb-danger' : 'bg-gb-green/15 text-gb-green') : 'bg-gb-surface-2 text-gb-text-muted'}">
				{#if sync.status === 'syncing'}
					<svg class="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 4v4m0 8v4m4.24-12.24l-2.83 2.83m-4.24 4.24l-2.83 2.83M20 12h-4M8 12H4m12.24 4.24l-2.83-2.83M9.17 9.17L6.34 6.34" />
					</svg>
				{:else if loggedIn}
					<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M17.5 19a4.5 4.5 0 10-.88-8.92A6 6 0 007 10a4 4 0 00-.5 7.97" />
						<path d="M9 15l2 2 4-4" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				{:else}
					<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M17.5 19a4.5 4.5 0 10-.88-8.92A6 6 0 007 10a4 4 0 00-.5 7.97" />
					</svg>
				{/if}
			</a>
			<a href="/profile" aria-label="Profil"
				class="w-10 h-10 rounded-full bg-gb-surface-2 flex items-center justify-center hover:bg-gb-surface transition-colors">
				<svg class="w-5 h-5 text-gb-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 22V16m0 0c-2-4-6-6-10-6 4 0 8-2 10-6 2 4 6 6 10 6-4 0-8 2-10 6z" />
				</svg>
			</a>
		</div>
	</div>

	<!-- ═══ HERO: Daily Check-in ═══ -->
	{#if active.length > 0}
		{#if showCheckin}
			<DailyCheckin onDone={closeCheckin} onCancel={closeCheckin} compact={false} />
		{:else if doneToday}
			<!-- Done Today: Streak-Feier -->
			<div class="bg-gradient-to-br from-gb-green/20 to-gb-green/5 border border-gb-green/30 rounded-xl p-5">
				<div class="flex items-center gap-3">
					<div class="w-12 h-12 rounded-full bg-gb-green/20 flex items-center justify-center text-2xl">
						✅
					</div>
					<div class="flex-1">
						<p class="font-bold">Check-in erledigt</p>
						<p class="text-xs text-gb-text-muted">
							{#if streakInfo.current > 0}
								🔥 {streakInfo.current}-Tage-Streak · {multiplier}x XP-Bonus aktiv
							{:else}
								Heute weiter so!
							{/if}
						</p>
					</div>
					<button onclick={openCheckin}
						class="bg-gb-surface-2 text-gb-text-muted text-xs px-3 py-1.5 rounded-lg hover:text-gb-text">
						+ Weiterer
					</button>
				</div>
			</div>
		{:else}
			<!-- Check-in Call-to-Action -->
			<button onclick={openCheckin}
				class="w-full text-left bg-gradient-to-br {danger ? 'from-gb-warning/20 to-gb-warning/5 border-gb-warning/40' : 'from-gb-green/20 to-gb-green/5 border-gb-green/30'} border rounded-xl p-5 hover:opacity-95 transition-opacity">
				<div class="flex items-center gap-3">
					<div class="w-12 h-12 rounded-full {danger ? 'bg-gb-warning/20' : 'bg-gb-green/20'} flex items-center justify-center text-2xl">
						{danger ? '⏰' : '📸'}
					</div>
					<div class="flex-1 min-w-0">
						<p class="font-bold">
							{danger ? 'Streak in Gefahr!' : 'Heutiger Check-in'}
						</p>
						<p class="text-xs text-gb-text-muted">
							{#if streakInfo.current > 0}
								🔥 {streakInfo.current} Tage · {multiplier}x XP wenn du heute checkst
							{:else}
								Starte deinen ersten Streak — Foto + Werte eingeben
							{/if}
						</p>
					</div>
					<span class="text-gb-text-muted">→</span>
				</div>
			</button>
		{/if}
	{/if}

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
			<p class="text-2xl font-bold text-gb-warning">{streakInfo.current}</p>
			<p class="text-xs text-gb-text-muted">{tr('home.streak')}</p>
		</div>
	</div>

	<!-- Aktive Grows -->
	{#if active.length > 0}
		<div class="space-y-2">
			<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">{tr('home.active_grows_title')}</h2>
			{#each active as grow}
				{@const days = Math.floor((Date.now() - new Date(grow.started_at).getTime()) / 86400000)}
				{@const growCheckins = storeVal.grows.find((g: any) => g.id === grow.id) ? (storeVal as any).checkins?.filter((c: CheckIn) => c.grow_id === grow.id) ?? [] : []}
				{@const lastCheckin = growCheckins.length > 0 ? growCheckins[growCheckins.length - 1] : null}
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

	<!-- Quick Actions -->
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
			<a href="/tools/doctor" class="bg-gb-info/10 border border-gb-info/20 rounded-xl p-4 hover:bg-gb-info/20 transition-colors">
				<svg class="w-6 h-6 text-gb-info mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<p class="font-medium text-sm">AI Doctor</p>
				<p class="text-xs text-gb-text-muted">Pflanzen-Diagnose</p>
			</a>
			<a href="/tools/vpd" class="bg-gb-warning/10 border border-gb-warning/20 rounded-xl p-4 hover:bg-gb-warning/20 transition-colors">
				<svg class="w-6 h-6 text-gb-warning mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<p class="font-medium text-sm">{tr('home.vpd')}</p>
				<p class="text-xs text-gb-text-muted">{tr('home.vpd_sub')}</p>
			</a>
			<a href="/insights" class="bg-gb-green/10 border border-gb-green/20 rounded-xl p-4 hover:bg-gb-green/20 transition-colors">
				<svg class="w-6 h-6 text-gb-green mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M3 3v18h18M7 14l4-4 4 4 5-5" />
				</svg>
				<p class="font-medium text-sm">Insights</p>
				<p class="text-xs text-gb-text-muted">Strain-Stats &amp; Trends</p>
			</a>
			<a href="/feed" class="bg-gb-info/10 border border-gb-info/20 rounded-xl p-4 hover:bg-gb-info/20 transition-colors">
				<svg class="w-6 h-6 text-gb-info mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M17 8h2a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2h2m10-4H7m10 4V4m-10 4V4" />
				</svg>
				<p class="font-medium text-sm">Feed</p>
				<p class="text-xs text-gb-text-muted">Community Check-ins</p>
			</a>
		</div>
	</div>

	<!-- Last Harvests -->
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
