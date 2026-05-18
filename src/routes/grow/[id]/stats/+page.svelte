<script lang="ts">
	/**
	 * Grow-Stats-Sub-Page: vollstaendige Detail-Statistiken pro Grow.
	 * Aufgerufen von grow/[id] via "Vollstaendige Statistik" Link.
	 *
	 * Reuse: src/lib/utils/grow-stats.ts (pure functions, getestet).
	 */
	import { page } from '$app/stores';
	import { growStore } from '$lib/stores/grow';
	import { isPro } from '$lib/stores/pro';
	import type { CheckIn } from '$lib/stores/grow';
	import { phaseDaysSummary, phaseBoundaries, totalGrowDays } from '$lib/utils/phase';
	import {
		metricStats,
		metricPerPhase,
		stressDays,
		checkinConsistency,
		type MetricStats,
	} from '$lib/utils/grow-stats';
	import MiniChart from '$lib/components/MiniChart.svelte';
	import MultiSeriesChart, { type ChartSeries } from '$lib/components/MultiSeriesChart.svelte';
	import HealthCard from '$lib/components/HealthCard.svelte';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import { phaseTargetSegments, targetFor } from '$lib/utils/phase-targets';
	import { CHART_COLORS } from '$lib/utils/chart-colors';
	import { calcNutrientUsage, productSeries, productSeriesCumulative, calcUsageForecast, type ProductUsage } from '$lib/utils/nutrient-usage';
	import { currentPhasePosition } from '$lib/utils/phase';
	import { onMount } from 'svelte';

	let growId = $derived($page.params.id);
	let growState = $state<any>({ grows: [], checkins: [] });
	let grow = $derived(growState?.grows?.find((g: any) => g.id === growId));
	let userIsPro = $state(false);

	onMount(() => {
		const subs = [
			growStore.subscribe(v => growState = v),
			isPro.subscribe(v => userIsPro = v),
		];
		return () => subs.forEach(u => u());
	});

	// Chrono-sortierte Check-ins dieses Grows
	let chronCheckins = $derived(
		(growState?.checkins ?? [])
			.filter((c: CheckIn) => c.grow_id === growId)
			.sort((a: CheckIn, b: CheckIn) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
	);

	// Phase-Targets fuer VPD-Stress-Berechnung (gleich wie auf grow/[id])
	const VPD_TARGETS = {
		Veg: { min: 0.8, max: 1.2 },
		Bloom: { min: 1.2, max: 1.5 },
		Flush: { min: 1.0, max: 1.4 },
	} as const;

	let tempStats: MetricStats = $derived(metricStats(chronCheckins.map((c: CheckIn) => c.temp)));
	let rhStats: MetricStats = $derived(metricStats(chronCheckins.map((c: CheckIn) => c.rh)));
	let vpdStats: MetricStats = $derived(metricStats(chronCheckins.map((c: CheckIn) => c.vpd)));
	let ecStats: MetricStats = $derived(metricStats(chronCheckins.map((c: CheckIn) => c.ec_measured)));
	let phStats: MetricStats = $derived(metricStats(chronCheckins.map((c: CheckIn) => c.ph_measured)));
	let tempPerPhase = $derived(metricPerPhase(chronCheckins, 'temp'));
	let rhPerPhase = $derived(metricPerPhase(chronCheckins, 'rh'));
	let vpdPerPhase = $derived(metricPerPhase(chronCheckins, 'vpd'));
	let ecPerPhase = $derived(metricPerPhase(chronCheckins, 'ec_measured'));
	let phPerPhase = $derived(metricPerPhase(chronCheckins, 'ph_measured'));

	let vpdStress = $derived(stressDays(chronCheckins, 'vpd', VPD_TARGETS));
	let consistency = $derived(grow ? checkinConsistency(chronCheckins, grow.started_at) : null);

	let totalWaterMl = $derived(
		chronCheckins.filter((c: CheckIn) => c.water_ml != null).reduce((s: number, c: CheckIn) => s + (c.water_ml as number), 0)
	);
	let totalNutrientMl = $derived(
		chronCheckins.filter((c: CheckIn) => c.nutrient_ml != null).reduce((s: number, c: CheckIn) => s + (c.nutrient_ml as number), 0)
	);
	let nutrientCheckins = $derived(
		chronCheckins.filter((c: CheckIn) => c.nutrient_ml != null && (c.nutrient_ml as number) > 0).length
	);

	let phaseDays = $derived(grow ? phaseDaysSummary(grow, chronCheckins) : []);

	// Chart-Series (Temp/RH/Wasser/Dünger) — auf Stats-Page (Übersicht hat VPD/EC/pH)
	function dayOf(c: CheckIn): number {
		if (!grow) return 1;
		// Math.max(1,…): Check-in vor started_at (z.B. nach Startdatum-Edit) darf X-Achse nicht brechen
		return Math.max(1, Math.floor((new Date(c.created_at).getTime() - new Date(grow.started_at).getTime()) / 86400000) + 1);
	}
	function seriesFrom(key: 'temp' | 'rh' | 'vpd' | 'ec_measured' | 'ph_measured') {
		const filtered = chronCheckins.filter((c: CheckIn) => (c as any)[key] != null);
		return {
			values: filtered.map((c: CheckIn) => (c as any)[key] as number),
			days: filtered.map(dayOf),
		};
	}
	let tempSeries = $derived(seriesFrom('temp'));
	let rhSeries = $derived(seriesFrom('rh'));
	let vpdSeries = $derived(seriesFrom('vpd'));
	let ecSeries = $derived(seriesFrom('ec_measured'));
	let phSeries = $derived(seriesFrom('ph_measured'));
	let waterSeries = $derived.by(() => {
		const filtered = chronCheckins.filter((c: CheckIn) => c.water_ml != null && (c.water_ml as number) > 0);
		let cum = 0;
		const points = filtered.map((c: CheckIn) => {
			cum += (c.water_ml as number) / 1000;
			return { day: dayOf(c), value: Math.round(cum * 10) / 10 };
		});
		return { values: points.map((p: { day: number; value: number }) => p.value), days: points.map((p: { day: number; value: number }) => p.day) };
	});
	let nutrientSeries = $derived.by(() => {
		const filtered = chronCheckins.filter((c: CheckIn) => c.nutrient_ml != null && (c.nutrient_ml as number) > 0);
		return { values: filtered.map((c: CheckIn) => c.nutrient_ml as number), days: filtered.map(dayOf) };
	});

	// Phase-Marker für Charts (gleicher Algorithmus wie auf Übersicht)
	function markersFor(serieDays: number[]): { atIndex: number; label: string }[] {
		if (!serieDays.length) return [];
		const out: { atIndex: number; label: string }[] = [];
		let lastPhase: string | null = null;
		serieDays.forEach((d: number, i: number) => {
			const ci = chronCheckins.find((c: CheckIn) => dayOf(c) === d);
			const ph = (ci?.phase as string) || '';
			if (ph && ph !== lastPhase) {
				if (lastPhase !== null) out.push({ atIndex: i, label: ph });
				lastPhase = ph;
			}
		});
		return out;
	}
	let tempMarkers = $derived(markersFor(tempSeries.days));
	let rhMarkers = $derived(markersFor(rhSeries.days));
	let waterMarkers = $derived(markersFor(waterSeries.days));
	let nutrientMarkers = $derived(markersFor(nutrientSeries.days));

	// Phase-Targets via zentralisiertem util (siehe lib/utils/phase-targets.ts)
	let tempPhaseTargets = $derived(phaseTargetSegments('temp', chronCheckins, tempSeries.days, dayOf));
	let rhPhaseTargets = $derived(phaseTargetSegments('rh', chronCheckins, rhSeries.days, dayOf));
	let vpdPhaseTargets = $derived(phaseTargetSegments('vpd', chronCheckins, vpdSeries.days, dayOf));
	let ecPhaseTargets = $derived(phaseTargetSegments('ec', chronCheckins, ecSeries.days, dayOf));
	let phPhaseTargets = $derived(phaseTargetSegments('ph', chronCheckins, phSeries.days, dayOf));

	// MultiSeriesChart: alle 7 Metriken zur Auswahl. phaseTargets wird nur sichtbar
	// wenn der User NUR diese eine Series anwählt (sonst Multi-Y-Skala-Konflikt).
	let allSeries: ChartSeries[] = $derived([
		{ key: 'temp', label: 'Temp', color: CHART_COLORS.temp, unit: '°C', values: tempSeries.values, days: tempSeries.days, phaseTargets: tempPhaseTargets },
		{ key: 'rh', label: 'RH', color: CHART_COLORS.rh, unit: '%', values: rhSeries.values, days: rhSeries.days, phaseTargets: rhPhaseTargets },
		{ key: 'vpd', label: 'VPD', color: CHART_COLORS.vpd, unit: ' kPa', values: vpdSeries.values, days: vpdSeries.days, phaseTargets: vpdPhaseTargets },
		{ key: 'ec', label: 'EC', color: CHART_COLORS.ec, unit: '', values: ecSeries.values, days: ecSeries.days, phaseTargets: ecPhaseTargets },
		{ key: 'ph', label: 'pH', color: CHART_COLORS.ph, unit: '', values: phSeries.values, days: phSeries.days, phaseTargets: phPhaseTargets },
		{ key: 'water', label: 'Wasser', color: CHART_COLORS.water, unit: ' L', values: waterSeries.values, days: waterSeries.days },
		{ key: 'nutrient', label: 'Dünger', color: CHART_COLORS.nutrient, unit: ' mL', values: nutrientSeries.values, days: nutrientSeries.days },
	]);
	// Default-aktive Metriken: VPD + EC + Wasser (häufigste Health-Indikatoren)
	let enabledKeys = $state<string[]>(['vpd', 'ec', 'water']);
	function toggleKey(key: string) {
		enabledKeys = enabledKeys.includes(key)
			? enabledKeys.filter(k => k !== key)
			: [...enabledKeys, key];
	}
	// Series die mind. 2 Datenpunkte haben (sonst nicht sinnvoll plotbar)
	let plottableSeries = $derived(allSeries.filter(s => s.values.length >= 2));

	let allPhases = $derived(Array.from(new Set([
		...Object.keys(tempPerPhase), ...Object.keys(rhPerPhase),
		...Object.keys(vpdPerPhase), ...Object.keys(ecPerPhase), ...Object.keys(phPerPhase),
	])));

	// v1.4.1: Düngerverbrauch — hochgerechnet aus Wassergaben + Feedline-Schema
	let nutrientUsage = $derived(grow ? calcNutrientUsage(grow, growState?.checkins ?? []) : null);

	// v1.4.3: Phase-Tab-Switch (Gesamt / Veg / Bloom / ...)
	// v1.4.6: Tab-Liste enthält ALLE Phasen mit Check-ins (auch ohne Düngung) — sonst sieht User nicht warum Daten fehlen
	let selectedTab = $state<string>('total');  // 'total' | phase-name
	let availableTabs = $derived.by(() => {
		const phases = nutrientUsage?.phaseCheckinStats.map(p => p.phase) ?? [];
		return [{ key: 'total', label: 'Gesamt' }, ...phases.map(p => ({ key: p, label: p }))];
	});

	/** Sichtbare Daten je nach Tab: { products, water_l, n_checkins } */
	let viewData = $derived.by(() => {
		if (!nutrientUsage) return { products: [] as ProductUsage[], water_l: 0, n_checkins: 0 };
		if (selectedTab === 'total') {
			return {
				products: nutrientUsage.byProduct,
				water_l: nutrientUsage.total_water_l,
				n_checkins: nutrientUsage.n_fertigated_checkins,
			};
		}
		const phase = nutrientUsage.byPhase.find(p => p.phase === selectedTab);
		return {
			products: phase?.products ?? [],
			water_l: phase?.water_l ?? 0,
			n_checkins: phase?.n_checkins ?? 0,
		};
	});

	/** v1.4.6: Diagnose-Stats für den aktiven Tab (für Empty-State-Erklärung) */
	let activePhaseDiag = $derived.by(() => {
		if (!nutrientUsage || selectedTab === 'total') return null;
		return nutrientUsage.phaseCheckinStats.find(p => p.phase === selectedTab) ?? null;
	});

	let nutrientMaxTotal = $derived(Math.max(0, ...viewData.products.map(p => p.total)));
	let selectedProductKey = $state<string | null>(null);
	// Default + Auto-Reset wenn Tab gewechselt und gewähltes Produkt nicht mehr in der Liste
	$effect(() => {
		const keys = viewData.products.map(p => p.key);
		if (keys.length === 0) { selectedProductKey = null; return; }
		if (selectedProductKey === null || !keys.includes(selectedProductKey)) {
			selectedProductKey = keys[0];
		}
	});

	// v1.4.3: Chart-Mode Toggle (kumulativ vs. pro Anwendung)
	let chartMode = $state<'cumulative' | 'per_application'>('cumulative');
	let selectedProductSeries = $derived.by(() => {
		if (!nutrientUsage || !selectedProductKey) return { days: [], values: [] };
		return chartMode === 'cumulative'
			? productSeriesCumulative(nutrientUsage.history, selectedProductKey)
			: productSeries(nutrientUsage.history, selectedProductKey);
	});
	let selectedProduct = $derived(
		viewData.products.find(p => p.key === selectedProductKey) ?? null
	);
	// Kategorie-Farben (visuelle Trennung base vs. supplement vs. ...)
	function categoryColor(kat: string): string {
		if (kat === 'base') return CHART_COLORS.nutrient;
		if (kat === 'supplement') return CHART_COLORS.water;
		if (kat === 'booster') return CHART_COLORS.vpd;
		if (kat === 'stimulator') return CHART_COLORS.ec;
		return CHART_COLORS.rh;
	}

	// v1.4.3: Forecast — voraussichtlicher Restverbrauch bis Schema-Ende
	let usageForecast = $derived.by(() => {
		if (!nutrientUsage || !grow) return null;
		const pos = currentPhasePosition(grow, growState?.checkins ?? []);
		// totalDaysCovered = letzter Düng-Tag (Tag X seit Start). Wenn history leer: 0.
		const lastDay = nutrientUsage.history.length > 0
			? nutrientUsage.history[nutrientUsage.history.length - 1].day
			: 0;
		return calcUsageForecast(nutrientUsage, pos.phase, pos.daysIn, lastDay);
	});

	// v1.4.4: Header-Übersicht
	let currentPos = $derived(grow ? currentPhasePosition(grow, growState?.checkins ?? []) : null);
	let growTotalDays = $derived(grow ? totalGrowDays(grow, growState?.checkins ?? []) : 0);

	// v1.4.4: Phase-Bänder für Charts — Tag-basiert
	let phaseBandsForCharts = $derived.by(() => {
		if (!grow) return [];
		const bounds = phaseBoundaries(grow, growState?.checkins ?? []);
		if (bounds.length === 0) return [];
		const startMs = new Date(grow.started_at).getTime();
		const todayMs = Date.now();
		const day_ms = 86400000;
		return bounds.map((b, i) => {
			const startDay = Math.max(1, Math.floor((b.start_ms - startMs) / day_ms) + 1);
			const nextStart = i + 1 < bounds.length ? bounds[i + 1].start_ms : todayMs;
			const endDay = Math.max(startDay, Math.floor((nextStart - startMs) / day_ms) + 1);
			return { startDay, endDay, label: b.phase };
		});
	});

	// v1.4.4: Chart-Zeit-Navigation — Range + Offset
	type RangeMode = 'all' | '14d' | '30d' | 'phase';
	let chartRange = $state<RangeMode>('all');
	let chartOffset = $state(0);  // Tage nach links (älter)

	/** Max-Day in irgendeiner Series (= rechte Grenze unverschoben) */
	let maxDayOverall = $derived.by(() => {
		let m = 0;
		for (const s of [tempSeries, rhSeries, vpdSeries, ecSeries, phSeries, waterSeries, nutrientSeries]) {
			for (const d of s.days) if (d > m) m = d;
		}
		return Math.max(m, growTotalDays);
	});

	/** Sichtbares Tag-Fenster basierend auf Range + Offset */
	let chartWindow = $derived.by(() => {
		if (chartRange === 'all' || maxDayOverall < 2) {
			return { fromDay: 1, toDay: Math.max(maxDayOverall, 1) };
		}
		if (chartRange === 'phase') {
			const currentBand = phaseBandsForCharts[phaseBandsForCharts.length - 1];
			if (!currentBand) return { fromDay: 1, toDay: maxDayOverall };
			// Offset bewegt sich durch die Phase-Bänder zurück
			const idx = Math.max(0, phaseBandsForCharts.length - 1 - chartOffset);
			const band = phaseBandsForCharts[idx];
			return { fromDay: band.startDay, toDay: band.endDay };
		}
		const win = chartRange === '14d' ? 14 : 30;
		const toDay = Math.max(win, maxDayOverall - chartOffset);
		const fromDay = Math.max(1, toDay - win + 1);
		return { fromDay, toDay };
	});

	/** Label für die aktuelle Window-Range. */
	let chartWindowLabel = $derived.by(() => {
		const { fromDay, toDay } = chartWindow;
		if (chartRange === 'all') return `Tag 1 – ${toDay}`;
		if (chartRange === 'phase') {
			const idx = Math.max(0, phaseBandsForCharts.length - 1 - chartOffset);
			const band = phaseBandsForCharts[idx];
			return band ? `${band.label} · Tag ${fromDay}–${toDay}` : `Tag ${fromDay}–${toDay}`;
		}
		return `Tag ${fromDay}–${toDay}`;
	});

	/** Slice einer Series aufs Fenster. */
	function sliceSeries(s: { values: number[]; days: number[] }, win: { fromDay: number; toDay: number }) {
		const out: { values: number[]; days: number[] } = { values: [], days: [] };
		for (let i = 0; i < s.days.length; i++) {
			if (s.days[i] >= win.fromDay && s.days[i] <= win.toDay) {
				out.values.push(s.values[i]);
				out.days.push(s.days[i]);
			}
		}
		return out;
	}

	/** Slicte Series für MultiSeriesChart basierend auf Window. */
	let viewSeries = $derived.by<ChartSeries[]>(() => {
		const win = chartWindow;
		return allSeries.map((s) => {
			const sliced = sliceSeries({ values: s.values, days: s.days }, win);
			return {
				...s,
				values: sliced.values,
				days: sliced.days,
				// phaseTargets-Mapping wäre komplex → bei Slicing weglassen.
				// (Wird nur im 'all'-Mode geliefert — phaseBands ersetzen das visuell)
				phaseTargets: chartRange === 'all' ? s.phaseTargets : undefined,
			};
		});
	});

	function setRange(r: RangeMode) {
		chartRange = r;
		chartOffset = 0;
	}
	function panOlder() {
		if (chartRange === 'phase') {
			chartOffset = Math.min(phaseBandsForCharts.length - 1, chartOffset + 1);
			return;
		}
		const win = chartRange === '14d' ? 14 : chartRange === '30d' ? 30 : 0;
		if (win > 0) chartOffset = Math.min(maxDayOverall - win, chartOffset + Math.floor(win / 2));
	}
	function panNewer() {
		if (chartRange === 'phase') {
			chartOffset = Math.max(0, chartOffset - 1);
			return;
		}
		const win = chartRange === '14d' ? 14 : chartRange === '30d' ? 30 : 0;
		if (win > 0) chartOffset = Math.max(0, chartOffset - Math.floor(win / 2));
	}
	let canPanOlder = $derived.by(() => {
		if (chartRange === 'all') return false;
		if (chartRange === 'phase') return chartOffset < phaseBandsForCharts.length - 1;
		const win = chartRange === '14d' ? 14 : 30;
		return maxDayOverall - chartOffset - win >= 1;
	});
	let canPanNewer = $derived(chartRange !== 'all' && chartOffset > 0);

	// v1.4.4: Pro-Phase Target-Status-Helper
	function targetStatus(phase: string, key: 'temp' | 'rh' | 'vpd' | 'ec' | 'ph', value: number | null): 'optimal' | 'warn' | 'crit' | null {
		if (value === null) return null;
		const t = targetFor(key, phase);
		if (!t) return null;
		if (value >= t.min && value <= t.max) return 'optimal';
		// Warn-Zone: 15% außerhalb
		const tolerance = (t.max - t.min) * 0.15;
		if (value >= t.min - tolerance && value <= t.max + tolerance) return 'warn';
		return 'crit';
	}
	function statusBg(status: 'optimal' | 'warn' | 'crit' | null): string {
		if (status === 'optimal') return 'text-gb-green';
		if (status === 'warn') return 'text-gb-warning';
		if (status === 'crit') return 'text-gb-danger';
		return 'text-gb-text-muted';
	}

	// v1.4.4: Foto-Timeline — chronologisch alle Check-ins mit Fotos
	let photoCheckins = $derived(
		chronCheckins.filter((c: CheckIn) =>
			(c.photos_data && c.photos_data.length > 0) ||
			(c.photo_urls && c.photo_urls.length > 0) ||
			c.photo_data || c.photo_url,
		)
	);
	function firstPhotoOf(c: CheckIn): string | null {
		if (c.photos_data?.[0]) return c.photos_data[0];
		if (c.photo_urls?.[0]) return c.photo_urls[0];
		return c.photo_data ?? c.photo_url ?? null;
	}

	// v1.4.4: Trainings-Events — chronologisch
	let trainingEvents = $derived(
		chronCheckins
			.filter((c: CheckIn) => c.training && c.training.trim())
			.map((c: CheckIn) => ({ day: dayOf(c), labels: c.training!.split(',').map(s => s.trim()).filter(Boolean), phase: c.phase, week: c.week }))
	);

	// v1.4.4: Anomalien-Detection — Werte deutlich außerhalb Targets
	let anomalies = $derived.by(() => {
		const out: { day: number; phase: string; metric: string; value: string; severity: 'warn' | 'crit' }[] = [];
		for (const c of chronCheckins) {
			const d = dayOf(c);
			const checks: Array<{ key: 'temp' | 'rh' | 'vpd' | 'ec' | 'ph'; val: number | null; unit: string }> = [
				{ key: 'temp', val: c.temp, unit: '°C' },
				{ key: 'rh', val: c.rh, unit: '%' },
				{ key: 'vpd', val: c.vpd, unit: ' kPa' },
				{ key: 'ec', val: c.ec_measured, unit: '' },
				{ key: 'ph', val: c.ph_measured, unit: '' },
			];
			for (const ch of checks) {
				const st = targetStatus(c.phase, ch.key, ch.val);
				if (st === 'crit') {
					out.push({ day: d, phase: c.phase, metric: ch.key.toUpperCase(), value: `${ch.val!.toFixed(ch.key === 'temp' || ch.key === 'rh' ? 0 : 2)}${ch.unit}`, severity: 'crit' });
				}
			}
		}
		// Top 5 nach Tag absteigend
		return out.sort((a, b) => b.day - a.day).slice(0, 5);
	});

	// v1.4.5: Lightbox-State für Foto-Timeline
	let lightboxOpen = $state(false);
	let lightboxIndex = $state(0);
	let allPhotos = $derived.by<string[]>(() => {
		const out: string[] = [];
		for (const c of photoCheckins) {
			const photos = c.photos_data?.length ? c.photos_data
				: c.photo_urls?.length ? c.photo_urls
				: c.photo_data ? [c.photo_data]
				: c.photo_url ? [c.photo_url]
				: [];
			out.push(...photos);
		}
		return out;
	});
	/** Index der ersten Photo eines Check-ins im flachen allPhotos-Array. */
	function firstPhotoIndex(ciIdx: number): number {
		let idx = 0;
		for (let i = 0; i < ciIdx; i++) {
			const c = photoCheckins[i];
			const n = c.photos_data?.length ?? c.photo_urls?.length ?? (c.photo_data || c.photo_url ? 1 : 0);
			idx += n;
		}
		return idx;
	}
	function openLightbox(ciIdx: number) {
		lightboxIndex = firstPhotoIndex(ciIdx);
		lightboxOpen = true;
	}

	// v1.4.5: Notes-Highlights — chronologisch absteigend, Top 5 mit nicht-leeren Notizen
	let notesHighlights = $derived(
		chronCheckins
			.filter((c: CheckIn) => c.notes && c.notes.trim().length >= 3)
			.slice()
			.reverse()
			.slice(0, 5)
			.map((c: CheckIn) => ({ day: dayOf(c), phase: c.phase, week: c.week, day_in_phase: c.day, notes: c.notes.trim(), date: c.created_at }))
	);

	// v1.4.5: Pro-Phase Tap-Info — welche Cell gerade getappt für Target-Tooltip
	let phaseInfoCell = $state<{ phase: string; key: 'temp' | 'rh' | 'vpd' | 'ec' | 'ph'; value: number } | null>(null);
	function showCellInfo(phase: string, key: 'temp' | 'rh' | 'vpd' | 'ec' | 'ph', value: number | null) {
		if (value === null) { phaseInfoCell = null; return; }
		// Toggle off wenn gleiche Zelle nochmal getappt
		if (phaseInfoCell && phaseInfoCell.phase === phase && phaseInfoCell.key === key) {
			phaseInfoCell = null;
		} else {
			phaseInfoCell = { phase, key, value };
		}
	}
	let phaseInfoTarget = $derived(phaseInfoCell ? targetFor(phaseInfoCell.key, phaseInfoCell.phase) : null);

	// v1.4.4: Best-Day — Check-in mit meisten Werten im optimal-Bereich
	let bestDay = $derived.by(() => {
		let best: { day: number; ok: number; total: number; phase: string } | null = null;
		for (const c of chronCheckins) {
			let ok = 0, total = 0;
			for (const ch of [{ k: 'temp' as const, v: c.temp }, { k: 'rh' as const, v: c.rh }, { k: 'vpd' as const, v: c.vpd }, { k: 'ec' as const, v: c.ec_measured }, { k: 'ph' as const, v: c.ph_measured }]) {
				if (ch.v === null) continue;
				const st = targetStatus(c.phase, ch.k, ch.v);
				if (st === null) continue;
				total++;
				if (st === 'optimal') ok++;
			}
			if (total >= 3 && (best === null || ok > best.ok)) {
				best = { day: dayOf(c), ok, total, phase: c.phase };
			}
		}
		return best;
	});
</script>

<svelte:head><title>Analyse · {grow?.name ?? 'Grow'}</title></svelte:head>

<div class="px-4 pt-6 max-w-lg mx-auto pb-24 space-y-5">
	{#if !grow}
		<a href="/grow" class="text-gb-text-muted text-sm">&larr; Grows</a>
		<p class="text-gb-text-muted text-sm bg-gb-surface rounded-xl p-4 text-center">
			Grow nicht gefunden.
		</p>
	{:else}
		<div>
			<a href="/grow/{grow.id}" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; {grow.name}</a>
			<h1 class="text-2xl font-bold mt-1">📈 Analyse</h1>
			<p class="text-xs text-gb-text-muted mt-1">{chronCheckins.length} Check-in{chronCheckins.length !== 1 ? 's' : ''} ausgewertet</p>
		</div>

		{#if chronCheckins.length === 0}
			<div class="bg-gb-surface rounded-xl p-6 text-center">
				<p class="text-3xl mb-3">📈</p>
				<p class="text-sm text-gb-text-muted">Noch keine Daten — leg ein paar Check-ins an, dann erscheint hier deine Auswertung.</p>
			</div>
		{:else}
			<!-- v1.4.4: Übersichts-Header — Tag/Phase/Score/Yield kompakt -->
			<div class="bg-gradient-to-br from-gb-surface to-gb-surface-2 rounded-xl p-4 space-y-3 border border-gb-border/50">
				<div class="flex items-baseline justify-between gap-3">
					<div class="min-w-0 flex-1">
						<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">Aktuell</p>
						<p class="text-lg font-bold truncate">
							{currentPos?.phase ?? '—'}
							<span class="text-sm font-normal text-gb-text-muted">W{currentPos?.week}T{currentPos?.day}</span>
						</p>
					</div>
					<div class="text-right shrink-0">
						<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">Grow-Tag</p>
						<p class="text-lg font-bold tabular-nums">{growTotalDays}</p>
					</div>
				</div>
				<div class="grid grid-cols-3 gap-2 pt-2 border-t border-gb-border/50">
					<div>
						<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">Konsistenz</p>
						<p class="text-sm font-bold tabular-nums">{consistency?.percent ?? '—'}<span class="text-[10px] font-normal text-gb-text-muted">%</span></p>
					</div>
					<div>
						<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">VPD-OK</p>
						<p class="text-sm font-bold tabular-nums">{vpdStress.okPercent ?? '—'}<span class="text-[10px] font-normal text-gb-text-muted">%</span></p>
					</div>
					<div>
						<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">{grow.status === 'harvested' ? 'Yield' : 'Score'}</p>
						<p class="text-sm font-bold tabular-nums">
							{#if grow.status === 'harvested' && grow.yield_g}
								{grow.yield_g.toFixed(0)}<span class="text-[10px] font-normal text-gb-text-muted">g</span>
							{:else if grow.grow_score !== null}
								{grow.grow_score}<span class="text-[10px] font-normal text-gb-text-muted">/100</span>
							{:else}
								—
							{/if}
						</p>
					</div>
				</div>
			</div>

			<!-- Klima + Wasser-Werte als Grid -->
			<div class="space-y-2">
				<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Klima &amp; Werte</h2>
				<div class="grid grid-cols-2 gap-2">
					{#if tempStats.avg !== null}
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-xs text-gb-text-muted">Temp</p>
							<p class="text-lg font-bold">Ø {tempStats.avg.toFixed(1)}°C</p>
							<p class="text-[10px] text-gb-text-muted">{tempStats.min!.toFixed(1)} – {tempStats.max!.toFixed(1)}°C</p>
						</div>
					{/if}
					{#if rhStats.avg !== null}
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-xs text-gb-text-muted">RH</p>
							<p class="text-lg font-bold">Ø {rhStats.avg.toFixed(0)}%</p>
							<p class="text-[10px] text-gb-text-muted">{rhStats.min!.toFixed(0)} – {rhStats.max!.toFixed(0)}%</p>
						</div>
					{/if}
					{#if vpdStats.avg !== null}
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-xs text-gb-text-muted">VPD</p>
							<p class="text-lg font-bold text-gb-green">Ø {vpdStats.avg.toFixed(2)} kPa</p>
							<p class="text-[10px] text-gb-text-muted">{vpdStats.min!.toFixed(2)} – {vpdStats.max!.toFixed(2)}</p>
						</div>
					{/if}
					{#if ecStats.avg !== null}
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-xs text-gb-text-muted">EC</p>
							<p class="text-lg font-bold">Ø {ecStats.avg.toFixed(2)}</p>
							<p class="text-[10px] text-gb-text-muted">{ecStats.min!.toFixed(2)} – {ecStats.max!.toFixed(2)}</p>
						</div>
					{/if}
					{#if phStats.avg !== null}
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-xs text-gb-text-muted">pH</p>
							<p class="text-lg font-bold">Ø {phStats.avg.toFixed(1)}</p>
							<p class="text-[10px] text-gb-text-muted">{phStats.min!.toFixed(1)} – {phStats.max!.toFixed(1)}</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- v1.4.3: Wasser & Dünger — Tab-Switch zwischen Gesamt / Veg / Bloom / ... -->
			<div class="space-y-2">
				<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide flex items-center justify-between gap-2">
					<span>Wasser &amp; Dünger</span>
					{#if nutrientUsage?.feedline}
						<span class="text-[10px] font-normal normal-case tracking-normal text-gb-text-muted truncate ml-2 max-w-[60%]" title={nutrientUsage.feedline.name}>{nutrientUsage.feedline.name}</span>
					{/if}
				</h2>

				{#if nutrientUsage?.feedline && nutrientUsage.byProduct.length > 0}
					<!-- Segmented Tab-Switch (nur wenn ≥1 Phase, sonst hat nur 'Gesamt' Sinn) -->
					{#if availableTabs.length > 1}
						<div class="bg-gb-surface rounded-xl p-1 flex gap-1 overflow-x-auto">
							{#each availableTabs as tab}
								<button type="button" onclick={() => selectedTab = tab.key}
									class="flex-1 text-xs font-medium px-3 rounded-lg transition-colors whitespace-nowrap
										{selectedTab === tab.key ? 'bg-gb-green text-gb-bg' : 'text-gb-text-muted hover:text-gb-text'}"
									style="min-height:36px">
									{tab.label}
								</button>
							{/each}
						</div>
					{/if}

					<!-- Reaktive Tiles (Wasser + Düng-Check-ins pro Tab) -->
					<div class="grid grid-cols-2 gap-2">
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">💧 Wasser</p>
							<p class="text-xl font-bold text-gb-info mt-0.5 tabular-nums">{viewData.water_l.toFixed(1)}<span class="text-xs font-normal text-gb-text-muted ml-1">L</span></p>
							{#if viewData.n_checkins > 0}
								<p class="text-[10px] text-gb-text-muted mt-0.5">Ø {(viewData.water_l / viewData.n_checkins).toFixed(1)} L/Gießung</p>
							{/if}
						</div>
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">🧪 Düng-Check-ins</p>
							<p class="text-xl font-bold mt-0.5 tabular-nums">{viewData.n_checkins}<span class="text-xs font-normal text-gb-text-muted ml-1">×</span></p>
							{#if selectedTab !== 'total' && nutrientUsage.n_fertigated_checkins > 0}
								<p class="text-[10px] text-gb-text-muted mt-0.5">von {nutrientUsage.n_fertigated_checkins} gesamt</p>
							{/if}
						</div>
					</div>

					<!-- Produkt-Liste für gewählten Tab (sortiert nach Total) -->
					{#if viewData.products.length === 0}
						<!-- v1.4.6: Diagnose statt nur "keine Produkte" — User sieht WARUM nichts da ist -->
						{#if activePhaseDiag}
							<div class="bg-gb-warning/10 border border-gb-warning/20 rounded-xl p-3 space-y-2">
								<p class="text-sm font-semibold text-gb-warning">
									Keine Düngungen in {selectedTab} berechnet
								</p>
								<div class="text-[11px] text-gb-text-muted space-y-0.5 leading-relaxed">
									<p>• <span class="text-gb-text tabular-nums">{activePhaseDiag.n_total}</span> Check-in{activePhaseDiag.n_total !== 1 ? 's' : ''} in dieser Phase</p>
									<p>• <span class="text-gb-text tabular-nums">{activePhaseDiag.n_watered}</span> davon mit Wassermenge geloggt</p>
									{#if activePhaseDiag.n_skipped > 0}
										<p class="text-gb-danger">• <span class="tabular-nums">{activePhaseDiag.n_skipped}</span> übersprungen — {selectedTab} W? ist nicht im Düngerschema definiert</p>
									{:else}
										<p>• <span class="tabular-nums">0</span> davon mit 🧪 <span class="text-gb-text">Gedüngt</span> aktiviert</p>
									{/if}
								</div>
								<p class="text-[11px] text-gb-text-muted leading-relaxed pt-1 border-t border-gb-border/40">
									{#if activePhaseDiag.n_skipped > 0}
										Tipp: Deine Düngerlinie ({nutrientUsage.feedline?.name}) hat kein Schema für „{selectedTab}". Andere Düngerlinie wählen oder bestehende Check-ins als „Veg" / „Bloom" markieren.
									{:else}
										Tipp: Beim Check-in 💧 <span class="text-gb-text">Gegossen</span> + 🧪 <span class="text-gb-text">Gedüngt</span> aktivieren und Wassermenge (mL) eintragen.
									{/if}
								</p>
							</div>
						{:else}
							<div class="bg-gb-surface rounded-xl p-4 text-center text-sm text-gb-text-muted">
								In Phase „{selectedTab}" wurden noch keine Produkte angewendet.
							</div>
						{/if}
					{:else}
						<div class="bg-gb-surface rounded-xl p-3 space-y-2.5">
							{#each viewData.products as p}
								{@const widthPct = nutrientMaxTotal > 0 ? (p.total / nutrientMaxTotal) * 100 : 0}
								{@const isSelected = selectedProductKey === p.key}
								{@const color = categoryColor(p.kategorie)}
								<button type="button" onclick={() => selectedProductKey = p.key}
									class="w-full text-left space-y-1 group" style="min-height:44px">
									<div class="flex items-baseline justify-between gap-2">
										<span class="text-sm font-medium truncate {isSelected ? 'text-gb-text' : 'text-gb-text-muted group-hover:text-gb-text'}">{p.name}</span>
										<span class="text-sm font-bold tabular-nums {isSelected ? 'text-gb-text' : 'text-gb-text-muted'}">
											{p.total.toFixed(p.einheit === 'g' ? 1 : 0)}<span class="text-[10px] font-normal text-gb-text-muted ml-0.5">{p.einheit}</span>
										</span>
									</div>
									<div class="flex items-center gap-2">
										<div class="flex-1 h-1.5 bg-gb-bg rounded-full overflow-hidden">
											<div class="h-full transition-all" style="width: {widthPct}%; background: {color}; opacity: {isSelected ? 1 : 0.55};"></div>
										</div>
										<span class="text-[10px] text-gb-text-muted whitespace-nowrap tabular-nums">{p.n_checkins}× · Ø {p.avg_per_application.toFixed(p.einheit === 'g' ? 1 : 0)}{p.einheit}</span>
									</div>
								</button>
							{/each}
						</div>
					{/if}

					<!-- Chart mit Mode-Toggle (kumulativ / pro Anwendung) -->
					{#if selectedProduct && selectedProductSeries.values.length >= 2}
						<div class="space-y-2">
							<div class="flex items-center justify-between gap-2 px-1">
								<span class="text-[11px] text-gb-text-muted">{selectedProduct.name} · Verlauf (gesamter Grow)</span>
								<div class="bg-gb-surface rounded-lg p-0.5 flex gap-0.5">
									<button type="button" onclick={() => chartMode = 'cumulative'}
										class="text-[10px] px-2 py-1 rounded-md font-medium {chartMode === 'cumulative' ? 'bg-gb-bg text-gb-text' : 'text-gb-text-muted'}"
										style="min-height:28px">kumulativ</button>
									<button type="button" onclick={() => chartMode = 'per_application'}
										class="text-[10px] px-2 py-1 rounded-md font-medium {chartMode === 'per_application' ? 'bg-gb-bg text-gb-text' : 'text-gb-text-muted'}"
										style="min-height:28px">pro Gabe</button>
								</div>
							</div>
							<MiniChart
								data={selectedProductSeries.values}
								days={selectedProductSeries.days}
								color={categoryColor(selectedProduct.kategorie)}
								label={chartMode === 'cumulative' ? 'kumulativ' : 'pro Gabe'}
								unit=" {selectedProduct.einheit}"
								showMinMax
							/>
						</div>
					{/if}

					<!-- Forecast-Block: voraussichtlich noch nötig (nur wenn remaining > 0) -->
					{#if usageForecast && usageForecast.remaining_days_total > 0 && usageForecast.products.length > 0}
						<div class="bg-gradient-to-br from-gb-info/10 to-gb-info/5 border border-gb-info/20 rounded-xl p-3 space-y-2">
							<div class="flex items-baseline justify-between gap-2">
								<p class="text-sm font-semibold text-gb-info">🔮 Voraussichtlich noch nötig</p>
								<span class="text-[10px] text-gb-text-muted whitespace-nowrap">~{usageForecast.remaining_days_total}d Schema</span>
							</div>
							<div class="space-y-1">
								<div class="flex items-baseline justify-between text-xs">
									<span class="text-gb-text-muted">💧 Wasser</span>
									<span class="font-semibold tabular-nums">~{usageForecast.water_remaining_est_l.toFixed(0)} L</span>
								</div>
								{#each usageForecast.products as f}
									{#if f.remaining_est >= 0.5}
										<div class="flex items-baseline justify-between text-xs">
											<span class="text-gb-text-muted truncate">{f.name}</span>
											<span class="font-semibold tabular-nums">~{f.remaining_est.toFixed(f.einheit === 'g' ? 1 : 0)} {f.einheit}</span>
										</div>
									{/if}
								{/each}
							</div>
							<p class="text-[10px] text-gb-text-muted leading-relaxed opacity-80">
								Basis: Ø {usageForecast.avg_water_per_day_l.toFixed(2)} L/Tag der bisherigen Daten,
								extrapoliert über verbleibende Schema-Tage. Nachbestellen-Richtwert, nicht exakte Prognose.
							</p>
						</div>
					{/if}

					<!-- Hinweise (kurz, freundlich) -->
					<div class="text-[11px] text-gb-text-muted leading-relaxed px-1 space-y-1">
						{#if nutrientUsage.n_skipped_checkins > 0}
							<p><span class="text-gb-warning">{nutrientUsage.n_skipped_checkins} Check-in{nutrientUsage.n_skipped_checkins !== 1 ? 's' : ''} übersprungen</span> — Phase/Woche nicht im Schema definiert.</p>
						{/if}
						<p class="opacity-80">Wenn du beim Check-in EC misst, passen wir die Mengen entsprechend an (schwächer dosiert = weniger Verbrauch).</p>
					</div>

				{:else if nutrientUsage?.feedline}
					<!-- Feedline gesetzt aber noch keine Düngung -->
					<div class="bg-gb-surface rounded-xl p-4 space-y-2">
						<p class="text-sm text-gb-text-muted">Noch keine Düngung berechnet.</p>
						<p class="text-[11px] text-gb-text-muted leading-relaxed">
							Beim Check-in 💧 <span class="text-gb-text">Gegossen</span> + 🧪 <span class="text-gb-text">Gedüngt</span> aktivieren und <span class="text-gb-text">Wassermenge (mL)</span> eintragen.
						</p>
					</div>
				{:else if totalWaterMl > 0 || totalNutrientMl > 0}
					<!-- Fallback: keine Feedline, aber User loggt water/nutrient_ml manuell -->
					<div class="grid grid-cols-2 gap-2">
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">💧 Wasser</p>
							<p class="text-xl font-bold text-gb-info mt-0.5">{(totalWaterMl / 1000).toFixed(1)}<span class="text-xs font-normal text-gb-text-muted ml-1">L</span></p>
						</div>
						<div class="bg-gb-surface rounded-xl p-3">
							<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">🧪 Nährstoff</p>
							<p class="text-xl font-bold mt-0.5">{totalNutrientMl.toFixed(0)}<span class="text-xs font-normal text-gb-text-muted ml-1">mL</span></p>
						</div>
					</div>
					<p class="text-[11px] text-gb-text-muted px-1">Ohne Düngerlinie können wir nicht pro Produkt aufschlüsseln — weise dem Grow eine Linie zu.</p>
				{/if}
			</div>

			<!-- v1.4.4: Pro Phase — Tabelle mit Target-Coloring -->
			{#if allPhases.length >= 1 && (allPhases.length >= 2 || phaseDays.length > 0)}
				<div class="space-y-2">
					<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Pro Phase</h2>
					<div class="bg-gb-surface rounded-xl p-3 overflow-x-auto">
						<table class="w-full text-xs">
							<thead>
								<tr class="text-gb-text-muted text-[10px] uppercase tracking-wide">
									<th class="text-left font-medium pb-2">Phase</th>
									<th class="text-right font-medium pb-2">Tage</th>
									<th class="text-right font-medium pb-2">Temp</th>
									<th class="text-right font-medium pb-2">RH</th>
									<th class="text-right font-medium pb-2">VPD</th>
									<th class="text-right font-medium pb-2">EC</th>
									<th class="text-right font-medium pb-2">pH</th>
								</tr>
							</thead>
							<tbody>
								{#each allPhases as phase}
									{@const days = phaseDays.find(p => p.phase === phase)?.days}
									{@const tempAvg = tempPerPhase[phase]?.avg ?? null}
									{@const rhAvg = rhPerPhase[phase]?.avg ?? null}
									{@const vpdAvg = vpdPerPhase[phase]?.avg ?? null}
									{@const ecAvg = ecPerPhase[phase]?.avg ?? null}
									{@const phAvg = phPerPhase[phase]?.avg ?? null}
									<tr class="border-t border-gb-border/50">
										<td class="py-1.5 font-medium">{phase}</td>
										<td class="text-right text-gb-text-muted tabular-nums">{days !== undefined ? `${days}d` : '—'}</td>
										<td class="text-right tabular-nums font-medium cursor-pointer {statusBg(targetStatus(phase, 'temp', tempAvg))}" onclick={() => showCellInfo(phase, 'temp', tempAvg)}>{tempAvg !== null ? `${tempAvg.toFixed(1)}°` : '—'}</td>
										<td class="text-right tabular-nums font-medium cursor-pointer {statusBg(targetStatus(phase, 'rh', rhAvg))}" onclick={() => showCellInfo(phase, 'rh', rhAvg)}>{rhAvg !== null ? `${rhAvg.toFixed(0)}%` : '—'}</td>
										<td class="text-right tabular-nums font-medium cursor-pointer {statusBg(targetStatus(phase, 'vpd', vpdAvg))}" onclick={() => showCellInfo(phase, 'vpd', vpdAvg)}>{vpdAvg !== null ? vpdAvg.toFixed(2) : '—'}</td>
										<td class="text-right tabular-nums font-medium cursor-pointer {statusBg(targetStatus(phase, 'ec', ecAvg))}" onclick={() => showCellInfo(phase, 'ec', ecAvg)}>{ecAvg !== null ? ecAvg.toFixed(2) : '—'}</td>
										<td class="text-right tabular-nums font-medium cursor-pointer {statusBg(targetStatus(phase, 'ph', phAvg))}" onclick={() => showCellInfo(phase, 'ph', phAvg)}>{phAvg !== null ? phAvg.toFixed(1) : '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>

						<!-- v1.4.5: Tap-Info-Strip mit Target-Range für gewählte Zelle -->
						{#if phaseInfoCell && phaseInfoTarget}
							{@const unit = phaseInfoCell.key === 'temp' ? '°C' : phaseInfoCell.key === 'rh' ? '%' : phaseInfoCell.key === 'vpd' ? ' kPa' : ''}
							{@const dp = phaseInfoCell.key === 'temp' ? 1 : phaseInfoCell.key === 'rh' ? 0 : 2}
							{@const status = targetStatus(phaseInfoCell.phase, phaseInfoCell.key, phaseInfoCell.value)}
							<div class="mt-2 bg-gb-bg/60 rounded-lg px-3 py-2 flex items-baseline justify-between gap-2 text-xs">
								<span class="text-gb-text-muted">{phaseInfoCell.phase} · {phaseInfoCell.key.toUpperCase()}</span>
								<span class="font-medium {statusBg(status)} tabular-nums">
									{phaseInfoCell.value.toFixed(dp)}{unit}
									<span class="text-gb-text-muted ml-1 font-normal">/ Soll {phaseInfoTarget.min.toFixed(dp)}–{phaseInfoTarget.max.toFixed(dp)}{unit}</span>
								</span>
							</div>
						{:else}
							<div class="flex items-center gap-3 mt-2 pt-2 border-t border-gb-border/50 text-[10px] text-gb-text-muted flex-wrap">
								<span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-gb-green"></span>optimal</span>
								<span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-gb-warning"></span>grenzwertig</span>
								<span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-gb-danger"></span>kritisch</span>
								<span class="ml-auto opacity-70">Zelle tippen für Soll-Range</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- v1.4.4: Verlauf — mit Range-Toolbar (14d/30d/Phase/Gesamt + Pan) + Phase-Bänder -->
			{#if plottableSeries.length >= 2}
				<div class="space-y-2">
					<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Verlauf</h2>

					<!-- Range-Toolbar -->
					<div class="bg-gb-surface rounded-xl p-2 space-y-2">
						<div class="flex items-center gap-1">
							<div class="flex-1 grid grid-cols-4 gap-1">
								{#each [{ k: '14d' as RangeMode, l: '14d' }, { k: '30d' as RangeMode, l: '30d' }, { k: 'phase' as RangeMode, l: 'Phase' }, { k: 'all' as RangeMode, l: 'Gesamt' }] as opt}
									<button type="button" onclick={() => setRange(opt.k)}
										class="text-[11px] font-medium rounded-lg transition-colors
											{chartRange === opt.k ? 'bg-gb-green text-gb-bg' : 'text-gb-text-muted hover:text-gb-text'}"
										style="min-height:32px">
										{opt.l}
									</button>
								{/each}
							</div>
							<div class="flex gap-0.5 ml-1">
								<button type="button" onclick={panOlder} disabled={!canPanOlder} aria-label="Älter"
									class="w-9 h-8 flex items-center justify-center rounded-lg text-gb-text-muted disabled:opacity-30 hover:text-gb-text hover:bg-gb-bg/50">←</button>
								<button type="button" onclick={panNewer} disabled={!canPanNewer} aria-label="Neuer"
									class="w-9 h-8 flex items-center justify-center rounded-lg text-gb-text-muted disabled:opacity-30 hover:text-gb-text hover:bg-gb-bg/50">→</button>
							</div>
						</div>
						<p class="text-[10px] text-gb-text-muted text-center">{chartWindowLabel}</p>
					</div>

					<!-- Metrik-Pills -->
					<div class="bg-gb-surface rounded-xl p-3">
						<div class="flex flex-wrap gap-1.5">
							{#each plottableSeries as s}
								{@const active = enabledKeys.includes(s.key)}
								<button type="button" onclick={() => toggleKey(s.key)}
									class="text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors flex items-center gap-1.5 {active ? 'border-transparent text-white' : 'border-gb-border text-gb-text-muted bg-gb-bg/50 hover:text-gb-text'}"
									style={active ? `background-color: ${s.color}` : ''}>
									<span class="w-1.5 h-1.5 rounded-full" style="background-color: {active ? CHART_COLORS.textOnDark : s.color}"></span>
									{s.label}
								</button>
							{/each}
						</div>
					</div>

					<MultiSeriesChart series={viewSeries} {enabledKeys} phaseBands={phaseBandsForCharts} />
					<p class="text-[10px] text-gb-text-muted px-2">
						Tippe in den Chart für Werte am Tag. Werte sind pro Metrik einzeln skaliert (Y-Achse pro Linie). Phasen sind als getönte Bänder im Hintergrund.
					</p>
				</div>
			{/if}

			<!-- v1.4.4: Pflanzen-Pflege — Foto-Timeline + Trainings-Events -->
			{#if photoCheckins.length > 0 || trainingEvents.length > 0}
				<div class="space-y-2">
					<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Pflanzen-Pflege</h2>

					{#if photoCheckins.length > 0}
						<div class="bg-gb-surface rounded-xl p-3 space-y-2">
							<div class="flex items-baseline justify-between gap-2">
								<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">📷 Foto-Verlauf</p>
								<a href="/grow/{grow.id}" class="text-[10px] text-gb-text-muted hover:text-gb-text">{photoCheckins.length} Fotos · alle ansehen →</a>
							</div>
							<div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
								{#each photoCheckins as ci, idx}
									{@const src = firstPhotoOf(ci)}
									{#if src}
										<button type="button" onclick={() => openLightbox(idx)} class="shrink-0 group" aria-label="Foto T{dayOf(ci)}, {ci.phase} W{ci.week}T{ci.day}">
											<div class="w-20 h-20 rounded-lg overflow-hidden bg-gb-bg ring-1 ring-gb-border/40 group-hover:ring-gb-accent/50 group-active:ring-gb-accent transition-colors">
												<img {src} alt="Tag {dayOf(ci)}" loading="lazy" class="w-full h-full object-cover pointer-events-none" />
											</div>
											<p class="text-[10px] text-gb-text-muted text-center mt-1 tabular-nums">T{dayOf(ci)} · {ci.phase}</p>
										</button>
									{/if}
								{/each}
							</div>
						</div>
					{/if}

					{#if trainingEvents.length > 0}
						<div class="bg-gb-surface rounded-xl p-3 space-y-2">
							<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">✂️ Trainings-Events</p>
							<div class="space-y-1.5">
								{#each trainingEvents as ev}
									<div class="flex items-baseline gap-2">
										<span class="text-[10px] text-gb-text-muted tabular-nums w-10 shrink-0">T{ev.day}</span>
										<div class="flex flex-wrap gap-1 flex-1">
											{#each ev.labels as label}
												<span class="text-[11px] bg-gb-accent/15 text-gb-accent-light px-2 py-0.5 rounded-full font-medium">{label}</span>
											{/each}
										</div>
										<span class="text-[10px] text-gb-text-muted">{ev.phase} W{ev.week}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- v1.4.4: Highlights — Best-Day + Anomalien + Notes (v1.4.5) -->
			{#if bestDay || anomalies.length > 0 || notesHighlights.length > 0}
				<div class="space-y-2">
					<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Highlights</h2>

					{#if bestDay}
						<div class="bg-gradient-to-br from-gb-green/10 to-gb-green/5 border border-gb-green/20 rounded-xl p-3">
							<div class="flex items-baseline justify-between gap-2">
								<p class="text-sm font-semibold text-gb-green">🏆 Bester Tag</p>
								<span class="text-[10px] text-gb-text-muted tabular-nums">Tag {bestDay.day} · {bestDay.phase}</span>
							</div>
							<p class="text-[11px] text-gb-text-muted mt-1">
								{bestDay.ok} von {bestDay.total} Messwerten im optimalen Bereich der Phase-Targets.
							</p>
						</div>
					{/if}

					{#if anomalies.length > 0}
						<div class="bg-gb-surface rounded-xl p-3 space-y-2">
							<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">⚠️ Anomalien (Top 5)</p>
							<div class="space-y-1">
								{#each anomalies as a}
									<div class="flex items-baseline gap-2 text-xs">
										<span class="text-gb-text-muted tabular-nums w-10 shrink-0">T{a.day}</span>
										<span class="text-gb-text-muted w-12 shrink-0">{a.phase}</span>
										<span class="font-medium flex-1">{a.metric}</span>
										<span class="text-gb-danger font-semibold tabular-nums">{a.value}</span>
									</div>
								{/each}
							</div>
							<p class="text-[10px] text-gb-text-muted leading-relaxed opacity-80 pt-1 border-t border-gb-border/40">
								Werte deutlich außerhalb des Soll-Bereichs für die jeweilige Phase. Zur Detail-Ansicht im Verlauf-Chart Range auf „Gesamt" → entsprechenden Tag tippen.
							</p>
						</div>
					{/if}

					<!-- v1.4.5: Notes-Highlights (Top 5 letzte mit Notiz) -->
					{#if notesHighlights.length > 0}
						<div class="bg-gb-surface rounded-xl p-3 space-y-2">
							<p class="text-[10px] text-gb-text-muted uppercase tracking-wide">📝 Letzte Notizen</p>
							<div class="space-y-2">
								{#each notesHighlights as n}
									<div class="text-xs space-y-0.5 pb-2 border-b border-gb-border/30 last:border-0 last:pb-0">
										<div class="flex items-baseline justify-between gap-2 text-[10px] text-gb-text-muted">
											<span>T{n.day} · {n.phase} W{n.week}T{n.day_in_phase}</span>
											<span class="tabular-nums">{new Date(n.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>
										</div>
										<p class="text-gb-text leading-relaxed line-clamp-3 whitespace-pre-wrap break-words">{n.notes}</p>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- v1.4.5: Lightbox für Foto-Verlauf -->
			{#if lightboxOpen}
				<Lightbox photos={allPhotos} startIndex={lightboxIndex} onClose={() => lightboxOpen = false} />
			{/if}
		{/if}
	{/if}
</div>

<!-- v1.4.3: details-CSS entfernt (Phase-<details> wurden zu Tab-Switch). -->

