<script lang="ts">
	import { proStore, isPro, isTrialing, PRICING } from '$lib/stores/pro';
	import { goto } from '$app/navigation';
	import { toastStore } from '$lib/stores/toast';

	let pro = $derived.by(() => { let v: any = {}; proStore.subscribe(x => v = x)(); return v; });
	let userIsPro = $derived.by(() => { let v = false; isPro.subscribe(x => v = x)(); return v; });
	let trialing = $derived.by(() => { let v = false; isTrialing.subscribe(x => v = x)(); return v; });
	let billing = $state<'monthly' | 'yearly'>('yearly');

	function startTrial() {
		const success = proStore.startTrial();
		if (success) {
			toastStore.achievement('Pro Trial gestartet — 7 Tage kostenlos!');
			goto('/');
		} else {
			toastStore.info('Trial wurde bereits genutzt');
		}
	}

	function subscribe() {
		// TODO: Stripe Checkout Session
		toastStore.info('Stripe-Integration kommt bald');
	}

	const features = [
		{ icon: '🌱', title: 'Unbegrenzte Grows', desc: 'Free: max. 1 aktiver Grow' },
		{ icon: '🤖', title: 'AI Plant Doctor', desc: 'Foto machen → sofortige Diagnose' },
		{ icon: '🧪', title: 'Alle Düngerlinien', desc: 'Athena, BioBizz, Canna, GHE & mehr' },
		{ icon: '☁️', title: 'Cloud-Sync', desc: 'Daten sicher in der Cloud, geräteübergreifend' },
		{ icon: '📄', title: 'PDF Grow-Reports', desc: 'Professionelle Dokumentation exportieren' },
		{ icon: '📊', title: 'Erweiterte Charts', desc: 'VPD, EC, pH Verlauf über den ganzen Grow' },
		{ icon: '🔔', title: 'Smart Reminders', desc: 'Check-in Erinnerungen, nie mehr vergessen' },
		{ icon: '👥', title: 'Community', desc: 'Anonyme Grow-Diaries teilen & vergleichen' },
	];
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-6 pb-24">
	<div>
		<a href="/profile" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; Zurück</a>
		<h1 class="text-2xl font-bold mt-2">GrowBuddy Pro</h1>
		<p class="text-gb-text-muted text-sm">Alles was du für den perfekten Grow brauchst</p>
	</div>

	{#if userIsPro}
		<!-- Active Pro -->
		<div class="bg-gb-green/10 border border-gb-green/20 rounded-xl p-5 text-center">
			<span class="text-3xl block mb-2">👑</span>
			<p class="font-bold text-lg text-gb-green">Pro aktiv</p>
			{#if trialing}
				<p class="text-sm text-gb-text-muted mt-1">
					Trial endet am {new Date(pro.trial_ends_at).toLocaleDateString('de-DE')}
				</p>
			{:else}
				<p class="text-sm text-gb-text-muted mt-1">
					Seit {new Date(pro.subscribed_at).toLocaleDateString('de-DE')}
				</p>
			{/if}
		</div>
	{:else}
		<!-- Pricing Toggle -->
		<div class="bg-gb-surface rounded-xl p-1 flex">
			<button onclick={() => billing = 'monthly'}
				class="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors
					{billing === 'monthly' ? 'bg-gb-green text-black' : 'text-gb-text-muted'}">
				Monatlich
			</button>
			<button onclick={() => billing = 'yearly'}
				class="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors relative
					{billing === 'yearly' ? 'bg-gb-green text-black' : 'text-gb-text-muted'}">
				Jährlich
				<span class="absolute -top-2 -right-1 bg-gb-accent text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">-33%</span>
			</button>
		</div>

		<!-- Price Display -->
		<div class="text-center py-2">
			{#if billing === 'monthly'}
				<p class="text-4xl font-bold">{PRICING.pro_monthly.toFixed(2).replace('.', ',')}€</p>
				<p class="text-gb-text-muted text-sm">pro Monat</p>
			{:else}
				<p class="text-4xl font-bold">{PRICING.pro_yearly.toFixed(2).replace('.', ',')}€</p>
				<p class="text-gb-text-muted text-sm">pro Jahr — {(PRICING.pro_yearly / 12).toFixed(2).replace('.', ',')}€/Monat</p>
			{/if}
		</div>

		<!-- CTA Buttons -->
		<div class="space-y-3">
			{#if !pro.trial_used}
				<button onclick={startTrial}
					class="w-full bg-gb-accent text-white font-semibold py-3.5 rounded-xl text-sm hover:bg-gb-accent/80 transition-colors">
					7 Tage kostenlos testen
				</button>
			{/if}
			<button onclick={subscribe}
				class="w-full bg-gb-green text-black font-semibold py-3.5 rounded-xl text-sm hover:bg-gb-green/80 transition-colors">
				Pro abonnieren
			</button>
		</div>
	{/if}

	<!-- Features List -->
	<div class="space-y-3">
		<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Was du bekommst</h2>
		{#each features as feat}
			<div class="flex items-start gap-3 bg-gb-surface rounded-xl p-4">
				<span class="text-xl">{feat.icon}</span>
				<div>
					<p class="font-semibold text-sm">{feat.title}</p>
					<p class="text-xs text-gb-text-muted">{feat.desc}</p>
				</div>
			</div>
		{/each}
	</div>

	<!-- FAQ -->
	<div class="space-y-3">
		<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">FAQ</h2>
		{#each [
			{ q: 'Kann ich jederzeit kündigen?', a: 'Ja, monatlich kündbar. Deine Daten bleiben erhalten.' },
			{ q: 'Was passiert nach der Trial?', a: 'Du wirst automatisch auf Free zurückgestuft. Keine Kosten.' },
			{ q: 'Sind meine Daten sicher?', a: 'Alles offline auf deinem Gerät. Cloud-Sync ist optional und verschlüsselt.' },
		] as faq}
			<details class="bg-gb-surface rounded-xl">
				<summary class="px-4 py-3 text-sm font-medium cursor-pointer">{faq.q}</summary>
				<p class="px-4 pb-3 text-sm text-gb-text-muted">{faq.a}</p>
			</details>
		{/each}
	</div>
</div>
