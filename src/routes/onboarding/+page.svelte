<script lang="ts">
	import { goto } from '$app/navigation';
	import { onboardingStore } from '$lib/stores/onboarding';
	import { proStore } from '$lib/stores/pro';
	import { t } from '$lib/i18n';

	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
	let step = $state(0);
	let experience = $state<'beginner' | 'intermediate' | 'advanced' | null>(null);
	let goal = $state<'first_grow' | 'improve' | 'document' | 'commercial' | null>(null);

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
		goto('/');
	}

	function skip() {
		onboardingStore.complete(null, null);
		goto('/');
	}

	function startTrial() {
		proStore.startTrial();
		onboardingStore.complete(experience, goal);
		goto('/');
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

					<button onclick={finish}
						class="w-full bg-gb-green text-black font-semibold py-3.5 rounded-xl text-sm hover:bg-gb-green/80 transition-colors">
						{tr('onboarding.free_btn')}
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
