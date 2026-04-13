<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';

	let status = $state<'loading' | 'success' | 'error'>('loading');

	onMount(async () => {
		try {
			// Supabase liest automatisch den Hash-Token aus der URL
			const { error } = await supabase.auth.getSession();
			if (error) throw error;
			status = 'success';
			setTimeout(() => goto('/profile'), 1000);
		} catch {
			status = 'error';
			setTimeout(() => goto('/profile'), 3000);
		}
	});
</script>

<div class="min-h-screen flex items-center justify-center bg-gb-bg">
	<div class="text-center space-y-4">
		{#if status === 'loading'}
			<div class="w-12 h-12 border-3 border-gb-green border-t-transparent rounded-full animate-spin mx-auto"></div>
			<p class="text-gb-text-muted text-sm">Login wird bestätigt...</p>
		{:else if status === 'success'}
			<span class="text-4xl block">✅</span>
			<p class="text-gb-green font-semibold">Erfolgreich eingeloggt!</p>
			<p class="text-gb-text-muted text-sm">Weiterleitung...</p>
		{:else}
			<span class="text-4xl block">❌</span>
			<p class="text-gb-danger font-semibold">Login fehlgeschlagen</p>
			<p class="text-gb-text-muted text-sm">Weiterleitung zum Profil...</p>
		{/if}
	</div>
</div>
