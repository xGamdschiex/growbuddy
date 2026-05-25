<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onboardingStore } from '$lib/stores/onboarding';
	import { reminderStore } from '$lib/stores/reminders';
	import { toastStore } from '$lib/stores/toast';
	import { hasCheckinToday, currentStreak } from '$lib/stores/streak';
	import { authStore } from '$lib/stores/auth';
	import { syncStore } from '$lib/stores/sync';
	import { privacyStore } from '$lib/stores/privacy';
	import { growStore, demoActive } from '$lib/stores/grow';
	import type { GrowState, Grow, CheckIn } from '$lib/stores/grow';
	import { t } from '$lib/i18n';
	import { hapticLight } from '$lib/utils/haptic';
	import InstallPrompt from '$lib/components/InstallPrompt.svelte';
	import type { Toast } from '$lib/stores/toast';
	import type { Snippet } from 'svelte';
	import { Capacitor } from '@capacitor/core';
	import { App as CapacitorApp } from '@capacitor/app';
	import { Browser } from '@capacitor/browser';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { logger } from '$lib/utils/logger';
	import { shouldShowBackupReminder, markReminderShown } from '$lib/utils/backup-reminder';
	import { tombstones } from '$lib/utils/tombstones';

	let { children }: { children: Snippet } = $props();
	let toasts = $state<Toast[]>([]);
	let onboarding = $state<any>({ completed: false });
	let tr = $state<any>((k: string) => k);
	// Reaktive Subscriptions (Tab-Wechsel-Bug: $derived.by sah Store-Updates nicht)
	let auth = $state<any>({ user: null, loading: true });
	let growState = $state<GrowState>({ grows: [], checkins: [] });
	let demoOn = $state(false);
	let localOnly = $state(false);
	onMount(() => {
		// Persistenten Speicher anfragen → OS verdrängt lokale Daten/Fotos nicht (Durability)
		try { navigator.storage?.persist?.(); } catch { /* nicht unterstützt */ }
		const subs = [
			onboardingStore.subscribe(v => onboarding = v),
			authStore.subscribe(v => auth = v),
			growStore.subscribe(v => growState = v),
			toastStore.subscribe(v => toasts = v),
			t.subscribe(v => tr = v),
			demoActive.subscribe(v => demoOn = v),
			privacyStore.subscribe(v => localOnly = v.localOnly),
		];
		return () => subs.forEach(u => u());
	});

	function clearDemoBanner() {
		growStore.clearDemo();
		toastStore.info('Demo-Modus beendet');
	}

	let showUpdateBanner = $state(false);
	let waitingSW: ServiceWorker | null = null;

	let currentPath = $derived($page.url.pathname);
	let isOnboardingPage = $derived(currentPath === '/onboarding');
	let hydrated = $state(false);
	let onboardingDone = $derived.by(() => {
		if (!hydrated) return false;
		return onboarding.completed;
	});
	let showNav = $derived(onboardingDone && !isOnboardingPage);
	// Demo-Banner nur wenn Demo-Daten aktiv UND App nutzbar (kein Onboarding/Loading)
	let showDemoBanner = $derived(demoOn && onboardingDone && !isOnboardingPage);

	// Offline Status
	let isOffline = $state(false);

	// Cloud-Sync Auto-Flow
	let lastPulledUserId = $state<string | null>(null);
	let pushTimer: any = null;
	let pushReady = $state(false);
	let initialPullPending = $state(false);

	// Hydration einmalig setzen
	$effect(() => {
		if (!hydrated) hydrated = true;
	});

	// Onboarding-Redirect nur bei tatsächlichem Bedarf — re-runs minimieren
	let lastRedirectFor = $state<string | null>(null);
	$effect(() => {
		if (!hydrated) return;
		if (isOnboardingPage) return;
		if (onboarding.completed) return;
		const key = currentPath;
		if (lastRedirectFor === key) return; // bereits in dieser Session umgeleitet
		lastRedirectFor = key;
		logger.info('[onboarding] redirect', { from: currentPath, to: '/onboarding' });
		goto('/onboarding', { replaceState: true });
	});

	// Auto-Pull bei Login-Event (Cloud → Local Merge)
	$effect(() => {
		if (!auth.user) {
			lastPulledUserId = null;
			pushReady = false;
			return;
		}
		// Nur-lokal-Modus: keinerlei Cloud-Kontakt (kein Pull/Push)
		if (localOnly) { pushReady = false; initialPullPending = false; return; }
		if (lastPulledUserId === auth.user.id) return;
		lastPulledUserId = auth.user.id;
		const uid = auth.user.id;
		initialPullPending = true;

		syncStore.pull(uid).then(cloud => {
			if (!cloud) { pushReady = true; initialPullPending = false; return; }
			const pickNewer = <T extends { updated_at?: string }>(a: T, b: T): T => {
				const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
				const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
				return ta >= tb ? a : b;
			};
			// v1.4.7: Lokal gelöschte IDs ignorieren — sonst kommen sie aus Cloud zurück
			const tomb = tombstones.get();
			const deletedGrowIds = new Set(tomb.grows);
			const deletedCheckinIds = new Set(tomb.checkins);
			const local = growState;
			const growsById = new Map(local.grows.map(g => [g.id, g]));
			for (const cg of cloud.grows) {
				if (deletedGrowIds.has(cg.id)) continue;  // tombstone
				const l = growsById.get(cg.id);
				growsById.set(cg.id, l ? pickNewer(l, cg) : cg);
			}
			const checkinsById = new Map(local.checkins.map(c => [c.id, c]));
			for (const cc of cloud.checkins) {
				if (deletedCheckinIds.has(cc.id)) continue;  // tombstone
				const l = checkinsById.get(cc.id);
				if (l) {
					const winner = pickNewer(l, cc);
					if (winner === cc) {
						checkinsById.set(cc.id, {
							...cc,
							photo_data: l.photo_data ?? cc.photo_data,
							photos_data: l.photos_data?.length ? l.photos_data : (cc.photos_data ?? []),
						});
					} else {
						checkinsById.set(cc.id, winner);
					}
				} else {
					checkinsById.set(cc.id, cc);
				}
			}
			growStore.replaceState({
				grows: Array.from(growsById.values()),
				checkins: Array.from(checkinsById.values()),
			});
			setTimeout(() => { pushReady = true; initialPullPending = false; }, 500);
		}).catch(() => { pushReady = true; initialPullPending = false; });
	});

	// Auto-Push debounced bei Store-Änderungen (nur wenn eingeloggt + Pull durch + nicht Nur-lokal)
	$effect(() => {
		if (!auth.user || !pushReady || localOnly) return;
		const uid = auth.user.id;
		const snapshot = growState;
		clearTimeout(pushTimer);
		pushTimer = setTimeout(() => {
			syncStore.push(uid, snapshot).catch(() => {});
		}, 2500);
		return () => clearTimeout(pushTimer);
	});

	// Auth: AppUrlOpen-Listener für Custom-Scheme growbuddy://auth/callback
	// Idempotent: gleicher Code wird nie zweimal exchanged (Doppel-Trigger durch Custom-Tab)
	onMount(() => {
		if (!Capacitor.isNativePlatform()) return;
		const processedCodes = new Set<string>();
		let exchanging = false;

		const handle = CapacitorApp.addListener('appUrlOpen', async (event) => {
			logger.info('[auth] appUrlOpen', { url: event.url });
			try {
				const u = new URL(event.url);
				const code = u.searchParams.get('code');
				if (code) {
					if (processedCodes.has(code)) {
						logger.debug('[auth] code already processed, skip');
						await Browser.close().catch(() => {});
						return;
					}
					if (exchanging) {
						logger.debug('[auth] another exchange in flight, skip');
						return;
					}
					exchanging = true;
					processedCodes.add(code);
					logger.info('[auth] exchangeCodeForSession start');
					const { error } = await supabase.auth.exchangeCodeForSession(code);
					exchanging = false;
					if (error) {
						console.warn('[auth] exchangeCodeForSession error', error.message);
						toastStore.warning('Login-Fehler: ' + error.message);
					} else {
						logger.info('[auth] exchangeCodeForSession ok');
					}
					await Browser.close().catch(() => {});
					return;
				}
				// Legacy implicit flow Fallback
				const hash = u.hash.startsWith('#') ? u.hash.slice(1) : u.hash;
				const params = new URLSearchParams(hash);
				const access_token = params.get('access_token');
				const refresh_token = params.get('refresh_token');
				if (access_token && refresh_token) {
					logger.info('[auth] setSession from implicit hash');
					await supabase.auth.setSession({ access_token, refresh_token });
					await Browser.close().catch(() => {});
				}
			} catch (e: any) {
				console.warn('[auth] appUrlOpen error', e);
				toastStore.warning('Auth-Fehler: ' + (e?.message ?? 'unbekannt'));
			}
		});
		return () => { handle.then(h => h.remove()); };
	});

	// Reminder-Timer beim App-Start wiederherstellen + Missed-Check-in prüfen
	$effect(() => {
		if (typeof window === 'undefined') return;
		reminderStore.init();

		// Nach Hydration: heute noch kein Check-in?
		setTimeout(() => {
			let hasToday = false;
			hasCheckinToday.subscribe(v => hasToday = v)();
			let streak: any;
			currentStreak.subscribe(v => streak = v)();
			reminderStore.checkMissedToday(hasToday, streak?.current ?? 0);
		}, 2000);

		// Backup-Reminder (Tester-Schutz): nach 5s checken ob Toast nötig
		setTimeout(() => {
			let count = 0;
			growStore.subscribe(s => count = s.checkins.length)();
			if (shouldShowBackupReminder(count)) {
				markReminderShown();
				toastStore.info('💾 Backup empfohlen — Profil → Daten → Export');
			}
		}, 5000);
	});

	// Service Worker Update-Flow
	$effect(() => {
		if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

		navigator.serviceWorker.ready.then(reg => {
			if (reg.waiting) {
				waitingSW = reg.waiting;
				showUpdateBanner = true;
			}
			reg.addEventListener('updatefound', () => {
				const newWorker = reg.installing;
				if (!newWorker) return;
				newWorker.addEventListener('statechange', () => {
					if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
						waitingSW = newWorker;
						showUpdateBanner = true;
					}
				});
			});
		});

		// Reload wenn neuer SW übernommen hat
		let refreshing = false;
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (refreshing) return;
			refreshing = true;
			window.location.reload();
		});

		// SW → Client Messages (z.B. NAVIGATE aus notificationclick)
		navigator.serviceWorker.addEventListener('message', (event) => {
			if (event.data?.type === 'NAVIGATE' && event.data.url) {
				goto(event.data.url);
			}
		});
	});

	function applyUpdate() {
		if (waitingSW) waitingSW.postMessage({ type: 'SKIP_WAITING' });
		showUpdateBanner = false;
	}
	function dismissUpdate() {
		showUpdateBanner = false;
	}

	// Offline listener
	$effect(() => {
		if (typeof window === 'undefined') return;

		const goOffline = () => isOffline = true;
		const goOnline = () => isOffline = false;
		isOffline = !navigator.onLine;
		window.addEventListener('offline', goOffline);
		window.addEventListener('online', goOnline);

		return () => {
			window.removeEventListener('offline', goOffline);
			window.removeEventListener('online', goOnline);
		};
	});

	const navItems = [
		{ href: '/', icon: 'home', key: 'nav.home' },
		{ href: '/grow', icon: 'sprout', key: 'nav.grow' },
		{ href: '/feed', icon: 'feed', key: 'nav.feed' },
		{ href: '/tools', icon: 'wrench', key: 'nav.tools' },
		{ href: '/profile', icon: 'user', key: 'nav.profile' },
	] as const;

	function isActive(href: string): boolean {
		if (href === '/') return currentPath === '/';
		return currentPath.startsWith(href);
	}
