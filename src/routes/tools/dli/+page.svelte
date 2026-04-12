<script lang="ts">
	import { calcDLI, ppfdForDLI, DLI_TARGETS } from '$lib/data/science';
	import { xpStore } from '$lib/stores/xp';
	import { t } from '$lib/i18n';
	xpStore.awardToolUse('dli');

	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
	let ppfd = $state(600);
	let hours = $state(18);
	let phase = $state<string>('vegetative');

	let dli = $derived(calcDLI(ppfd, hours));
	let target = $derived(DLI_TARGETS[phase]);

	function dliStatus(d: number, t: typeof target): string {
		if (!t) return 'text-gb-text';
		if (d < t.dli_min) return 'text-gb-info';
		if (d > t.dli_max) return 'text-gb-warning';
		return 'text-gb-green';
	}

	let phases = $derived([
		{ key: 'seedling', label: tr('dli.seedling'), hours: 18 },
		{ key: 'vegetative', label: tr('dli.vegetative'), hours: 18 },
		{ key: 'flower', label: tr('dli.flower'), hours: 12 },
		{ key: 'flower_co2', label: tr('dli.flower_co2'), hours: 12 },
	]);
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-6">
	<div>
		<h1 class="text-xl font-bold">{tr('dli.title')}</h1>
		<p class="text-gb-text-muted text-sm">{tr('dli.subtitle')}</p>
	</div>

	<!-- DLI Ergebnis -->
	<div class="bg-gb-surface rounded-xl p-6 text-center">
		<p class="text-5xl font-bold {dliStatus(dli, target)}">{dli.toFixed(1)}</p>
		<p class="text-sm text-gb-text-muted mt-1">mol/m²/Tag</p>
		{#if target}
			<p class="text-xs text-gb-text-muted mt-2">{tr('dli.target', { min: target.dli_min, max: target.dli_max })}</p>
		{/if}
	</div>

	<!-- Phase -->
	<div>
		<label class="block text-sm text-gb-text-muted mb-2">{tr('dli.phase')}</label>
		<div class="grid grid-cols-2 gap-2">
			{#each phases as p}
				<button
					onclick={() => { phase = p.key; hours = p.hours; }}
					class="px-3 py-2 rounded-lg text-sm transition-colors
						{phase === p.key ? 'bg-gb-green text-black font-semibold' : 'bg-gb-surface-2 text-gb-text-muted hover:text-gb-text'}"
				>
					{p.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- PPFD -->
	<div>
		<div class="flex justify-between text-sm mb-2">
			<span class="text-gb-text-muted">{tr('dli.ppfd')}</span>
			<span class="font-medium">{ppfd} µmol/m²/s</span>
		</div>
		<input type="range" min="50" max="1500" step="10" bind:value={ppfd}
			class="w-full accent-gb-green" />
		{#if target}
			<p class="text-xs text-gb-text-muted mt-1">{tr('dli.recommended', { min: target.ppfd_min, max: target.ppfd_max })}</p>
		{/if}
	</div>

	<!-- Photoperiode -->
	<div>
		<div class="flex justify-between text-sm mb-2">
			<span class="text-gb-text-muted">{tr('dli.photoperiod')}</span>
			<span class="font-medium">{hours}h</span>
		</div>
		<input type="range" min="6" max="24" step="1" bind:value={hours}
			class="w-full accent-gb-green" />
	</div>

	<!-- Empfehlung -->
	{#if target}
		<div class="bg-gb-surface rounded-xl p-4 space-y-2 text-sm">
			<p class="font-medium">{tr('dli.for_target', { min: target.dli_min, max: target.dli_max })}</p>
			<p class="text-gb-text-muted">{tr('dli.min_ppfd')} <span class="text-gb-text font-medium">{ppfdForDLI(target.dli_min, hours)}</span> µmol/m²/s</p>
			<p class="text-gb-text-muted">{tr('dli.max_ppfd')} <span class="text-gb-text font-medium">{ppfdForDLI(target.dli_max, hours)}</span> µmol/m²/s</p>
			{#if phase === 'flower_co2'}
				<p class="text-gb-warning text-xs mt-2">{tr('dli.co2_warning')}</p>
			{/if}
		</div>
	{/if}

	<!-- Info -->
	<div class="bg-gb-surface rounded-xl p-4 text-sm text-gb-text-muted space-y-2">
		<p><strong class="text-gb-text">{tr('dli.what_is')}</strong></p>
		<p>{tr('dli.explanation')}</p>
	</div>
</div>
