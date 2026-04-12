<script lang="ts">
	import { calcDLI, ppfdForDLI, DLI_TARGETS } from '$lib/data/science';
	import { xpStore } from '$lib/stores/xp';
	xpStore.awardToolUse('dli');

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

	const phases = [
		{ key: 'seedling', label: 'Sämling', hours: 18 },
		{ key: 'vegetative', label: 'Vegetation', hours: 18 },
		{ key: 'flower', label: 'Blüte', hours: 12 },
		{ key: 'flower_co2', label: 'Blüte + CO₂', hours: 12 },
	];
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-6">
	<div>
		<h1 class="text-xl font-bold">DLI Rechner</h1>
		<p class="text-gb-text-muted text-sm">Daily Light Integral — Lichtmenge optimieren</p>
	</div>

	<!-- DLI Ergebnis -->
	<div class="bg-gb-surface rounded-xl p-6 text-center">
		<p class="text-5xl font-bold {dliStatus(dli, target)}">{dli.toFixed(1)}</p>
		<p class="text-sm text-gb-text-muted mt-1">mol/m²/Tag</p>
		{#if target}
			<p class="text-xs text-gb-text-muted mt-2">Ziel: {target.dli_min}–{target.dli_max} mol/m²/Tag</p>
		{/if}
	</div>

	<!-- Phase -->
	<div>
		<label class="block text-sm text-gb-text-muted mb-2">Phase</label>
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
			<span class="text-gb-text-muted">PPFD</span>
			<span class="font-medium">{ppfd} µmol/m²/s</span>
		</div>
		<input type="range" min="50" max="1500" step="10" bind:value={ppfd}
			class="w-full accent-gb-green" />
		{#if target}
			<p class="text-xs text-gb-text-muted mt-1">Empfohlen: {target.ppfd_min}–{target.ppfd_max} µmol/m²/s</p>
		{/if}
	</div>

	<!-- Photoperiode -->
	<div>
		<div class="flex justify-between text-sm mb-2">
			<span class="text-gb-text-muted">Photoperiode</span>
			<span class="font-medium">{hours}h</span>
		</div>
		<input type="range" min="6" max="24" step="1" bind:value={hours}
			class="w-full accent-gb-green" />
	</div>

	<!-- Empfehlung -->
	{#if target}
		<div class="bg-gb-surface rounded-xl p-4 space-y-2 text-sm">
			<p class="font-medium">Für Ziel-DLI {target.dli_min}–{target.dli_max}:</p>
			<p class="text-gb-text-muted">Min. PPFD: <span class="text-gb-text font-medium">{ppfdForDLI(target.dli_min, hours)}</span> µmol/m²/s</p>
			<p class="text-gb-text-muted">Max. PPFD: <span class="text-gb-text font-medium">{ppfdForDLI(target.dli_max, hours)}</span> µmol/m²/s</p>
			{#if phase === 'flower_co2'}
				<p class="text-gb-warning text-xs mt-2">Über 900 PPFD nur mit CO₂-Supplementierung (1200+ ppm) sinnvoll. Ohne CO₂ bei ca. 800 PPFD Lichtsättigung.</p>
			{/if}
		</div>
	{/if}

	<!-- Info -->
	<div class="bg-gb-surface rounded-xl p-4 text-sm text-gb-text-muted space-y-2">
		<p><strong class="text-gb-text">Was ist DLI?</strong></p>
		<p>DLI = PPFD × Stunden × 3600 / 1.000.000. Misst die Gesamtlichtmenge die eine Pflanze pro Tag erhält. Wichtiger als PPFD allein, weil es die Belichtungsdauer einbezieht.</p>
	</div>
</div>
