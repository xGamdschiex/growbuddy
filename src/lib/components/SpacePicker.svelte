<script lang="ts">
	/**
	 * Space-Picker mit Preset-Dropdown + Custom-Größe (cm × cm).
	 * Output: standard-string ('60x60', 'outdoor') oder custom WxT ('130x80').
	 */
	interface Props {
		value: string;
	}

	let { value = $bindable() }: Props = $props();

	const PRESETS = [
		{ value: 'fensterbank', label: 'Fensterbank' },
		{ value: '40x40', label: '40×40 cm' },
		{ value: '60x60', label: '60×60 cm' },
		{ value: '80x80', label: '80×80 cm' },
		{ value: '100x100', label: '100×100 cm' },
		{ value: '120x60', label: '120×60 cm' },
		{ value: '120x120', label: '120×120 cm' },
		{ value: 'raum', label: 'Ganzer Raum' },
		{ value: 'outdoor', label: 'Outdoor' },
	] as const;

	// Check ob value ein Preset ist oder Custom
	let isCustom = $derived(!PRESETS.some(p => p.value === value));

	// Custom-State (initial direkt aus value berechnen, nicht aus isCustom — sonst Svelte warning)
	let customWidth = $state(120);
	let customDepth = $state(60);
	let mode = $state<'preset' | 'custom'>(
		PRESETS.some(p => p.value === value) ? 'preset' : 'custom'
	);

	// Initial: parse custom value wenn vorhanden
	$effect(() => {
		if (isCustom && value && value.includes('x')) {
			const [w, d] = value.split('x').map(Number);
			if (!isNaN(w) && !isNaN(d)) {
				customWidth = w;
				customDepth = d;
				mode = 'custom';
			}
		}
	});

	function selectPreset(v: string) {
		mode = 'preset';
		value = v;
	}

	function activateCustom() {
		mode = 'custom';
		value = `${customWidth}x${customDepth}`;
	}

	function updateCustom() {
		const w = Math.max(20, Math.min(500, Math.round(customWidth)));
		const d = Math.max(20, Math.min(500, Math.round(customDepth)));
		customWidth = w;
		customDepth = d;
		value = `${w}x${d}`;
	}
</script>

<div class="space-y-2">
	{#if mode === 'preset'}
		<select bind:value={value} onchange={(e) => selectPreset((e.currentTarget as HTMLSelectElement).value)}
			class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm">
			{#each PRESETS as p}
				<option value={p.value}>{p.label}</option>
			{/each}
		</select>
		<button type="button" onclick={activateCustom}
			class="text-gb-green text-xs hover:text-gb-green-light transition-colors">
			+ Eigene Größe…
		</button>
	{:else}
		<div class="flex gap-2 items-center">
			<input
				type="number"
				bind:value={customWidth}
				oninput={updateCustom}
				min="20" max="500" step="5"
				aria-label="Breite cm"
				class="flex-1 bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm text-center" />
			<span class="text-gb-text-muted text-sm">×</span>
			<input
				type="number"
				bind:value={customDepth}
				oninput={updateCustom}
				min="20" max="500" step="5"
				aria-label="Tiefe cm"
				class="flex-1 bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm text-center" />
			<span class="text-gb-text-muted text-sm">cm</span>
		</div>
		<button type="button" onclick={() => { mode = 'preset'; value = '60x60'; }}
			class="text-gb-text-muted text-xs hover:text-gb-text transition-colors">
			← Voreinstellung
		</button>
	{/if}
</div>
