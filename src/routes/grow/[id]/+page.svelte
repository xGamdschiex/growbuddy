<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { growStore } from '$lib/stores/grow';
	import { authStore } from '$lib/stores/auth';
	import { syncStore } from '$lib/stores/sync';
	import { xpStore } from '$lib/stores/xp';
	import { isPro } from '$lib/stores/pro';
	import { toastStore } from '$lib/stores/toast';
	import { t } from '$lib/i18n';
	import type { CheckIn } from '$lib/stores/grow';
	import { calculateGrowScore } from '$lib/data/score';
	import { hapticSuccess, hapticMedium } from '$lib/utils/haptic';
	import type { ScoreBreakdown } from '$lib/data/score';
	import MiniChart from '$lib/components/MiniChart.svelte';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import CheckInForm from '$lib/components/CheckInForm.svelte';
	import HealthCard from '$lib/components/HealthCard.svelte';
	import HarvestPredictModal from '$lib/components/HarvestPredictModal.svelte';
	import { getFeedLine } from '$lib/calc/feedlines/registry';
	import { phaseDaysSummary, totalGrowDays, currentPhasePosition } from '$lib/utils/phase';
	import { phaseStyle } from '$lib/utils/phase-colors';
	import { phaseTargetSegments, PHASE_TARGETS as PHASE_TARGETS_ALL } from '$lib/utils/phase-targets';
	import { predictHarvest, predictHarvestPerStrain, formatDaysUntil } from '$lib/utils/harvest-predict';
	import { summarizeStrains, totalPlantCount, getStrainEntries } from '$lib/utils/grow-strains';
	import { CHART_COLORS } from '$lib/utils/chart-colors';
	const PHASE_TARGETS_VPD = PHASE_TARGETS_ALL.vpd;
	import {
		metricStats,
		stressDays,
		checkinConsistency,
		type MetricStats,
	} from '$lib/utils/grow-stats';

	import { onMount } from 'svelte';

	let tr: (key: string, params?: Record<string, string | number>) => string = $state((k: string) => k);
	let growId = $derived($page.params.id);
	let growState: any = $state({ grows: [], checkins: [] });
	let grow = $derived(growState?.grows?.find((g: any) => g.id === growId));

	onMount(() => {
		const subs = [
			t.subscribe(v => tr = v),
			growStore.subscribe(v => growState = v),
			isPro.subscribe(v => userIsPro = v),
		];
		return () => subs.forEach(u => u());
	});
	let checkins = $derived(
		(growState?.checkins ?? [])
			.filter((c: CheckIn) => c.grow_id === growId)
			.sort((a: CheckIn, b: CheckIn) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
	);

	// Check-in Form State — das Formular selbst lebt in CheckInForm.svelte
	let showCheckin = $state(false);
	let editingCi: CheckIn | null = $state(null);

	// Pro-Status
	let userIsPro = $state(false);


	// Chart-Daten (chronologisch sortiert)
	let chronCheckins = $derived(
		(growState?.checkins ?? [])
			.filter((c: CheckIn) => c.grow_id === growId)
			.sort((a: CheckIn, b: CheckIn) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
	);
	function dayOf(c: CheckIn): number {
		if (!grow) return 1;
		const start = new Date(grow.started_at).getTime();
		const t = new Date(c.created_at).getTime();
		return Math.max(1, Math.floor((t - start) / 86400000) + 1);
	}
	function seriesFrom<K extends keyof CheckIn>(key: K) {
		const filtered = chronCheckins.filter((c: CheckIn) => (c as any)[key] !== null && (c as any)[key] !== undefined);
		return {
			values: filtered.map((c: CheckIn) => (c as any)[key] as number),
			days: filtered.map(dayOf),
		};
	}
	let vpdSeries = $derived(seriesFrom('vpd'));
	let tempSeries = $derived(seriesFrom('temp'));
	let rhSeries = $derived(seriesFrom('rh'));
	let ecSeries = $derived(seriesFrom('ec_measured'));
	let phSeries = $derived(seriesFrom('ph_measured'));
	let vpdData = $derived(vpdSeries.values);
	let tempData = $derived(tempSeries.values);
	let rhData = $derived(rhSeries.values);
	let ecData = $derived(ecSeries.values);
	let phData = $derived(phSeries.values);

	// Wasser kumulativ in Liter (X = Tage, Y = gesamt L die in den Grow gingen)
	let waterSeries = $derived.by(() => {
		const filtered = chronCheckins.filter((c: CheckIn) => c.water_ml != null && c.water_ml > 0);
		let cum = 0;
		const points = filtered.map((c: CheckIn) => {
			cum += (c.water_ml as number) / 1000; // mL → L
			return { day: dayOf(c), value: Math.round(cum * 10) / 10 };
		});
		return { values: points.map((p: { day: number; value: number }) => p.value), days: points.map((p: { day: number; value: number }) => p.day) };
	});
	let nutrientSeries = $derived.by(() => {
		const filtered = chronCheckins.filter((c: CheckIn) => c.nutrient_ml != null && c.nutrient_ml > 0);
		return { values: filtered.map((c: CheckIn) => c.nutrient_ml as number), days: filtered.map(dayOf) };
	});

	// Phasen-Marker: erster Index je neuem Phase-Wert
	function markersFor(serieDays: number[]): { atIndex: number; label: string }[] {
		if (!serieDays.length) return [];
		// für jeden Datenpunkt die Phase aus dem ursprünglichen Check-in nehmen
		const all = chronCheckins;
		const out: { atIndex: number; label: string }[] = [];
		let lastPhase: string | null = null;
		// Map serie-Index → all-Index via days-Match
		serieDays.forEach((d, i) => {
			const ci = all.find((c: CheckIn) => dayOf(c) === d);
			const ph = (ci?.phase as string) || '';
			if (ph && ph !== lastPhase) {
				if (lastPhase !== null) out.push({ atIndex: i, label: ph });
				lastPhase = ph;
			}
		});
		return out;
	}
	let vpdMarkers = $derived(markersFor(vpdSeries.days));
	let tempMarkers = $derived(markersFor(tempSeries.days));
	let rhMarkers = $derived(markersFor(rhSeries.days));
	let ecMarkers = $derived(markersFor(ecSeries.days));
	let phMarkers = $derived(markersFor(phSeries.days));
	let waterMarkers = $derived(markersFor(waterSeries.days));
	let nutrientMarkers = $derived(markersFor(nutrientSeries.days));

	// Phase-Targets via zentralisiertem util (siehe lib/utils/phase-targets.ts)
	let vpdPhaseTargets = $derived(phaseTargetSegments('vpd', chronCheckins, vpdSeries.days, dayOf));
	let tempPhaseTargets = $derived(phaseTargetSegments('temp', chronCheckins, tempSeries.days, dayOf));
	let rhPhaseTargets = $derived(phaseTargetSegments('rh', chronCheckins, rhSeries.days, dayOf));
	let ecPhaseTargets = $derived(phaseTargetSegments('ec', chronCheckins, ecSeries.days, dayOf));
	let phPhaseTargets = $derived(phaseTargetSegments('ph', chronCheckins, phSeries.days, dayOf));

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

	// v1.3.54: Min/Avg/Max statt nur Avg (Reihenfolge: temp, rh, vpd, ec, ph)
	let tempStats: MetricStats = $derived(metricStats(chronCheckins.map((c: CheckIn) => c.temp)));
	let rhStats: MetricStats = $derived(metricStats(chronCheckins.map((c: CheckIn) => c.rh)));
	let vpdStats: MetricStats = $derived(metricStats(chronCheckins.map((c: CheckIn) => c.vpd)));
	let ecStats: MetricStats = $derived(metricStats(chronCheckins.map((c: CheckIn) => c.ec_measured)));
	let phStats: MetricStats = $derived(metricStats(chronCheckins.map((c: CheckIn) => c.ph_measured)));
	// Stress-Counter (VPD = wichtigste Health-Metrik) — Targets aus zentralem util
	let vpdStress = $derived(stressDays(chronCheckins, 'vpd', {
		Veg: PHASE_TARGETS_VPD.Veg,
		Bloom: PHASE_TARGETS_VPD.Bloom,
		Flush: PHASE_TARGETS_VPD.Flush,
	}));
	// Konsistenz: wie zuverlässig wurde geloggt
	let consistency = $derived(grow ? checkinConsistency(chronCheckins, grow.started_at) : null);
	// Heute schon geloggt? → Button-State im Grow-Detail
	let checkedInToday = $derived(consistency?.daysSinceLastCheckin === 0);

	// Aliases für hasAggregates-Check
	let avgTemp = $derived(tempStats.avg);
	let avgVpd = $derived(vpdStats.avg);
	let avgEc = $derived(ecStats.avg);
	// Phase-Tage neu (v1.3.34): Lauri-Logik via Helper.
	// Σ phaseDays = totalGrowDays = Header-Zahl (garantiert konsistent).
	let phaseDays = $derived(grow ? phaseDaysSummary(grow, chronCheckins) : []);
	let totalDays = $derived(grow ? totalGrowDays(grow, chronCheckins) : 0);
	let hasAggregates = $derived(
		totalWaterMl > 0 || avgTemp !== null || avgEc !== null || avgVpd !== null || phaseDays.length > 0
	);

	// Bloom-Start aus Check-ins ableiten: erster CI mit phase='Bloom' → Tag im Grow
	let bloomStartDay = $derived.by<number | null>(() => {
		const firstBloom = chronCheckins.find((c: CheckIn) => c.phase === 'Bloom');
		if (!firstBloom) return null;
		return dayOf(firstBloom);
	});

	let harvestPredictCheckins = $derived(chronCheckins.map((c: CheckIn) => ({
		phase: c.phase,
		temp: c.temp,
		rh: c.rh,
		vpd: c.vpd,
	})));

	// Harvest-Predict (Multi-Strain aware: nutzt bloomStartDay wenn in Bloom, sonst Veg-Default)
	let harvestPredict = $derived.by(() => {
		if (!grow || grow.status !== 'active') return null;
		if (!grow.strain_type) return null;
		const totalPlants = totalPlantCount(grow);
		if (totalPlants === 0) return null;
		// Gewichteter Durchschnitt der flowering_weeks falls Multi-Strain (für Total-Anzeige)
		const entries = getStrainEntries(grow);
		const totalForWeights = entries.reduce((s, e) => s + (e.plant_count || 0), 0) || 1;
		const avgFlowerWeeks = entries.length > 0
			? entries.reduce((s, e) => s + (e.flowering_weeks ?? (grow.strain_type === 'auto' ? 5 : 9)) * (e.plant_count || 0), 0) / totalForWeights
			: undefined;
		return predictHarvest({
			strainType: grow.strain_type === 'auto' ? 'auto' : 'photo',
			plantCount: totalPlants,
			currentGrowDays: totalDays,
			floweringWeeks: avgFlowerWeeks,
			bloomStartDay,
			checkins: harvestPredictCheckins,
		});
	});

	// Per-Strain-Predict (Aufschlüsselung pro Strain — eigene flowering_weeks → eigene Tage)
	let harvestPerStrain = $derived.by(() => {
		if (!grow || grow.status !== 'active' || !grow.strain_type) return [];
		const entries = getStrainEntries(grow);
		if (entries.length === 0) return [];
		return predictHarvestPerStrain(entries, {
			strainType: grow.strain_type === 'auto' ? 'auto' : 'photo',
			currentGrowDays: totalDays,
			bloomStartDay,
			checkins: harvestPredictCheckins,
		});
	});

	// Erste Ernte: Strain mit kürzester verbleibender Zeit (für Übersichts-Card)
	let nextHarvestStrain = $derived.by(() => {
		if (harvestPerStrain.length === 0) return null;
		return harvestPerStrain.reduce((min, s) =>
			s.daysUntilHarvest < min.daysUntilHarvest ? s : min
		);
	});
	let allStrainsSameTime = $derived(
		harvestPerStrain.length <= 1 ||
			harvestPerStrain.every((s) => s.daysUntilHarvest === harvestPerStrain[0].daysUntilHarvest)
	);

	// Retro-Predict für geerntete Grows: was hätte die App vorhergesagt?
	// → Predicted-vs-Actual macht die Schätzung über mehrere Harvests glaubwürdig.
	let retroPredict = $derived.by(() => {
		if (!grow || grow.status !== 'harvested' || !grow.strain_type) return null;
		const totalPlants = totalPlantCount(grow);
		if (totalPlants === 0) return null;
		return predictHarvest({
			strainType: grow.strain_type === 'auto' ? 'auto' : 'photo',
			plantCount: totalPlants,
			currentGrowDays: totalDays,
			bloomStartDay,
			checkins: harvestPredictCheckins,
		});
	});

	// Harvest-Predict-Modal (Per-Strain-Liste + Info-View leben in HarvestPredictModal.svelte)
	let showHarvestModal = $state(false);
	// Health-Card sichtbar wenn ≥1 Check-in (Konsistenz-Wert macht Sinn ab Tag 1).
	// Card + Info-Modale leben in HealthCard.svelte (geteilt mit stats-Page).
	let hasHealthData = $derived(chronCheckins.length > 0);

	// Harvest Flow
	let showHarvest = $state(false);
	let harvestYield: number = $state(0);
	let scoreBreakdown = $derived.by<ScoreBreakdown | null>(() => {
		if (!grow || !showHarvest) return null;
		const sortedCheckins = (growState?.checkins ?? [])
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

	let showAbandonConfirm = $state(false);
	function abandonGrow() {
		if (!grow) return;
		growStore.abandonGrow(grow.id);
		showAbandonConfirm = false;
		goto('/grow');
	}

	function startEdit(ci: CheckIn) {
		editingCi = ci;
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

	function openCheckin() {
		editingCi = null;
		showCheckin = true;
	}

	/** onDone + onCancel des CheckInForm: Formular schließen, Edit-State zurücksetzen. */
	function closeCheckin() {
		showCheckin = false;
		editingCi = null;
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
	}

	// Lightbox State
	let lightboxPhotos: string[] = $state([]);
	let lightboxIndex = $state(0);
	let lightboxOpen = $state(false);
	function openLightbox(photos: string[], idx: number) {
		lightboxPhotos = photos;
		lightboxIndex = idx;
		lightboxOpen = true;
	}

	// Custom Delete-Confirm-Sheet (statt nativem confirm)
	let pendingDeleteId: string | null = $state(null);
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
			<div class="flex items-center justify-between gap-3">
				<a href="/grow" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; {tr('grow.my_grows')}</a>
				<a href="/grow/{grow.id}/edit"
					class="text-gb-text-muted text-xs hover:text-gb-text flex items-center gap-1"
					aria-label="Grow bearbeiten">
					✏️ Bearbeiten
				</a>
			</div>
			<!-- v1.3.78: Phase-Chip aus dem Header entfernt — die "Aktuelle Position"-Hero-Card direkt darunter zeigt die Phase mit Emoji+Wochenzahl bereits prominent (war Duplikat). -->
			<div class="mt-2 min-w-0">
				<h1 class="text-xl font-bold truncate">{grow.name}</h1>
				<!-- v1.3.78: Multi-Strain-Liste darf 2 Zeilen wrappen + maxLength 60→140 (kein Truncate mehr in der Mitte eines Strain-Namens). -->
				<p class="text-sm text-gb-text-muted leading-snug">{summarizeStrains(grow, { maxLength: 140 })} · {grow.strain_type === 'auto' ? 'Auto' : 'Photo'} · {grow.medium}</p>
			</div>
		</div>

		<!-- Aktuelle Position (Hero-Card bei aktivem Grow) -->
		{#if grow.status === 'active'}
			{@const pos = currentPhasePosition(grow, chronCheckins)}
			{@const ps2 = phaseStyle(pos.phase)}
			<div class="bg-gradient-to-br {ps2.bgSoft} border {ps2.border} rounded-xl p-4">
				<div class="flex items-baseline gap-2">
					<span class="text-3xl font-bold {ps2.text}">W{pos.week}</span>
					<span class="text-xl font-semibold {ps2.text} opacity-70">·</span>
					<span class="text-3xl font-bold {ps2.text}">T{pos.day}</span>
					<span class="text-xs text-gb-text-muted ml-auto">{ps2.emoji} {pos.phase} · Tag {pos.daysIn}</span>
				</div>
				<p class="text-[11px] text-gb-text-muted mt-1">Heutige Position · für Calc + Check-in</p>
			</div>
		{/if}

		<!-- Harvest-Predict Card (Yield + Tage bis Harvest — erste Ernte wenn Multi-Strain) -->
		{#if harvestPredict && grow.status === 'active'}
			{@const displayDays = nextHarvestStrain?.daysUntilHarvest ?? harvestPredict.daysUntilHarvest}
			<button type="button" onclick={() => showHarvestModal = true}
				class="w-full bg-gb-surface rounded-xl p-4 border border-gb-border/30 text-left
					hover:border-gb-green/30 transition-colors">
				<div class="flex items-center justify-between gap-3">
					<div>
						<p class="text-[10px] text-gb-text-muted uppercase tracking-wide font-semibold">🌿 Harvest-Predict</p>
						<div class="flex items-baseline gap-3 mt-1">
							<span class="text-2xl font-bold text-gb-green">~{harvestPredict.yieldGrams}g</span>
							<span class="text-gb-text-muted">·</span>
							<span class="text-2xl font-bold">{formatDaysUntil(displayDays)}</span>
						</div>
						<p class="text-[10px] text-gb-text-muted mt-1">
							{harvestPredict.yieldRange.min}-{harvestPredict.yieldRange.max}g · Confidence: {harvestPredict.confidence}
							{#if harvestPredict.performanceMultiplier !== 1.0}
								· Perf {(harvestPredict.performanceMultiplier * 100).toFixed(0)}%
							{/if}
						</p>
						{#if harvestPerStrain.length > 1 && nextHarvestStrain}
							<p class="text-[10px] text-gb-text-muted mt-0.5">
								{#if allStrainsSameTime}
									{harvestPerStrain.length} Strains — tippen für Aufschlüsselung
								{:else}
									🥇 „{nextHarvestStrain.strain}" zuerst · {harvestPerStrain.length} Strains tippen
								{/if}
							</p>
						{/if}
					</div>
					<span class="text-gb-text-muted text-xl">›</span>
				</div>
			</button>
		{/if}

		<!-- Harvest-Predict-Modal (Per-Strain-Liste + Info-View) -->
		{#if showHarvestModal && harvestPredict}
			<HarvestPredictModal
				{harvestPredict}
				{harvestPerStrain}
				{nextHarvestStrain}
				{allStrainsSameTime}
				{bloomStartDay}
				{totalDays}
				{grow}
				onClose={() => showHarvestModal = false}
			/>
		{/if}

		<!-- ═══ ACTIONS — Check-in / Harvest / Abandon (v1.3.78: hochgezogen direkt nach Predict) ═══ -->
		{#if grow.status === 'active'}
			{#if !showCheckin}
				<button onclick={openCheckin}
					class="w-full font-semibold py-3 rounded-lg text-sm transition-colors
						{checkedInToday
							? 'bg-gb-surface border border-gb-green/40 text-gb-green hover:bg-gb-surface-2'
							: 'bg-gb-green text-gb-bg hover:bg-gb-green-light'}">
					{checkedInToday ? '✓ Heute erledigt · Weiterer Check-in' : tr('grow.daily_checkin')}
				</button>
			{:else}
				<CheckInForm
					{grow}
					{editingCi}
					allCheckins={growState?.checkins ?? []}
					onDone={closeCheckin}
					onCancel={closeCheckin}
				/>
			{/if}

			<!-- Harvest + Abandon Buttons -->
			{#if !showCheckin && !showHarvest}
				<div class="flex gap-3">
					<button onclick={() => showHarvest = true}
						class="flex-1 bg-gb-warning/10 border border-gb-warning/20 text-gb-warning font-semibold py-2.5 rounded-lg text-sm hover:bg-gb-warning/20 transition-colors">
						{tr('grow.harvest_btn')}
					</button>
					<button onclick={() => { showAbandonConfirm = true; hapticMedium(); }}
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
						<label for="harvest-yield" class="block text-xs text-gb-text-muted mb-1">{tr('harvest.yield')}</label>
						<input id="harvest-yield" type="number" bind:value={harvestYield} min="0" step="1" placeholder="0"
							class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
					</div>

					<!-- 50-g- & Lagerungs-Hinweis (KCanG) -->
					<div class="bg-gb-info/10 border border-gb-info/20 rounded-lg p-3">
						<p class="text-xs text-gb-text-muted leading-relaxed">
							ℹ️ Zuhause max. <strong class="text-gb-text">50 g</strong> getrocknet erlaubt — kindersicher &amp; vor Minderjährigen geschützt lagern (KCanG).
						</p>
					</div>

					<!-- Confirm/Cancel -->
					<div class="flex gap-3">
						<button onclick={confirmHarvest}
							class="flex-1 bg-gb-green text-gb-bg font-semibold py-3 rounded-lg text-sm hover:bg-gb-green/80 transition-colors">
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
				{#if retroPredict && grow.yield_g != null}
					{@const delta = grow.yield_g - retroPredict.yieldGrams}
					{@const deltaPct = retroPredict.yieldGrams > 0 ? Math.round((delta / retroPredict.yieldGrams) * 100) : 0}
					<div class="mt-3 pt-3 border-t border-gb-green/15 text-xs text-gb-text-muted">
						🔮 Predict war <span class="text-gb-text font-medium">~{retroPredict.yieldGrams}g</span>
						· Ist <span class="text-gb-text font-medium">{grow.yield_g}g</span>
						<span class="{delta >= 0 ? 'text-gb-green' : 'text-gb-warning'}">
							({delta >= 0 ? '+' : ''}{delta}g{deltaPct !== 0 ? ` · ${deltaPct >= 0 ? '+' : ''}${deltaPct}%` : ''})
						</span>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Stats -->
		<div class="grid grid-cols-3 gap-3">
			<div class="bg-gb-surface rounded-xl p-3 text-center">
				<p class="text-2xl font-bold text-gb-green">{totalDays}</p>
				<p class="text-xs text-gb-text-muted">{tr('grow.days')}</p>
				{#if phaseDays.length >= 1}
					<p class="text-[10px] text-gb-text-muted mt-0.5 leading-tight">
						{phaseDays.map(p => `${p.phase} ${p.days}`).join(' · ')}
					</p>
				{/if}
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

		<!-- Info-Grid -->
		{#if grow.space || grow.light_info || grow.feedline_id || grow.notes}
			<div class="bg-gb-surface rounded-xl p-3 grid grid-cols-2 gap-2 text-sm">
				{#if grow.space}
					<div class="flex items-start gap-2 min-w-0">
						<span class="text-base shrink-0">📐</span>
						<div class="min-w-0">
							<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">{tr('grow.info_space')}</p>
							<p class="text-xs truncate">{grow.space}</p>
						</div>
					</div>
				{/if}
				{#if grow.light_info}
					<div class="flex items-start gap-2 min-w-0">
						<span class="text-base shrink-0">💡</span>
						<div class="min-w-0">
							<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">{tr('grow.info_light')}</p>
							<p class="text-xs truncate">{grow.light_info}</p>
						</div>
					</div>
				{/if}
				{#if grow.feedline_id}
					<div class="flex items-start gap-2 min-w-0">
						<span class="text-base shrink-0">🧪</span>
						<div class="min-w-0">
							<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">{tr('grow.info_feedline')}</p>
							<p class="text-xs truncate">{getFeedLine(grow.feedline_id)?.name ?? grow.feedline_id}</p>
						</div>
					</div>
				{/if}
				{#if grow.notes}
					<div class="flex items-start gap-2 min-w-0 col-span-2">
						<span class="text-base shrink-0">📝</span>
						<div class="min-w-0">
							<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">{tr('grow.info_notes')}</p>
							<p class="text-xs">{grow.notes}</p>
						</div>
					</div>
				{/if}
			</div>
		{/if}


		<!-- Health-Card (Komponente, geteilt mit stats-Page) -->
		{#if hasHealthData}
			<HealthCard {consistency} {vpdStress} />
		{/if}

		<!-- Quick-Stats (v1.3.55: slim — nur EC, VPD, Wasser. Volle Details auf /grow/[id]/stats) -->
		{#if hasAggregates}
			<div class="space-y-2">
				<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Quick-Stats</h2>
				<div class="grid grid-cols-3 gap-2">
					{#if ecStats.avg !== null}
						<div class="bg-gb-surface rounded-xl p-3 text-center">
							<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">Ø EC</p>
							<p class="text-lg font-bold mt-0.5">{ecStats.avg.toFixed(2)}</p>
						</div>
					{/if}
					{#if vpdStats.avg !== null}
						<div class="bg-gb-surface rounded-xl p-3 text-center">
							<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">Ø VPD</p>
							<p class="text-lg font-bold text-gb-green mt-0.5">{vpdStats.avg.toFixed(2)}</p>
						</div>
					{/if}
					{#if totalWaterMl > 0}
						<div class="bg-gb-surface rounded-xl p-3 text-center">
							<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">💧 Wasser</p>
							<p class="text-lg font-bold text-gb-info mt-0.5">{(totalWaterMl / 1000).toFixed(1)} L</p>
						</div>
					{/if}
				</div>
				<!-- v1.3.78: Großer Stats-Link-Card → schlanker Text-Link (paritätisch zum „Mehr Charts"-Link im Charts-Block). -->
				<a href="/grow/{grow.id}/stats"
					class="block text-center text-xs text-gb-text-muted hover:text-gb-text py-2">
					📊 Vollständige Statistik →
				</a>
			</div>
		{/if}

		<!-- Charts auf Übersicht (v1.3.57: nur VPD/EC/pH — Temp/RH/Wasser/Dünger in /stats) -->
		{#if vpdData.length >= 2 || ecData.length >= 2 || phData.length >= 2}
			{#if userIsPro}
				<div class="space-y-2">
					<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">{tr('charts.title')}</h2>
					{#if vpdData.length >= 2}
						<MiniChart data={vpdData} days={vpdSeries.days} phaseMarkers={vpdMarkers}
							phaseTargets={vpdPhaseTargets} showMinMax
							color={CHART_COLORS.vpd} label="VPD" unit=" kPa" />
					{/if}
					{#if ecData.length >= 2}
						<MiniChart data={ecData} days={ecSeries.days} phaseMarkers={ecMarkers}
							phaseTargets={ecPhaseTargets} showMinMax
							color={CHART_COLORS.ec} label="EC" unit=" mS" />
					{/if}
					{#if phData.length >= 2}
						<MiniChart data={phData} days={phSeries.days} phaseMarkers={phMarkers}
							phaseTargets={phPhaseTargets} showMinMax
							color={CHART_COLORS.ph} label="pH" unit="" />
					{/if}
					<a href="/grow/{grow.id}/stats"
						class="block text-center text-xs text-gb-text-muted hover:text-gb-text py-2">
						Mehr Charts (Temp, RH, Wasser, Dünger) → Statistik
					</a>
				</div>
			{:else}
				<div class="space-y-2">
					<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide flex items-center gap-2">
						{tr('charts.title')}
						<span class="text-[10px] bg-gb-accent/20 text-gb-accent px-2 py-0.5 rounded-full font-normal">Free Preview</span>
					</h2>
					{#if vpdData.length >= 2}
						<MiniChart data={vpdData} days={vpdSeries.days} phaseMarkers={vpdMarkers}
							phaseTargets={vpdPhaseTargets} showMinMax
							color={CHART_COLORS.vpd} label="VPD" unit=" kPa" />
					{:else if ecData.length >= 2}
						<MiniChart data={ecData} days={ecSeries.days} phaseMarkers={ecMarkers}
							phaseTargets={ecPhaseTargets} showMinMax
							color={CHART_COLORS.ec} label="EC" unit=" mS" />
					{/if}

					<div class="bg-gradient-to-br from-gb-accent/15 to-gb-accent/5 border border-gb-accent/30 rounded-xl p-4">
						<div class="flex items-start gap-3">
							<div class="text-2xl">📊</div>
							<div class="flex-1">
								<p class="font-semibold text-sm">+ 6 weitere Charts in Pro</p>
								<p class="text-xs text-gb-text-muted mt-1 leading-relaxed">
									Temp, RH, EC, pH, Wasser & Dünger — alle mit Phasen-Targets, Tap-Tooltips und Min/Max-Markern.
								</p>
								<a href="/pro" class="inline-block mt-3 bg-gb-accent text-white font-semibold text-xs px-4 py-2 rounded-lg"
									style="min-height:36px; display:inline-flex; align-items:center;">
									{tr('grow.unlock_pro')}
								</a>
							</div>
						</div>
					</div>
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
				<!-- Foto Grid (alle Fotos aller Check-ins): erst Cloud-URLs, dann lokale Base64 -->
				{@const allPhotos = checkins.flatMap((c: CheckIn) =>
					(c.photo_urls?.length ? c.photo_urls
						: c.photos_data?.length ? c.photos_data
						: (c.photo_url ? [c.photo_url] : (c.photo_data ? [c.photo_data] : [])))
				)}
				{#if allPhotos.length > 0}
					<div class="grid grid-cols-4 gap-1 rounded-xl overflow-hidden">
						{#each allPhotos.slice(0, 8) as src, i}
							<button type="button" onclick={() => openLightbox(allPhotos, i)} class="aspect-square overflow-hidden relative">
								<img {src} alt="Foto {i + 1}" class="aspect-square object-cover w-full hover:opacity-80 transition-opacity cursor-zoom-in" />
								{#if i === 7 && allPhotos.length > 8}
									<div class="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
										<span class="text-white text-lg font-bold">+{allPhotos.length - 8}</span>
									</div>
								{/if}
							</button>
						{/each}
					</div>
				{/if}

				<!-- Check-in List -->
				{#each checkins as ci}
					{@const ciAllPhotos = ci.photo_urls?.length ? ci.photo_urls
						: ci.photos_data?.length ? ci.photos_data
						: (ci.photo_url ? [ci.photo_url] : (ci.photo_data ? [ci.photo_data] : []))}
					<div class="bg-gb-surface rounded-xl p-3 space-y-2">
						<div class="flex justify-between items-start">
							<div>
								<p class="font-medium text-sm">{ci.phase} W{ci.week}T{ci.day}</p>
								<p class="text-xs text-gb-text-muted">{formatDate(ci.created_at)}</p>
							</div>
							<div class="flex items-center gap-2 text-xs">
								{#if ci.watered}<span class="bg-gb-info/20 text-gb-info px-2 py-0.5 rounded">💧</span>{/if}
								{#if ci.nutrients_given}<span class="bg-gb-green/20 text-gb-green px-2 py-0.5 rounded">🧪</span>{/if}
								{#if ci.training}{#each ci.training.split(',') as trg}<span class="bg-gb-accent/20 text-gb-accent px-2 py-0.5 rounded">{trg.trim()}</span>{/each}{/if}
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
						{#if ci.temp != null || ci.rh != null || ci.vpd != null || ci.ec_measured != null || ci.ph_measured != null}
							<div class="flex gap-3 text-xs text-gb-text-muted">
								{#if ci.temp != null}<span>{ci.temp}°C</span>{/if}
								{#if ci.rh != null}<span>{ci.rh}%</span>{/if}
								{#if ci.vpd != null}<span>VPD {ci.vpd.toFixed(2)}</span>{/if}
								{#if ci.ec_measured != null}<span>EC {ci.ec_measured}</span>{/if}
								{#if ci.ph_measured != null}<span>pH {ci.ph_measured}</span>{/if}
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
		<div class="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
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

	{#if showAbandonConfirm}
		<div class="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
			onclick={() => showAbandonConfirm = false}
			onkeydown={(e) => { if (e.key === 'Escape') showAbandonConfirm = false; }}
			role="presentation">
			<div class="bg-gb-surface w-full max-w-sm rounded-2xl p-5 space-y-4"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
				role="dialog" aria-modal="true" tabindex="-1">
				<div>
					<p class="font-semibold text-base">Grow „{grow.name}" abbrechen?</p>
					<p class="text-sm text-gb-text-muted mt-1">
						Der Grow wird als abgebrochen markiert und verschwindet aus deinen aktiven Grows.
						Check-ins bleiben erhalten — du kannst den Status später im Bearbeiten-Menü wiederherstellen.
					</p>
				</div>
				<div class="flex gap-3 pt-1">
					<button onclick={() => showAbandonConfirm = false}
						class="flex-1 bg-gb-bg border border-gb-border text-gb-text font-medium rounded-xl"
						style="min-height:48px">
						Zurück
					</button>
					<button onclick={abandonGrow}
						class="flex-1 bg-gb-danger text-white font-medium rounded-xl"
						style="min-height:48px">
						Abbrechen
					</button>
				</div>
			</div>
		</div>
	{/if}
{/if}
