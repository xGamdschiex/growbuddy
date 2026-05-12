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
	import { phaseDaysSummary, totalGrowDays, currentPhasePosition } from '$lib/utils/phase';
	import { phaseStyle } from '$lib/utils/phase-colors';
	import { phaseTargetSegments, PHASE_TARGETS as PHASE_TARGETS_ALL } from '$lib/utils/phase-targets';
	import { predictHarvest, predictHarvestPerStrain, formatDaysUntil } from '$lib/utils/harvest-predict';
	import { summarizeStrains, totalPlantCount, getStrainEntries } from '$lib/utils/grow-strains';
	const PHASE_TARGETS_VPD = PHASE_TARGETS_ALL.vpd;
	import {
		metricStats,
		metricPerPhase,
		stressDays,
		checkinConsistency,
		type MetricStats,
		type CheckinNumKey,
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
			streakMultiplier.subscribe(v => multiplierValue = v),
		];
		return () => subs.forEach(u => u());
	});
	let checkins = $derived(
		(growState?.checkins ?? [])
			.filter((c: CheckIn) => c.grow_id === growId)
			.sort((a: CheckIn, b: CheckIn) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
	);

	// Check-in Form State
	let showCheckin = $state(false);
	let editingId: string | null = $state(null);
	let ciPhase = $state('Veg');
	let ciWeek = $state(1);
	let ciDay = $state(1);
	let ciWeekDayManual = $state(false);

	// Auto-Berechnung Phase/Woche/Tag (Lauri-Logik via Helper)
	$effect(() => {
		if (editingId || ciWeekDayManual || !grow || !showCheckin) return;
		const allCheckins = (growState?.checkins ?? []) as CheckIn[];
		const pos = currentPhasePosition(grow, allCheckins);
		ciPhase = pos.phase;
		ciWeek = pos.week;
		ciDay = pos.day;
	});
	let ciTemp: number | null = $state(null);
	let ciRh: number | null = $state(null);
	let ciEc: number | null = $state(null);
	let ciEcUnit: ECEinheit = $state(
		(typeof localStorage !== 'undefined' ? (localStorage.getItem('growbuddy_ec_unit') as ECEinheit | null) : null) ?? 'mS/cm'
	);
	$effect(() => {
		if (typeof localStorage !== 'undefined') localStorage.setItem('growbuddy_ec_unit', ciEcUnit);
	});
	let ciEcStep = $derived(ciEcUnit === 'mS/cm' ? '0.1' : '10');
	let ciEcPlaceholder = $derived(ciEcUnit === 'mS/cm' ? '1.5' : ciEcUnit === 'ppm500' ? '750' : '1050');
	let ciPh: number | null = $state(null);
	let ciWatered = $state(false);
	let ciNutrients = $state(false);
	let ciWaterMl: number | null = $state(null);
	let ciNutrientMl: number | null = $state(null);
	let ciTraining: string | null = $state(null);
	let ciNotes = $state('');
	let ciPhotos: string[] = $state([]);
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
	let userIsPro = $state(false);

	// Public-Check-in Repair (für Bestandsdaten von vor v1.3.26)
	let repairBusy = $state(false);
	async function repairPublicCheckins() {
		if (!grow || repairBusy) return;
		repairBusy = true;
		try {
			// Lokal alle Check-ins dieses Grows auf grow.is_public setzen
			const targetPublic = grow.is_public ?? false;
			const affected = (growState?.checkins ?? []).filter((c: CheckIn) =>
				c.grow_id === grow.id && c.is_public !== targetPublic
			);
			for (const c of affected) {
				growStore.updateCheckIn(c.id, { is_public: targetPublic });
			}
			// Cloud-Push wenn eingeloggt
			let authState: any = { user: null };
			authStore.subscribe(s => authState = s)();
			let snapshot: any = growState;
			growStore.subscribe(s => snapshot = s)();
			if (authState.user) {
				await syncStore.push(authState.user.id, snapshot);
			}
			toastStore.success(`${affected.length} Check-ins nachsynchronisiert`);
		} catch (e: any) {
			toastStore.warning('Fehlgeschlagen: ' + (e?.message ?? 'unbekannt'));
		} finally {
			repairBusy = false;
		}
	}

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
		const filtered = chronCheckins.filter((_: CheckIn, i: number) => true);
		// einfacherer Ansatz: für jeden Datenpunkt die Phase aus dem ursprünglichen Check-in nehmen
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
	// Phase-Sub-Aggregate (Veg/Bloom/Flush separat)
	let tempPerPhase = $derived(metricPerPhase(chronCheckins, 'temp'));
	let vpdPerPhase = $derived(metricPerPhase(chronCheckins, 'vpd'));
	let ecPerPhase = $derived(metricPerPhase(chronCheckins, 'ec_measured'));
	// Stress-Counter (VPD = wichtigste Health-Metrik) — Targets aus zentralem util
	let vpdStress = $derived(stressDays(chronCheckins, 'vpd', {
		Veg: PHASE_TARGETS_VPD.Veg,
		Bloom: PHASE_TARGETS_VPD.Bloom,
		Flush: PHASE_TARGETS_VPD.Flush,
	}));
	// Konsistenz: wie zuverlässig wurde geloggt
	let consistency = $derived(grow ? checkinConsistency(chronCheckins, grow.started_at) : null);

	// Legacy-aliases (für UI-Fragments unten beibehalten)
	let avgTemp = $derived(tempStats.avg);
	let avgRh = $derived(rhStats.avg);
	let avgVpd = $derived(vpdStats.avg);
	let avgEc = $derived(ecStats.avg);
	let avgPh = $derived(phStats.avg);
	// Phase-Tage neu (v1.3.34): Lauri-Logik via Helper.
	// Σ phaseDays = totalGrowDays = Header-Zahl (garantiert konsistent).
	let phaseDays = $derived(grow ? phaseDaysSummary(grow, chronCheckins) : []);
	let totalDays = $derived(grow ? totalGrowDays(grow, chronCheckins) : 0);
	let hasAggregates = $derived(totalWaterMl > 0 || avgTemp !== null || phaseDays.length > 0);

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

	// Modal-State: default Per-Strain-Liste, Info ist Sub-Modal
	let showHarvestPerStrain = $state(false);
	let showHarvestInfo = $state(false);
	// Health-Card sichtbar wenn ≥1 Check-in (Konsistenz-Wert macht Sinn ab Tag 1)
	let hasHealthData = $derived(chronCheckins.length > 0);

	// Health-Card Info-Modal (v1.3.57: tap → erklärt was der Wert bedeutet)
	type HealthInfoKey = 'consistency' | 'vpd' | 'lastCheckin';
	let healthInfo = $state<HealthInfoKey | null>(null);
	const HEALTH_INFO: Record<HealthInfoKey, { title: string; emoji: string; body: string }> = {
		consistency: {
			title: 'Konsistenz',
			emoji: '📅',
			body: 'Anteil der Tage seit Grow-Start mit mindestens einem Check-in.\n\n'
				+ '> 80% = top — du hast lückenlose Daten\n'
				+ '50–79% = ok, lückig\n'
				+ '< 50% = wenig Daten, schwerere Insights\n\n'
				+ 'Tipp: jeden Tag ein kurzer Check-in (auch nur Phase + Foto) hebt den Wert spürbar.',
		},
		vpd: {
			title: 'VPD optimal',
			emoji: '🌬️',
			body: 'Anteil der Check-in-Tage, an denen der gemessene VPD im phasen-spezifischen Zielbereich war.\n\n'
				+ 'Veg: 0.8–1.2 kPa\n'
				+ 'Bloom: 1.2–1.5 kPa\n'
				+ 'Flush: 1.0–1.4 kPa\n\n'
				+ '> 70% = optimales Klima\n'
				+ '40–69% = grenzwertig\n'
				+ '< 40% = Dauerstress (Klima-Setup prüfen)\n\n'
				+ 'Voraussetzung: du loggst Temp + RH im Daily-Check-in (VPD wird automatisch berechnet).',
		},
		lastCheckin: {
			title: 'Letzter Check-in',
			emoji: '⏱️',
			body: 'Tage seit deinem letzten Check-in.\n\n'
				+ '0 = heute geloggt — top\n'
				+ '1–2 Tage = ok\n'
				+ 'Mehr Tage = Reminder einschalten (Profil → Einstellungen)\n\n'
				+ 'Tägliches Loggen ist der wichtigste Faktor für aussagekräftige Insights.',
		},
	};
	function openHealthInfo(key: HealthInfoKey) { healthInfo = key; }
	function closeHealthInfo() { healthInfo = null; }

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
			const { images, errors } = await compressBatch(files, 800);
			if (images.length > 0) {
				ciPhotos = [...ciPhotos, ...images].slice(0, MAX_PHOTOS);
			}
			if (errors.length > 0) {
				toastStore.error(`${errors.length} Foto${errors.length > 1 ? 's' : ''} fehlgeschlagen: ${errors[0]}`);
				console.error('[grow/[id]] Foto-Errors:', errors);
			}
		} catch (e: any) {
			toastStore.error('Foto-Upload: ' + (e?.message ?? e?.name ?? 'unbekannter Fehler'));
			console.error('[grow/[id]] handlePhoto Exception:', e);
		} finally {
			compressing = false;
		}
	}

	function removePhoto(idx: number) {
		ciPhotos = ciPhotos.filter((_: string, i: number) => i !== idx);
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
		ciPhotos = ci.photo_urls?.length ? [...ci.photo_urls]
			: ci.photos_data?.length ? [...ci.photos_data]
			: (ci.photo_url ? [ci.photo_url] : (ci.photo_data ? [ci.photo_data] : []));
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

	let multiplierValue = $state(1);

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

		// ciPhotos kann Mix aus base64 (data:) und URLs (https://...) sein
		const newBase64 = ciPhotos.filter((p: string) => p?.startsWith('data:'));
		const existingUrls = ciPhotos.filter((p: string) => p && !p.startsWith('data:'));
		const patch = {
			phase: ciPhase,
			week: validWeek,
			day: validDay,
			photo_data: newBase64[0] ?? null,
			photos_data: newBase64,
			photo_url: existingUrls[0] ?? null,
			photo_urls: existingUrls,
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
			<div class="flex items-start justify-between gap-3 mt-2">
				<div class="min-w-0">
					<h1 class="text-xl font-bold truncate">{grow.name}</h1>
					<p class="text-sm text-gb-text-muted truncate">{summarizeStrains(grow, { maxLength: 60 })} · {grow.strain_type === 'auto' ? 'Auto' : 'Photo'} · {grow.medium}</p>
				</div>
				{#if grow.status === 'active'}
					{@const ps = phaseStyle(currentPhasePosition(grow, chronCheckins).phase)}
					<span class="shrink-0 text-xs {ps.text} {ps.bgSoft} px-2.5 py-1 rounded-full font-semibold whitespace-nowrap">
						{ps.emoji} {currentPhasePosition(grow, chronCheckins).phase}
					</span>
				{/if}
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
			<button type="button" onclick={() => showHarvestPerStrain = true}
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

		<!-- Per-Strain Predict Modal (Tap-Default) -->
		{#if showHarvestPerStrain && harvestPredict}
			<div class="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
				role="presentation" onclick={() => showHarvestPerStrain = false}>
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<div class="bg-gb-surface rounded-xl p-5 max-w-md w-full max-h-[80vh] overflow-y-auto"
					role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()}>
					<div class="flex items-start justify-between mb-3 gap-2">
						<h3 class="text-lg font-bold">🌿 Harvest-Predict</h3>
						<div class="flex items-center gap-1 shrink-0">
							<button type="button" onclick={() => { showHarvestPerStrain = false; showHarvestInfo = true; }}
								aria-label="Berechnung erklären"
								class="text-gb-text-muted hover:text-gb-text text-base leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gb-surface-2 transition-colors">
								ℹ️
							</button>
							<button type="button" onclick={() => showHarvestPerStrain = false} aria-label="Schließen"
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

					<button type="button" onclick={() => showHarvestPerStrain = false}
						class="mt-4 w-full bg-gb-green text-white font-medium py-2.5 rounded-lg hover:bg-gb-green/90 transition-colors">
						Verstanden
					</button>
				</div>
			</div>
		{/if}

		<!-- Harvest-Predict Info-Modal (Sub-Modal, geöffnet via ℹ️ aus Per-Strain) -->
		{#if showHarvestInfo && harvestPredict}
			<div class="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
				role="presentation" onclick={() => showHarvestInfo = false}>
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<div class="bg-gb-surface rounded-xl p-5 max-w-md w-full max-h-[80vh] overflow-y-auto"
					role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()}>
					<div class="flex items-start justify-between mb-3">
						<h3 class="text-lg font-bold">🌿 Wie wird die Schätzung berechnet?</h3>
						<button type="button" onclick={() => showHarvestInfo = false} aria-label="Schließen"
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
					<button type="button" onclick={() => showHarvestInfo = false}
						class="mt-4 w-full bg-gb-green text-white font-medium py-2.5 rounded-lg hover:bg-gb-green/90 transition-colors">
						Verstanden
					</button>
				</div>
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
							<p class="text-xs truncate">{grow.feedline_id}</p>
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

		<!-- Public-Toggle (Phase 2 Community) — div statt button damit inneres Repair-button valid HTML ist -->
		<div role="button" tabindex="0"
			onclick={() => {
				const newVal = !grow.is_public;
				growStore.updateGrow(grow.id, { is_public: newVal });
				// Force re-read damit UI sicher reagiert (Workaround für Reactivity-Edge-Case)
				growStore.subscribe(s => growState = s)();
				toastStore.success(newVal ? '🌍 Grow ist jetzt öffentlich' : '🔒 Grow ist jetzt privat');
			}}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					const newVal = !grow.is_public;
					growStore.updateGrow(grow.id, { is_public: newVal });
					growStore.subscribe(s => growState = s)();
					toastStore.success(newVal ? '🌍 Grow ist jetzt öffentlich' : '🔒 Grow ist jetzt privat');
				}
			}}
			class="w-full bg-gb-surface border border-gb-border rounded-xl p-3 flex items-center justify-between gap-3 text-left cursor-pointer"
			style="min-height:56px">
			<div class="min-w-0 flex-1 space-y-0.5">
				<p class="font-medium text-sm">{grow.is_public ? '🌍 Öffentlich' : '🔒 Privat'}</p>
				<p class="text-xs text-gb-text-muted leading-snug">
					{grow.is_public ? 'Im Community-Feed sichtbar' : 'Nur du siehst diesen Grow'}
				</p>
				{#if grow.is_public}
					<button type="button" onclick={(e) => { e.stopPropagation(); repairPublicCheckins(); }}
						disabled={repairBusy}
						class="text-[11px] text-gb-info hover:underline disabled:opacity-50 mt-1">
						{repairBusy ? 'Synchronisiere…' : '🔧 Alte Check-ins nachsynchronisieren'}
					</button>
				{/if}
			</div>
			<div class="relative h-6 w-11 rounded-full transition-colors" class:bg-gb-green={grow.is_public} class:bg-gb-bg={!grow.is_public}>
				<div class="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
					class:left-0.5={!grow.is_public} class:left-[22px]={grow.is_public}></div>
			</div>
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
					{#if editingId}
						{@const editingCi = (growState?.checkins ?? []).find((c: CheckIn) => c.id === editingId)}
						{#if editingCi}
							<div class="bg-gb-warning/10 border border-gb-warning/20 rounded-lg px-3 py-2 text-xs text-gb-warning flex items-center gap-2">
								<span>✏️</span>
								<span>Bearbeitest Check-in vom {formatDate(editingCi.created_at)} ({editingCi.phase} W{editingCi.week}T{editingCi.day})</span>
							</div>
						{/if}
					{/if}

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
								<button type="button" class="ci-chip" class:active={ciPhase === p} onclick={() => { ciPhase = p; ciWeekDayManual = true; }}>{p}</button>
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
								{#if ciWatered || (ciNutrients && !ciWatered)}
									<div class="ci-grid2 ci-mt10">
										{#if ciWatered}
											<label class="ci-field">
												<span class="ci-field-label">Wasser (mL)</span>
												<input class="ci-input" type="number" min="0" step="100" placeholder="1000" bind:value={ciWaterMl} />
											</label>
										{/if}
										{#if ciNutrients && !ciWatered}
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
						<label for="harvest-yield" class="block text-xs text-gb-text-muted mb-1">{tr('harvest.yield')}</label>
						<input id="harvest-yield" type="number" bind:value={harvestYield} min="0" step="1" placeholder="0"
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

		<!-- Health-Card (v1.3.57: KPIs sind Buttons → Info-Modal mit Erklärung) -->
		{#if hasHealthData && consistency}
			<div class="bg-gb-surface rounded-xl p-4 space-y-3">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Health</h2>
					<span class="text-[10px] text-gb-text-muted/70">Tippe für Info</span>
				</div>
				<div class="grid grid-cols-3 gap-2">
					<!-- Konsistenz -->
					<button type="button" onclick={() => openHealthInfo('consistency')}
						class="text-center bg-gb-bg/50 hover:bg-gb-bg rounded-lg p-2 transition-colors"
						style="min-height:64px;">
						<p class="text-2xl font-bold {consistency.percent !== null && consistency.percent >= 80 ? 'text-gb-green' : consistency.percent !== null && consistency.percent >= 50 ? 'text-gb-warning' : 'text-gb-text-muted'}">
							{consistency.percent ?? '—'}{consistency.percent !== null ? '%' : ''}
						</p>
						<p class="text-[10px] text-gb-text-muted leading-tight mt-0.5">Konsistenz<br/><span class="text-[9px]">{consistency.daysWithCheckin}/{consistency.totalDays} Tage</span></p>
					</button>
					<!-- VPD-Stress -->
					<button type="button" onclick={() => openHealthInfo('vpd')}
						class="text-center bg-gb-bg/50 hover:bg-gb-bg rounded-lg p-2 transition-colors"
						style="min-height:64px;">
						{#if vpdStress.total > 0}
							<p class="text-2xl font-bold {vpdStress.okPercent !== null && vpdStress.okPercent >= 70 ? 'text-gb-green' : vpdStress.okPercent !== null && vpdStress.okPercent >= 40 ? 'text-gb-warning' : 'text-gb-danger'}">
								{vpdStress.okPercent}%
							</p>
							<p class="text-[10px] text-gb-text-muted leading-tight mt-0.5">VPD optimal<br/><span class="text-[9px]">{vpdStress.ok}/{vpdStress.total} Tage</span></p>
						{:else}
							<p class="text-2xl font-bold text-gb-text-muted">—</p>
							<p class="text-[10px] text-gb-text-muted leading-tight mt-0.5">VPD optimal<br/><span class="text-[9px]">noch keine Daten</span></p>
						{/if}
					</button>
					<!-- Letzter Check-in -->
					<button type="button" onclick={() => openHealthInfo('lastCheckin')}
						class="text-center bg-gb-bg/50 hover:bg-gb-bg rounded-lg p-2 transition-colors"
						style="min-height:64px;">
						{#if consistency.daysSinceLastCheckin !== null}
							<p class="text-2xl font-bold {consistency.daysSinceLastCheckin === 0 ? 'text-gb-green' : consistency.daysSinceLastCheckin <= 2 ? 'text-gb-text' : 'text-gb-warning'}">
								{consistency.daysSinceLastCheckin === 0 ? 'heute' : `${consistency.daysSinceLastCheckin}d`}
							</p>
							<p class="text-[10px] text-gb-text-muted leading-tight mt-0.5">letzter<br/>Check-in</p>
						{:else}
							<p class="text-2xl font-bold text-gb-text-muted">—</p>
							<p class="text-[10px] text-gb-text-muted leading-tight mt-0.5">letzter<br/>Check-in</p>
						{/if}
					</button>
				</div>
			</div>
		{/if}

		<!-- Health-Info-Modal (v1.3.57) -->
		{#if healthInfo}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div class="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]"
				role="presentation" onclick={closeHealthInfo}>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div class="bg-gb-surface rounded-2xl p-5 max-w-sm w-full space-y-3 animate-[slideUp_0.25s_ease-out]"
					onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="text-2xl">{HEALTH_INFO[healthInfo].emoji}</span>
							<h3 class="font-bold text-base">{HEALTH_INFO[healthInfo].title}</h3>
						</div>
						<button type="button" onclick={closeHealthInfo} aria-label="Schließen"
							class="text-gb-text-muted hover:text-gb-text text-xl leading-none w-8 h-8 flex items-center justify-center">×</button>
					</div>
					<p class="text-xs text-gb-text-muted leading-relaxed whitespace-pre-line">{HEALTH_INFO[healthInfo].body}</p>
					<button type="button" onclick={closeHealthInfo}
						class="w-full bg-gb-green/15 text-gb-green font-semibold text-sm py-2.5 rounded-lg hover:bg-gb-green/25 transition-colors mt-2"
						style="min-height:44px;">
						Verstanden
					</button>
				</div>
			</div>
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
				<a href="/grow/{grow.id}/stats"
					class="block bg-gb-surface rounded-xl p-3 text-center hover:bg-gb-surface-2 transition-colors">
					<span class="text-sm">📊 Vollständige Statistik <span class="text-gb-text-muted">→</span></span>
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
							color="#22c55e" label="VPD" unit=" kPa" />
					{/if}
					{#if ecData.length >= 2}
						<MiniChart data={ecData} days={ecSeries.days} phaseMarkers={ecMarkers}
							phaseTargets={ecPhaseTargets} showMinMax
							color="#a855f7" label="EC" unit=" mS" />
					{/if}
					{#if phData.length >= 2}
						<MiniChart data={phData} days={phSeries.days} phaseMarkers={phMarkers}
							phaseTargets={phPhaseTargets} showMinMax
							color="#ef4444" label="pH" unit="" />
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
							color="#22c55e" label="VPD" unit=" kPa" />
					{:else if ecData.length >= 2}
						<MiniChart data={ecData} days={ecSeries.days} phaseMarkers={ecMarkers}
							phaseTargets={ecPhaseTargets} showMinMax
							color="#a855f7" label="EC" unit=" mS" />
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
