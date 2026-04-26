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
	import { getFeedLine } from '$lib/calc/feedlines/registry';

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
	let ciMore = $state(false);

	let ciVpd = $derived(ciTemp !== null && ciRh !== null ? calcVPD(ciTemp, ciRh) : null);
	let ciVpdStatusVal = $derived(ciVpd !== null ? getVPDStatus(ciVpd, ciPhase === 'Bloom' || ciPhase === 'Flush' ? 'early_flower' : 'vegetative') : 'idle');
	let ciVpdZones = $derived(
		ciPhase === 'Bloom' || ciPhase === 'Flush'
			? { opt: [1.2, 1.6], warn: [0.8, 2.0] }
			: { opt: [0.8, 1.2], warn: [0.4, 1.6] }
	);
	function ciToPct(k: number) { return Math.max(0, Math.min(100, ((k - 0) / (2.5 - 0)) * 100)); }
	let ciVpdColor = $derived(
		ciVpdStatusVal === 'optimal' ? 'var(--color-gb-green)' :
		ciVpdStatusVal === 'warn' ? 'var(--color-gb-warning)' :
		ciVpd === null ? '#666' : 'var(--color-gb-danger)'
	);
	let ciVpdLabel = $derived(
		ciVpdStatusVal === 'optimal' ? 'optimal' :
		ciVpdStatusVal === 'warn' ? 'grenzwertig' :
		ciVpd === null ? '' : 'kritisch'
	);
	let ciFeedlineLabel = $derived.by(() => {
		if (!grow?.feedline_id) return null;
		const line = getFeedLine(grow.feedline_id);
		return line ? `${line.name} · ${grow.medium}` : null;
	});

	function ciStepWeek(delta: number) {
		ciWeek = Math.max(1, Math.min(30, ciWeek + delta));
		ciWeekDayManual = true;
	}
	function ciStepDay(delta: number) {
		ciDay = Math.max(1, Math.min(7, ciDay + delta));
		ciWeekDayManual = true;
	}

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
		ciMore = true;
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
		ciMore = false;
	}

	const CI_PHASES = ['Seedling', 'Veg', 'Bloom', 'Flush', 'Dry', 'Cure'];
	const CI_TRAININGS = ['LST', 'Topping', 'FIM', 'ScrOG', 'Defoliation'];
	const CI_EC_OPTS: { v: ECEinheit; l: string }[] = [
		{ v: 'mS/cm', l: 'mS/cm' },
		{ v: 'ppm500', l: 'ppm·500' },
		{ v: 'ppm700', l: 'ppm·700' },
	];

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

	// Custom Delete-Confirm-Sheet (statt nativem confirm)
	let pendingDeleteId = $state<string | null>(null);
	function askDeleteCheckin(id: string) {
		pendingDeleteId = id;
		hapticMedium();
	}
	function confirmDeleteCheckin() {
		if (!pendingDeleteId) return;
		growStore.deleteCheckIn(pendingDeleteId);
		toastStore.success('Check-in gelöscht');
		pendingDeleteId = null;
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
				<!-- Check-in Form (Mockup-Design) -->
				<div id="checkin-form" class="ci-form">
					<div class="ci-head">
						<h2>{editingId ? 'Check-in bearbeiten' : tr('checkin.title')}</h2>
						<button type="button" onclick={cancelCheckin} class="ci-close" aria-label={tr('checkin.cancel')}>✕</button>
					</div>

					<!-- Fotos -->
					<div class="ci-card">
						<div class="ci-sec-head">
							<span class="ci-sec-title">{tr('checkin.photo')}</span>
							<span class="ci-sec-hint">{ciPhotos.length}/{MAX_PHOTOS}</span>
						</div>
						<div class="ci-photos">
							{#each ciPhotos as src, idx}
								<div class="ci-photo">
									<img {src} alt="Foto {idx + 1}" />
									<button type="button" class="ci-rm" onclick={() => removePhoto(idx)} aria-label="Entfernen">✕</button>
								</div>
							{/each}
							{#if ciPhotos.length < MAX_PHOTOS}
								<label class="ci-photo ci-add" class:busy={compressing}>
									{#if compressing}
										<span>⏳</span><span>Lade…</span>
									{:else}
										<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 8l2-3h4l1-2h4l1 2h4l2 3v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="13" r="4" stroke="currentColor" stroke-width="1.5"/></svg>
										<span>{ciPhotos.length === 0 ? 'Foto' : '+'}</span>
									{/if}
									<input type="file" accept="image/*" multiple onchange={handlePhoto} disabled={compressing} />
								</label>
							{/if}
						</div>
					</div>

					<!-- Phase & Zeit -->
					<div class="ci-card">
						<div class="ci-sec-head"><span class="ci-sec-title">Phase &amp; Zeit</span></div>
						<div class="ci-chip-row">
							{#each CI_PHASES as p}
								<button type="button" class="ci-chip" class:active={ciPhase === p} onclick={() => ciPhase = p}>{p}</button>
							{/each}
						</div>
						<div class="ci-grid2 ci-mt10">
							<div class="ci-stepper">
								<button type="button" onclick={() => ciStepWeek(-1)} aria-label="Woche minus">−</button>
								<div class="val">{ciWeek}<small>Woche{ciWeekDayManual ? '' : ' · auto'}</small></div>
								<button type="button" onclick={() => ciStepWeek(1)} aria-label="Woche plus">+</button>
							</div>
							<div class="ci-stepper">
								<button type="button" onclick={() => ciStepDay(-1)} aria-label="Tag minus">−</button>
								<div class="val">{ciDay}<small>Tag{ciWeekDayManual ? '' : ' · auto'}</small></div>
								<button type="button" onclick={() => ciStepDay(1)} aria-label="Tag plus">+</button>
							</div>
						</div>
					</div>

					<!-- Klima -->
					<div class="ci-card">
						<div class="ci-sec-head">
							<span class="ci-sec-title">Klima</span>
							<span class="ci-sec-hint">Temp · RH → VPD</span>
						</div>
						<div class="ci-grid2 ci-mb10">
							<label class="ci-field">
								<span class="ci-field-label">{tr('checkin.temp')}</span>
								<input class="ci-input" type="number" step="0.5" min="0" max="50" placeholder="25" bind:value={ciTemp} />
							</label>
							<label class="ci-field">
								<span class="ci-field-label">{tr('checkin.rh')}</span>
								<input class="ci-input" type="number" step="1" min="0" max="100" placeholder="60" bind:value={ciRh} />
							</label>
						</div>
						<div class="ci-card2 ci-vpd">
							<div class="ci-row ci-between ci-vpd-head">
								<span class="ci-vpd-label">VPD · {ciPhase === 'Bloom' || ciPhase === 'Flush' ? 'Bloom' : 'Veg'}</span>
								<span class="ci-vpd-val" style="color: {ciVpdColor}">
									{ciVpd === null ? '— kPa' : `${ciVpd.toFixed(2)} kPa`}
									{#if ciVpdLabel}<em class="ci-vpd-state">· {ciVpdLabel}</em>{/if}
								</span>
							</div>
							<div class="ci-gauge">
								<div class="ci-gauge-crit"></div>
								<div class="ci-gauge-warn" style="left: {ciToPct(ciVpdZones.warn[0])}%; width: {ciToPct(ciVpdZones.warn[1]) - ciToPct(ciVpdZones.warn[0])}%;"></div>
								<div class="ci-gauge-opt" style="left: {ciToPct(ciVpdZones.opt[0])}%; width: {ciToPct(ciVpdZones.opt[1]) - ciToPct(ciVpdZones.opt[0])}%;"></div>
								{#if ciVpd !== null}
									<div class="ci-gauge-cursor" style="left: calc({ciToPct(ciVpd)}% - 1.5px); background: {ciVpdColor}"></div>
								{/if}
							</div>
							<div class="ci-scale">
								<span>0.0</span><span>0.5</span><span>1.0</span><span>1.5</span><span>2.0</span><span>2.5</span>
							</div>
						</div>
					</div>

					<!-- Disclosure -->
					<button type="button" class="ci-disc" onclick={() => ciMore = !ciMore}>
						<div class="ci-disc-l">
							<div class="ci-disc-ico">{ciMore ? '−' : '+'}</div>
							<div>
								<div class="ci-disc-title">Mehr erfassen</div>
								<div class="ci-disc-sub">EC · pH · Gießen · Training · Notizen</div>
							</div>
						</div>
						<div class="ci-chev">{ciMore ? '▾' : '▸'}</div>
					</button>

					<div class="ci-fold" style="max-height: {ciMore ? '2000px' : '0'}; opacity: {ciMore ? 1 : 0};">
						<div class="ci-fold-inner">
							<!-- EC + pH -->
							<div class="ci-card">
								<div class="ci-sec-head">
									<span class="ci-sec-title">Messwerte</span>
									<div class="ci-seg">
										{#each CI_EC_OPTS as opt}
											<button type="button" class:on={ciEcUnit === opt.v} onclick={() => {
												if (ciEc !== null) ciEc = +fromMsPerCm(toMsPerCm(ciEc, ciEcUnit), opt.v).toFixed(opt.v === 'mS/cm' ? 2 : 0);
												ciEcUnit = opt.v;
											}}>{opt.l}</button>
										{/each}
									</div>
								</div>
								<div class="ci-grid2">
									<label class="ci-field">
										<span class="ci-field-label">EC</span>
										<input class="ci-input" type="number" step={ciEcStep} min="0" placeholder={ciEcPlaceholder} bind:value={ciEc} />
									</label>
									<label class="ci-field">
										<span class="ci-field-label">pH</span>
										<input class="ci-input" type="number" step="0.1" min="0" max="14" placeholder="6.0" bind:value={ciPh} />
									</label>
								</div>
							</div>

							<!-- Gießen & Düngen -->
							<div class="ci-card">
								<div class="ci-sec-head"><span class="ci-sec-title">Gießen &amp; Düngen</span></div>
								<div class="ci-toggle-row">
									<button type="button" class="ci-toggle-card" class:on={ciWatered} onclick={() => ciWatered = !ciWatered}>
										<span>💧 {tr('checkin.watered')}</span>
										<div class="ci-sw" class:on={ciWatered}></div>
									</button>
									<button type="button" class="ci-toggle-card" class:on={ciNutrients} onclick={() => ciNutrients = !ciNutrients}>
										<span>🧪 {tr('checkin.nutrients')}</span>
										<div class="ci-sw" class:on={ciNutrients}></div>
									</button>
								</div>
								{#if ciNutrients && ciFeedlineLabel}
									<div class="ci-fp">
										<div class="ci-fp-l">
											<div class="ci-fi">
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 2v6a6 6 0 1 0 12 0V2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 8h12" stroke="currentColor" stroke-width="2"/></svg>
											</div>
											<div class="ci-fp-t">
												<div class="ci-fp-cap">Düngerlinie</div>
												<div class="ci-fp-name">{ciFeedlineLabel}</div>
											</div>
										</div>
										<a href="/calc" class="ci-fp-link">zu Calc →</a>
									</div>
								{/if}
								{#if ciWatered || ciNutrients}
									<div class="ci-grid2 ci-mt10">
										{#if ciWatered}
											<label class="ci-field">
												<span class="ci-field-label">Wasser (mL)</span>
												<input class="ci-input" type="number" min="0" step="100" placeholder="1000" bind:value={ciWaterMl} />
											</label>
										{/if}
										{#if ciNutrients}
											<label class="ci-field">
												<span class="ci-field-label">Dünger (mL)</span>
												<input class="ci-input" type="number" min="0" step="1" placeholder="10" bind:value={ciNutrientMl} />
											</label>
										{/if}
									</div>
								{/if}
							</div>

							<!-- Training -->
							<div class="ci-card">
								<div class="ci-sec-head"><span class="ci-sec-title">{tr('checkin.training')}</span></div>
								<div class="ci-chip-row ci-wrap">
									{#each CI_TRAININGS as t}
										<button type="button" class="ci-chip ci-accent" class:active={ciTraining === t} onclick={() => ciTraining = ciTraining === t ? null : t}>{t}</button>
									{/each}
								</div>
							</div>

							<!-- Notizen -->
							<div class="ci-card">
								<div class="ci-sec-head"><span class="ci-sec-title">{tr('checkin.notes')}</span></div>
								<textarea class="ci-input ci-notes" rows="3" placeholder={tr('checkin.notes_placeholder')} bind:value={ciNotes}></textarea>
							</div>
						</div>
					</div>

					<!-- Submit -->
					<button type="button" class="ci-cta" onclick={submitCheckin}>
						✓ {editingId ? 'Änderungen speichern' : tr('checkin.save')}{#if !editingId && multiplierValue > 1} · +{Math.round(10 * multiplierValue)} XP{/if}
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
										class="text-gb-text-muted hover:text-gb-text rounded-lg flex items-center justify-center"
										style="min-width:44px;min-height:44px"
										aria-label="Bearbeiten">
										✏️
									</button>
									<button onclick={() => askDeleteCheckin(ci.id)}
										class="text-gb-danger/70 hover:text-gb-danger rounded-lg flex items-center justify-center"
										style="min-width:44px;min-height:44px"
										aria-label="Löschen">
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

	{#if pendingDeleteId}
		<div class="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4"
			onclick={() => pendingDeleteId = null}
			onkeydown={(e) => { if (e.key === 'Escape') pendingDeleteId = null; }}
			role="presentation">
			<div class="bg-gb-surface w-full max-w-sm rounded-2xl p-5 space-y-4"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
				role="dialog" aria-modal="true" tabindex="-1">
				<div>
					<p class="font-semibold text-base">Check-in löschen?</p>
					<p class="text-sm text-gb-text-muted mt-1">Dieser Eintrag wird endgültig entfernt — kann nicht rückgängig gemacht werden.</p>
				</div>
				<div class="flex gap-3 pt-1">
					<button onclick={() => pendingDeleteId = null}
						class="flex-1 bg-gb-bg border border-gb-border text-gb-text font-medium rounded-xl"
						style="min-height:48px">
						Abbrechen
					</button>
					<button onclick={confirmDeleteCheckin}
						class="flex-1 bg-gb-danger text-white font-medium rounded-xl"
						style="min-height:48px">
						Löschen
					</button>
				</div>
			</div>
		</div>
	{/if}
{/if}

<style>
	.ci-form {
		display: flex;
		flex-direction: column;
		gap: 12px;
		color: var(--color-gb-text);
	}
	.ci-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 2px;
	}
	.ci-head h2 {
		margin: 0;
		font-size: 20px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.ci-close {
		background: none; border: none; color: var(--color-gb-text-muted);
		font-size: 18px; cursor: pointer; padding: 4px 8px; min-height: 36px; min-width: 36px;
	}
	.ci-card {
		background: var(--color-gb-surface);
		border-radius: 16px;
		padding: 14px;
	}
	.ci-card2 {
		background: var(--color-gb-surface-2);
		border-radius: 12px;
		padding: 12px;
	}
	.ci-row { display: flex; gap: 8px; align-items: center; }
	.ci-between { justify-content: space-between; }
	.ci-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
	.ci-mt10 { margin-top: 10px; }
	.ci-mb10 { margin-bottom: 10px; }

	.ci-sec-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 10px;
		gap: 8px;
	}
	.ci-sec-title {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-gb-text-muted);
	}
	.ci-sec-hint { font-size: 11px; color: #666; }

	.ci-chip {
		min-height: 36px;
		padding: 8px 12px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 500;
		border: 1px solid var(--color-gb-border);
		background: var(--color-gb-bg);
		color: var(--color-gb-text-muted);
		display: inline-flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}
	.ci-chip.active {
		background: rgba(34,197,94,0.14);
		border-color: var(--color-gb-green);
		color: var(--color-gb-green);
	}
	.ci-chip.ci-accent.active {
		background: rgba(168,85,247,0.16);
		border-color: var(--color-gb-accent);
		color: #d8b4fe;
	}
	.ci-chip-row {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		padding-bottom: 2px;
	}
	.ci-chip-row.ci-wrap { flex-wrap: wrap; overflow: visible; }
	.ci-chip-row::-webkit-scrollbar { display: none; }

	.ci-field { display: flex; flex-direction: column; gap: 4px; }
	.ci-field-label { font-size: 11px; color: var(--color-gb-text-muted); }
	.ci-input {
		width: 100%;
		background: var(--color-gb-bg);
		color: var(--color-gb-text);
		border: 1px solid var(--color-gb-border);
		border-radius: 10px;
		padding: 10px 12px;
		font-size: 14px;
		min-height: 44px;
		transition: border-color 0.15s ease;
		font-family: inherit;
	}
	.ci-input:focus { border-color: var(--color-gb-green); outline: none; }
	.ci-input::placeholder { color: #555; }
	.ci-input.ci-notes { resize: none; min-height: 80px; }

	.ci-stepper {
		display: grid;
		grid-template-columns: 44px 1fr 44px;
		align-items: center;
		background: var(--color-gb-bg);
		border: 1px solid var(--color-gb-border);
		border-radius: 12px;
		overflow: hidden;
		min-height: 44px;
	}
	.ci-stepper button {
		background: none; border: none;
		min-height: 44px;
		color: var(--color-gb-text-muted);
		font-size: 20px; font-weight: 300;
		cursor: pointer;
	}
	.ci-stepper .val {
		text-align: center;
		font-size: 15px; font-weight: 600;
		color: var(--color-gb-text);
	}
	.ci-stepper .val small {
		display: block;
		color: var(--color-gb-text-muted);
		font-size: 10px; font-weight: 500;
		margin-top: 1px;
	}

	.ci-photos {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 6px;
	}
	.ci-photo {
		aspect-ratio: 1;
		background: var(--color-gb-surface-2);
		border-radius: 10px;
		position: relative;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.ci-photo img { width: 100%; height: 100%; object-fit: cover; }
	.ci-rm {
		position: absolute;
		top: 4px; right: 4px;
		width: 22px; height: 22px;
		border-radius: 999px;
		background: rgba(0,0,0,0.65);
		color: white; font-size: 11px;
		display: flex; align-items: center; justify-content: center;
		border: none; cursor: pointer;
	}
	.ci-add {
		border: 1.5px dashed var(--color-gb-border);
		background: transparent;
		color: var(--color-gb-text-muted);
		font-size: 10px; font-weight: 500;
		gap: 4px; flex-direction: column;
		min-height: 44px; cursor: pointer;
	}
	.ci-add:hover { border-color: var(--color-gb-green); color: var(--color-gb-green); }
	.ci-add.busy { opacity: 0.6; pointer-events: none; }
	.ci-add input { display: none; }

	.ci-vpd { padding: 12px 14px; }
	.ci-vpd-head { margin-bottom: 8px; }
	.ci-vpd-label {
		font-size: 11px;
		color: var(--color-gb-text-muted);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.ci-vpd-val { font-size: 14px; font-weight: 700; }
	.ci-vpd-state {
		font-size: 10px; font-weight: 500;
		color: var(--color-gb-text-muted);
		margin-left: 6px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-style: normal;
	}
	.ci-gauge {
		height: 6px;
		background: var(--color-gb-surface);
		border-radius: 999px;
		overflow: visible;
		position: relative;
	}
	.ci-gauge-crit, .ci-gauge-warn, .ci-gauge-opt {
		position: absolute;
		top: 0; bottom: 0;
		border-radius: 999px;
	}
	.ci-gauge-crit { inset: 0; background: var(--color-gb-danger); opacity: 0.35; }
	.ci-gauge-warn { background: var(--color-gb-warning); opacity: 0.55; }
	.ci-gauge-opt { background: var(--color-gb-green); opacity: 0.85; }
	.ci-gauge-cursor {
		position: absolute;
		top: -3px;
		width: 3px; height: 12px;
		border-radius: 2px;
	}
	.ci-scale {
		display: flex;
		justify-content: space-between;
		margin-top: 6px;
		font-size: 10px;
		color: #666;
	}

	.ci-disc {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px;
		background: var(--color-gb-surface);
		border: none;
		border-radius: 14px;
		min-height: 56px;
		width: 100%;
		color: var(--color-gb-text);
		cursor: pointer;
		text-align: left;
	}
	.ci-disc-l { display: flex; align-items: center; gap: 12px; }
	.ci-disc-ico {
		width: 36px; height: 36px;
		border-radius: 10px;
		background: var(--color-gb-surface-2);
		display: flex; align-items: center; justify-content: center;
		color: var(--color-gb-text-muted);
		font-size: 18px;
	}
	.ci-disc-title { font-size: 14px; font-weight: 500; }
	.ci-disc-sub { font-size: 11px; color: var(--color-gb-text-muted); margin-top: 1px; }
	.ci-chev { color: #555; font-size: 18px; }

	.ci-fold {
		overflow: hidden;
		transition: max-height 0.25s ease, opacity 0.2s ease;
	}
	.ci-fold-inner {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-top: 12px;
	}

	.ci-seg {
		display: inline-flex;
		background: var(--color-gb-bg);
		border: 1px solid var(--color-gb-border);
		border-radius: 12px;
		padding: 3px;
		gap: 2px;
	}
	.ci-seg button {
		padding: 8px 12px;
		font-size: 12px; font-weight: 500;
		color: var(--color-gb-text-muted);
		background: none; border: none;
		border-radius: 9px;
		min-height: 36px; min-width: 44px;
		cursor: pointer;
		font-family: inherit;
	}
	.ci-seg button.on {
		background: var(--color-gb-surface-2);
		color: var(--color-gb-text);
		box-shadow: 0 1px 0 rgba(255,255,255,0.04);
	}

	.ci-toggle-row { display: flex; gap: 8px; }
	.ci-toggle-card {
		flex: 1;
		padding: 12px;
		background: var(--color-gb-surface-2);
		border: 1px solid transparent;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		color: var(--color-gb-text);
		font-size: 13px; font-weight: 500;
		cursor: pointer;
		font-family: inherit;
	}
	.ci-toggle-card.on { border-color: var(--color-gb-green); }

	.ci-sw {
		width: 40px; height: 24px;
		border-radius: 999px;
		background: var(--color-gb-surface-2);
		position: relative;
		border: 1px solid var(--color-gb-border);
		flex-shrink: 0;
		transition: background 0.15s ease;
	}
	.ci-sw::after {
		content: '';
		position: absolute;
		top: 2px; left: 2px;
		width: 18px; height: 18px;
		border-radius: 999px;
		background: #666;
		transition: all 0.15s ease;
	}
	.ci-sw.on { background: rgba(34,197,94,0.25); border-color: var(--color-gb-green); }
	.ci-sw.on::after { left: 18px; background: var(--color-gb-green); }

	.ci-fp {
		padding: 8px 10px;
		background: rgba(168,85,247,0.08);
		border: 1px solid rgba(168,85,247,0.25);
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-top: 10px;
	}
	.ci-fp-l { display: flex; align-items: center; gap: 8px; min-width: 0; }
	.ci-fi {
		width: 28px; height: 28px;
		border-radius: 8px;
		background: rgba(168,85,247,0.18);
		display: flex; align-items: center; justify-content: center;
		color: #d8b4fe;
		flex-shrink: 0;
	}
	.ci-fp-t { min-width: 0; }
	.ci-fp-cap {
		font-size: 10px;
		color: var(--color-gb-text-muted);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.ci-fp-name {
		font-size: 13px; font-weight: 600;
		color: #e9d5ff;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.ci-fp-link {
		font-size: 11px;
		color: #d8b4fe;
		text-decoration: none;
		padding: 6px 8px;
		white-space: nowrap;
	}

	.ci-cta {
		width: 100%;
		min-height: 52px;
		background: var(--color-gb-green);
		color: #000;
		font-weight: 700;
		font-size: 15px;
		border: none;
		border-radius: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		cursor: pointer;
		box-shadow: 0 10px 30px -10px rgba(34,197,94,0.55);
		font-family: inherit;
	}
	.ci-cta:active { transform: scale(0.98); }
</style>
