<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { growStore } from '$lib/stores/grow';
	import { xpStore } from '$lib/stores/xp';
	import { isPro } from '$lib/stores/pro';
	import { t } from '$lib/i18n';
	import type { CheckIn } from '$lib/stores/grow';
	import { calcVPD, getVPDStatus } from '$lib/data/science';
	import { calculateGrowScore } from '$lib/data/score';
	import { hapticSuccess, hapticMedium } from '$lib/utils/haptic';
	import type { ScoreBreakdown } from '$lib/data/score';
	import MiniChart from '$lib/components/MiniChart.svelte';

	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
	let growId = $derived($page.params.id);
	let state = $derived.by(() => { let s: any; growStore.subscribe(v => s = v)(); return s; });
	let grow = $derived(state?.grows?.find((g: any) => g.id === growId));
	let checkins = $derived(
		(state?.checkins ?? [])
			.filter((c: CheckIn) => c.grow_id === growId)
			.sort((a: CheckIn, b: CheckIn) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
	);

	// Check-in Form State
	let showCheckin = $state(false);
	let ciPhase = $state('Veg');
	let ciWeek = $state(1);
	let ciDay = $state(1);
	let ciTemp = $state<number | null>(null);
	let ciRh = $state<number | null>(null);
	let ciEc = $state<number | null>(null);
	let ciPh = $state<number | null>(null);
	let ciWatered = $state(false);
	let ciNutrients = $state(false);
	let ciTraining = $state<string | null>(null);
	let ciNotes = $state('');
	let ciPhoto = $state<string | null>(null);

	let ciVpd = $derived(ciTemp && ciRh ? calcVPD(ciTemp, ciRh) : null);

	// Pro-Status
	let userIsPro = $derived.by(() => { let v = false; isPro.subscribe(x => v = x)(); return v; });

	// Chart-Daten (chronologisch sortiert)
	let chronCheckins = $derived(
		(state?.checkins ?? [])
			.filter((c: CheckIn) => c.grow_id === growId)
			.sort((a: CheckIn, b: CheckIn) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
	);
	let vpdData = $derived(chronCheckins.filter((c: CheckIn) => c.vpd !== null).map((c: CheckIn) => c.vpd as number));
	let tempData = $derived(chronCheckins.filter((c: CheckIn) => c.temp !== null).map((c: CheckIn) => c.temp as number));
	let rhData = $derived(chronCheckins.filter((c: CheckIn) => c.rh !== null).map((c: CheckIn) => c.rh as number));
	let ecData = $derived(chronCheckins.filter((c: CheckIn) => c.ec_measured !== null).map((c: CheckIn) => c.ec_measured as number));
	let phData = $derived(chronCheckins.filter((c: CheckIn) => c.ph_measured !== null).map((c: CheckIn) => c.ph_measured as number));

	// Harvest Flow
	let showHarvest = $state(false);
	let harvestYield = $state<number>(0);
	let scoreBreakdown = $derived.by<ScoreBreakdown | null>(() => {
		if (!grow || !showHarvest) return null;
		const sortedCheckins = (state?.checkins ?? [])
			.filter((c: CheckIn) => c.grow_id === growId)
			.sort((a: CheckIn, b: CheckIn) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
		return calculateGrowScore(grow, sortedCheckins);
	});

	function confirmHarvest() {
		if (!grow || !scoreBreakdown) return;
		growStore.harvestGrow(grow.id, harvestYield);
		growStore.updateGrow(grow.id, { grow_score: scoreBreakdown.total });
		xpStore.awardHarvest(scoreBreakdown.total);
		hapticSuccess();
		showHarvest = false;
	}

	function abandonGrow() {
		if (!grow) return;
		growStore.abandonGrow(grow.id);
		goto('/grow');
	}

	function handlePhoto(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files?.[0]) return;
		const file = input.files[0];
		const reader = new FileReader();
		reader.onload = () => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement('canvas');
				const maxSize = 800;
				let w = img.width, h = img.height;
				if (w > maxSize || h > maxSize) {
					if (w > h) { h = (h / w) * maxSize; w = maxSize; }
					else { w = (w / h) * maxSize; h = maxSize; }
				}
				canvas.width = w;
				canvas.height = h;
				canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
				ciPhoto = canvas.toDataURL('image/jpeg', 0.7);
			};
			img.src = reader.result as string;
		};
		reader.readAsDataURL(file);
	}

	function submitCheckin() {
		if (!grow) return;
		growStore.addCheckIn({
			grow_id: grow.id,
			phase: ciPhase,
			week: ciWeek,
			day: ciDay,
			photo_data: ciPhoto,
			temp: ciTemp,
			rh: ciRh,
			vpd: ciVpd ?? null,
			ec_measured: ciEc,
			ph_measured: ciPh,
			watered: ciWatered,
			nutrients_given: ciNutrients,
			training: ciTraining,
			notes: ciNotes.trim(),
		});
		const hasPhoto = !!ciPhoto;
		const isFull = !!(ciTemp && ciRh && ciEc && ciPh);
		xpStore.awardCheckIn(hasPhoto, isFull);
		hapticSuccess();
		showCheckin = false;
		ciPhoto = null;
		ciNotes = '';
		ciWatered = false;
		ciNutrients = false;
		ciTraining = null;
	}

	function daysSince(dateStr: string): number {
		return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
	}
