<script lang="ts">
	import { reminderStore } from '$lib/stores/reminders';
	import { t, locale } from '$lib/i18n';
	import type { Locale } from '$lib/i18n';
	import { downloadBackup, importBackup, readFileAsText } from '$lib/utils/backup';
	import { toastStore } from '$lib/stores/toast';
	import { isPro } from '$lib/stores/pro';
	import { authStore, isLoggedIn } from '$lib/stores/auth';
	import { xpStore } from '$lib/stores/xp';
	import { streakStore } from '$lib/stores/streak';
	import { growStore } from '$lib/stores/grow';
	import { householdStore, complianceStatus } from '$lib/stores/household';
	import { privacyStore } from '$lib/stores/privacy';
	import { estimateStorageQuota } from '$lib/utils/storage-safe';
	import { onboardingStore } from '$lib/stores/onboarding';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
	let reminder = $state<any>({ enabled: false, time: '19:00', permission: 'default', streak_alerts: true });
	let currentLocale = $state<Locale>('de');
	let userIsPro = $state(false);
	let loggedIn = $state(false);
	let auth = $state<any>({ user: null });
	let household = $state<{ adults: number }>({ adults: 1 });
	let compliance = $state<{ adults: number; limit: number; current: number; over: boolean; remaining: number }>({ adults: 1, limit: 3, current: 0, over: false, remaining: 3 });
	let privacy = $state<{ localOnly: boolean }>({ localOnly: false });
	let storage = $state<{ used: number; quota: number; percent: number } | null>(null);

	function fmtMB(bytes: number): string {
		return (bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0);
	}

	onMount(() => {
		const subs = [
			reminderStore.subscribe(v => reminder = v),
			locale.subscribe(v => currentLocale = v),
			isPro.subscribe(v => userIsPro = v),
			isLoggedIn.subscribe(v => loggedIn = v),
			authStore.subscribe(v => auth = v),
			householdStore.subscribe(v => household = v),
			complianceStatus.subscribe(v => compliance = v),
			privacyStore.subscribe(v => privacy = v),
		];
		estimateStorageQuota().then(s => storage = s);
		return () => subs.forEach(u => u());
	});

	let showDangerZone = $state(false);
	let showDeleteAccount = $state(false);
	let deleteConfirmText = $state('');
	let deletingAccount = $state(false);

	// v1.4.0: Custom-Confirm-Sheet statt nativer confirm() — dark-themed, konsistent zum Rest der App
	type Confirm = {
		title: string;
		message: string;
		confirmLabel: string;
		danger?: boolean;
		typeToConfirm?: string;  // wenn gesetzt: User muss diesen String tippen (z.B. "LÖSCHEN")
		onConfirm: () => void | Promise<void>;
	};
	let pendingConfirm: Confirm | null = $state(null);
	let confirmTypeText = $state('');
	function closeConfirm() {
		pendingConfirm = null;
		confirmTypeText = '';
	}
	async function runConfirm() {
		if (!pendingConfirm) return;
		const fn = pendingConfirm.onConfirm;
		closeConfirm();
		await fn();
	}

	async function logout() {
		await authStore.logout();
		toastStore.info('Abgemeldet');
	}

	function resetXP() {
		pendingConfirm = {
			title: 'XP & Achievements zurücksetzen?',
			message: 'Alle gesammelten XP, Level und Streak-Milestones werden gelöscht. Deine Grows und Check-ins bleiben erhalten.',
			confirmLabel: 'Zurücksetzen',
			danger: true,
			onConfirm: () => {
				xpStore.reset();
				streakStore.reset();
				toastStore.success('XP zurückgesetzt');
			},
		};
	}

	function resetOnboarding() {
		pendingConfirm = {
			title: 'Onboarding erneut anzeigen?',
			message: 'Du wirst zum Willkommens-Bildschirm geleitet. Deine Daten bleiben erhalten.',
			confirmLabel: 'Anzeigen',
			onConfirm: () => {
				onboardingStore.reset();
				toastStore.success('Onboarding zurückgesetzt');
				setTimeout(() => goto('/onboarding', { replaceState: true }), 300);
			},
		};
	}

	function resetAll() {
		pendingConfirm = {
			title: 'Wirklich alle Daten löschen?',
			message: 'Alle Grows, Check-ins, Fotos und Fortschritt werden unwiderruflich gelöscht. Tippe LÖSCHEN zur Bestätigung.',
			confirmLabel: 'Alles löschen',
			danger: true,
			typeToConfirm: 'LÖSCHEN',
			onConfirm: () => {
				xpStore.reset();
				streakStore.reset();
				growStore.replaceState({ grows: [], checkins: [] });
				localStorage.removeItem('growbuddy_reminders');
				localStorage.removeItem('growbuddy_sync');
				toastStore.success('Alles zurückgesetzt — App wird neu geladen');
				setTimeout(() => window.location.reload(), 1500);
			},
		};
	}

	async function deleteAccount() {
		const userId = auth.user?.id;
		if (!userId) return;
		deletingAccount = true;
		try {
			// Cloud-Daten löschen (RLS sorgt für Eigentümer-Match)
			await supabase.from('checkins').delete().eq('user_id', userId);
			await supabase.from('grows').delete().eq('user_id', userId);
			// Storage-Fotos im User-Folder
			try {
				const { data: list } = await supabase.storage.from('checkin-photos').list(userId);
				if (list?.length) {
					await supabase.storage.from('checkin-photos').remove(list.map(f => `${userId}/${f.name}`));
				}
			} catch {}
			// RPC zum Auth-Eintrag löschen (falls in Supabase definiert) — fail-soft
			try { await supabase.rpc('delete_my_account'); } catch {}
			await supabase.auth.signOut();

			// Lokal alles weg
			xpStore.reset();
			streakStore.reset();
			growStore.replaceState({ grows: [], checkins: [] });
			localStorage.removeItem('growbuddy_reminders');
			localStorage.removeItem('growbuddy_sync');
			toastStore.success('Konto und Daten gelöscht');
			setTimeout(() => window.location.reload(), 1500);
		} catch (e: any) {
			toastStore.add({ message: 'Löschung fehlgeschlagen: ' + (e?.message ?? 'unbekannter Fehler'), type: 'warning', icon: '⚠️' });
		} finally {
			deletingAccount = false;
			showDeleteAccount = false;
			deleteConfirmText = '';
		}
	}
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-5 pb-24">
	<div>
		<a href="/profile" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; Profil</a>
		<h1 class="text-xl font-bold mt-2">Einstellungen</h1>
	</div>

	<!-- Account -->
	{#if loggedIn}
		<div class="bg-gb-surface rounded-xl p-4">
			<div class="flex items-center justify-between">
				<div>
					<p class="font-medium text-sm">Account</p>
					<p class="text-xs text-gb-text-muted">{auth.user?.email ?? ''}</p>
				</div>
				<button onclick={logout}
					class="text-xs text-gb-danger bg-gb-danger/10 px-3 py-1.5 rounded-lg font-medium">
					Abmelden
				</button>
			</div>
		</div>
	{:else}
		<a href="/profile" class="block bg-gb-surface rounded-xl p-4 hover:bg-gb-surface-2 transition-colors">
			<p class="font-medium text-sm">Anmelden für Cloud-Sync</p>
			<p class="text-xs text-gb-text-muted">Grows + Check-ins geräteübergreifend synchronisieren</p>
		</a>
	{/if}

	<!-- Erinnerungen -->
	<div class="space-y-3">
		<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Erinnerungen</h2>
		<div class="bg-gb-surface rounded-xl p-4 space-y-3">
			<div class="flex items-center justify-between">
				<div>
					<p class="font-medium text-sm">Täglicher Check-in-Reminder</p>
					<p class="text-xs text-gb-text-muted">Push-Benachrichtigung zur gewählten Zeit</p>
				</div>
				<button
					onclick={() => reminder.enabled ? reminderStore.disable() : reminderStore.enable()}
					aria-label="Reminder umschalten"
					class="w-12 h-7 rounded-full transition-colors relative
						{reminder.enabled ? 'bg-gb-green' : 'bg-gb-border'}">
					<div class="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform
						{reminder.enabled ? 'translate-x-5' : 'translate-x-0.5'}"></div>
				</button>
			</div>
			{#if reminder.enabled}
				<div class="flex items-center gap-2 pt-2 border-t border-gb-border">
					<span class="text-xs text-gb-text-muted">Zeit:</span>
					<input type="time" value={reminder.time}
						onchange={(e) => reminderStore.setTime((e.target as HTMLInputElement).value)}
						class="bg-gb-bg border border-gb-border rounded-lg px-2 py-1 text-sm" />
				</div>
				<div class="flex items-center justify-between pt-2 border-t border-gb-border">
					<div>
						<p class="text-sm">🔥 Streak-Warnung</p>
						<p class="text-xs text-gb-text-muted">Extra-Reminder 22:00 wenn Streak läuft</p>
					</div>
					<button
						onclick={() => reminderStore.setStreakAlerts(!reminder.streak_alerts)}
						aria-label="Streak-Alerts umschalten"
						class="w-10 h-6 rounded-full transition-colors relative
							{reminder.streak_alerts ? 'bg-gb-warning' : 'bg-gb-border'}">
						<div class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
							{reminder.streak_alerts ? 'translate-x-4' : 'translate-x-0.5'}"></div>
					</button>
				</div>
			{/if}
			{#if reminder.permission === 'denied'}
				<div class="bg-gb-danger/10 border border-gb-danger/30 rounded-lg p-3 space-y-2">
					<p class="text-xs text-gb-danger font-medium">⚠️ Benachrichtigungen blockiert</p>
					<p class="text-xs text-gb-text-muted">Aktiviere sie in den App-Einstellungen deines Geräts unter „GrowBuddy → Benachrichtigungen", damit Reminder funktionieren.</p>
					<button onclick={() => reminderStore.requestPermission()}
						class="w-full bg-gb-danger/20 text-gb-danger text-xs font-medium py-2 rounded-lg"
						style="min-height:44px">
						Erneut anfragen
					</button>
				</div>
			{:else if reminder.enabled && reminder.permission !== 'granted'}
				<p class="text-xs text-gb-warning">⚠️ Permission noch nicht erteilt — Reminder wird nicht erscheinen</p>
			{/if}
		</div>
	</div>

	<!-- Sprache -->
	<div class="space-y-3">
		<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Sprache</h2>
		<div class="bg-gb-surface rounded-xl p-4">
			<div class="flex items-center justify-between">
				<div>
					<p class="font-medium text-sm">App-Sprache</p>
					<p class="text-xs text-gb-text-muted">{currentLocale === 'de' ? 'Deutsch' : 'English'}</p>
				</div>
				<div class="flex gap-1">
					<button onclick={() => locale.set('de')}
						class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
							{currentLocale === 'de' ? 'bg-gb-green text-gb-bg' : 'bg-gb-bg text-gb-text-muted'}">
						DE
					</button>
					<button onclick={() => locale.set('en')}
						class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
							{currentLocale === 'en' ? 'bg-gb-green text-gb-bg' : 'bg-gb-bg text-gb-text-muted'}">
						EN
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Anbau & Recht -->
	<div class="space-y-3">
		<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Anbau &amp; Recht</h2>
		<div class="bg-gb-surface rounded-xl p-4 space-y-3">
			<div class="flex items-center justify-between gap-3">
				<div class="min-w-0">
					<p class="font-medium text-sm">Erwachsene im Haushalt</p>
					<p class="text-xs text-gb-text-muted">Volljährige (18+) — je Person 3 Pflanzen erlaubt</p>
				</div>
				<div class="flex items-center gap-2 shrink-0">
					<button onclick={() => householdStore.decrement()} aria-label="Weniger Erwachsene"
						disabled={household.adults <= 1}
						class="w-11 h-11 rounded-lg bg-gb-bg border border-gb-border text-xl font-bold leading-none disabled:opacity-40 hover:bg-gb-surface-2 transition-colors">
						−
					</button>
					<span class="w-8 text-center font-bold text-lg tabular-nums">{household.adults}</span>
					<button onclick={() => householdStore.increment()} aria-label="Mehr Erwachsene"
						disabled={household.adults >= 20}
						class="w-11 h-11 rounded-lg bg-gb-bg border border-gb-border text-xl font-bold leading-none disabled:opacity-40 hover:bg-gb-surface-2 transition-colors">
						+
					</button>
				</div>
			</div>

			<div class="flex items-center justify-between pt-3 border-t border-gb-border text-sm">
				<span class="text-gb-text-muted">Erlaubtes Pflanzen-Limit</span>
				<span class="font-bold">{compliance.limit} Pflanzen</span>
			</div>

			{#if compliance.over}
				<div class="bg-gb-warning/10 border border-gb-warning/30 rounded-lg p-3">
					<p class="text-xs text-gb-warning font-medium leading-relaxed">
						⚠️ {compliance.current} Pflanzen in aktiven Grows — über dem Limit von {compliance.limit}.
						Erhöhe die Personenzahl oder reduziere Pflanzen.
					</p>
				</div>
			{:else}
				<p class="text-xs text-gb-text-muted">
					Aktuell {compliance.current} Pflanze{compliance.current === 1 ? '' : 'n'} in aktiven Grows.
				</p>
			{/if}

			<p class="text-[11px] text-gb-text-muted leading-relaxed border-t border-gb-border pt-3">
				Deutschland (KCanG): max. 3 lebende Pflanzen <strong>pro volljähriger Person</strong> im Haushalt
				gleichzeitig. <span class="text-gb-text-dim">Keine Rechtsberatung.</span>
			</p>
			<a href="/legal?tab=cannabis" class="block text-xs text-gb-green font-medium">Mehr zum Cannabis-Recht →</a>
		</div>
	</div>

	<!-- Pro -->
	<div class="space-y-3">
		<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Abo</h2>
		<a href="/pro" class="block bg-gb-surface rounded-xl p-4 hover:bg-gb-surface-2 transition-colors">
			<div class="flex items-center justify-between">
				<div>
					<p class="font-medium text-sm">{userIsPro ? '👑 Pro aktiv' : 'GrowBuddy Pro'}</p>
					<p class="text-xs text-gb-text-muted">{userIsPro ? 'Abo verwalten' : 'Alle Features freischalten'}</p>
				</div>
				<span class="text-gb-text-muted text-sm">→</span>
			</div>
		</a>
	</div>

	<!-- Cloud & Privatsphäre -->
	<div class="space-y-3">
		<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Cloud &amp; Privatsphäre</h2>
		<div class="bg-gb-surface rounded-xl p-4 space-y-3">
			<div class="flex items-center justify-between gap-3">
				<div class="min-w-0">
					<p class="font-medium text-sm">Nur lokal (Cloud aus)</p>
					<p class="text-xs text-gb-text-muted">Synchronisiert nichts — alle Daten &amp; Fotos bleiben auf diesem Gerät.</p>
				</div>
				<button
					onclick={() => privacyStore.setLocalOnly(!privacy.localOnly)}
					aria-label="Nur-lokal-Modus umschalten"
					class="w-12 h-7 rounded-full transition-colors relative shrink-0
						{privacy.localOnly ? 'bg-gb-green' : 'bg-gb-border'}">
					<div class="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform
						{privacy.localOnly ? 'translate-x-5' : 'translate-x-0.5'}"></div>
				</button>
			</div>

			{#if privacy.localOnly && loggedIn}
				<div class="bg-gb-info/10 border border-gb-info/20 rounded-lg p-2.5">
					<p class="text-xs text-gb-text-muted">☁️ Cloud-Sync pausiert — du bleibst eingeloggt. Schalter aus = Sync wieder an.</p>
				</div>
			{/if}

			{#if storage}
				<div class="pt-2 border-t border-gb-border space-y-1.5">
					<div class="flex items-center justify-between text-xs">
						<span class="text-gb-text-muted">Lokaler Speicher</span>
						<span class="font-medium">{fmtMB(storage.used)} MB{storage.quota ? ` / ${fmtMB(storage.quota)} MB` : ''}</span>
					</div>
					{#if storage.quota}
						<div class="h-1.5 bg-gb-bg rounded-full overflow-hidden">
							<div class="h-full rounded-full {storage.percent > 85 ? 'bg-gb-danger' : 'bg-gb-green'}"
								style="width: {Math.max(2, Math.min(100, storage.percent))}%"></div>
						</div>
					{/if}
				</div>
			{/if}

			<p class="text-[11px] text-gb-text-muted leading-relaxed">
				Fotos &amp; Check-ins werden lokal auf dem Gerät gespeichert. Sichere sie regelmäßig per Export (unten).
			</p>
		</div>
	</div>

	<!-- Daten -->
	<div class="space-y-3">
		<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Daten</h2>
		<div class="bg-gb-surface rounded-xl p-4 space-y-3">
			<div class="flex gap-3">
				<button onclick={async () => {
						try {
							const path = await downloadBackup();
							toastStore.success(`Backup gespeichert: ${path}`);
						} catch (e) {
							toastStore.error('Backup fehlgeschlagen: ' + ((e as any)?.message ?? 'unbekannt'));
						}
					}}
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
							toastStore.success(`${result.keys} Datensätze importiert`);
							setTimeout(() => window.location.reload(), 1500);
						} else {
							toastStore.add({ message: result.error ?? 'Import fehlgeschlagen', type: 'warning', icon: '⚠️' });
						}
					}} />
				</label>
			</div>
			<p class="text-xs text-gb-text-muted text-center">Sichere deine Daten als JSON-Datei</p>
		</div>
	</div>

	<!-- Danger Zone -->
	<div class="space-y-3">
		<button onclick={() => showDangerZone = !showDangerZone}
			class="text-xs text-gb-danger flex items-center gap-1">
			<span>{showDangerZone ? '▼' : '▶'}</span>
			Danger Zone
		</button>
		{#if showDangerZone}
			<div class="bg-gb-danger/5 border border-gb-danger/20 rounded-xl p-4 space-y-3">
				<button onclick={resetOnboarding}
					class="w-full bg-gb-warning/10 text-gb-warning font-medium text-sm py-2 rounded-lg hover:bg-gb-warning/20 transition-colors"
					style="min-height:44px">
					🔄 Onboarding erneut anzeigen
				</button>
				<button onclick={resetXP}
					class="w-full bg-gb-danger/10 text-gb-danger font-medium text-sm py-2 rounded-lg hover:bg-gb-danger/20 transition-colors"
					style="min-height:44px">
					XP + Streak zurücksetzen
				</button>
				<button onclick={resetAll}
					class="w-full bg-gb-danger text-white font-medium text-sm py-2 rounded-lg hover:bg-gb-danger/80 transition-colors"
					style="min-height:44px">
					🗑️ Alles löschen (lokal)
				</button>
				{#if loggedIn}
					<button onclick={() => showDeleteAccount = true}
						class="w-full bg-gb-danger text-white font-medium text-sm py-2 rounded-lg hover:bg-gb-danger/80 transition-colors"
						style="min-height:44px">
						⚠️ Konto + Cloud-Daten löschen
					</button>
				{/if}
			</div>
		{/if}
	</div>

	<!-- v1.4.0: Generischer Confirm-Sheet (ersetzt natives confirm()) -->
	{#if pendingConfirm}
		<div class="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
			onclick={closeConfirm}
			onkeydown={(e) => { if (e.key === 'Escape') closeConfirm(); }}
			role="presentation">
			<div class="bg-gb-surface w-full max-w-sm rounded-2xl p-5 space-y-4"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
				role="dialog" aria-modal="true" tabindex="-1">
				<div>
					<p class="font-semibold text-base">{pendingConfirm.title}</p>
					<p class="text-sm text-gb-text-muted mt-2">{pendingConfirm.message}</p>
				</div>
				{#if pendingConfirm.typeToConfirm}
					<div>
						<label for="confirm-type" class="text-xs text-gb-text-muted">Tippe <span class="font-mono text-gb-danger">{pendingConfirm.typeToConfirm}</span></label>
						<input id="confirm-type" type="text" bind:value={confirmTypeText}
							class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 mt-1 text-sm"
							style="min-height:44px"
							placeholder={pendingConfirm.typeToConfirm} autocapitalize="characters" />
					</div>
				{/if}
				<div class="flex gap-3 pt-1">
					<button onclick={closeConfirm}
						class="flex-1 bg-gb-bg border border-gb-border text-gb-text font-medium rounded-xl"
						style="min-height:48px">
						Abbrechen
					</button>
					<button onclick={runConfirm}
						disabled={!!pendingConfirm.typeToConfirm && confirmTypeText !== pendingConfirm.typeToConfirm}
						class="flex-1 {pendingConfirm.danger ? 'bg-gb-danger text-white' : 'bg-gb-green text-gb-bg'} font-medium rounded-xl disabled:opacity-50"
						style="min-height:48px">
						{pendingConfirm.confirmLabel}
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if showDeleteAccount}
		<div class="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
			onclick={() => { if (!deletingAccount) { showDeleteAccount = false; deleteConfirmText = ''; } }}
			onkeydown={(e) => { if (e.key === 'Escape' && !deletingAccount) { showDeleteAccount = false; deleteConfirmText = ''; } }}
			role="presentation">
			<div class="bg-gb-surface w-full max-w-sm rounded-2xl p-5 space-y-4"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
				role="dialog" aria-modal="true" tabindex="-1">
				<div>
					<p class="font-semibold text-base">Konto endgültig löschen?</p>
					<p class="text-sm text-gb-text-muted mt-2">Cloud-Daten (Grows, Check-ins, Fotos), lokale Daten und Login werden entfernt. Dieser Vorgang ist <span class="text-gb-danger font-medium">unwiderruflich</span>.</p>
				</div>
				<div>
					<label for="delete-confirm" class="text-xs text-gb-text-muted">Tippe <span class="font-mono text-gb-danger">LÖSCHEN</span> zur Bestätigung:</label>
					<input id="delete-confirm" type="text" bind:value={deleteConfirmText} disabled={deletingAccount}
						class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 mt-1 text-sm"
						style="min-height:44px"
						placeholder="LÖSCHEN" autocapitalize="characters" />
				</div>
				<div class="flex gap-3 pt-1">
					<button onclick={() => { showDeleteAccount = false; deleteConfirmText = ''; }} disabled={deletingAccount}
						class="flex-1 bg-gb-bg border border-gb-border text-gb-text font-medium rounded-xl"
						style="min-height:48px">
						Abbrechen
					</button>
					<button onclick={deleteAccount} disabled={deleteConfirmText !== 'LÖSCHEN' || deletingAccount}
						class="flex-1 bg-gb-danger text-white font-medium rounded-xl disabled:opacity-50"
						style="min-height:48px">
						{deletingAccount ? '…' : 'Löschen'}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Footer -->
	<div class="flex justify-center gap-4 text-xs text-gb-text-muted pt-4">
		<a href="/legal" class="hover:text-gb-text">Rechtliches</a>
		<span>·</span>
		<span>v{__APP_VERSION__}</span>
	</div>
</div>
