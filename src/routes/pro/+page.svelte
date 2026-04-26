<script lang="ts">
	import { proStore, isPro, isTrialing, PRICING } from '$lib/stores/pro';
	import { goto } from '$app/navigation';
	import { toastStore } from '$lib/stores/toast';
	import { t } from '$lib/i18n';

	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
	let pro = $derived.by(() => { let v: any = {}; proStore.subscribe(x => v = x)(); return v; });
	let userIsPro = $derived.by(() => { let v = false; isPro.subscribe(x => v = x)(); return v; });
	let trialing = $derived.by(() => { let v = false; isTrialing.subscribe(x => v = x)(); return v; });
	let billing = $state<'monthly' | 'yearly'>('yearly');
	let betaCode = $state('');
	let showBetaInput = $state(false);

	const BETA_CODE = 'GROWBUDDY2026';

	function activateBeta() {
		const code = betaCode.trim().toUpperCase();
		if (!code) {
			toastStore.warning('Bitte Code eingeben');
			return;
		}
		if (code === BETA_CODE) {
			proStore.activatePro('beta-tester');
			toastStore.achievement('Pro aktiviert — Viel Spaß beim Testen! 🌱');
			betaCode = '';
			showBetaInput = false;
			// Kurze Verzögerung damit der Store-Save abgeschlossen ist und Toast sichtbar bleibt
			setTimeout(() => goto('/'), 800);
		} else {
			toastStore.warning('Ungültiger Code: ' + code);
		}
	}
	function onBetaKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') activateBeta();
	}

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
		// Stripe Payment Links — erstelle Produkte im Stripe Dashboard unter:
		// https://dashboard.stripe.com/payment-links
		// Dann ersetze die URLs hier:
		const links: Record<string, string> = {
			monthly: 'https://buy.stripe.com/test_bJe14mbC86D72XW7vr48000',
			yearly: 'https://buy.stripe.com/test_cNi4gyay4f9DfKI02Z48001',
		};
		const url = links[billing];
		if (url) {
			window.open(url, '_blank');
		} else {
			toastStore.info('Stripe Payment Links werden noch eingerichtet');
		}
	}

	let features = $derived([
		{ icon: '🌱', title: tr('pro.feat_grows'), desc: tr('pro.feat_grows_desc') },
		{ icon: '🤖', title: tr('pro.feat_ai'), desc: tr('pro.feat_ai_desc') },
		{ icon: '🧪', title: tr('pro.feat_feedlines'), desc: tr('pro.feat_feedlines_desc') },
		{ icon: '☁️', title: tr('pro.feat_cloud'), desc: tr('pro.feat_cloud_desc') },
		{ icon: '📄', title: tr('pro.feat_pdf'), desc: tr('pro.feat_pdf_desc') },
		{ icon: '📊', title: tr('pro.feat_charts'), desc: tr('pro.feat_charts_desc') },
		{ icon: '🔔', title: tr('pro.feat_reminders'), desc: tr('pro.feat_reminders_desc') },
		{ icon: '👥', title: tr('pro.feat_community'), desc: tr('pro.feat_community_desc') },
	]);

	let faqs = $derived([
		{ q: tr('pro.faq_cancel_q'), a: tr('pro.faq_cancel_a') },
		{ q: tr('pro.faq_trial_q'), a: tr('pro.faq_trial_a') },
		{ q: tr('pro.faq_data_q'), a: tr('pro.faq_data_a') },
	]);
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-6 pb-24">
	<div>
		<a href="/profile" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; {tr('general.back')}</a>
		<h1 class="text-2xl font-bold mt-2">{tr('pro.title')}</h1>
		<p class="text-gb-text-muted text-sm">{tr('pro.subtitle')}</p>
	</div>

	{#if userIsPro}
		<!-- Active Pro -->
		<div class="bg-gb-green/10 border border-gb-green/20 rounded-xl p-5 text-center">
			<span class="text-3xl block mb-2">👑</span>
			<p class="font-bold text-lg text-gb-green">{tr('pro.active')}</p>
			{#if trialing}
				<p class="text-sm text-gb-text-muted mt-1">
					{tr('pro.trial_ends', { date: new Date(pro.trial_ends_at).toLocaleDateString('de-DE') })}
				</p>
			{:else}
				<p class="text-sm text-gb-text-muted mt-1">
					{tr('pro.since', { date: new Date(pro.subscribed_at).toLocaleDateString('de-DE') })}
				</p>
			{/if}
		</div>
	{:else}
		<!-- Pricing Toggle -->
		<div class="bg-gb-surface rounded-xl p-1 flex">
			<button onclick={() => billing = 'monthly'}
				class="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors
					{billing === 'monthly' ? 'bg-gb-green text-black' : 'text-gb-text-muted'}">
				{tr('pro.monthly')}
			</button>
			<button onclick={() => billing = 'yearly'}
				class="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors relative
					{billing === 'yearly' ? 'bg-gb-green text-black' : 'text-gb-text-muted'}">
				{tr('pro.yearly')}
				<span class="absolute -top-2 -right-1 bg-gb-accent text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">-33%</span>
			</button>
		</div>

		<!-- Price Display -->
		<div class="text-center py-2">
			{#if billing === 'monthly'}
				<p class="text-4xl font-bold">{PRICING.pro_monthly.toFixed(2).replace('.', ',')}€</p>
				<p class="text-gb-text-muted text-sm">{tr('pro.per_month')}</p>
			{:else}
				<p class="text-4xl font-bold">{PRICING.pro_yearly.toFixed(2).replace('.', ',')}€</p>
				<p class="text-gb-text-muted text-sm">{tr('pro.per_year', { monthly: (PRICING.pro_yearly / 12).toFixed(2).replace('.', ',') + '€' })}</p>
			{/if}
		</div>

		<!-- CTA Buttons -->
		<div class="space-y-3">
			{#if !pro.trial_used}
				<button onclick={startTrial}
					class="w-full bg-gb-accent text-white font-semibold py-3.5 rounded-xl text-sm hover:bg-gb-accent/80 transition-colors">
					{tr('pro.trial_btn')}
				</button>
			{/if}
			<button onclick={subscribe}
				class="w-full bg-gb-green text-black font-semibold py-3.5 rounded-xl text-sm hover:bg-gb-green/80 transition-colors">
				{tr('pro.subscribe_btn')}
			</button>

			<!-- Beta Code -->
			<button onclick={() => showBetaInput = !showBetaInput}
				class="w-full text-gb-text-muted text-xs py-2 hover:text-gb-text transition-colors">
				Beta-Tester Code einlösen
			</button>
			{#if showBetaInput}
				<div class="flex gap-2">
					<input type="text" bind:value={betaCode} placeholder="Code eingeben"
						onkeydown={onBetaKeydown} autocapitalize="characters" autocomplete="off"
						class="flex-1 bg-gb-bg border border-gb-border rounded-lg px-3 py-2.5 text-sm uppercase" />
					<button onclick={activateBeta}
						class="bg-gb-accent text-white font-semibold text-sm px-4 rounded-lg">
						OK
					</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Features List -->
	<div class="space-y-3">
		<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">{tr('pro.features_title')}</h2>
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
		<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">{tr('pro.faq')}</h2>
		{#each faqs as faq}
			<details class="bg-gb-surface rounded-xl">
				<summary class="px-4 py-3 text-sm font-medium cursor-pointer">{faq.q}</summary>
				<p class="px-4 pb-3 text-sm text-gb-text-muted">{faq.a}</p>
			</details>
		{/each}
	</div>
</div>
