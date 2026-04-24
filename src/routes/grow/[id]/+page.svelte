<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { growStore } from '$lib/stores/grow';
	import { authStore } from '$lib/stores/auth';
	import { syncStore } from '$lib/stores/sync';
	import { xpStore } from '$lib/stores/xp';
	import { streakMultiplier } from '$lib/stores/streak';
	import { isPro } from '$lib/stores/pro';
	import { toastStore } from '$lib/stores/toast';
	import { compressBatch, MAX_PHOTOS } from '$lib/utils/photo';
	import { t } from '$lib/i18n';
	import type { CheckIn } from '$lib/stores/grow';
	import { calcVPD, getVPDStatus } from '$lib/data/science';
	import { calculateGrowScore } from '$lib/data/score';
	import { hapticSuccess, hapticMedium } from '$lib/utils/haptic';
	import type { ScoreBreakdown } from '$lib/data/score';
	import MiniChart from '$lib/components/MiniChart.svelte';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import { clampNumber, RANGES } from '$lib/utils/validation';
	import { toMsPerCm, fromMsPerCm, type ECEinheit } from '$lib/calc/units';

	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
	let growId = $derived($page.params.id);
	let state = $derived.by<any>(() => { let v: any = { grows: [], checkins: [] }; growStore.subscribe(x => v = x)(); return v; });
	let grow = $derived(state?.grows?.find((g: any) => g.id === growId));
	let checkins = $derived(
		(state?.checkins ?? [])
			.filter((c: CheckIn) => c.grow_id === growId)
			.sort((a: CheckIn, b: CheckIn) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
	);

	// Check-in Form State
	let showCheckin = $state(false);
	let editingId = $state<string | null>(null);
	let ciPhase = $state('Veg');
	let ciWeek = $state(1);
	let ciDay = $state(1);
	let ciWeekDayManual = $state(false);

	// Auto-Berechnung Woche/Tag aus Grow-Start (wenn kein Edit, kein manueller Override)
	$effect(() => {
		if (editingId || ciWeekDayManual || !grow || !showCheckin) return;
		const started = new Date(grow.started_at).getTime();
		if (Number.isNaN(started)) return;
		const daysSince = Math.max(1, Math.floor((Date.now() - started) / 86400000) + 1);
		ciWeek = Math.max(1, Math.ceil(daysSince / 7));
		ciDay = ((daysSince - 1) % 7) + 1;
	});
	let ciTemp = $state<number | null>(null);
	let ciRh = $state<number | null>(null);
	let ciEc = $state<number | null>(null);
	let ciEcUnit = $state<ECEinheit>(
		(typeof localStorage !== 'undefined' ? (localStorage.getItem('growbuddy_ec_unit') as ECEinheit | null) : null) ?? 'mS/cm'
	);
	$effect(() => {
		if (typeof localStorage !== 'undefined') localStorage.setItem('growbuddy_ec_unit', ciEcUnit);
	});
	let ciEcStep = $derived(ciEcUnit === 'mS/cm' ? '0.1' : '10');
	let ciEcPlaceholder = $derived(ciEcUnit === 'mS/cm' ? '1.5' : ciEcUnit === 'ppm500' ? '750' : '1050');
	let ciPh = $state<number | null>(null);
	let ciWatered = $state(false);
	let ciNutrients = $state(false);
	let ciWaterMl = $state<number | null>(null);
	let ciNutrientMl = $state<number | null>(null);
	let ciTraining = $state<string | null>(null);
	let ciNotes = $state('');
	let ciPhotos = $state<string[]>([]);

	let ciVpd = $derived(ciTemp !== null && ciRh !== null ? calcVPD(ciTemp, ciRh) : null);

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

	// Aggregat-Statistiken
	function avg(nums: number[]): number | null {
		if (!nums.length) return null;
		return nums.reduce((a, b) => a + b, 0) / nums.length;
	}
	function sum(nums: number[]): number {
		return nums.reduce((a, b) => a + b, 0);
	}
	let totalWaterMl = $derived(sum(chronCheckins.filter((c: CheckIn) => c.water_ml != null).map((c: CheckIn) => c.water_ml as number)));
	let totalNutrientMl = $derived(sum(chronCheckins.filter((c: CheckIn) => c.nutrient_ml != null).map((c: CheckIn) => c.nutrient_ml as number)));
	let avgTemp = $derived(avg(tempData));
	let avgRh = $derived(avg(rhData));
	let avgVpd = $derived(avg(vpdData));
	let avgEc = $derived(avg(ecData));
	let avgPh = $derived(avg(phData));
	let phaseDays = $derived.by(() => {
		const map = new Map<string, Set<string>>();
		for (const c of chronCheckins) {
			const day = c.created_at.slice(0, 10);
			if (!map.has(c.phase)) map.set(c.phase, new Set());
			map.get(c.phase)!.add(day);
		}
		return Array.from(map.entries()).map(([phase, days]) => ({ phase, days: days.size }));
	});
	let hasAggregates = $derived(totalWaterMl > 0 || totalNutrientMl > 0 || avgTemp !== null || phaseDays.length > 0);

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

	let compressing = $state(false);

	async function handlePhoto(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files?.length) return;
		const remaining = MAX_PHOTOS - ciPhotos.length;
		const all = Array.from(input.files);
		const files = all.slice(0, remaining);
		if (all.length > remaining) {
			toastStore.warning(`Max ${MAX_PHOTOS} Fotos — ${all.length - remaining} ignoriert`);
		}
		input.value = '';
		if (!files.length) return;
		compressing = true;
		try {
			const compressed = await compressBatch(files, 800);
			ciPhotos = [...ciPhotos, ...compressed].slice(0, MAX_PHOTOS);
		} catch {
			toastStore.warning('Foto konnte nicht verarbeitet werden');
		} finally {
			compressing = false;
		}
	}

	function removePhoto(idx: number) {
		ciPhotos = ciPhotos.filter((_, i) => i !== idx);
	}

	function startEdit(ci: CheckIn) {
		editingId = ci.id;
		ciWeekDayManual = true;
		ciPhase = ci.phase;
		ciWeek = ci.week;
		ciDay = ci.day;
		ciTemp = ci.temp;
		ciRh = ci.rh;
		ciEc = ci.ec_measured !== null ? +fromMsPerCm(ci.ec_measured, ciEcUnit).toFixed(ciEcUnit === 'mS/cm' ? 2 : 0) : null;
		ciPh = ci.ph_measured;
		ciWatered = ci.watered;
		ciNutrients = ci.nutrients_given;
		ciWaterMl = ci.water_ml ?? null;
		ciNutrientMl = ci.nutrient_ml ?? null;
		ciTraining = ci.training;
		ciNotes = ci.notes;
		ciPhotos = ci.photos_data?.length ? [...ci.photos_data] : (ci.photo_data ? [ci.photo_data] : []);
		showCheckin = true;
		hapticMedium();
		// Zum Formular scrollen + visuelles Feedback
		setTimeout(() => {
			const form = document.getElementById('checkin-form');
			if (form) {
				form.scrollIntoView({ behavior: 'smooth', block: 'start' });
				form.classList.add('ring-2', 'ring-gb-green');
				setTimeout(() => form.classList.remove('ring-2', 'ring-gb-green'), 1500);
			}
		}, 50);
	}

	function cancelCheckin() {
		showCheckin = false;
		editingId = null;
		ciWeekDayManual = false;
		ciPhotos = [];
		ciNotes = '';
		ciWatered = false;
		ciNutrients = false;
		ciWaterMl = null;
		ciNutrientMl = null;
		ciTraining = null;
		ciTemp = null; ciRh = null; ciEc = null; ciPh = null;
	}

	let multiplierValue = $derived.by(() => { let v = 1; streakMultiplier.subscribe(x => v = x)(); return v; });

	function submitCheckin() {
		if (!grow) return;
		const validTemp = ciTemp !== null ? clampNumber(ciTemp, RANGES.temp.min, RANGES.temp.max) : null;
		const validRh = ciRh !== null ? clampNumber(ciRh, RANGES.rh.min, RANGES.rh.max) : null;
		const ecMs = ciEc !== null ? toMsPerCm(ciEc, ciEcUnit) : null;
		const validEc = ecMs !== null ? clampNumber(ecMs, RANGES.ec.min, RANGES.ec.max) : null;
		const validPh = ciPh !== null ? clampNumber(ciPh, RANGES.ph.min, RANGES.ph.max) : null;
		const validWeek = clampNumber(ciWeek, RANGES.week.min, RANGES.week.max);
		const validDay = clampNumber(ciDay, RANGES.day.min, RANGES.day.max);
		const validVpd = validTemp !== null && validRh !== null ? calcVPD(validTemp, validRh) : null;

		const patch = {
			phase: ciPhase,
			week: validWeek,
			day: validDay,
			photo_data: ciPhotos[0] ?? null,
			photos_data: ciPhotos,
			temp: validTemp,
			rh: validRh,
			vpd: validVpd,
			ec_measured: validEc,
			ph_measured: validPh,
			watered: ciWatered,
			nutrients_given: ciNutrients,
			water_ml: ciWaterMl,
			nutrient_ml: ciNutrientMl,
			training: ciTraining,
			notes: ciNotes.trim(),
		};

		if (editingId) {
			growStore.updateCheckIn(editingId, patch);
		} else {
			growStore.addCheckIn({ grow_id: grow.id, ...patch });
			const isFull = !!(validTemp && validRh && validEc && validPh);
			xpStore.awardCheckIn(ciPhotos.length > 0, isFull, multiplierValue);
		}

		hapticSuccess();

		// Auto-Sync wenn eingeloggt
		let authState: any;
		authStore.subscribe(a => authState = a)();
		if (authState?.user) {
			let growState: any;
			growStore.subscribe(s => growState = s)();
			syncStore.push(authState.user.id, growState).catch(() => {});
		}

		cancelCheckin();
	}

	function daysSince(dateStr: string): number {
		return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
	}

	// Lightbox State
	let lightboxPhotos = $state<string[]>([]);
	let lightboxIndex = $state(0);
	let lightboxOpen = $state(false);
	function openLightbox(photos: string[], idx: number) {
		lightboxPhotos = photos;
		lightboxIndex = idx;
		lightboxOpen = true;
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
				<div id="checkin-form" class="bg-gb-surface rounded-xl p-4 space-y-4 transition-all duration-300">
					<div class="flex items-center justify-between">
						<h2 class="font-semibold">{editingId ? 'Check-in bearbeiten' : tr('checkin.title')}</h2>
						<button onclick={cancelCheckin} class="text-gb-text-muted text-sm">{tr('checkin.cancel')}</button>
					</div>

					<!-- Fotos (max 5) -->
					<div>
						<label class="block text-xs text-gb-text-muted mb-1">{tr('checkin.photo')} ({ciPhotos.length}/{MAX_PHOTOS})</label>
						{#if ciPhotos.length > 0}
							<div class="grid grid-cols-3 gap-1 mb-2">
								{#each ciPhotos as src, idx}
									<div class="relative">
										<img {src} alt="Foto {idx + 1}" class="aspect-square object-cover rounded-lg w-full" />
										<button onclick={() => removePhoto(idx)}
											class="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center leading-none">
											✕
										</button>
									</div>
								{/each}
							</div>
						{/if}
						{#if ciPhotos.length < MAX_PHOTOS}
							<label class="block w-full bg-gb-surface-2 border border-dashed border-gb-border rounded-lg p-3 text-center text-sm text-gb-text-muted cursor-pointer hover:border-gb-green transition-colors {compressing ? 'opacity-60 pointer-events-none' : ''}">
								{compressing ? '⏳ Verarbeite…' : `📸 ${ciPhotos.length === 0 ? tr('checkin.take_photo') : 'Weiteres Foto'}`}
								<input type="file" accept="image/*" multiple onchange={handlePhoto} class="hidden" disabled={compressing} />
							</label>
						{/if}
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
							<label class="block text-xs text-gb-text-muted mb-1">{tr('checkin.week')}{ciWeekDayManual ? '' : ' (auto)'}</label>
							<input type="number" bind:value={ciWeek} oninput={() => ciWeekDayManual = true} min="1" max="20"
								class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm" />
						</div>
						<div>
							<label class="block text-xs text-gb-text-muted mb-1">{tr('checkin.day')}{ciWeekDayManual ? '' : ' (auto)'}</label>
							<input type="number" bind:value={ciDay} oninput={() => ciWeekDayManual = true} min="1" max="7"
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
							<label class="block text-xs text-gb-text-muted mb-1">{tr('checkin.ec')} ({ciEcUnit})</label>
							<input type="number" bind:value={ciEc} step={ciEcStep} placeholder={ciEcPlaceholder}
								class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm placeholder:text-gb-border" />
						</div>
						<div>
							<label class="block text-xs text-gb-text-muted mb-1">{tr('checkin.ph')}</label>
							<input type="number" bind:value={ciPh} step="0.1" placeholder="6.0"
								class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm placeholder:text-gb-border" />
						</div>
					</div>

					<!-- EC-Einheit Selector -->
					<div>
						<span class="block text-xs text-gb-text-muted mb-1">EC-Einheit</span>
						<div class="grid grid-cols-3 gap-2">
							{#each [{v:'mS/cm',l:'mS/cm'},{v:'ppm500',l:'ppm (500)'},{v:'ppm700',l:'ppm (700)'}] as opt}
								<button type="button" onclick={() => {
									if (ciEc !== null) ciEc = +fromMsPerCm(toMsPerCm(ciEc, ciEcUnit), opt.v as ECEinheit).toFixed(opt.v === 'mS/cm' ? 2 : 0);
									ciEcUnit = opt.v as ECEinheit;
								}}
									class="px-2 py-1.5 rounded-lg text-xs font-medium border {ciEcUnit === opt.v ? 'bg-gb-green/20 border-gb-green text-gb-green' : 'bg-gb-bg border-gb-border text-gb-text-muted'}">{opt.l}</button>
							{/each}
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

					<!-- Mengen -->
					{#if ciWatered || ciNutrients}
						<div class="grid grid-cols-2 gap-2">
							{#if ciWatered}
								<div>
									<label class="block text-xs text-gb-text-muted mb-1">Wasser (mL)</label>
									<input type="number" bind:value={ciWaterMl} min="0" step="100" placeholder="1000"
										class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm placeholder:text-gb-border" />
								</div>
							{/if}
							{#if ciNutrients}
								<div>
									<label class="block text-xs text-gb-text-muted mb-1">Dünger (mL)</label>
									<input type="number" bind:value={ciNutrientMl} min="0" step="1" placeholder="10"
										class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm placeholder:text-gb-border" />
								</div>
							{/if}
						</div>
					{/if}

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
						{editingId ? 'Änderungen speichern' : tr('checkin.save')}
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

		<!-- Aggregat-Statistiken -->
		{#if hasAggregates}
			<div class="space-y-2">
				<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Statistik gesamt</h2>
				<div class="grid grid-cols-2 gap-2">
					{#if totalWaterMl > 0}
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-xs text-gb-text-muted">💧 Wasser total</p>
							<p class="text-xl font-bold text-gb-info">{(totalWaterMl / 1000).toFixed(1)} L</p>
						</div>
					{/if}
					{#if totalNutrientMl > 0}
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-xs text-gb-text-muted">🧪 Dünger total</p>
							<p class="text-xl font-bold text-gb-accent">{totalNutrientMl} mL</p>
						</div>
					{/if}
					{#if avgTemp !== null}
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-xs text-gb-text-muted">Ø Temp</p>
							<p class="text-xl font-bold">{avgTemp.toFixed(1)}°C</p>
						</div>
					{/if}
					{#if avgRh !== null}
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-xs text-gb-text-muted">Ø RH</p>
							<p class="text-xl font-bold">{avgRh.toFixed(0)}%</p>
						</div>
					{/if}
					{#if avgVpd !== null}
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-xs text-gb-text-muted">Ø VPD</p>
							<p class="text-xl font-bold text-gb-green">{avgVpd.toFixed(2)} kPa</p>
						</div>
					{/if}
					{#if avgEc !== null}
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-xs text-gb-text-muted">Ø EC</p>
							<p class="text-xl font-bold">{avgEc.toFixed(2)}</p>
						</div>
					{/if}
					{#if avgPh !== null}
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-xs text-gb-text-muted">Ø pH</p>
							<p class="text-xl font-bold">{avgPh.toFixed(1)}</p>
						</div>
					{/if}
				</div>
				{#if phaseDays.length > 0}
					<div class="bg-gb-surface rounded-xl p-3">
						<p class="text-xs text-gb-text-muted mb-1">Tage pro Phase</p>
						<div class="flex flex-wrap gap-2">
							{#each phaseDays as pd}
								<span class="bg-gb-bg px-2 py-1 rounded text-xs">
									<span class="text-gb-text-muted">{pd.phase}:</span> <span class="font-semibold">{pd.days}d</span>
								</span>
							{/each}
						</div>
					</div>
				{/if}
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
				<!-- Foto Grid (alle Fotos aller Check-ins) -->
				{@const allPhotos = checkins.flatMap((c: CheckIn) =>
					(c.photos_data?.length ? c.photos_data : (c.photo_data ? [c.photo_data] : []))
				)}
				{#if allPhotos.length > 0}
					<div class="grid grid-cols-4 gap-1 rounded-xl overflow-hidden">
						{#each allPhotos.slice(0, 8) as src, i}
							<button type="button" onclick={() => openLightbox(allPhotos, i)} class="aspect-square overflow-hidden">
								<img {src} alt="Foto {i + 1}" class="aspect-square object-cover w-full hover:opacity-80 transition-opacity cursor-zoom-in" />
							</button>
						{/each}
					</div>
				{/if}

				<!-- Check-in List -->
				{#each checkins as ci}
					{@const ciAllPhotos = ci.photos_data?.length ? ci.photos_data : (ci.photo_data ? [ci.photo_data] : [])}
					<div class="bg-gb-surface rounded-xl p-3 space-y-2">
						<div class="flex justify-between items-start">
							<div>
								<p class="font-medium text-sm">{ci.phase} W{ci.week}T{ci.day}</p>
								<p class="text-xs text-gb-text-muted">{formatDate(ci.created_at)}</p>
							</div>
							<div class="flex items-center gap-2 text-xs">
								{#if ci.watered}<span class="bg-gb-info/20 text-gb-info px-2 py-0.5 rounded">💧</span>{/if}
								{#if ci.nutrients_given}<span class="bg-gb-green/20 text-gb-green px-2 py-0.5 rounded">🧪</span>{/if}
								{#if ci.training}<span class="bg-gb-accent/20 text-gb-accent px-2 py-0.5 rounded">{ci.training}</span>{/if}
								{#if grow.status === 'active'}
									<button onclick={() => startEdit(ci)}
										class="text-gb-text-muted hover:text-gb-text p-1 rounded" aria-label="Bearbeiten">
										✏️
									</button>
									<button onclick={() => { if (confirm('Check-in löschen?')) growStore.deleteCheckIn(ci.id); }}
										class="text-gb-danger/60 hover:text-gb-danger p-1 rounded" aria-label="Löschen">
										🗑️
									</button>
								{/if}
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
						{#if ciAllPhotos.length === 1}
							<button type="button" onclick={() => openLightbox(ciAllPhotos, 0)} class="w-full block">
								<img src={ciAllPhotos[0]} alt="Check-in" class="w-full rounded-lg max-h-64 object-cover cursor-zoom-in hover:opacity-90 transition-opacity" />
							</button>
						{:else if ciAllPhotos.length > 1}
							<div class="grid grid-cols-3 gap-1">
								{#each ciAllPhotos as src, i}
									<button type="button" onclick={() => openLightbox(ciAllPhotos, i)} class="aspect-square">
										<img {src} alt="Foto {i + 1}" class="aspect-square object-cover rounded-lg w-full cursor-zoom-in hover:opacity-90 transition-opacity" />
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	</div>

	{#if lightboxOpen}
		<Lightbox photos={lightboxPhotos} startIndex={lightboxIndex} onClose={() => lightboxOpen = false} />
	{/if}
{/if}
