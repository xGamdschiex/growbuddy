<script lang="ts">
	import { goto } from '$app/navigation';
	import { growStore, totalGrows, activeGrows } from '$lib/stores/grow';
	import { xpStore } from '$lib/stores/xp';
	import { proStore, isPro, limits } from '$lib/stores/pro';
	import { t } from '$lib/i18n';
	import { onMount } from 'svelte';
	import { getAllFeedLines } from '$lib/calc/feedlines/registry';
	import type { StrainType, GrowSystem } from '$lib/stores/grow';
	import type { Medium } from '$lib/data/science';
	import { hapticSuccess } from '$lib/utils/haptic';
	import { toastStore } from '$lib/stores/toast';

	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
	const feedlines = getAllFeedLines();
	let activeCount = $state(0);
	let lim = $state<any>({});
	let userIsPro = $state(false);
	let atLimit = $derived(activeCount >= (lim.max_active_grows ?? 1));

	onMount(() => {
		const subs = [
			activeGrows.subscribe(v => activeCount = v.length),
			limits.subscribe(v => lim = v),
			isPro.subscribe(v => userIsPro = v),
			totalGrows.subscribe(v => growCount = v),
		];
		return () => subs.forEach(u => u());
	});

	let name = $state('');
	let strain = $state('');
	let strainType = $state<StrainType>('auto');
	let medium = $state<Medium>('coco');
	let space = $state('60x60');
	let feedlineId = $state('athena-pro');
	let lightInfo = $state('');
	let plantCount = $state(1);
	let notes = $state('');
	let startDate = $state(new Date().toISOString().slice(0, 10));
	let system = $state<GrowSystem>('topf');
	let cocoPerliteRatio = $state(70); // % Kokos (Rest Perlite)

	let spaces = $derived([
		{ value: 'fensterbank', label: tr('grow.space_fensterbank') },
		{ value: '40x40', label: '40×40 cm' },
		{ value: '60x60', label: '60×60 cm' },
		{ value: '80x80', label: '80×80 cm' },
		{ value: '100x100', label: '100×100 cm' },
		{ value: '120x60', label: '120×60 cm' },
		{ value: '120x120', label: '120×120 cm' },
		{ value: 'raum', label: tr('grow.space_raum') },
		{ value: 'outdoor', label: tr('grow.space_outdoor') },
	]);

	let growCount = $state(0);

	// Pro-Gate für Hydro-Systeme (AutoPot/DWC/RDWC)
	function selectSystem(s: GrowSystem) {
		if (s !== 'topf' && !userIsPro) {
			toastStore.error('Hydro-Systeme sind Pro-Feature');
			return;
		}
		system = s;
	}

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
			started_at: new Date(startDate).toISOString(),
			notes: notes.trim(),
			system,
			coco_perlite_ratio: medium === 'coco' ? cocoPerliteRatio : undefined,
		});
		xpStore.awardGrowStart(isFirst);
		hapticSuccess();
		goto(`/grow/${id}`);
	}
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-5">
	<div>
		<a href="/grow" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; {tr('grow.back')}</a>
		<h1 class="text-xl font-bold mt-2">{tr('grow.new')}</h1>
	</div>

	<!-- Strain -->
	<div>
		<label class="block text-xs text-gb-text-muted mb-1">{tr('grow.strain')} *</label>
		<input type="text" bind:value={strain} placeholder={tr('grow.strain_placeholder')}
			class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm placeholder:text-gb-border" />
	</div>

	<!-- Name (optional) -->
	<div>
		<label class="block text-xs text-gb-text-muted mb-1">{tr('grow.name')}</label>
		<input type="text" bind:value={name} placeholder={tr('grow.name_placeholder')}
			class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm placeholder:text-gb-border" />
	</div>

	<!-- Strain Type -->
	<div>
		<label class="block text-xs text-gb-text-muted mb-2">{tr('grow.type')}</label>
		<div class="grid grid-cols-2 gap-2">
			<button onclick={() => strainType = 'auto'}
				class="px-3 py-2.5 rounded-lg text-sm transition-colors
					{strainType === 'auto' ? 'bg-gb-green text-black font-semibold' : 'bg-gb-surface-2 text-gb-text-muted'}">
				{tr('general.auto')}
			</button>
			<button onclick={() => strainType = 'photo'}
				class="px-3 py-2.5 rounded-lg text-sm transition-colors
					{strainType === 'photo' ? 'bg-gb-green text-black font-semibold' : 'bg-gb-surface-2 text-gb-text-muted'}">
				{tr('general.photo')}
			</button>
		</div>
	</div>

	<!-- Medium -->
	<div>
		<label class="block text-xs text-gb-text-muted mb-2">{tr('grow.medium')}</label>
		<div class="grid grid-cols-3 gap-2">
			{#each [['soil', tr('grow.medium_soil')], ['coco', tr('grow.medium_coco')], ['hydro', tr('grow.medium_hydro')]] as [val, label]}
				<button onclick={() => medium = val as Medium}
					class="px-3 py-2.5 rounded-lg text-sm transition-colors
						{medium === val ? 'bg-gb-green text-black font-semibold' : 'bg-gb-surface-2 text-gb-text-muted'}">
					{label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Coco / Perlite Verhältnis (nur bei Coco) -->
	{#if medium === 'coco'}
		<div>
			<label class="block text-xs text-gb-text-muted mb-2">
				Kokos/Perlite-Mix: <span class="text-gb-text">{cocoPerliteRatio}% Kokos · {100 - cocoPerliteRatio}% Perlite</span>
			</label>
			<input type="range" min="50" max="100" step="5" bind:value={cocoPerliteRatio}
				class="w-full accent-gb-green" />
			<p class="text-xs text-gb-text-muted mt-1">
				Empfehlung: 70/30 für ausgeglichen, 60/40 bei viel Wasser, 80/20 bei trockener Umgebung. Relevant für Diagnose.
			</p>
		</div>
	{/if}

	<!-- Anbausystem -->
	<div>
		<label class="block text-xs text-gb-text-muted mb-2">Anbausystem</label>
		<div class="grid grid-cols-2 gap-2">
			{#each [
				{ val: 'topf', label: '🪴 Topf', desc: 'Klassisch' },
				{ val: 'autopot', label: '💧 AutoPot', desc: 'Pro', pro: true },
				{ val: 'dwc', label: '🫧 DWC', desc: 'Pro', pro: true },
				{ val: 'rdwc', label: '♻️ RDWC', desc: 'Pro', pro: true }
			] as opt}
				<button onclick={() => selectSystem(opt.val as GrowSystem)}
					disabled={opt.pro && !userIsPro}
					class="px-3 py-2.5 rounded-lg text-sm text-left transition-colors
						{system === opt.val ? 'bg-gb-green text-black font-semibold' : 'bg-gb-surface-2 text-gb-text-muted'}
						{opt.pro && !userIsPro ? 'opacity-50 cursor-not-allowed' : ''}">
					<div class="flex items-center justify-between">
						<span>{opt.label}</span>
						{#if opt.pro && !userIsPro}
							<span class="text-[10px] bg-gb-accent/20 text-gb-accent px-1.5 py-0.5 rounded">PRO</span>
						{/if}
					</div>
				</button>
			{/each}
		</div>
		<p class="text-xs text-gb-text-muted mt-2">
			{#if system === 'topf'}Topf: Standard-Dosierung (100%)
			{:else if system === 'autopot'}AutoPot: Reduzierte EC (85%) — konstante Wasserverfügbarkeit
			{:else if system === 'dwc'}DWC: Stark reduzierte EC (65%) — direkte Wurzelzone
			{:else if system === 'rdwc'}RDWC: Reduzierte EC (68%) — Rezirkulation
			{/if}
		</p>
	</div>

	<!-- Space + Plants -->
	<div class="grid grid-cols-2 gap-3">
		<div>
			<label class="block text-xs text-gb-text-muted mb-1">{tr('grow.space')}</label>
			<select bind:value={space} class="w-full bg-gb-surface border border-gb-border rounded-lg px-2 py-2.5 text-sm">
				{#each spaces as s}
					<option value={s.value}>{s.label}</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="block text-xs text-gb-text-muted mb-1">{tr('grow.plants')}</label>
			<input type="number" bind:value={plantCount} min="1" max="50" step="1"
				class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
		</div>
	</div>

	<!-- Feedline -->
	<div>
		<label class="block text-xs text-gb-text-muted mb-1">{tr('grow.feedline')}</label>
		<select bind:value={feedlineId} class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm">
			{#each feedlines as fl}
				<option value={fl.id}>{fl.name}</option>
			{/each}
		</select>
	</div>

	<!-- Licht -->
	<div>
		<label class="block text-xs text-gb-text-muted mb-1">{tr('grow.light')}</label>
		<input type="text" bind:value={lightInfo} placeholder={tr('grow.light_placeholder')}
			class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm placeholder:text-gb-border" />
	</div>

	<!-- Notizen -->
	<div>
		<label class="block text-xs text-gb-text-muted mb-1">{tr('grow.notes')}</label>
		<textarea bind:value={notes} rows="2" placeholder={tr('grow.notes_placeholder')}
			class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm placeholder:text-gb-border resize-none"></textarea>
	</div>

	<!-- Startdatum -->
	<div>
		<label class="block text-xs text-gb-text-muted mb-1">Startdatum (retroaktiv möglich)</label>
		<input type="date" bind:value={startDate} max={new Date().toISOString().slice(0, 10)}
			class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
	</div>

	<!-- Pro Limit Warning -->
	{#if atLimit}
		<div class="bg-gb-accent/10 border border-gb-accent/20 rounded-xl p-4 text-center">
			<p class="font-semibold text-sm">{tr('grow.limit_reached')}</p>
			<p class="text-xs text-gb-text-muted mt-1">{tr('grow.limit_desc', { max: lim.max_active_grows })}</p>
			<a href="/pro" class="inline-block mt-3 bg-gb-accent text-white font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-gb-accent/80 transition-colors">
				{tr('grow.unlock_pro')}
			</a>
		</div>
	{/if}

	<!-- Start Button -->
	<button
		onclick={startGrow}
		disabled={!strain.trim() || atLimit}
		class="w-full bg-gb-green text-black font-semibold py-3 rounded-lg text-sm
			hover:bg-gb-green-light transition-colors
			disabled:opacity-30 disabled:cursor-not-allowed"
	>
		{tr('grow.start')}
	</button>
</div>
