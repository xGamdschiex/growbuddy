<script lang="ts">
	import { goto } from '$app/navigation';
	import { onboardingStore } from '$lib/stores/onboarding';
	import { proStore } from '$lib/stores/pro';
	import { authStore } from '$lib/stores/auth';
	import { toastStore } from '$lib/stores/toast';
	import { t } from '$lib/i18n';

	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
	let step = $state(0);
	let experience = $state<'beginner' | 'intermediate' | 'advanced' | null>(null);
	let goal = $state<'first_grow' | 'improve' | 'document' | 'commercial' | null>(null);
	let loginEmail = $state('');
	let loginLoading = $state(false);
	let loginMessage = $state('');

	const CLOUD_STEP = 6; // nach slides(4) + exp(1) + goal(1)

	function goToCloud() { step = CLOUD_STEP; }

	async function cloudGoogle() {
		const { error } = await authStore.loginWithGoogle();
		if (error) toastStore.warning(error);
		// Redirect passiert durch Supabase, OAuth-Callback kommt zurück
	}

	async function cloudEmail() {
		if (!loginEmail.trim()) return;
		loginLoading = true;
		const { error } = await authStore.loginWithEmail(loginEmail.trim());
		loginLoading = false;
		if (error) {
			loginMessage = error;
		} else {
			loginMessage = tr('auth.link_sent');
			toastStore.success(tr('auth.link_sent'));
			// User kann jetzt aufs Mail klicken — wir schließen Onboarding trotzdem
			setTimeout(() => finish(), 1500);
		}
	}

	let slides = $derived([
		{
			icon: '🌱',
			title: tr('onboarding.welcome_title'),
			subtitle: tr('onboarding.welcome_sub'),
		},
		{
			icon: '📊',
			title: tr('onboarding.track_title'),
			subtitle: tr('onboarding.track_sub'),
		},
		{
			icon: '🧪',
			title: tr('onboarding.calc_title'),
			subtitle: tr('onboarding.calc_sub'),
		},
		{
			icon: '🏆',
			title: tr('onboarding.improve_title'),
			subtitle: tr('onboarding.improve_sub'),
		},
	]);

	function next() {
		if (step < slides.length - 1) {
			step++;
		} else if (step === slides.length - 1) {
			step = slides.length;
		} else if (step === slides.length) {
			step = slides.length + 1;
		}
	}

	function finish() {
		onboardingStore.complete(experience, goal);
		setTimeout(() => goto('/'), 50);
	}

	function skip() {
		onboardingStore.complete(null, null);
		setTimeout(() => goto('/'), 50);
	}

	function startTrial() {
		proStore.startTrial();
		goToCloud();
	}

	function continueFree() {
		goToCloud();
	}

	let experienceOptions = $derived([
		{ val: 'beginner', icon: '🌱', title: tr('onboarding.exp_beginner'), desc: tr('onboarding.exp_beginner_desc') },
		{ val: 'intermediate', icon: '🌿', title: tr('onboarding.exp_intermediate'), desc: tr('onboarding.exp_intermediate_desc') },
		{ val: 'advanced', icon: '🌳', title: tr('onboarding.exp_advanced'), desc: tr('onboarding.exp_advanced_desc') },
	]);

	let goalOptions = $derived([
		{ val: 'first_grow', icon: '🌱', title: tr('onboarding.goal_first'), desc: tr('onboarding.goal_first_desc') },
		{ val: 'improve', icon: '📈', title: tr('onboarding.goal_improve'), desc: tr('onboarding.goal_improve_desc') },
		{ val: 'document', icon: '📋', title: tr('onboarding.goal_document'), desc: tr('onboarding.goal_document_desc') },
		{ val: 'commercial', icon: '🏢', title: tr('onboarding.goal_commercial'), desc: tr('onboarding.goal_commercial_desc') },
	]);
</script>

