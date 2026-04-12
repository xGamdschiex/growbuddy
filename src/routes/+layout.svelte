<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onboardingStore } from '$lib/stores/onboarding';
	import { reminderStore } from '$lib/stores/reminders';
	import { toastStore } from '$lib/stores/toast';
	import { t } from '$lib/i18n';
	import { hapticLight } from '$lib/utils/haptic';
	import type { Toast } from '$lib/stores/toast';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
	let toasts = $derived.by(() => { let v: Toast[] = []; toastStore.subscribe(x => v = x)(); return v; });
	let onboarding = $derived.by(() => { let v = { completed: false }; onboardingStore.subscribe(x => v = x)(); return v; });
	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });

	let currentPath = $derived($page.url.pathname);
	let isOnboardingPage = $derived(currentPath === '/onboarding');
	let showNav = $derived(onboarding.completed && !isOnboardingPage);

	// PWA Install Prompt
	let deferredPrompt = $state<any>(null);
	let showInstall = $state(false);

	// Offline Status
	let isOffline = $state(false);

	// Redirect zu Onboarding wenn nicht completed
	$effect(() => {
		if (!onboarding.completed && !isOnboardingPage && typeof window !== 'undefined') {
			goto('/onboarding');
		}
	});

	// Reminder-Timer beim App-Start wiederherstellen
	$effect(() => {
		if (typeof window !== 'undefined') reminderStore.init();
	});

	// PWA Install + Offline listeners
	$effect(() => {
		if (typeof window === 'undefined') return;

		// Install prompt
		const handleInstall = (e: Event) => {
			e.preventDefault();
			deferredPrompt = e;
			// Nur anzeigen wenn nicht schon installiert und nicht dismissed
			const dismissed = localStorage.getItem('growbuddy_install_dismissed');
			if (!dismissed) showInstall = true;
		};
		window.addEventListener('beforeinstallprompt', handleInstall);

		// Offline/Online
		const goOffline = () => isOffline = true;
		const goOnline = () => isOffline = false;
		isOffline = !navigator.onLine;
		window.addEventListener('offline', goOffline);
		window.addEventListener('online', goOnline);

		return () => {
			window.removeEventListener('beforeinstallprompt', handleInstall);
			window.removeEventListener('offline', goOffline);
			window.removeEventListener('online', goOnline);
		};
	});

	async function installApp() {
		if (!deferredPrompt) return;
		deferredPrompt.prompt();
		const result = await deferredPrompt.userChoice;
		deferredPrompt = null;
		showInstall = false;
	}

	function dismissInstall() {
		showInstall = false;
		localStorage.setItem('growbuddy_install_dismissed', '1');
	}

	const navItems = [
		{ href: '/', icon: 'home', key: 'nav.home' },
		{ href: '/grow', icon: 'sprout', key: 'nav.grow' },
		{ href: '/calc', icon: 'flask', key: 'nav.calc' },
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
	<div class="fixed top-0 inset-x-0 z-[110] bg-gb-warning text-black text-center py-1.5 text-xs font-medium animate-[slideDown_0.3s_ease-out]">
		📡 Offline — Daten werden lokal gespeichert
	</div>
{/if}

<!-- PWA Install Banner -->
{#if showInstall && showNav}
	<div class="fixed top-{isOffline ? '8' : '0'} inset-x-0 z-[105] px-4 pt-3 pb-2 animate-[slideDown_0.3s_ease-out]">
		<div class="max-w-lg mx-auto bg-gb-surface border border-gb-green/30 rounded-xl p-4 flex items-center gap-3 shadow-lg">
			<span class="text-2xl">🌱</span>
			<div class="flex-1 min-w-0">
				<p class="font-medium text-sm">GrowBuddy installieren</p>
				<p class="text-xs text-gb-text-muted">Für schnellen Zugriff zum Homescreen hinzufügen</p>
			</div>
			<button onclick={installApp}
				class="bg-gb-green text-black font-semibold text-xs px-3 py-1.5 rounded-lg shrink-0">
				OK
			</button>
			<button onclick={dismissInstall}
				class="text-gb-text-muted text-xs shrink-0">
				✕
			</button>
		</div>
	</div>
{/if}

<!-- Toast Notifications -->
{#if toasts.length > 0}
	<div class="fixed top-4 inset-x-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4">
		{#each toasts as toast (toast.id)}
			<div class="pointer-events-auto max-w-sm w-full px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium
				animate-[slideDown_0.3s_ease-out]
				{toast.type === 'xp' ? 'bg-gb-green/90 text-black' :
				 toast.type === 'achievement' ? 'bg-gb-accent/90 text-white' :
				 toast.type === 'success' ? 'bg-gb-green/90 text-black' :
				 toast.type === 'warning' ? 'bg-gb-warning/90 text-black' :
				 'bg-gb-surface-2 text-gb-text'}">
				{#if toast.icon}<span class="mr-1">{toast.icon}</span>{/if}
				{toast.message}
			</div>
		{/each}
	</div>
{/if}

<!-- Main Content -->
<main class="{showNav ? 'pb-20' : ''} min-h-screen">
	{@render children()}
</main>

<!-- Bottom Navigation (nur wenn Onboarding fertig) -->
{#if showNav}
<nav class="fixed bottom-0 inset-x-0 bg-gb-surface border-t border-gb-border safe-bottom z-50">
	<div class="flex justify-around items-center h-16 max-w-lg mx-auto">
		{#each navItems as item}
			<a
				href={item.href}
				onclick={() => hapticLight()}
				class="flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors
					{isActive(item.href) ? 'text-gb-green' : 'text-gb-text-muted hover:text-gb-text'}"
			>
				<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					{#if item.icon === 'home'}
						<path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
					{:else if item.icon === 'sprout'}
						<path d="M12 22V16m0 0c-2-4-6-6-10-6 4 0 8-2 10-6 2 4 6 6 10 6-4 0-8 2-10 6z" />
					{:else if item.icon === 'flask'}
						<path d="M9 3h6m-5 0v6.5L4 18a1 1 0 001 1h14a1 1 0 001-1l-6-8.5V3m-4 0h4" />
					{:else if item.icon === 'wrench'}
						<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
					{:else if item.icon === 'user'}
						<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2m8-10a4 4 0 100-8 4 4 0 000 8z" />
					{/if}
				</svg>
				<span>{tr(item.key)}</span>
			</a>
		{/each}
	</div>
</nav>
{/if}
