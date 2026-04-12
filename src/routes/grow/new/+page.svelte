<script lang="ts">
	import { goto } from '$app/navigation';
	import { growStore, totalGrows } from '$lib/stores/grow';
	import { xpStore } from '$lib/stores/xp';
	import { getAllFeedLines } from '$lib/calc/feedlines/registry';
	import type { StrainType } from '$lib/stores/grow';
	import type { Medium } from '$lib/data/science';

	const feedlines = getAllFeedLines();

	let name = $state('');
	let strain = $state('');
	let strainType = $state<StrainType>('auto');
	let medium = $state<Medium>('coco');
	let space = $state('60x60');
	let feedlineId = $state('athena-pro');
	let lightInfo = $state('');
	let plantCount = $state(1);
	let notes = $state('');

	const spaces = [
		{ value: 'fensterbank', label: 'Fensterbank' },
		{ value: '40x40', label: '40×40 cm' },
		{ value: '60x60', label: '60×60 cm' },
		{ value: '80x80', label: '80×80 cm' },
		{ value: '100x100', label: '100×100 cm' },
		{ value: '120x60', label: '120×60 cm' },
		{ value: '120x120', label: '120×120 cm' },
		{ value: 'raum', label: 'Ganzer Raum' },
		{ value: 'outdoor', label: 'Outdoor' },
	];

	let growCount = $derived.by(() => { let v = 0; totalGrows.subscribe(x => v = x)(); return v; });

	function startGrow() {
		if (!strain.trim()) return;
		const growName = name.trim() || `${strain} #1`;
		const isFirst = growCount === 0;
		const id = growStore.addGrow({
			name: growName,
			strain: strain.trim(),
			strain_type: strainType,
			medium,
			space,
			feedline_id: feedlineId,
			light_info: lightInfo.trim(),
			plant_count: plantCount,
			started_at: new Date().toISOString(),
			notes: notes.trim(),
		});
		xpStore.awardGrowStart(isFirst);
		goto(`/grow/${id}`);
	}
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-5">
	<div>
		<a href="/grow" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; Zurück</a>
		<h1 class="text-xl font-bold mt-2">Neuer Grow</h1>
	</div>

	<!-- Strain -->
	<div>
		<label class="block text-xs text-gb-text-muted mb-1">Strain *</label>
		<input type="text" bind:value={strain} placeholder="z.B. Northern Lights Auto"
			class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm placeholder:text-gb-border" />
	</div>

	<!-- Name (optional) -->
	<div>
		<label class="block text-xs text-gb-text-muted mb-1">Grow-Name (optional)</label>
		<input type="text" bind:value={name} placeholder="z.B. NL Run #3"
			class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm placeholder:text-gb-border" />
	</div>

	<!-- Strain Type -->
	<div>
		<label class="block text-xs text-gb-text-muted mb-2">Typ</label>
		<div class="grid grid-cols-2 gap-2">
			<button onclick={() => strainType = 'auto'}
				class="px-3 py-2.5 rounded-lg text-sm transition-colors
					{strainType === 'auto' ? 'bg-gb-green text-black font-semibold' : 'bg-gb-surface-2 text-gb-text-muted'}">
				Automatic
			</button>
			<button onclick={() => strainType = 'photo'}
				class="px-3 py-2.5 rounded-lg text-sm transition-colors
					{strainType === 'photo' ? 'bg-gb-green text-black font-semibold' : 'bg-gb-surface-2 text-gb-text-muted'}">
				Photoperiodisch
			</button>
		</div>
	</div>

	<!-- Medium -->
	<div>
		<label class="block text-xs text-gb-text-muted mb-2">Medium</label>
		<div class="grid grid-cols-3 gap-2">
			{#each [['soil', 'Erde'], ['coco', 'Kokos'], ['hydro', 'Hydro']] as [val, label]}
				<button onclick={() => medium = val as Medium}
					class="px-3 py-2.5 rounded-lg text-sm transition-colors
						{medium === val ? 'bg-gb-green text-black font-semibold' : 'bg-gb-surface-2 text-gb-text-muted'}">
					{label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Space + Plants -->
	<div class="grid grid-cols-2 gap-3">
		<div>
			<label class="block text-xs text-gb-text-muted mb-1">Grow-Space</label>
			<select bind:value={space} class="w-full bg-gb-surface border border-gb-border rounded-lg px-2 py-2.5 text-sm">
				{#each spaces as s}
					<option value={s.value}>{s.label}</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="block text-xs text-gb-text-muted mb-1">Pflanzen</label>
			<input type="number" bind:value={plantCount} min="1" max="50" step="1"
				class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
		</div>
	</div>

	<!-- Feedline -->
	<div>
		<label class="block text-xs text-gb-text-muted mb-1">Düngerlinie</label>
		<select bind:value={feedlineId} class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm">
			{#each feedlines as fl}
				<option value={fl.id}>{fl.name}</option>
			{/each}
		</select>
	</div>

	<!-- Licht -->
	<div>
		<label class="block text-xs text-gb-text-muted mb-1">Beleuchtung (optional)</label>
		<input type="text" bind:value={lightInfo} placeholder="z.B. Samsung LM301H 150W"
			class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm placeholder:text-gb-border" />
	</div>

	<!-- Notizen -->
	<div>
		<label class="block text-xs text-gb-text-muted mb-1">Notizen (optional)</label>
		<textarea bind:value={notes} rows="2" placeholder="Seedbank, Phänotyp, Besonderheiten..."
			class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm placeholder:text-gb-border resize-none"></textarea>
	</div>

	<!-- Start Button -->
	<button
		onclick={startGrow}
		disabled={!strain.trim()}
		class="w-full bg-gb-green text-black font-semibold py-3 rounded-lg text-sm
			hover:bg-gb-green-light transition-colors
			disabled:opacity-30 disabled:cursor-not-allowed"
	>
		Grow starten
	</button>
</div>
