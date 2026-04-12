<script lang="ts">
	import { xpStore, currentLevel, xpProgress, LEVELS } from '$lib/stores/xp';
	import { growStore, totalGrows, totalHarvests } from '$lib/stores/grow';
	import { proStore, isPro } from '$lib/stores/pro';
	import { reminderStore } from '$lib/stores/reminders';
	import { ACHIEVEMENTS } from '$lib/data/achievements';
	import type { AchievementStats, Achievement } from '$lib/data/achievements';
	import type { GrowState } from '$lib/stores/grow';

	let xp = $derived.by(() => { let v: any = {}; xpStore.subscribe(x => v = x)(); return v; });
	let level = $derived.by(() => { let v: any = LEVELS[0]; currentLevel.subscribe(x => v = x)(); return v; });
	let progress = $derived.by(() => { let v = { current: 0, needed: 0, percent: 0 }; xpProgress.subscribe(x => v = x)(); return v; });
	let state = $derived.by(() => { let v: GrowState = { grows: [], checkins: [] }; growStore.subscribe(x => v = x)(); return v; });
	let grows = $derived.by(() => { let v = 0; totalGrows.subscribe(x => v = x)(); return v; });
	let harvests = $derived.by(() => { let v = 0; totalHarvests.subscribe(x => v = x)(); return v; });

	let stats = $derived<AchievementStats>({
		total_grows: grows,
		total_harvests: harvests,
		total_checkins: state.checkins.length,
		total_photos: state.checkins.filter(c => c.photo_data).length,
		best_score: state.grows.reduce((best, g) => {
			if (g.grow_score !== null && (best === null || g.grow_score > best)) return g.grow_score;
			return best;
		}, null as number | null),
		unique_strains: new Set(state.grows.map(g => g.strain.toLowerCase())).size,
		longest_streak: 0, // TODO: berechnen
		total_xp: xp.total_xp ?? 0,
		calc_uses: Object.keys(xp.daily_checkins ?? {}).filter((k: string) => k.startsWith('calc_')).length,
		tool_uses: Object.keys(xp.daily_checkins ?? {}).filter((k: string) => k.startsWith('tool_')).length,
	});

	let unlockedIds = $derived(new Set(
		ACHIEVEMENTS.filter(a => a.check(stats)).map(a => a.id)
	));

	// XP-Vergabe für neu freigeschaltete Achievements
	let awardedAchievements = $state(new Set<string>());
	$effect(() => {
		for (const ach of ACHIEVEMENTS) {
			if (unlockedIds.has(ach.id) && !awardedAchievements.has(ach.id)) {
				awardedAchievements.add(ach.id);
				xpStore.awardAchievement(ach.name, ach.xp);
			}
		}
	});

	let showHistory = $state(false);
	let userIsPro = $derived.by(() => { let v = false; isPro.subscribe(x => v = x)(); return v; });
	let reminder = $derived.by(() => { let v: any = { enabled: false, time: '19:00', permission: 'default' }; reminderStore.subscribe(x => v = x)(); return v; });
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-6 pb-24">
	<div>
		<h1 class="text-xl font-bold">Profil</h1>
		<p class="text-gb-text-muted text-sm">Dein Grower-Profil</p>
	</div>

	<!-- Level Card -->
	<div class="bg-gb-surface rounded-xl p-6 text-center">
		<div class="w-20 h-20 rounded-full bg-gb-green/10 border-2 border-gb-green mx-auto flex items-center justify-center mb-3">
			<span class="text-3xl">{level.icon}</span>
		</div>
		<p class="font-bold text-lg">{level.name}</p>
		<p class="text-sm text-gb-text-muted">Level {level.level} — {xp.total_xp ?? 0} XP</p>
		<div class="mt-3 bg-gb-bg rounded-full h-2 overflow-hidden">
			<div class="bg-gb-green h-full rounded-full transition-all duration-500" style="width: {progress.percent}%"></div>
		</div>
		{#if progress.needed > 0}
			<p class="text-xs text-gb-text-muted mt-1">{progress.current} / {progress.needed} XP zum nächsten Level</p>
		{:else}
			<p class="text-xs text-gb-green mt-1">Max Level erreicht!</p>
		{/if}
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-3 gap-3">
		<div class="bg-gb-surface rounded-xl p-3 text-center">
			<p class="text-2xl font-bold">{grows}</p>
			<p class="text-xs text-gb-text-muted">Grows</p>
		</div>
		<div class="bg-gb-surface rounded-xl p-3 text-center">
			<p class="text-2xl font-bold">{harvests}</p>
			<p class="text-xs text-gb-text-muted">Ernten</p>
		</div>
		<div class="bg-gb-surface rounded-xl p-3 text-center">
			<p class="text-2xl font-bold">{state.checkins.length}</p>
			<p class="text-xs text-gb-text-muted">Check-ins</p>
		</div>
	</div>

	<!-- Achievements -->
	<div>
		<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide mb-3">
			Achievements ({unlockedIds.size}/{ACHIEVEMENTS.length})
		</h2>
		<div class="grid grid-cols-3 gap-3">
			{#each ACHIEVEMENTS as ach}
				{@const unlocked = unlockedIds.has(ach.id)}
				<div class="bg-gb-surface rounded-xl p-3 text-center {unlocked ? '' : 'opacity-30'}" title={ach.description}>
					<p class="text-2xl mb-1">{ach.icon}</p>
					<p class="text-xs {unlocked ? 'text-gb-text' : 'text-gb-text-muted'}">{ach.name}</p>
					{#if unlocked}
						<p class="text-[10px] text-gb-green">+{ach.xp} XP</p>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- XP History -->
	<div>
		<button onclick={() => showHistory = !showHistory}
			class="text-sm text-gb-text-muted hover:text-gb-text flex items-center gap-1">
			<span class="text-xs">{showHistory ? '▼' : '▶'}</span>
			XP-Verlauf ({(xp.events ?? []).length} Events)
		</button>
		{#if showHistory}
			<div class="mt-2 space-y-1 max-h-60 overflow-y-auto">
				{#each (xp.events ?? []).slice().reverse().slice(0, 30) as evt}
					<div class="flex justify-between text-xs bg-gb-surface rounded-lg px-3 py-2">
						<span class="text-gb-text-muted">{evt.description}</span>
						<span class="text-gb-green font-semibold">+{evt.amount} XP</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Einstellungen -->
	<div class="space-y-3">
		<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Einstellungen</h2>

		<!-- Reminders -->
		<div class="bg-gb-surface rounded-xl p-4">
			<div class="flex items-center justify-between">
				<div>
					<p class="font-medium text-sm">Check-in Erinnerung</p>
					<p class="text-xs text-gb-text-muted">Tägliche Benachrichtigung</p>
				</div>
				<button
					onclick={() => reminder.enabled ? reminderStore.disable() : reminderStore.enable()}
					class="w-12 h-7 rounded-full transition-colors relative
						{reminder.enabled ? 'bg-gb-green' : 'bg-gb-border'}">
					<div class="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform
						{reminder.enabled ? 'translate-x-5' : 'translate-x-0.5'}"></div>
				</button>
			</div>
			{#if reminder.enabled}
				<div class="mt-3 flex items-center gap-2">
					<span class="text-xs text-gb-text-muted">Uhrzeit:</span>
					<input type="time" value={reminder.time}
						onchange={(e) => reminderStore.setTime((e.target as HTMLInputElement).value)}
						class="bg-gb-bg border border-gb-border rounded-lg px-2 py-1 text-sm" />
				</div>
			{/if}
		</div>

		<!-- Pro Status -->
		<a href="/pro" class="block bg-gb-surface rounded-xl p-4 hover:bg-gb-surface-2 transition-colors">
			<div class="flex items-center justify-between">
				<div>
					<p class="font-medium text-sm">{userIsPro ? '👑 Pro aktiv' : 'GrowBuddy Pro'}</p>
					<p class="text-xs text-gb-text-muted">{userIsPro ? 'Abo verwalten' : 'Alle Features freischalten'}</p>
				</div>
				<span class="text-gb-text-muted text-sm">&rarr;</span>
			</div>
		</a>
	</div>

	<!-- Cloud-Sync -->
	<div class="bg-gb-surface rounded-xl p-4 text-center">
		<p class="text-sm text-gb-text-muted mb-3">Cloud-Sync kommt bald — deine Daten sind lokal gespeichert</p>
	</div>

	<!-- Footer Links -->
	<div class="flex justify-center gap-4 text-xs text-gb-text-muted">
		<a href="/legal" class="hover:text-gb-text">Impressum & Datenschutz</a>
		<span>·</span>
		<span>v1.0.0</span>
	</div>
</div>
