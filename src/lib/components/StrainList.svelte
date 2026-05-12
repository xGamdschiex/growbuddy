<script lang="ts">
	/**
	 * Multi-Strain-Editor: Liste von Strain+Plant-Count-Inputs.
	 * Mindestens 1 Entry, + / ✕ zum Erweitern.
	 *
	 * `entries` ist bindable — Parent kontrolliert State.
	 */
	import type { GrowStrainEntry } from '$lib/stores/grow';
	import { DEFAULT_FLOWERING_WEEKS } from '$lib/utils/grow-strains';

	interface Props {
		entries: GrowStrainEntry[];
		placeholder?: string;
		/** Auto vs Photo — bestimmt Default für Bloom-Wochen-Feld */
		strainType?: 'auto' | 'photo';
	}

	let { entries = $bindable(), placeholder = 'z.B. Strawberry Gummies', strainType = 'photo' }: Props = $props();

	let defaultFlowerWeeks = $derived(DEFAULT_FLOWERING_WEEKS[strainType]);

	function addEntry() {
		entries = [...entries, { strain: '', plant_count: 1, flowering_weeks: defaultFlowerWeeks }];
	}

	function removeEntry(i: number) {
		if (entries.length <= 1) return;
		entries = entries.filter((_, idx) => idx !== i);
	}

	function updateStrain(i: number, value: string) {
		entries = entries.map((e, idx) => idx === i ? { ...e, strain: value } : e);
	}

	function updatePlantCount(i: number, value: number) {
		const safe = Math.max(1, Math.min(50, Math.round(value)));
		entries = entries.map((e, idx) => idx === i ? { ...e, plant_count: safe } : e);
	}

	function updateFloweringWeeks(i: number, value: number) {
		const safe = Math.max(3, Math.min(16, Math.round(value)));
		entries = entries.map((e, idx) => idx === i ? { ...e, flowering_weeks: safe } : e);
	}

	let total = $derived(entries.reduce((s, e) => s + (e.plant_count || 0), 0));
</script>

<div class="space-y-3">
	{#each entries as entry, i}
		<div class="space-y-1.5">
			<div class="flex gap-2 items-center">
				<input
					type="text"
					value={entry.strain}
					oninput={(e) => updateStrain(i, (e.currentTarget as HTMLInputElement).value)}
					{placeholder}
					class="flex-1 min-w-0 bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm placeholder:text-gb-border" />
				<input
					type="number"
					value={entry.plant_count}
					oninput={(e) => updatePlantCount(i, parseInt((e.currentTarget as HTMLInputElement).value || '1'))}
					min="1" max="50" step="1"
					aria-label="Anzahl Pflanzen"
					class="w-14 bg-gb-surface border border-gb-border rounded-lg px-2 py-2.5 text-sm text-center" />
				<button
					type="button"
					onclick={() => removeEntry(i)}
					disabled={entries.length <= 1}
					aria-label="Strain entfernen"
					class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-gb-text-muted
						hover:bg-gb-error/10 hover:text-gb-error transition-colors
						disabled:opacity-30 disabled:cursor-not-allowed">
					✕
				</button>
			</div>
			<!-- Bloom-Wochen Sub-Input -->
			<div class="flex items-center gap-2 pl-1">
				<label for="strain-bloom-{i}" class="text-[11px] text-gb-text-muted">Blütezeit:</label>
				<input
					id="strain-bloom-{i}"
					type="number"
					value={entry.flowering_weeks ?? defaultFlowerWeeks}
					oninput={(e) => updateFloweringWeeks(i, parseInt((e.currentTarget as HTMLInputElement).value || String(defaultFlowerWeeks)))}
					min="3" max="16" step="1"
					aria-label="Blütezeit in Wochen"
					class="w-12 bg-gb-surface border border-gb-border rounded px-1.5 py-1 text-[12px] text-center" />
				<span class="text-[11px] text-gb-text-muted">Wochen (Standard {defaultFlowerWeeks})</span>
			</div>
		</div>
	{/each}

	<div class="flex items-center justify-between gap-2 pt-1">
		<button
			type="button"
			onclick={addEntry}
			class="text-gb-green text-sm font-medium hover:text-gb-green-light transition-colors">
			+ Weiteren Strain
		</button>
		<span class="text-xs text-gb-text-muted">
			Σ {total} Pflanze{total === 1 ? '' : 'n'}
		</span>
	</div>
</div>
