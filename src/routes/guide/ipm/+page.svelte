<script lang="ts">
	import { PESTS } from '$lib/data/ipm';
	import type { PestEntry } from '$lib/data/ipm';

	let selectedPest = $state<PestEntry | null>(null);
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-5">
	<div>
		<a href="/tools" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; Tools</a>
		<h1 class="text-xl font-bold mt-2">IPM Guide</h1>
		<p class="text-gb-text-muted text-sm">Integrierte Schädlingsbekämpfung — wissenschaftlich korrekt</p>
	</div>

	<div class="bg-gb-warning/10 border border-gb-warning/20 rounded-lg p-3 text-sm text-gb-warning">
		Kein Neem-Öl bei Cannabis! Azadirachtin-Rückstände sind gesundheitsschädlich.
	</div>

	{#if selectedPest}
		<!-- Detail View -->
		<div class="space-y-4">
			<button onclick={() => selectedPest = null} class="text-gb-text-muted text-sm hover:text-gb-text">&larr; Alle Schädlinge</button>

			<div>
				<h2 class="text-lg font-bold">{selectedPest.german}</h2>
				<p class="text-sm text-gb-text-muted">{selectedPest.name}</p>
			</div>

			<!-- Symptome -->
			<div class="bg-gb-surface rounded-xl p-4 space-y-2">
				<h3 class="text-sm font-semibold text-gb-danger">Symptome</h3>
				<ul class="space-y-1">
					{#each selectedPest.symptoms as s}
						<li class="text-sm text-gb-text-muted flex gap-2">
							<span class="text-gb-danger shrink-0">•</span>{s}
						</li>
					{/each}
				</ul>
			</div>

			<!-- Lösungen -->
			<div class="space-y-2">
				<h3 class="text-sm font-semibold text-gb-green">Bekämpfung</h3>
				{#each selectedPest.solutions as sol}
					<div class="bg-gb-surface rounded-xl p-3">
						<div class="flex items-start justify-between gap-2">
							<div>
								<p class="font-medium text-sm">{sol.name}</p>
								{#if sol.product}<p class="text-xs text-gb-accent">Produkt: {sol.product}</p>{/if}
								<p class="text-xs text-gb-text-muted mt-1">{sol.note}</p>
							</div>
							<span class="shrink-0 text-xs px-2 py-0.5 rounded {sol.safe_in_flower ? 'bg-gb-green/20 text-gb-green' : 'bg-gb-warning/20 text-gb-warning'}">
								{sol.safe_in_flower ? 'Blüte OK' : 'Nur Veg'}
							</span>
						</div>
					</div>
				{/each}
			</div>

			<!-- Prävention -->
			<div class="bg-gb-surface rounded-xl p-4 space-y-2">
				<h3 class="text-sm font-semibold text-gb-info">Prävention</h3>
				<ul class="space-y-1">
					{#each selectedPest.prevention as p}
						<li class="text-sm text-gb-text-muted flex gap-2">
							<span class="text-gb-info shrink-0">•</span>{p}
						</li>
					{/each}
				</ul>
			</div>
		</div>
	{:else}
		<!-- Pest List -->
		<div class="space-y-2">
			{#each PESTS as pest}
				<button onclick={() => selectedPest = pest}
					class="w-full text-left bg-gb-surface rounded-xl p-4 hover:bg-gb-surface-2 transition-colors flex items-center gap-3">
					<span class="text-2xl">
						{#if pest.id.includes('mite')}🕷️
						{:else if pest.id.includes('thrip')}🪲
						{:else if pest.id.includes('gnat')}🦟
						{:else if pest.id.includes('white')}🪰
						{:else if pest.id.includes('aphid')}🐛
						{:else if pest.id.includes('mildew')}🍄
						{:else if pest.id.includes('botrytis')}💀
						{:else if pest.id.includes('caterpillar')}🐛
						{:else}🐞{/if}
					</span>
					<div class="flex-1">
						<p class="font-medium">{pest.german}</p>
						<p class="text-sm text-gb-text-muted">{pest.symptoms[0]}</p>
					</div>
					<svg class="w-5 h-5 text-gb-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M9 18l6-6-6-6" />
					</svg>
				</button>
			{/each}
		</div>
	{/if}
</div>
