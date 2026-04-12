<script lang="ts">
	import { DRYING_PARAMS, CURING_PARAMS } from '$lib/data/science';

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
		// Persist
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

	// Load on mount
	$effect(() => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem(`growbuddy_${mode}_start`);
			if (saved) startedAt = saved;
		}
	});
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-5">
	<div>
		<a href="/tools" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; Tools</a>
		<h1 class="text-xl font-bold mt-2">Trocknungs-Timer</h1>
	</div>

	<!-- Mode Toggle -->
	<div class="grid grid-cols-2 gap-2">
		<button onclick={() => mode = 'drying'}
			class="py-2.5 rounded-lg text-sm transition-colors
				{mode === 'drying' ? 'bg-gb-green text-black font-semibold' : 'bg-gb-surface-2 text-gb-text-muted'}">
			Trocknung
		</button>
		<button onclick={() => mode = 'curing'}
			class="py-2.5 rounded-lg text-sm transition-colors
				{mode === 'curing' ? 'bg-gb-green text-black font-semibold' : 'bg-gb-surface-2 text-gb-text-muted'}">
			Curing
		</button>
	</div>

	{#if mode === 'drying'}
		<!-- Timer -->
		<div class="bg-gb-surface rounded-xl p-6 text-center">
			{#if startedAt}
				<p class="text-5xl font-bold {elapsedDays >= DRYING_PARAMS.days_min ? 'text-gb-green' : 'text-gb-text'}">
					Tag {elapsedDays}
				</p>
				<p class="text-sm text-gb-text-muted mt-2">
					{#if elapsedDays < DRYING_PARAMS.days_min}
						Noch min. {DRYING_PARAMS.days_min - elapsedDays} Tage
					{:else if elapsedDays <= DRYING_PARAMS.days_max}
						Im Zielfenster! Zweig-Test machen.
					{:else}
						Über {DRYING_PARAMS.days_max} Tage — prüfe ob zu trocken
					{/if}
				</p>
				<button onclick={reset} class="mt-3 text-sm text-gb-text-muted hover:text-gb-danger">Timer zurücksetzen</button>
			{:else}
				<p class="text-gb-text-muted mb-4">Trocknung starten wenn die Pflanzen hängen</p>
				<button onclick={start}
					class="bg-gb-green text-black font-semibold px-6 py-3 rounded-lg text-sm hover:bg-gb-green-light transition-colors">
					Timer starten
				</button>
			{/if}
		</div>

		<!-- Messwerte -->
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="block text-xs text-gb-text-muted mb-1">Temp °C</label>
				<input type="number" bind:value={temp} step="0.5" placeholder="20"
					class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
				{#if temp !== null}
					<p class="text-xs mt-1 {tempOk ? 'text-gb-green' : 'text-gb-danger'}">
						Ziel: {DRYING_PARAMS.temp_min}–{DRYING_PARAMS.temp_max}°C {tempOk ? '✓' : '✗'}
					</p>
				{/if}
			</div>
			<div>
				<label class="block text-xs text-gb-text-muted mb-1">RH %</label>
				<input type="number" bind:value={rh} step="1" placeholder="60"
					class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
				{#if rh !== null}
					<p class="text-xs mt-1 {rhOk ? 'text-gb-green' : 'text-gb-danger'}">
						Ziel: {DRYING_PARAMS.rh_min}–{DRYING_PARAMS.rh_max}% {rhOk ? '✓' : '✗'}
					</p>
				{/if}
			</div>
		</div>

		<!-- Regeln -->
		<div class="bg-gb-surface rounded-xl p-4 space-y-2 text-sm">
			<h3 class="font-semibold">Trocknungsregeln</h3>
			<ul class="space-y-1 text-gb-text-muted">
				<li>• {DRYING_PARAMS.temp_min}–{DRYING_PARAMS.temp_max}°C, {DRYING_PARAMS.rh_min}–{DRYING_PARAMS.rh_max}% RH</li>
				<li>• {DRYING_PARAMS.days_min}–{DRYING_PARAMS.days_max} Tage</li>
				<li>• Absolut dunkel (Licht baut THC ab)</li>
				<li>• Luftzirkulation indirekt — kein Ventilator direkt auf die Pflanzen</li>
				<li>• Fertig wenn: {DRYING_PARAMS.done_indicator}</li>
			</ul>
		</div>

	{:else}
		<!-- Curing Info -->
		<div class="bg-gb-surface rounded-xl p-4 space-y-3 text-sm">
			<h3 class="font-semibold">Curing-Anleitung</h3>
			<p class="text-gb-text-muted">{CURING_PARAMS.container}</p>
			<p class="text-gb-text-muted">Ziel-RH im Glas: {CURING_PARAMS.target_rh.min}–{CURING_PARAMS.target_rh.max}%</p>

			<h4 class="font-medium mt-2">Burping-Schema</h4>
			{#each CURING_PARAMS.burping as b}
				<div class="flex justify-between">
					<span class="text-gb-text-muted">Woche {b.weeks}:</span>
					<span>{b.frequency}</span>
				</div>
			{/each}

			<div class="mt-2 pt-2 border-t border-gb-border">
				<p>Minimum: <span class="text-gb-warning font-medium">{CURING_PARAMS.minimum_weeks} Wochen</span></p>
				<p>Optimal: <span class="text-gb-green font-medium">{CURING_PARAMS.optimal_weeks} Wochen</span></p>
				<p class="text-gb-text-muted mt-1">{CURING_PARAMS.temp_min}–{CURING_PARAMS.temp_max}°C, dunkel lagern</p>
			</div>
		</div>
	{/if}
</div>
