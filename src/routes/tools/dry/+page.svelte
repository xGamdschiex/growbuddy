<script lang="ts">
	import { DRYING_PARAMS, CURING_PARAMS } from '$lib/data/science';
	import { t } from '$lib/i18n';

	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
	let mode = $state<'drying' | 'curing'>('drying');
	let startedAt = $state<string | null>(null);
	let temp = $state<number | null>(null);
	let rh = $state<number | null>(null);

	let elapsedDays = $derived(startedAt
		? Math.floor((Date.now() - new Date(startedAt).getTime()) / 86400000)
		: 0
	);

	let tempOk = $derived(temp !== null && temp >= DRYING_PARAMS.temp_min && temp <= DRYING_PARAMS.temp_max);
	let rhOk = $derived(rh !== null && rh >= DRYING_PARAMS.rh_min && rh <= DRYING_PARAMS.rh_max);

	function start() {
		startedAt = new Date().toISOString();
		if (typeof window !== 'undefined') {
			localStorage.setItem(`growbuddy_${mode}_start`, startedAt);
		}
	}

	function reset() {
		startedAt = null;
		if (typeof window !== 'undefined') {
			localStorage.removeItem(`growbuddy_${mode}_start`);
		}
	}

	$effect(() => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem(`growbuddy_${mode}_start`);
			if (saved) startedAt = saved;
		}
	});
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-5">
	<div>
		<a href="/tools" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; {tr('nav.tools')}</a>
		<h1 class="text-xl font-bold mt-2">{tr('dry.title')}</h1>
	</div>

	<!-- Mode Toggle -->
	<div class="grid grid-cols-2 gap-2">
		<button onclick={() => mode = 'drying'}
			class="py-2.5 rounded-lg text-sm transition-colors
				{mode === 'drying' ? 'bg-gb-green text-black font-semibold' : 'bg-gb-surface-2 text-gb-text-muted'}">
			{tr('dry.drying')}
		</button>
		<button onclick={() => mode = 'curing'}
			class="py-2.5 rounded-lg text-sm transition-colors
				{mode === 'curing' ? 'bg-gb-green text-black font-semibold' : 'bg-gb-surface-2 text-gb-text-muted'}">
			{tr('dry.curing')}
		</button>
	</div>

	{#if mode === 'drying'}
		<!-- Timer -->
		<div class="bg-gb-surface rounded-xl p-6 text-center">
			{#if startedAt}
				<p class="text-5xl font-bold {elapsedDays >= DRYING_PARAMS.days_min ? 'text-gb-green' : 'text-gb-text'}">
					{tr('dry.day', { day: elapsedDays })}
				</p>
				<p class="text-sm text-gb-text-muted mt-2">
					{#if elapsedDays < DRYING_PARAMS.days_min}
						{tr('dry.days_remaining', { days: DRYING_PARAMS.days_min - elapsedDays })}
					{:else if elapsedDays <= DRYING_PARAMS.days_max}
						{tr('dry.in_target')}
					{:else}
						{tr('dry.over_max', { max: DRYING_PARAMS.days_max })}
					{/if}
				</p>
				<button onclick={reset} class="mt-3 text-sm text-gb-text-muted hover:text-gb-danger">{tr('dry.reset')}</button>
			{:else}
				<p class="text-gb-text-muted mb-4">{tr('dry.start_info')}</p>
				<button onclick={start}
					class="bg-gb-green text-black font-semibold px-6 py-3 rounded-lg text-sm hover:bg-gb-green-light transition-colors">
					{tr('dry.start_btn')}
				</button>
			{/if}
		</div>

		<!-- Messwerte -->
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="block text-xs text-gb-text-muted mb-1">{tr('checkin.temp')}</label>
				<input type="number" bind:value={temp} step="0.5" placeholder="20"
					class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
				{#if temp !== null}
					<p class="text-xs mt-1 {tempOk ? 'text-gb-green' : 'text-gb-danger'}">
						{tr('vpd.target', { min: DRYING_PARAMS.temp_min, max: DRYING_PARAMS.temp_max })}°C {tempOk ? '✓' : '✗'}
					</p>
				{/if}
			</div>
			<div>
				<label class="block text-xs text-gb-text-muted mb-1">{tr('checkin.rh')}</label>
				<input type="number" bind:value={rh} step="1" placeholder="60"
					class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
				{#if rh !== null}
					<p class="text-xs mt-1 {rhOk ? 'text-gb-green' : 'text-gb-danger'}">
						{tr('vpd.target', { min: DRYING_PARAMS.rh_min, max: DRYING_PARAMS.rh_max })}% {rhOk ? '✓' : '✗'}
					</p>
				{/if}
			</div>
		</div>

		<!-- Regeln -->
		<div class="bg-gb-surface rounded-xl p-4 space-y-2 text-sm">
			<h3 class="font-semibold">{tr('dry.rules')}</h3>
			<ul class="space-y-1 text-gb-text-muted">
				<li>• {DRYING_PARAMS.temp_min}–{DRYING_PARAMS.temp_max}°C, {DRYING_PARAMS.rh_min}–{DRYING_PARAMS.rh_max}% RH</li>
				<li>• {DRYING_PARAMS.days_min}–{DRYING_PARAMS.days_max} {tr('grow.days')}</li>
				<li>• {tr('dry.rule_dark')}</li>
				<li>• {tr('dry.rule_air')}</li>
				<li>• {tr('dry.rule_done')} {DRYING_PARAMS.done_indicator}</li>
			</ul>
		</div>

	{:else}
		<!-- Curing Info -->
		<div class="bg-gb-surface rounded-xl p-4 space-y-3 text-sm">
			<h3 class="font-semibold">{tr('dry.curing_guide')}</h3>
			<p class="text-gb-text-muted">{CURING_PARAMS.container}</p>
			<p class="text-gb-text-muted">{tr('dry.target_rh')} {CURING_PARAMS.target_rh.min}–{CURING_PARAMS.target_rh.max}%</p>

			<h4 class="font-medium mt-2">{tr('dry.burping')}</h4>
			{#each CURING_PARAMS.burping as b}
				<div class="flex justify-between">
					<span class="text-gb-text-muted">{tr('dry.week', { week: b.weeks })}:</span>
					<span>{b.frequency}</span>
				</div>
			{/each}

			<div class="mt-2 pt-2 border-t border-gb-border">
				<p>{tr('dry.minimum')} <span class="text-gb-warning font-medium">{tr('dry.weeks', { weeks: CURING_PARAMS.minimum_weeks })}</span></p>
				<p>{tr('dry.optimal')} <span class="text-gb-green font-medium">{tr('dry.weeks', { weeks: CURING_PARAMS.optimal_weeks })}</span></p>
				<p class="text-gb-text-muted mt-1">{CURING_PARAMS.temp_min}–{CURING_PARAMS.temp_max}°C, {tr('dry.store_dark')}</p>
			</div>
		</div>
	{/if}
</div>
