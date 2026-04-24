<script lang="ts">
	import { xpStore, currentLevel, xpProgress, LEVELS } from '$lib/stores/xp';
	import { growStore, totalGrows, totalHarvests } from '$lib/stores/grow';
	import { proStore, isPro } from '$lib/stores/pro';
	import { reminderStore } from '$lib/stores/reminders';
	import { authStore, isLoggedIn } from '$lib/stores/auth';
	import { syncStore } from '$lib/stores/sync';
	import { t, locale } from '$lib/i18n';
	import type { Locale } from '$lib/i18n';
	import { ACHIEVEMENTS } from '$lib/data/achievements';
	import { downloadBackup, importBackup, readFileAsText } from '$lib/utils/backup';
	import { toastStore } from '$lib/stores/toast';
	import type { AchievementStats, Achievement } from '$lib/data/achievements';
	import type { GrowState } from '$lib/stores/grow';

	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
	let xp = $derived.by(() => { let v: any = {}; xpStore.subscribe(x => v = x)(); return v; });
	let level = $derived.by(() => { let v: any = LEVELS[0]; currentLevel.subscribe(x => v = x)(); return v; });
	let progress = $derived.by(() => { let v = { current: 0, needed: 0, percent: 0 }; xpProgress.subscribe(x => v = x)(); return v; });
	let state = $derived.by(() => { let v: GrowState = { grows: [], checkins: [] }; growStore.subscribe(x => v = x)(); return v; });
	let grows = $derived.by(() => { let v = 0; totalGrows.subscribe(x => v = x)(); return v; });
	let harvests = $derived.by(() => { let v = 0; totalHarvests.subscribe(x => v = x)(); return v; });
	let auth = $derived.by(() => { let v: any = { user: null, loading: true }; authStore.subscribe(x => v = x)(); return v; });
	let loggedIn = $derived.by(() => { let v = false; isLoggedIn.subscribe(x => v = x)(); return v; });
	let sync = $derived.by(() => { let v: any = { status: 'idle', last_synced: null }; syncStore.subscribe(x => v = x)(); return v; });

	let loginEmail = $state('');
	let loginLoading = $state(false);
	let loginMessage = $state('');

	async function sendMagicLink() {
		if (!loginEmail.trim()) return;
		loginLoading = true;
		loginMessage = '';
		const { error } = await authStore.loginWithEmail(loginEmail.trim());
		loginLoading = false;
		if (error) {
			loginMessage = error;
		} else {
			loginMessage = tr('auth.link_sent');
			toastStore.success(tr('auth.link_sent'));
		}
	}

	async function loginGoogle() {
		const { error } = await authStore.loginWithGoogle();
		if (error) toastStore.warning(error);
	}

	async function logout() {
		await authStore.logout();
		toastStore.info(tr('auth.logout'));
	}

	async function pushSync() {
		if (!auth.user) return;
		const ok = await syncStore.push(auth.user.id, state);
		if (ok) toastStore.success(tr('sync.success'));
		else toastStore.warning(tr('sync.error'));
	}

	async function pullSync() {
		if (!auth.user) return;
		const data = await syncStore.pull(auth.user.id);
		if (data) {
			// Last-Write-Wins Merge via updated_at — schützt Offline-Edits
			const pickNewer = <T extends { updated_at?: string }>(a: T, b: T): T => {
				const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
				const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
				return ta >= tb ? a : b;
			};

			const growsById = new Map(state.grows.map(g => [g.id, g]));
			for (const cg of data.grows) {
				const local = growsById.get(cg.id);
				growsById.set(cg.id, local ? pickNewer(local, cg) : cg);
			}
			const mergedGrows = Array.from(growsById.values());

			const checkinsById = new Map(state.checkins.map(c => [c.id, c]));
			for (const cc of data.checkins) {
				const local = checkinsById.get(cc.id);
				if (local) {
					const winner = pickNewer(local, cc);
					// Lokale Foto-Base64 bewahren, auch wenn Cloud gewinnt
					checkinsById.set(cc.id, local.photo_data && winner === cc ? { ...cc, photo_data: local.photo_data } : winner);
				} else {
					checkinsById.set(cc.id, cc);
				}
			}
			const mergedCheckins = Array.from(checkinsById.values());

			growStore.replaceState({ grows: mergedGrows, checkins: mergedCheckins });
			toastStore.success(tr('sync.success'));
		} else {
			toastStore.warning(tr('sync.error'));
		}
	}

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
		longest_streak: 0,
		total_xp: xp.total_xp ?? 0,
		calc_uses: Object.keys(xp.daily_checkins ?? {}).filter((k: string) => k.startsWith('calc_')).length,
		tool_uses: Object.keys(xp.daily_checkins ?? {}).filter((k: string) => k.startsWith('tool_')).length,
	});

	let unlockedIds = $derived(new Set(
		ACHIEVEMENTS.filter(a => a.check(stats)).map(a => a.id)
	));

	$effect(() => {
		for (const ach of ACHIEVEMENTS) {
			if (unlockedIds.has(ach.id)) {
				xpStore.awardAchievementOnce(ach.id, ach.name, ach.xp);
			}
		}
	});

	let showHistory = $state(false);
	let userIsPro = $derived.by(() => { let v = false; isPro.subscribe(x => v = x)(); return v; });
	let reminder = $derived.by(() => { let v: any = { enabled: false, time: '19:00', permission: 'default' }; reminderStore.subscribe(x => v = x)(); return v; });
	let currentLocale = $derived.by(() => { let v: Locale = 'de'; locale.subscribe(x => v = x)(); return v; });
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-6 pb-24">
	<div>
		<h1 class="text-xl font-bold">{tr('profile.title')}</h1>
		<p class="text-gb-text-muted text-sm">{tr('profile.subtitle')}</p>
	</div>

	<!-- Level Card -->
	<div class="bg-gb-surface rounded-xl p-6 text-center">
		<div class="w-20 h-20 rounded-full bg-gb-green/10 border-2 border-gb-green mx-auto flex items-center justify-center mb-3">
			<span class="text-3xl">{level.icon}</span>
		</div>
		<p class="font-bold text-lg">{level.name}</p>
		<p class="text-sm text-gb-text-muted">{tr('profile.level', { level: level.level, xp: xp.total_xp ?? 0 })}</p>
		<div class="mt-3 bg-gb-bg rounded-full h-2 overflow-hidden">
			<div class="bg-gb-green h-full rounded-full transition-all duration-500" style="width: {progress.percent}%"></div>
		</div>
		{#if progress.needed > 0}
			<p class="text-xs text-gb-text-muted mt-1">{tr('profile.xp_to_next', { current: progress.current, needed: progress.needed })}</p>
		{:else}
			<p class="text-xs text-gb-green mt-1">{tr('profile.max_level')}</p>
		{/if}
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-3 gap-3">
		<div class="bg-gb-surface rounded-xl p-3 text-center">
			<p class="text-2xl font-bold">{grows}</p>
			<p class="text-xs text-gb-text-muted">{tr('profile.grows')}</p>
		</div>
		<div class="bg-gb-surface rounded-xl p-3 text-center">
			<p class="text-2xl font-bold">{harvests}</p>
			<p class="text-xs text-gb-text-muted">{tr('profile.harvests')}</p>
		</div>
		<div class="bg-gb-surface rounded-xl p-3 text-center">
			<p class="text-2xl font-bold">{state.checkins.length}</p>
			<p class="text-xs text-gb-text-muted">{tr('grow.checkins')}</p>
		</div>
	</div>

	<!-- Achievements -->
	<div>
		<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide mb-3">
			{tr('profile.achievements')} ({unlockedIds.size}/{ACHIEVEMENTS.length})
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
			{tr('profile.xp_history')} ({tr('profile.events', { count: (xp.events ?? []).length })})
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
	<a href="/settings" class="block bg-gb-surface rounded-xl p-4 hover:bg-gb-surface-2 transition-colors">
		<div class="flex items-center justify-between">
			<div>
				<p class="font-medium text-sm">⚙️ {tr('profile.settings')}</p>
				<p class="text-xs text-gb-text-muted">Reminder, Sprache, Pro, Backup</p>
			</div>
			<span class="text-gb-text-muted text-sm">&rarr;</span>
		</div>
	</a>

	<!-- Daten-Backup -->
	<div class="space-y-3">
		<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Daten</h2>
		<div class="bg-gb-surface rounded-xl p-4 space-y-3">
			<div class="flex gap-3">
				<button onclick={() => { downloadBackup(); toastStore.success('Backup heruntergeladen'); }}
					class="flex-1 bg-gb-green/10 border border-gb-green/20 text-gb-green font-medium text-sm py-2.5 rounded-lg hover:bg-gb-green/20 transition-colors">
					📦 Export
				</button>
				<label class="flex-1 bg-gb-info/10 border border-gb-info/20 text-gb-info font-medium text-sm py-2.5 rounded-lg hover:bg-gb-info/20 transition-colors text-center cursor-pointer">
					📥 Import
					<input type="file" accept=".json" class="hidden" onchange={async (e) => {
						const input = e.target as HTMLInputElement;
						if (!input.files?.[0]) return;
						const text = await readFileAsText(input.files[0]);
						const result = importBackup(text);
						if (result.success) {
							toastStore.success(`${result.keys} Datensätze importiert — App wird neu geladen`);
							setTimeout(() => window.location.reload(), 1500);
						} else {
							toastStore.warning(result.error ?? 'Import fehlgeschlagen');
						}
					}} />
				</label>
			</div>
			<p class="text-xs text-gb-text-muted text-center">Sichere deine Daten als JSON-Datei</p>
		</div>
	</div>

	<!-- Account & Cloud-Sync -->
	<div class="space-y-3">
		<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">{tr('sync.title')}</h2>

		{#if loggedIn}
			<!-- Eingeloggt -->
			<div class="bg-gb-surface rounded-xl p-4 space-y-3">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium">{tr('auth.logged_in_as')}</p>
						<p class="text-xs text-gb-text-muted">{auth.user?.email ?? ''}</p>
					</div>
					<button onclick={logout}
						class="text-xs text-gb-danger bg-gb-danger/10 px-3 py-1.5 rounded-lg font-medium hover:bg-gb-danger/20">
						{tr('auth.logout')}
					</button>
				</div>

				<!-- Sync Buttons -->
				<div class="flex gap-3">
					<button onclick={pushSync}
						disabled={sync.status === 'syncing'}
						class="flex-1 bg-gb-green/10 border border-gb-green/20 text-gb-green font-medium text-sm py-2.5 rounded-lg hover:bg-gb-green/20 transition-colors disabled:opacity-50">
						{sync.status === 'syncing' ? tr('sync.syncing') : '☁️↑ ' + tr('sync.push')}
					</button>
					<button onclick={pullSync}
						disabled={sync.status === 'syncing'}
						class="flex-1 bg-gb-info/10 border border-gb-info/20 text-gb-info font-medium text-sm py-2.5 rounded-lg hover:bg-gb-info/20 transition-colors disabled:opacity-50">
						{sync.status === 'syncing' ? tr('sync.syncing') : '☁️↓ ' + tr('sync.pull')}
					</button>
				</div>

				<p class="text-xs text-gb-text-muted text-center">
					{#if sync.last_synced}
						{tr('sync.last', { date: new Date(sync.last_synced).toLocaleString() })}
					{:else}
						{tr('sync.never')}
					{/if}
				</p>
			</div>
		{:else}
			<!-- Nicht eingeloggt -->
			<div class="bg-gb-surface rounded-xl p-5 space-y-4">
				<p class="text-sm text-center text-gb-text-muted">{tr('auth.login_for_sync')}</p>

				<!-- Google Login -->
				<button onclick={loginGoogle}
					class="w-full flex items-center justify-center gap-2 bg-white text-gray-700 font-medium text-sm py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
					<svg class="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
					{tr('auth.google')}
				</button>

				<div class="flex items-center gap-3">
					<div class="flex-1 h-px bg-gb-border"></div>
					<span class="text-xs text-gb-text-muted">{tr('auth.or')}</span>
					<div class="flex-1 h-px bg-gb-border"></div>
				</div>

				<!-- Magic Link -->
				<div class="space-y-2">
					<input type="email" bind:value={loginEmail} placeholder={tr('auth.email_placeholder')}
						class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
					<button onclick={sendMagicLink}
						disabled={loginLoading || !loginEmail.trim()}
						class="w-full bg-gb-green text-black font-medium text-sm py-2.5 rounded-lg hover:bg-gb-green/80 transition-colors disabled:opacity-50">
						{loginLoading ? '...' : tr('auth.send_link')}
					</button>
				</div>

				{#if loginMessage}
					<p class="text-xs text-center text-gb-green">{loginMessage}</p>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Footer Links -->
	<div class="flex justify-center gap-4 text-xs text-gb-text-muted">
		<a href="/legal" class="hover:text-gb-text">{tr('profile.legal')}</a>
		<span>·</span>
		<span>v{__APP_VERSION__}</span>
	</div>
</div>
