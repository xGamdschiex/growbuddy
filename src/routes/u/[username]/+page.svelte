<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { authStore } from '$lib/stores/auth';
	import { isFollowing as checkFollowing, fetchFollowerCount, fetchFollowingCount, toggleFollow } from '$lib/stores/follows';
	import { toastStore } from '$lib/stores/toast';

	type Profile = {
		id: string;
		username: string;
		bio: string | null;
		avatar_url: string | null;
		created_at: string;
	};
	type CheckinItem = {
		id: string;
		grow_id: string;
		phase: string;
		week: number;
		day: number;
		notes: string;
		photo_urls: string[];
		created_at: string;
		grow_name: string | null;
		grow_strain: string | null;
	};

	let username = $derived($page.params.username);
	let profile = $state<Profile | null>(null);
	let checkins = $state<CheckinItem[]>([]);
	let publicGrows = $state(0);
	let totalCheckins = $state(0);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let auth = $derived.by(() => { let v: any = { user: null }; authStore.subscribe(x => v = x)(); return v; });
	let following = $state(false);
	let followerCount = $state(0);
	let followingCount = $state(0);
	let followBusy = $state(false);
	let isOwnProfile = $derived(auth.user && profile && auth.user.id === profile.id);

	async function load() {
		loading = true;
		error = null;
		profile = null;
		checkins = [];
		publicGrows = 0;
		totalCheckins = 0;

		// Profile laden
		const { data: prof, error: pErr } = await supabase
			.from('profiles')
			.select('id, username, bio, avatar_url, created_at')
			.eq('username', username)
			.maybeSingle();
		if (pErr) { error = pErr.message; loading = false; return; }
		if (!prof) { error = 'User nicht gefunden'; loading = false; return; }
		profile = prof as Profile;

		// Public Grows zählen
		const { count: gCount } = await supabase
			.from('grows')
			.select('id', { count: 'exact', head: true })
			.eq('user_id', profile.id)
			.eq('is_public', true);
		publicGrows = gCount ?? 0;

		// Public Check-ins laden (max 30)
		const { data: ciData, error: ciErr, count: ciCount } = await supabase
			.from('checkins')
			.select(`
				id, grow_id, phase, week, day, notes, photo_urls, created_at,
				grow:grows!inner(id, name, strain, is_public)
			`, { count: 'exact' })
			.eq('user_id', profile.id)
			.eq('is_public', true)
			.order('created_at', { ascending: false })
			.limit(30);

		if (ciErr) { error = ciErr.message; loading = false; return; }
		totalCheckins = ciCount ?? 0;
		checkins = ((ciData as any[]) ?? [])
			.filter(r => r.grow?.is_public)
			.map(r => ({
				id: r.id,
				grow_id: r.grow_id,
				phase: r.phase,
				week: r.week,
				day: r.day,
				notes: r.notes ?? '',
				photo_urls: r.photo_urls ?? [],
				created_at: r.created_at,
				grow_name: r.grow?.name ?? null,
				grow_strain: r.grow?.strain ?? null,
			}));

		// Follow-Daten parallel
		const [fc, ggc, isF] = await Promise.all([
			fetchFollowerCount(profile.id),
			fetchFollowingCount(profile.id),
			auth.user ? checkFollowing(auth.user.id, profile.id) : Promise.resolve(false),
		]);
		followerCount = fc;
		followingCount = ggc;
		following = isF;
		loading = false;
	}

	async function handleFollow() {
		if (!auth.user) {
			toastStore.warning('Login erforderlich');
			return;
		}
		if (!profile || followBusy || isOwnProfile) return;
		followBusy = true;
		const wasFollowing = following;
		const res = await toggleFollow(auth.user.id, profile.id, wasFollowing);
		if (res.error) {
			toastStore.warning(res.error);
		} else {
			following = res.following;
			followerCount += res.following ? 1 : -1;
		}
		followBusy = false;
	}

	$effect(() => {
		if (username) load();
	});

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

	function memberSince(iso: string): string {
		return new Date(iso).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });
	}

	function gridColsClass(n: number): string {
		if (n >= 3) return 'grid-cols-3';
		if (n === 2) return 'grid-cols-2';
		return 'grid-cols-1';
	}
