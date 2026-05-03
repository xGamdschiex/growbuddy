<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { authStore } from '$lib/stores/auth';
	import { fetchLikeCounts, fetchMyLikes, toggleLike } from '$lib/stores/likes';
	import { fetchFollowingIds } from '$lib/stores/follows';
	import { submitReport, REPORT_REASONS, type ReportReason } from '$lib/stores/reports';
	import { toastStore } from '$lib/stores/toast';

	type FeedItem = {
		id: string;
		grow_id: string;
		user_id: string;
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

	let auth = $state<any>({ user: null });

	onMount(() => authStore.subscribe(v => auth = v));
	let likeCounts = $state<Record<string, number>>({});
	let myLikes = $state<Set<string>>(new Set());
	let likingNow = $state<Set<string>>(new Set());

	let filterMode = $state<'all' | 'following'>('all');
	let followingIds = $state<Set<string>>(new Set());

	// Report-Modal
	let reportingItem = $state<FeedItem | null>(null);
	let reportReason = $state<ReportReason>('spam');
	let reportDetails = $state('');
	let reportSubmitting = $state(false);

	let items = $state<FeedItem[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function load() {
		loading = true;
		error = null;

		// Step 1: Check-ins + Grow joinen (FK existiert)
		const { data, error: err } = await supabase
			.from('checkins')
			.select(`
				id, grow_id, phase, week, day, temp, rh, vpd, notes, photo_urls, created_at, user_id,
				grow:grows!inner(id, name, strain, is_public)
			`)
			.eq('is_public', true)
			.order('created_at', { ascending: false })
			.limit(50);

		if (err) {
			error = err.message;
			loading = false;
			return;
		}

		const rows = ((data as any[]) ?? []).filter(r => r.grow?.is_public);

		// Step 2: Profiles separat laden (kein direkter FK checkins.user_id → profiles.id)
		const userIds = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)));
		const profileMap = new Map<string, string>();
		if (userIds.length > 0) {
			const { data: profs } = await supabase
				.from('profiles')
				.select('id, username')
				.in('id', userIds);
			for (const p of (profs as { id: string; username: string }[]) ?? []) {
				profileMap.set(p.id, p.username);
			}
		}

		items = rows.map(r => ({
			id: r.id,
			grow_id: r.grow_id,
			user_id: r.user_id,
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
			username: profileMap.get(r.user_id) ?? 'Anonym',
		}));

		// Step 3: Likes + Follows parallel laden
		const ids = items.map(i => i.id);
		const [counts, mine, fIds] = await Promise.all([
			fetchLikeCounts(ids),
			auth.user ? fetchMyLikes(auth.user.id, ids) : Promise.resolve(new Set<string>()),
			auth.user ? fetchFollowingIds(auth.user.id) : Promise.resolve([] as string[]),
		]);
		likeCounts = counts;
		myLikes = mine;
		followingIds = new Set(fIds);
		loading = false;
	}

	let visibleItems = $derived(
		filterMode === 'following'
			? items.filter(i => followingIds.has(i.user_id))
			: items
	);

	function openReport(item: FeedItem) {
		if (!auth.user) {
			toastStore.warning('Login erforderlich');
			return;
		}
		reportingItem = item;
		reportReason = 'spam';
		reportDetails = '';
	}
	function closeReport() {
		reportingItem = null;
		reportDetails = '';
	}
	async function sendReport() {
		if (!auth.user || !reportingItem || reportSubmitting) return;
		reportSubmitting = true;
		const res = await submitReport(auth.user.id, reportingItem.id, reportReason, reportDetails);
		reportSubmitting = false;
		if (res.error) {
			toastStore.warning(res.error);
		} else {
			toastStore.success('Danke — wir prüfen das.');
			closeReport();
		}
	}

	async function handleLike(checkinId: string) {
		if (!auth.user) {
			toastStore.warning('Login erforderlich für Likes');
			return;
		}
		if (likingNow.has(checkinId)) return;
		likingNow = new Set([...likingNow, checkinId]);
		const wasLiked = myLikes.has(checkinId);
		const res = await toggleLike(auth.user.id, checkinId, wasLiked);
		if (res.error) {
			toastStore.warning(res.error);
		} else {
			const newLikes = new Set(myLikes);
			if (res.liked) newLikes.add(checkinId);
			else newLikes.delete(checkinId);
			myLikes = newLikes;
			likeCounts = { ...likeCounts, [checkinId]: (likeCounts[checkinId] ?? 0) + (res.liked ? 1 : -1) };
		}
		const newLiking = new Set(likingNow);
		newLiking.delete(checkinId);
		likingNow = newLiking;
	}

	onMount(() => { load(); });

	function gridColsClass(n: number): string {
		if (n >= 3) return 'grid-cols-3';
		if (n === 2) return 'grid-cols-2';
		return 'grid-cols-1';
	}

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
		<button onclick={load} disabled={loading}
			class="bg-gb-surface border border-gb-border rounded-lg px-3 py-2 text-xs disabled:opacity-50"
			style="min-height:36px">
			{#if loading}
				<span class="inline-flex items-center gap-1.5">
					<span class="w-3 h-3 border-2 border-gb-text-muted border-t-transparent rounded-full animate-spin"></span>
					Lade…
				</span>
			{:else}
				⟳ Refresh
			{/if}
		</button>
	</div>

	<!-- Filter-Tabs -->
	{#if auth.user}
		<div class="flex bg-gb-surface rounded-lg p-1 gap-1">
			<button onclick={() => filterMode = 'all'}
				class="flex-1 py-2 rounded-md text-xs font-medium transition-colors {filterMode === 'all' ? 'bg-gb-bg text-gb-text' : 'text-gb-text-muted'}"
				style="min-height:36px">
				Alle
			</button>
			<button onclick={() => filterMode = 'following'}
				class="flex-1 py-2 rounded-md text-xs font-medium transition-colors {filterMode === 'following' ? 'bg-gb-bg text-gb-text' : 'text-gb-text-muted'}"
				style="min-height:36px">
				Folge ich ({followingIds.size})
			</button>
		</div>
	{/if}

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
	{:else if visibleItems.length === 0}
		<div class="bg-gb-surface rounded-xl p-6 text-center text-sm text-gb-text-muted space-y-2">
			<p class="text-3xl">🌿</p>
			{#if filterMode === 'following'}
				<p>Du folgst noch niemandem mit Public-Posts.</p>
				<p class="text-xs">Wechsle auf "Alle" und folge anderen Growern.</p>
			{:else}
				<p>Noch keine öffentlichen Check-ins.</p>
				<p class="text-xs">Sei der Erste — markiere deine Grows als öffentlich in den Grow-Einstellungen.</p>
			{/if}
		</div>
	{:else}
		<div class="space-y-3">
			{#each visibleItems as item}
				<article class="bg-gb-surface rounded-xl p-4 space-y-2">
					<header class="flex items-center justify-between gap-2">
						<div class="flex items-baseline gap-2 min-w-0">
							<a href="/u/{item.username}" class="font-semibold text-sm truncate text-gb-green hover:underline">@{item.username}</a>
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
						<div class="grid {gridColsClass(item.photo_urls.length)} gap-1.5 mt-1">
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

					<footer class="flex items-center gap-2 pt-2 border-t border-gb-border/50">
						<button onclick={() => handleLike(item.id)} disabled={likingNow.has(item.id)}
							class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors disabled:opacity-50 {myLikes.has(item.id) ? 'text-gb-danger bg-gb-danger/10' : 'text-gb-text-muted hover:text-gb-text hover:bg-gb-bg'}"
							style="min-height:32px">
							<span>{myLikes.has(item.id) ? '❤️' : '🤍'}</span>
							<span class="font-medium">{likeCounts[item.id] ?? 0}</span>
						</button>
						{#if auth.user && item.user_id !== auth.user.id}
							<button onclick={() => openReport(item)}
								class="ml-auto px-2 py-1 rounded-lg text-xs text-gb-text-muted hover:text-gb-danger hover:bg-gb-danger/10 transition-colors"
								style="min-height:32px"
								title="Melden">
								⚐
							</button>
						{/if}
					</footer>
				</article>
			{/each}
		</div>
	{/if}
</div>

<!-- Report-Modal -->
{#if reportingItem}
	<div role="presentation" onclick={closeReport}
		class="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
		<div role="dialog" onclick={(e) => e.stopPropagation()}
			class="bg-gb-surface rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
			<header class="flex items-center justify-between">
				<h2 class="font-bold text-base">Check-in melden</h2>
				<button onclick={closeReport} class="text-gb-text-muted text-xl leading-none">×</button>
			</header>
			<p class="text-xs text-gb-text-muted">Was stimmt mit diesem Beitrag nicht?</p>

			<div class="space-y-2">
				{#each REPORT_REASONS as r}
					<label class="flex items-center gap-3 bg-gb-bg rounded-lg p-3 cursor-pointer hover:bg-gb-bg/80">
						<input type="radio" bind:group={reportReason} value={r.id} class="accent-gb-green" />
						<span class="text-sm">{r.label}</span>
					</label>
				{/each}
			</div>

			<label class="block">
				<span class="text-xs text-gb-text-muted">Details (optional, max 500)</span>
				<textarea bind:value={reportDetails} maxlength="500" rows="2"
					class="mt-1 w-full bg-gb-bg border border-gb-border rounded-lg px-3 py-2 text-sm resize-none"></textarea>
			</label>

			<div class="flex gap-2 pt-1">
				<button onclick={sendReport} disabled={reportSubmitting}
					class="flex-1 bg-gb-danger text-white font-medium text-sm py-2.5 rounded-lg disabled:opacity-50"
					style="min-height:44px">
					{reportSubmitting ? '...' : 'Melden'}
				</button>
				<button onclick={closeReport} disabled={reportSubmitting}
					class="flex-1 bg-gb-bg border border-gb-border text-gb-text font-medium text-sm py-2.5 rounded-lg"
					style="min-height:44px">
					Abbrechen
				</button>
			</div>
		</div>
	</div>
{/if}
