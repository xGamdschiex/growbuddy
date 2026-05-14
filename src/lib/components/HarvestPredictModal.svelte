<script lang="ts">
	/**
	 * HarvestPredictModal — Per-Strain-Aufschlüsselung der Harvest-Schätzung
	 * + Info-Sub-View ("Wie wird das berechnet?").
	 *
	 * Aus grow/[id]/+page.svelte extrahiert (v1.3.74). Wird gerendert wenn der
	 * Parent das Modal öffnen will; `onClose` schließt komplett.
	 * Die ℹ️-Ansicht ersetzt die Strain-Ansicht (kein Stack) — wie vorher.
	 */
	import { formatDaysUntil, type HarvestPredictResult } from '$lib/utils/harvest-predict';
	import type { Grow } from '$lib/stores/grow';

	type PerStrainResult = HarvestPredictResult & { strain: string; plantCount: number; floweringWeeks: number };

	interface Props {
		harvestPredict: HarvestPredictResult;
		harvestPerStrain: PerStrainResult[];
		nextHarvestStrain: PerStrainResult | null;
		allStrainsSameTime: boolean;
		bloomStartDay: number | null;
		totalDays: number;
		grow: Grow;
		onClose: () => void;
	}
	let {
		harvestPredict,
		harvestPerStrain,
		nextHarvestStrain,
		allStrainsSameTime,
		bloomStartDay,
		totalDays,
		grow,
		onClose,
	}: Props = $props();

	let view = $state<'strains' | 'info'>('strains');
</script>