</script>

<svelte:head><title>@{username} — GrowBuddy</title></svelte:head>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-4 pb-24">
	<a href="/feed" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; Feed</a>

	{#if loading}
		<div class="bg-gb-surface rounded-xl p-6 text-center text-sm text-gb-text-muted">
			<div class="w-6 h-6 border-2 border-gb-green border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
			Lade Profil…
		</div>
	{:else if error}
		<div class="bg-gb-danger/10 border border-gb-danger/20 rounded-xl p-6 text-center">
			<p class="text-3xl mb-2">😕</p>
			<p class="font-semibold text-gb-danger text-sm">{error}</p>
			<a href="/feed" class="inline-block mt-3 text-xs text-gb-info hover:underline">Zurück zum Feed</a>
		</div>
	{:else if profile}
		<!-- Profile Card -->
		<div class="bg-gb-surface rounded-xl p-5 text-center">
			<div class="w-20 h-20 rounded-full bg-gb-green/10 border-2 border-gb-green mx-auto flex items-center justify-center mb-3 overflow-hidden">
				{#if profile.avatar_url}
					<img src={profile.avatar_url} alt="" class="w-full h-full object-cover" />
				{:else}
					<span class="text-3xl">🌱</span>
				{/if}
			</div>
			<h1 class="text-xl font-bold">@{profile.username}</h1>
			{#if profile.bio}
				<p class="text-sm text-gb-text-muted mt-2 whitespace-pre-wrap break-words">{profile.bio}</p>
			{/if}
			<p class="text-[11px] text-gb-text-muted mt-2">Mitglied seit {memberSince(profile.created_at)}</p>

			{#if !isOwnProfile && auth.user}
				<button onclick={handleFollow} disabled={followBusy}
					class="mt-4 px-5 py-2 rounded-lg font-medium text-sm disabled:opacity-50 transition-colors {following ? 'bg-gb-bg border border-gb-border text-gb-text' : 'bg-gb-green text-black'}"
					style="min-height:40px">
					{following ? '✓ Folge ich' : '+ Folgen'}
				</button>
			{:else if isOwnProfile}
				<a href="/profile" class="mt-4 inline-block text-xs text-gb-info hover:underline">Eigenes Profil bearbeiten →</a>
			{/if}
		</div>

		<!-- Stats -->
		<div class="grid grid-cols-4 gap-2">
			<div class="bg-gb-surface rounded-xl p-3 text-center">
				<p class="text-lg font-bold">{publicGrows}</p>
				<p class="text-[10px] text-gb-text-muted">Grows</p>
			</div>
			<div class="bg-gb-surface rounded-xl p-3 text-center">
				<p class="text-lg font-bold">{totalCheckins}</p>
				<p class="text-[10px] text-gb-text-muted">Check-ins</p>
			</div>
			<div class="bg-gb-surface rounded-xl p-3 text-center">
				<p class="text-lg font-bold">{followerCount}</p>
				<p class="text-[10px] text-gb-text-muted">Follower</p>
			</div>
			<div class="bg-gb-surface rounded-xl p-3 text-center">
				<p class="text-lg font-bold">{followingCount}</p>
				<p class="text-[10px] text-gb-text-muted">Folgt</p>
			</div>
		</div>

		<!-- Check-ins -->
		<div>
			<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide mb-3">Letzte Check-ins</h2>
			{#if checkins.length === 0}
				<div class="bg-gb-surface rounded-xl p-6 text-center text-sm text-gb-text-muted">
					<p class="text-3xl mb-2">🌿</p>
					<p>Noch keine öffentlichen Check-ins.</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each checkins as item}
						<article class="bg-gb-surface rounded-xl p-4 space-y-2">
							<header class="flex items-center justify-between gap-2">
								<div class="flex items-baseline gap-2 min-w-0">
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
						</article>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
