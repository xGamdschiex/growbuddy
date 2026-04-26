<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';

	type FeedItem = {
		id: string;
		grow_id: string;
		phase: string;
		week: number;
		day: number;
		temp: number | null;
		rh: number | null;
		vpd: number | null;
		notes: string;
		photo_urls: string[];
		created_at: string;
		grow_name: string | null;
		grow_strain: string | null;
		username: string;
	};

	let items = $state<FeedItem[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function load() {
		loading = true;
		error = null;
		const { data, error: err } = await supabase
			.from('checkins')
			.select(`
				id, grow_id, phase, week, day, temp, rh, vpd, notes, photo_urls, created_at, user_id,
				grow:grows!inner(id, name, strain, is_public),
				profile:profiles!inner(username)
			`)
			.eq('is_public', true)
			.order('created_at', { ascending: false })
			.limit(50);

		if (err) {
			error = err.message;
			loading = false;
			return;
		}

		items = ((data as any[]) ?? [])
			.filter(r => r.grow?.is_public)
			.map(r => ({
				id: r.id,
				grow_id: r.grow_id,
				phase: r.phase,
				week: r.week,
				day: r.day,
				temp: r.temp,
				rh: r.rh,
				vpd: r.vpd,
				notes: r.notes ?? '',
				photo_urls: r.photo_urls ?? [],
				created_at: r.created_at,
				grow_name: r.grow?.name ?? null,
				grow_strain: r.grow?.strain ?? null,
				username: r.profile?.username ?? 'Anonym',
			}));
		loading = false;
	}

	onMount(() => { load(); });

	function relativeTime(iso: string): string {
		const ms = Date.now() - new Date(iso).getTime();
		const min = Math.floor(ms / 60000);
		if (min < 1) return 'jetzt';
		if (min < 60) return `vor ${min} min`;
		const h = Math.floor(min / 60);
		if (h < 24) return `vor ${h} h`;
		const d = Math.floor(h / 24);
		if (d < 7) return `vor ${d} Tagen`;
		return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
	}
</script>

<svelte:head><title>Feed — GrowBuddy</title></svelte:head>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-4 pb-24">
	<div class="flex items-center justify-between">
		<div>
			<a href="/" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; Home</a>
			<h1 class="text-2xl font-bold mt-1">🌱 Community Feed</h1>
			<p class="text-sm text-gb-text-muted mt-1">Public Check-ins der Community.</p>
		</div>
		<button onclick={load} class="bg-gb-surface border border-gb-border rounded-lg px-3 py-2 text-xs"
			style="min-height:36px">
			⟳ Refresh
		</button>
	</div>

	{#if loading}
		<div class="bg-gb-surface rounded-xl p-4 text-center text-sm text-gb-text-muted">
			<div class="w-6 h-6 border-2 border-gb-green border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
			Lade Feed…
		</div>
	{:else if error}
		<div class="bg-gb-danger/10 border border-gb-danger/20 rounded-xl p-4 text-sm">
			<p class="font-semibold text-gb-danger">Fehler beim Laden</p>
			<p class="text-xs text-gb-text-muted mt-1">{error}</p>
		</div>
	{:else if items.length === 0}
		<div class="bg-gb-surface rounded-xl p-6 text-center text-sm text-gb-text-muted space-y-2">
			<p class="text-3xl">🌿</p>
			<p>Noch keine öffentlichen Check-ins.</p>
			<p class="text-xs">Sei der Erste — markiere deine Grows als öffentlich in den Grow-Einstellungen.</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each items as item}
				<article class="bg-gb-surface rounded-xl p-4 space-y-2">
					<header class="flex items-center justify-between gap-2">
						<div class="flex items-baseline gap-2 min-w-0">
							<span class="font-semibold text-sm truncate">{item.username}</span>
							<span class="text-[11px] text-gb-text-muted whitespace-nowrap">{relativeTime(item.created_at)}</span>
						</div>
						<span class="text-[10px] bg-gb-bg px-2 py-0.5 rounded-full text-gb-text-muted whitespace-nowrap">{item.phase} W{item.week}D{item.day}</span>
					</header>

					{#if item.grow_strain}
						<p class="text-xs text-gb-text-muted">
							<span class="font-medium text-gb-text">{item.grow_name || 'Grow'}</span> · {item.grow_strain}
						</p>
					{/if}

					{#if item.photo_urls.length > 0}
						<div class="grid grid-cols-{Math.min(item.photo_urls.length, 3)} gap-1.5 mt-1">
							{#each item.photo_urls.slice(0, 3) as url}
								<img src={url} alt="" loading="lazy" class="aspect-square object-cover rounded-lg w-full" />
							{/each}
						</div>
					{/if}

					{#if item.notes}
						<p class="text-sm leading-relaxed">{item.notes}</p>
					{/if}

					{#if item.temp !== null || item.rh !== null || item.vpd !== null}
						<div class="flex gap-3 text-[11px] text-gb-text-muted pt-1">
							{#if item.temp !== null}<span>🌡 {item.temp.toFixed(1)}°C</span>{/if}
							{#if item.rh !== null}<span>💧 {item.rh.toFixed(0)}%</span>{/if}
							{#if item.vpd !== null}<span>VPD {item.vpd.toFixed(2)}</span>{/if}
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</div>