</script>

{#if !grow}
	<div class="px-4 pt-6 max-w-lg mx-auto text-center">
		<p class="text-gb-text-muted">{tr('grow.not_found')}</p>
		<a href="/grow" class="text-gb-green text-sm">{tr('grow.back')}</a>
	</div>
{:else}
	<div class="px-4 pt-6 max-w-lg mx-auto space-y-5">
		<!-- Header -->
		<div>
			<a href="/grow" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; {tr('grow.my_grows')}</a>
			<h1 class="text-xl font-bold mt-2">{grow.name}</h1>
			<p class="text-sm text-gb-text-muted">{grow.strain} · {grow.strain_type === 'auto' ? 'Auto' : 'Photo'} · {grow.medium}</p>
		</div>

		<!-- Stats -->
		<div class="grid grid-cols-3 gap-3">
			<div class="bg-gb-surface rounded-xl p-3 text-center">
				<p class="text-2xl font-bold text-gb-green">{daysSince(grow.started_at)}</p>
				<p class="text-xs text-gb-text-muted">{tr('grow.days')}</p>
			</div>
			<div class="bg-gb-surface rounded-xl p-3 text-center">
				<p class="text-2xl font-bold">{checkins.length}</p>
				<p class="text-xs text-gb-text-muted">{tr('grow.checkins')}</p>
			</div>
			<div class="bg-gb-surface rounded-xl p-3 text-center">
				<p class="text-2xl font-bold">{grow.plant_count}</p>
				<p class="text-xs text-gb-text-muted">{tr('grow.plants')}</p>
			</div>
		</div>

		<!-- Info -->
		<div class="bg-gb-surface rounded-xl p-4 space-y-2 text-sm">
			{#if grow.space}<p><span class="text-gb-text-muted">{tr('grow.info_space')}:</span> {grow.space}</p>{/if}
			{#if grow.light_info}<p><span class="text-gb-text-muted">{tr('grow.info_light')}:</span> {grow.light_info}</p>{/if}
			{#if grow.feedline_id}<p><span class="text-gb-text-muted">{tr('grow.info_feedline')}:</span> {grow.feedline_id}</p>{/if}
			{#if grow.notes}<p><span class="text-gb-text-muted">{tr('grow.info_notes')}:</span> {grow.notes}</p>{/if}
		</div>

		<!-- Check-in Button -->
		{#if grow.status === 'active'}
			{#if !showCheckin}
				<button onclick={() => showCheckin = true}
					class="w-full bg-gb-green text-black font-semibold py-3 rounded-lg text-sm hover:bg-gb-green-light transition-colors">
					{tr('grow.daily_checkin')}
				</button>
			{:else}
				<!-- Check-in Form -->
				<div class="bg-gb-surface rounded-xl p-4 space-y-4">
					<div class="flex items-center justify-between">
						<h2 class="font-semibold">{tr('checkin.title')}</h2>
						<button onclick={() => showCheckin = false} class="text-gb-text-muted text-sm">{tr('checkin.cancel')}</button>
					</div>

					<!-- Foto -->
					<div>
						<label class="block text-xs text-gb-text-muted mb-1">{tr('checkin.photo')}</label>
						{#if ciPhoto}
							<img src={ciPhoto} alt="Check-in" class="w-full rounded-lg mb-2 max-h-48 object-cover" />
						{/if}
						<label class="block w-full bg-gb-surface-2 border border-dashed border-gb-border rounded-lg p-4 text-center text-sm text-gb-text-muted cursor-pointer hover:border-gb-green transition-colors">
							{ciPhoto ? tr('checkin.change_photo') : tr('checkin.take_photo')}
							<input type="file" accept="image/*" capture="environment" onchange={handlePhoto} class="hidden" />
						</label>
					</div>

					<!-- Phase / Week / Day -->
					<div class="grid grid-cols-3 gap-2">
						<div>
							<label class="block text-xs text-gb-text-muted mb-1">{tr('checkin.phase')}</label>
							<select bind:value={ciPhase} class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm">
								{#each ['Seedling', 'Veg', 'Bloom', 'Flush', 'Dry', 'Cure'] as p}
									<option>{p}</option>
								{/each}
							</select>
						</div>
						<div>
							<label class="block text-xs text-gb-text-muted mb-1">{tr('checkin.week')}</label>
							<input type="number" bind:value={ciWeek} min="1" max="20"
								class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm" />
						</div>
						<div>
							<label class="block text-xs text-gb-text-muted mb-1">{tr('checkin.day')}</label>
							<input type="number" bind:value={ciDay} min="1" max="7"
								class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm" />
						</div>
					</div>

					<!-- Messwerte -->
					<div class="grid grid-cols-2 gap-2">
						<div>
							<label class="block text-xs text-gb-text-muted mb-1">{tr('checkin.temp')}</label>
							<input type="number" bind:value={ciTemp} step="0.5" placeholder="25"
								class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm placeholder:text-gb-border" />
						</div>
						<div>
							<label class="block text-xs text-gb-text-muted mb-1">{tr('checkin.rh')}</label>
							<input type="number" bind:value={ciRh} step="1" placeholder="60"
								class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm placeholder:text-gb-border" />
						</div>
						<div>
							<label class="block text-xs text-gb-text-muted mb-1">{tr('checkin.ec')}</label>
							<input type="number" bind:value={ciEc} step="0.1" placeholder="1.5"
								class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm placeholder:text-gb-border" />
						</div>
						<div>
							<label class="block text-xs text-gb-text-muted mb-1">{tr('checkin.ph')}</label>
							<input type="number" bind:value={ciPh} step="0.1" placeholder="6.0"
								class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm placeholder:text-gb-border" />
						</div>
					</div>

					<!-- VPD Live -->
					{#if ciVpd !== null}
						<div class="bg-gb-bg rounded-lg p-2 text-center text-sm">
							VPD: <span class="font-bold {getVPDStatus(ciVpd, ciPhase.toLowerCase() === 'veg' ? 'vegetative' : 'early_flower') === 'optimal' ? 'text-gb-green' : 'text-gb-warning'}">{ciVpd.toFixed(2)} kPa</span>
						</div>
					{/if}

					<!-- Toggles -->
					<div class="flex gap-3">
						<label class="flex items-center gap-2 bg-gb-bg rounded-lg px-3 py-2 flex-1">
							<input type="checkbox" bind:checked={ciWatered} class="accent-gb-green" />
							<span class="text-sm">{tr('checkin.watered')}</span>
						</label>
						<label class="flex items-center gap-2 bg-gb-bg rounded-lg px-3 py-2 flex-1">
							<input type="checkbox" bind:checked={ciNutrients} class="accent-gb-green" />
							<span class="text-sm">{tr('checkin.nutrients')}</span>
						</label>
					</div>

					<!-- Training -->
					<div>
						<label class="block text-xs text-gb-text-muted mb-1">{tr('checkin.training')}</label>
						<div class="flex flex-wrap gap-2">
							{#each ['LST', 'Topping', 'FIM', 'ScrOG', 'Defoliation'] as t}
								<button onclick={() => ciTraining = ciTraining === t ? null : t}
									class="px-3 py-1.5 rounded-lg text-xs transition-colors
										{ciTraining === t ? 'bg-gb-accent text-white' : 'bg-gb-bg text-gb-text-muted'}">
									{t}
								</button>
							{/each}
						</div>
					</div>

					<!-- Notizen -->
					<div>
						<label class="block text-xs text-gb-text-muted mb-1">{tr('checkin.notes')}</label>
						<textarea bind:value={ciNotes} rows="2" placeholder={tr('checkin.notes_placeholder')}
							class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 py-2 text-sm placeholder:text-gb-border resize-none"></textarea>
					</div>

					<!-- Submit -->
					<button onclick={submitCheckin}
						class="w-full bg-gb-green text-black font-semibold py-3 rounded-lg text-sm hover:bg-gb-green-light transition-colors">
						{tr('checkin.save')}
					</button>
				</div>
			{/if}

			<!-- Harvest + Abandon Buttons -->
			{#if !showCheckin && !showHarvest}
				<div class="flex gap-3">
					<button onclick={() => showHarvest = true}
						class="flex-1 bg-gb-warning/10 border border-gb-warning/20 text-gb-warning font-semibold py-2.5 rounded-lg text-sm hover:bg-gb-warning/20 transition-colors">
						{tr('grow.harvest_btn')}
					</button>
					<button onclick={abandonGrow}
						class="bg-gb-danger/10 border border-gb-danger/20 text-gb-danger px-4 py-2.5 rounded-lg text-sm hover:bg-gb-danger/20 transition-colors">
						{tr('grow.abandon_btn')}
					</button>
				</div>
			{/if}

			<!-- Harvest Dialog -->
			{#if showHarvest && scoreBreakdown}
				<div class="bg-gb-surface rounded-xl p-5 space-y-4">
					<h2 class="font-bold text-lg text-center">{tr('harvest.title')}</h2>

					<!-- Score -->
					<div class="text-center">
						<p class="text-5xl font-bold {scoreBreakdown.total >= 80 ? 'text-gb-green' : scoreBreakdown.total >= 50 ? 'text-gb-warning' : 'text-gb-danger'}">
							{scoreBreakdown.total}
						</p>
						<p class="text-sm text-gb-text-muted">{tr('harvest.score')}</p>
					</div>

					<!-- Score Breakdown -->
					<div class="space-y-2">
						{#each [
							{ label: tr('harvest.consistency'), value: scoreBreakdown.consistency, weight: '30%' },
							{ label: tr('harvest.environment'), value: scoreBreakdown.environment, weight: '25%' },
							{ label: tr('harvest.documentation'), value: scoreBreakdown.documentation, weight: '20%' },
							{ label: tr('harvest.care'), value: scoreBreakdown.care, weight: '15%' },
							{ label: tr('harvest.training'), value: scoreBreakdown.training, weight: '10%' },
						] as cat}
							<div>
								<div class="flex justify-between text-xs mb-1">
									<span class="text-gb-text-muted">{cat.label} ({cat.weight})</span>
									<span class="font-medium">{cat.value}/100</span>
								</div>
								<div class="bg-gb-bg rounded-full h-1.5 overflow-hidden">
									<div class="h-full rounded-full transition-all duration-500
										{cat.value >= 70 ? 'bg-gb-green' : cat.value >= 40 ? 'bg-gb-warning' : 'bg-gb-danger'}"
										style="width: {cat.value}%"></div>
								</div>
							</div>
						{/each}
					</div>

					<!-- Yield Input -->
					<div>
						<label class="block text-xs text-gb-text-muted mb-1">{tr('harvest.yield')}</label>
						<input type="number" bind:value={harvestYield} min="0" step="1" placeholder="0"
							class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
					</div>

					<!-- Confirm/Cancel -->
					<div class="flex gap-3">
						<button onclick={confirmHarvest}
							class="flex-1 bg-gb-green text-black font-semibold py-3 rounded-lg text-sm hover:bg-gb-green/80 transition-colors">
							{tr('harvest.confirm')}
						</button>
						<button onclick={() => showHarvest = false}
							class="px-4 py-3 bg-gb-surface-2 text-gb-text-muted rounded-lg text-sm">
							{tr('harvest.cancel')}
						</button>
					</div>
				</div>
			{/if}
		{/if}

		<!-- Harvested Score Display -->
		{#if grow.status === 'harvested'}
			<div class="bg-gb-green/10 border border-gb-green/20 rounded-xl p-4 text-center">
				<p class="text-sm text-gb-green mb-1">{tr('harvest.success')}</p>
				<div class="flex justify-center gap-6">
					{#if grow.yield_g}
						<div>
							<p class="text-2xl font-bold">{grow.yield_g}g</p>
							<p class="text-xs text-gb-text-muted">{tr('harvest.yield_label')}</p>
						</div>
					{/if}
					{#if grow.grow_score !== null}
						<div>
							<p class="text-2xl font-bold {grow.grow_score >= 80 ? 'text-gb-green' : grow.grow_score >= 50 ? 'text-gb-warning' : 'text-gb-danger'}">{grow.grow_score}</p>
							<p class="text-xs text-gb-text-muted">{tr('harvest.score_label')}</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Charts (Pro Feature) -->
		{#if vpdData.length >= 2 || tempData.length >= 2}
			{#if userIsPro}
				<div class="space-y-2">
					<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">{tr('charts.title')}</h2>
					{#if vpdData.length >= 2}
						<MiniChart data={vpdData} color="#22c55e" label="VPD" unit=" kPa"
							targets={{ min: 0.8, max: 1.3 }} />
					{/if}
					{#if tempData.length >= 2}
						<MiniChart data={tempData} color="#f59e0b" label={tr('checkin.temp')} unit="°C"
							targets={{ min: 22, max: 28 }} />
					{/if}
					{#if rhData.length >= 2}
						<MiniChart data={rhData} color="#3b82f6" label={tr('checkin.rh')} unit="%"
							targets={{ min: 45, max: 65 }} />
					{/if}
					{#if ecData.length >= 2}
						<MiniChart data={ecData} color="#a855f7" label="EC" unit=" mS" />
					{/if}
					{#if phData.length >= 2}
						<MiniChart data={phData} color="#ef4444" label="pH" unit=""
							targets={{ min: 5.5, max: 6.5 }} />
					{/if}
				</div>
			{:else}
				<div class="bg-gb-accent/10 border border-gb-accent/20 rounded-xl p-4 text-center">
					<p class="font-semibold text-sm">{tr('charts.pro_title')}</p>
					<p class="text-xs text-gb-text-muted mt-1">{tr('charts.pro_desc')}</p>
					<a href="/pro" class="inline-block mt-3 bg-gb-accent text-white font-semibold text-xs px-4 py-2 rounded-lg">
						{tr('grow.unlock_pro')}
					</a>
				</div>
			{/if}
		{/if}

		<!-- Timeline -->
		<div class="space-y-2">
			<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">{tr('timeline.title', { count: checkins.length })}</h2>

			{#if checkins.length === 0}
				<p class="text-gb-text-muted text-sm bg-gb-surface rounded-xl p-4 text-center">
					{tr('timeline.no_entries')}
				</p>
			{:else}
				<!-- Foto Grid -->
				{#if checkins.some((c: CheckIn) => c.photo_data)}
					<div class="grid grid-cols-4 gap-1 rounded-xl overflow-hidden">
						{#each checkins.filter((c: CheckIn) => c.photo_data).slice(0, 8) as ci}
							<img src={ci.photo_data} alt="Day {ci.day}" class="aspect-square object-cover w-full" />
						{/each}
					</div>
				{/if}

				<!-- Check-in List -->
				{#each checkins as ci}
					<div class="bg-gb-surface rounded-xl p-3 space-y-2">
						<div class="flex justify-between items-start">
							<div>
								<p class="font-medium text-sm">{ci.phase} W{ci.week}T{ci.day}</p>
								<p class="text-xs text-gb-text-muted">{formatDate(ci.created_at)}</p>
							</div>
							<div class="flex gap-2 text-xs">
								{#if ci.watered}<span class="bg-gb-info/20 text-gb-info px-2 py-0.5 rounded">💧</span>{/if}
								{#if ci.nutrients_given}<span class="bg-gb-green/20 text-gb-green px-2 py-0.5 rounded">🧪</span>{/if}
								{#if ci.training}<span class="bg-gb-accent/20 text-gb-accent px-2 py-0.5 rounded">{ci.training}</span>{/if}
							</div>
						</div>
						{#if ci.temp || ci.ec_measured || ci.ph_measured}
							<div class="flex gap-3 text-xs text-gb-text-muted">
								{#if ci.temp}<span>{ci.temp}°C</span>{/if}
								{#if ci.rh}<span>{ci.rh}%</span>{/if}
								{#if ci.vpd}<span>VPD {ci.vpd.toFixed(2)}</span>{/if}
								{#if ci.ec_measured}<span>EC {ci.ec_measured}</span>{/if}
								{#if ci.ph_measured}<span>pH {ci.ph_measured}</span>{/if}
							</div>
						{/if}
						{#if ci.notes}
							<p class="text-sm text-gb-text-muted">{ci.notes}</p>
						{/if}
						{#if ci.photo_data}
							<img src={ci.photo_data} alt="Check-in" class="w-full rounded-lg max-h-64 object-cover" />
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	</div>
{/if}
