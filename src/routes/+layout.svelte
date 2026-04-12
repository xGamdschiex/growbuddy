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