{#if view === 'strains'}
	<!-- Per-Strain Predict Modal -->
	<div class="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center p-4"
		role="presentation" onclick={onClose}>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="bg-gb-surface rounded-xl p-5 max-w-md w-full max-h-[80vh] overflow-y-auto"
			role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-start justify-between mb-3 gap-2">
				<h3 class="text-lg font-bold">🌿 Harvest-Predict</h3>
				<div class="flex items-center gap-1 shrink-0">
					<button type="button" onclick={() => (view = 'info')}
						aria-label="Berechnung erklären"
						class="text-gb-text-muted hover:text-gb-text text-base leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gb-surface-2 transition-colors">
						ℹ️
					</button>
					<button type="button" onclick={onClose} aria-label="Schließen"
						class="text-gb-text-muted hover:text-gb-text text-xl leading-none w-8 h-8 flex items-center justify-center">×</button>
				</div>
			</div>

			<!-- Gemeinsame Zeit-Anzeige -->
			<div class="bg-gb-bg/40 rounded-lg p-3 mb-3 text-center">
				<p class="text-xs text-gb-text-muted">Voraussichtlich noch</p>
				<p class="text-xl font-bold text-gb-text mt-0.5">{formatDaysUntil(harvestPredict.daysUntilHarvest)} bis Harvest</p>
				<p class="text-[10px] text-gb-text-muted mt-1">
					{harvestPredict.totalDaysExpected}d gesamt · {totalDays}d schon · Performance {(harvestPredict.performanceMultiplier * 100).toFixed(0)}%
				</p>
			</div>

			<!-- Per-Strain-Aufschlüsselung mit Bloom-Progress-Bar -->
			<div class="space-y-2">
				<p class="text-xs text-gb-text-muted font-semibold uppercase tracking-wide">Ertrag pro Strain</p>
				{#each harvestPerStrain as ps, idx}
					{@const bloomDaysTotal = ps.floweringWeeks * 7}
					{@const bloomDaysElapsed = bloomStartDay !== null ? Math.max(0, totalDays - bloomStartDay) : 0}
					{@const progressPct = bloomStartDay !== null && bloomDaysTotal > 0
						? Math.min(100, (bloomDaysElapsed / bloomDaysTotal) * 100)
						: 0}
					{@const isFirstHarvest = nextHarvestStrain && ps.strain === nextHarvestStrain.strain && !allStrainsSameTime}
					<div class="space-y-1.5 bg-gb-bg/40 rounded-lg px-3 py-2.5 {isFirstHarvest ? 'ring-1 ring-gb-green/40' : ''}">
						<div class="flex items-center justify-between gap-3">
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium truncate flex items-center gap-1.5">
									{#if isFirstHarvest}<span class="text-xs">🥇</span>{/if}
									{ps.strain}
								</p>
								<p class="text-[10px] text-gb-text-muted">
									{ps.plantCount} Pflanze{ps.plantCount === 1 ? '' : 'n'} · {ps.floweringWeeks} Wo Bloom
								</p>
							</div>
							<div class="text-right shrink-0">
								<p class="text-base font-bold text-gb-green">~{ps.yieldGrams}g</p>
								<p class="text-[10px] text-gb-text-muted">{ps.yieldRange.min}-{ps.yieldRange.max}g</p>
							</div>
						</div>
						<!-- Bloom-Progress-Bar (nur wenn in Bloom) -->
						{#if bloomStartDay !== null}
							<div class="space-y-0.5">
								<div class="h-1.5 bg-gb-surface rounded-full overflow-hidden">
									<div
										class="h-full {progressPct >= 100 ? 'bg-gb-accent' : 'bg-gb-green'} transition-all"
										style="width: {progressPct.toFixed(0)}%"
									></div>
								</div>
								<p class="text-[10px] text-gb-text-muted text-right">
									{progressPct.toFixed(0)}% Bloom · noch {formatDaysUntil(ps.daysUntilHarvest)}
								</p>
							</div>
						{:else}
							<p class="text-[10px] text-gb-text-muted">
								Noch in Veg · gesamt noch {formatDaysUntil(ps.daysUntilHarvest)}
							</p>
						{/if}
					</div>
				{/each}

				<!-- Σ Gesamt -->
				<div class="flex items-center justify-between gap-3 border-t border-gb-border/30 pt-3 mt-2 px-3">
					<p class="text-sm font-semibold">Σ Gesamt</p>
					<span class="text-lg font-bold text-gb-green">~{harvestPredict.yieldGrams}g</span>
				</div>
			</div>

			<button type="button" onclick={onClose}
				class="mt-4 w-full bg-gb-green text-white font-medium py-2.5 rounded-lg hover:bg-gb-green/90 transition-colors">
				Verstanden
			</button>
		</div>
	</div>
{:else}
	<!-- Harvest-Predict Info-View (via ℹ️) -->
	<div class="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center p-4"
		role="presentation" onclick={onClose}>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="bg-gb-surface rounded-xl p-5 max-w-md w-full max-h-[80vh] overflow-y-auto"
			role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-start justify-between mb-3">
				<h3 class="text-lg font-bold">🌿 Wie wird die Schätzung berechnet?</h3>
				<button type="button" onclick={onClose} aria-label="Schließen"
					class="text-gb-text-muted hover:text-gb-text text-xl leading-none w-8 h-8 flex items-center justify-center">×</button>
			</div>
			<div class="space-y-3 text-sm leading-relaxed text-gb-text-muted">
				<p><strong>Tage bis Harvest</strong> = Erwartete Gesamtdauer minus aktuelle Grow-Tage.
					{harvestPredict.totalDaysExpected}d für {grow.strain_type === 'auto' ? 'Autoflower' : 'Photoperiode'} − {totalDays}d aktuell.</p>
				<p><strong>Yield</strong> = Basis-Ertrag pro Pflanze × Pflanzenzahl × Performance-Multiplier ({(harvestPredict.performanceMultiplier * 100).toFixed(0)}%).</p>
				<p><strong>Performance</strong> richtet sich nach deiner VPD- und Temperatur-In-Range-Rate.
					Bessere Klima-Werte → höherer Multiplier (max +10%).</p>
				<p><strong>Confidence: {harvestPredict.confidence}</strong> — basiert auf Check-in-Anzahl. Ab 20 Check-ins wird die Schätzung genauer.</p>
				<p class="text-xs italic">Range ±25% reflektiert Strain- und Setup-Varianz.
					Echte Yields hängen stark von Licht (PPFD/Watt), Genetik und Pflege ab.</p>
			</div>
			<button type="button" onclick={onClose}
				class="mt-4 w-full bg-gb-green text-white font-medium py-2.5 rounded-lg hover:bg-gb-green/90 transition-colors">
				Verstanden
			</button>
		</div>
	</div>
{/if}