</script>

<!-- Offline Banner -->
{#if isOffline}
	<div class="fixed top-0 inset-x-0 z-[110] bg-gb-warning text-gb-bg text-center py-1.5 text-xs font-medium animate-[slideDown_0.3s_ease-out]">
		📡 Offline — Daten werden lokal gespeichert
	</div>
{/if}

<!-- Demo-Banner: aktiv sobald Demo-Daten geladen sind (Mary-Jane-Demo) -->
{#if showDemoBanner}
	<div class="fixed top-{isOffline ? '8' : '0'} inset-x-0 z-[107] bg-gb-accent text-white py-1.5 text-xs font-medium flex items-center justify-center gap-3 px-4 animate-[slideDown_0.3s_ease-out]">
		<span>🎬 Demo-Modus aktiv — Daten sind nicht echt</span>
		<button onclick={clearDemoBanner}
			class="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-[11px] font-semibold">
			Reset
		</button>
	</div>
{/if}

<!-- Initial Cloud-Pull Loading Overlay -->
{#if initialPullPending && !isOnboardingPage}
	<div class="fixed inset-0 z-[150] bg-gb-bg/95 backdrop-blur-sm flex items-center justify-center animate-[fadeIn_0.2s_ease-out]">
		<div class="text-center space-y-4">
			<div class="w-12 h-12 border-3 border-gb-green border-t-transparent rounded-full animate-spin mx-auto"></div>
			<p class="font-semibold">Daten werden geladen…</p>
			<p class="text-xs text-gb-text-muted">Cloud-Sync mit deinem Konto</p>
		</div>
	</div>
{/if}

<!-- Update Banner -->
{#if showUpdateBanner}
	<div class="fixed top-{isOffline ? '8' : '0'} inset-x-0 z-[108] px-4 pt-3 pb-2 animate-[slideDown_0.3s_ease-out]">
		<div class="max-w-lg mx-auto bg-gb-surface border border-gb-info/30 rounded-xl p-4 flex items-center gap-3 shadow-lg">
			<span class="text-2xl">✨</span>
			<div class="flex-1 min-w-0">
				<p class="font-medium text-sm">Update verfügbar</p>
				<p class="text-xs text-gb-text-muted">Neue Version bereit — App wird neu geladen</p>
			</div>
			<button onclick={applyUpdate}
				class="bg-gb-info text-white font-semibold text-xs px-3 py-1.5 rounded-lg shrink-0">
				Aktualisieren
			</button>
			<button onclick={dismissUpdate} aria-label="Später"
				class="text-gb-text-muted text-xs shrink-0">
				✕
			</button>
		</div>
	</div>
{/if}

<!-- PWA Install Banner (iOS + Chrome/Android) -->
{#if showNav}
	<InstallPrompt />
{/if}

<!-- Toast Notifications -->
{#if toasts.length > 0}
	<div class="fixed top-4 inset-x-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4">
		{#each toasts as toast (toast.id)}
			<div class="pointer-events-auto max-w-sm w-full px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium
				animate-[slideDown_0.3s_ease-out]
				{toast.type === 'xp' ? 'bg-gb-green/90 text-gb-bg' :
				 toast.type === 'achievement' ? 'bg-gb-accent/90 text-white' :
				 toast.type === 'success' ? 'bg-gb-green/90 text-gb-bg' :
				 toast.type === 'warning' ? 'bg-gb-warning/90 text-gb-bg' :
				 'bg-gb-surface-2 text-gb-text'}">
				{#if toast.icon}<span class="mr-1">{toast.icon}</span>{/if}
				{toast.message}
			</div>
		{/each}
	</div>
{/if}

<!-- Main Content -->
<main class="{showNav ? 'pb-20' : ''} min-h-screen" style="padding-top: env(safe-area-inset-top, 0px)">
	{@render children()}
</main>

<!-- Bottom Navigation (nur wenn Onboarding fertig) -->
{#if showNav}
<nav class="fixed bottom-0 inset-x-0 bg-gb-surface border-t border-gb-border safe-bottom z-50">
	<div class="flex justify-around items-center h-16 max-w-lg mx-auto">
		{#each navItems as item}
			{@const active = isActive(item.href)}
			<a
				href={item.href}
				onclick={() => hapticLight()}
				class="flex flex-col items-center gap-0.5 px-3 py-2 text-xs nav-link
					{active ? 'text-gb-green' : 'text-gb-text-muted hover:text-gb-text'}"
			>
				<!-- v1.4.8: Icon-Container mit smooth scale bei active -->
				<span class="flex items-center justify-center h-7 w-12 rounded-full nav-icon-bg {active ? 'bg-gb-green/15 nav-icon-active' : ''}">
					<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						{#if item.icon === 'home'}
							<path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
						{:else if item.icon === 'sprout'}
							<path d="M12 22V16m0 0c-2-4-6-6-10-6 4 0 8-2 10-6 2 4 6 6 10 6-4 0-8 2-10 6z" />
						{:else if item.icon === 'feed'}
							<circle cx="6" cy="18" r="2" /><path d="M3 11a9 9 0 0 1 9 9" /><path d="M3 5a15 15 0 0 1 15 15" />
						{:else if item.icon === 'wrench'}
							<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
						{:else if item.icon === 'user'}
							<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2m8-10a4 4 0 100-8 4 4 0 000 8z" />
						{/if}
					</svg>
				</span>
				<span class="{active ? 'font-semibold' : ''}">{tr(item.key)}</span>
				<!-- v1.4.8: Active-Dot-Indicator -->
				<span class="nav-dot {active ? 'nav-dot-active' : ''}"></span>
			</a>
		{/each}
	</div>
</nav>

<style>
	.nav-link { position: relative; transition: color var(--anim-fast, 150ms) ease; }
	.nav-icon-bg {
		transition: background-color var(--anim-fast, 150ms) ease, transform var(--anim-medium, 250ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
	}
	.nav-icon-active { transform: scale(1.08); }
	.nav-dot {
		display: block;
		width: 4px; height: 4px;
		border-radius: 50%;
		background: var(--color-gb-green);
		opacity: 0;
		transform: translateY(-2px) scale(0.5);
		transition: opacity var(--anim-medium, 250ms) ease, transform var(--anim-medium, 250ms) var(--ease-spring);
		margin-top: 1px;
	}
	.nav-dot-active { opacity: 1; transform: translateY(0) scale(1); }
</style>
{/if}