<div class="min-h-screen flex flex-col items-center justify-center px-6 max-w-md mx-auto">

	{#if step < slides.length}
		<!-- Intro Slides -->
		<div class="text-center space-y-6 animate-[fadeIn_0.4s_ease-out]">
			<span class="text-6xl block">{slides[step].icon}</span>
			<h1 class="text-2xl font-bold leading-tight">{slides[step].title}</h1>
			<p class="text-gb-text-muted leading-relaxed">{slides[step].subtitle}</p>

			<!-- Dots -->
			<div class="flex justify-center gap-2 pt-4">
				{#each slides as _, i}
					<div class="w-2 h-2 rounded-full transition-all duration-300 {i === step ? 'bg-gb-green w-6' : 'bg-gb-border'}"></div>
				{/each}
			</div>

			<div class="pt-6 space-y-3">
				<button onclick={next}
					class="w-full bg-gb-green text-black font-semibold py-3.5 rounded-xl text-sm hover:bg-gb-green/80 transition-colors">
					{step === slides.length - 1 ? tr('onboarding.start') : tr('onboarding.next')}
				</button>
				<button onclick={skip}
					class="w-full text-gb-text-muted text-sm py-2 hover:text-gb-text transition-colors">
					{tr('onboarding.skip')}
				</button>
			</div>
		</div>

	{:else if step === slides.length}
		<!-- Experience Level -->
		<div class="w-full space-y-6 animate-[fadeIn_0.4s_ease-out]">
			<div class="text-center">
				<h1 class="text-2xl font-bold">{tr('onboarding.experience_title')}</h1>
				<p class="text-gb-text-muted text-sm mt-2">{tr('onboarding.experience_desc')}</p>
			</div>

			<div class="space-y-3">
				{#each experienceOptions as opt}
					<button onclick={() => { experience = opt.val as typeof experience; next(); }}
						class="w-full bg-gb-surface rounded-xl p-4 text-left hover:bg-gb-surface-2 transition-colors border-2
							{experience === opt.val ? 'border-gb-green' : 'border-transparent'}">
						<div class="flex items-center gap-3">
							<span class="text-2xl">{opt.icon}</span>
							<div>
								<p class="font-semibold">{opt.title}</p>
								<p class="text-sm text-gb-text-muted">{opt.desc}</p>
							</div>
						</div>
					</button>
				{/each}
			</div>
		</div>

	{:else if step === slides.length + 1}
		<!-- Goal -->
		<div class="w-full space-y-6 animate-[fadeIn_0.4s_ease-out]">
			<div class="text-center">
				<h1 class="text-2xl font-bold">{tr('onboarding.goal_title')}</h1>
				<p class="text-gb-text-muted text-sm mt-2">{tr('onboarding.goal_desc')}</p>
			</div>

			<div class="space-y-3">
				{#each goalOptions as opt}
					<button onclick={() => { goal = opt.val as typeof goal; }}
						class="w-full bg-gb-surface rounded-xl p-4 text-left hover:bg-gb-surface-2 transition-colors border-2
							{goal === opt.val ? 'border-gb-green' : 'border-transparent'}">
						<div class="flex items-center gap-3">
							<span class="text-2xl">{opt.icon}</span>
							<div>
								<p class="font-semibold">{opt.title}</p>
								<p class="text-sm text-gb-text-muted">{opt.desc}</p>
							</div>
						</div>
					</button>
				{/each}
			</div>

			{#if goal}
				<div class="space-y-3 pt-2">
					<!-- Pro Trial CTA -->
					<div class="bg-gb-accent/10 border border-gb-accent/20 rounded-xl p-4 text-center">
						<p class="font-semibold text-sm">{tr('onboarding.trial_cta')}</p>
						<p class="text-xs text-gb-text-muted mt-1">{tr('onboarding.trial_desc')}</p>
						<button onclick={startTrial}
							class="mt-3 bg-gb-accent text-white font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-gb-accent/80 transition-colors">
							{tr('onboarding.trial_btn')}
						</button>
					</div>

					<button onclick={continueFree}
						class="w-full bg-gb-green text-black font-semibold py-3.5 rounded-xl text-sm hover:bg-gb-green/80 transition-colors">
						{tr('onboarding.free_btn')}
					</button>
				</div>
			{/if}
		</div>

	{:else if step === CLOUD_STEP}
		<!-- Cloud-Sync (Optional) -->
		<div class="w-full space-y-6 animate-[fadeIn_0.4s_ease-out]">
			<div class="text-center">
				<span class="text-5xl block mb-2">☁️</span>
				<h1 class="text-2xl font-bold">{tr('onboarding.cloud_title')}</h1>
				<p class="text-gb-text-muted text-sm mt-2 leading-relaxed">{tr('onboarding.cloud_desc')}</p>
			</div>

			<div class="space-y-3">
				<!-- Google -->
				<button onclick={cloudGoogle}
					class="w-full flex items-center justify-center gap-2 bg-white text-gray-700 font-medium text-sm py-3 rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors">
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
						class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-3 text-sm" />
					<button onclick={cloudEmail}
						disabled={loginLoading || !loginEmail.trim()}
						class="w-full bg-gb-green text-black font-semibold py-3 rounded-xl text-sm hover:bg-gb-green/80 transition-colors disabled:opacity-50">
						{loginLoading ? '...' : tr('auth.send_link')}
					</button>
				</div>

				{#if loginMessage}
					<p class="text-xs text-center text-gb-green">{loginMessage}</p>
				{/if}
			</div>

			<button onclick={finish}
				class="w-full text-gb-text-muted text-sm py-2 hover:text-gb-text transition-colors">
				{tr('onboarding.cloud_later')}
			</button>
		</div>
	{/if}
</div>
