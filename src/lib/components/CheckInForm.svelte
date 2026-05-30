<script lang="ts">
	/**
	 * CheckInForm — Check-in-Formular (Foto · Phase/Zeit · Klima · EC/pH · Gießen · Training · Notizen).
	 *
	 * Aus `grow/[id]/+page.svelte` extrahiert (v1.3.72) — die Seite war 1950+ Zeilen.
	 * Verhalten 1:1 identisch zur vorherigen Inline-Variante.
	 *
	 * Modi:
	 *  - Neuer Check-in: `editingCi` nicht gesetzt → Prefill Temp/RH/EC/pH aus letztem Check-in
	 *  - Edit: `editingCi` gesetzt → Felder aus dem Check-in vorbelegt
	 *
	 * Persistenz + Sync passieren im Component (growStore + syncStore), danach `onDone()`.
	 */
	import { growStore } from '$lib/stores/grow';
	import { authStore } from '$lib/stores/auth';
	import { syncStore } from '$lib/stores/sync';
	import { xpStore } from '$lib/stores/xp';
	import { streakStore, currentStreak, streakMultiplier } from '$lib/stores/streak';
	import { toastStore } from '$lib/stores/toast';
	import { t } from '$lib/i18n';
	import { compressBatch, MAX_PHOTOS } from '$lib/utils/photo';
	import { putOriginal } from '$lib/utils/photo-store';
	import { calcVPD, getVPDStatus } from '$lib/data/science';
	import { clampNumber, RANGES } from '$lib/utils/validation';
	import { toMsPerCm, fromMsPerCm, type ECEinheit } from '$lib/calc/units';
	import { getFeedLine } from '$lib/calc/feedlines/registry';
	import { currentPhasePosition } from '$lib/utils/phase';
	import { hapticSuccess } from '$lib/utils/haptic';
	import type { Grow, CheckIn } from '$lib/stores/grow';
	import { onMount } from 'svelte';

	interface Props {
		/** Grow für den der Check-in erstellt/bearbeitet wird */
		grow: Grow;
		/** Wenn gesetzt: Edit-Modus, Felder werden aus diesem Check-in vorbelegt */
		editingCi?: CheckIn | null;
		/** Alle Check-ins (für Auto-Phase/Woche/Tag + Prefill aus letztem CI) */
		allCheckins?: CheckIn[];
		/** Called nach erfolgreichem Speichern */
		onDone?: () => void;
		/** Called bei Abbrechen */
		onCancel?: () => void;
	}
	let { grow, editingCi = null, allCheckins = [], onDone, onCancel }: Props = $props();

	let tr: (key: string, params?: Record<string, string | number>) => string = $state((k) => k);
	let multiplierValue = $state(1);
	onMount(() => {
		const subs = [
			t.subscribe((v) => (tr = v)),
			streakMultiplier.subscribe((v) => (multiplierValue = v)),
		];
		return () => subs.forEach((u) => u());
	});

	// EC-Einheit aus localStorage (Single Source of Truth, geteilt mit Calc/DailyCheckin)
	let ciEcUnit: ECEinheit = $state(
		(typeof localStorage !== 'undefined' ? (localStorage.getItem('growbuddy_ec_unit') as ECEinheit | null) : null) ?? 'mS/cm'
	);
	$effect(() => {
		if (typeof localStorage !== 'undefined') localStorage.setItem('growbuddy_ec_unit', ciEcUnit);
	});

	/**
	 * Init-Snapshot: editingCi → Felder aus Check-in laden; sonst → Prefill aus letztem
	 * Check-in des Grows (Klima ändert sich langsam, tägliches Neutippen ist Reibung).
	 */
	function buildInit() {
		const ecUnit = ciEcUnit;
		const convEc = (ms: number | null) =>
			ms !== null ? +fromMsPerCm(ms, ecUnit).toFixed(ecUnit === 'mS/cm' ? 2 : 0) : null;
		if (editingCi) {
			const ci = editingCi;
			return {
				phase: ci.phase, week: ci.week, day: ci.day, weekDayManual: true,
				temp: ci.temp, rh: ci.rh, ec: convEc(ci.ec_measured), ph: ci.ph_measured,
				watered: ci.watered, nutrients: ci.nutrients_given,
				waterMl: ci.water_ml ?? null, nutrientMl: ci.nutrient_ml ?? null,
				// training: komma-getrennt gespeichert (Multi-Select) → Array
				training: ci.training ? ci.training.split(',').map((s) => s.trim()).filter(Boolean) : [],
				notes: ci.notes,
				photos: ci.photo_urls?.length ? [...ci.photo_urls]
					: ci.photos_data?.length ? [...ci.photos_data]
					: (ci.photo_url ? [ci.photo_url] : (ci.photo_data ? [ci.photo_data] : [])),
				more: true, prefilled: false,
			};
		}
		// Neuer Check-in: Prefill aus jüngstem Check-in dieses Grows
		const last = allCheckins
			.filter((c) => c.grow_id === grow.id)
			.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;
		return {
			phase: 'Veg', week: 1, day: 1, weekDayManual: false,
			temp: last?.temp ?? null, rh: last?.rh ?? null,
			ec: last ? convEc(last.ec_measured) : null, ph: last?.ph_measured ?? null,
			watered: false, nutrients: false, waterMl: null as number | null, nutrientMl: null as number | null,
			training: [] as string[], notes: '', photos: [] as string[],
			more: typeof localStorage !== 'undefined' && localStorage.getItem('growbuddy_ci_more') === '1',
			prefilled: !!last && (last.temp !== null || last.rh !== null || last.ec_measured !== null || last.ph_measured !== null),
		};
	}
	// svelte-ignore state_referenced_locally
	const init = buildInit();

	let ciPhase = $state(init.phase);
	let ciWeek = $state(init.week);
	let ciDay = $state(init.day);
	let ciWeekDayManual = $state(init.weekDayManual);
	let ciTemp = $state<number | null>(init.temp);
	let ciRh = $state<number | null>(init.rh);
	let ciEc = $state<number | null>(init.ec);
	let ciPh = $state<number | null>(init.ph);
	let ciWatered = $state(init.watered);
	let ciNutrients = $state(init.nutrients);
	let ciWaterMl = $state<number | null>(init.waterMl);
	let ciNutrientMl = $state<number | null>(init.nutrientMl);
	let ciTrainings = $state<string[]>(init.training);
	let ciNotes = $state(init.notes);
	let ciPhotos = $state<string[]>(init.photos);
	let ciMore = $state(init.more);
	let ciPrefilled = $state(init.prefilled);
	let compressing = $state(false);
	// v1.4.8: Success-Burst beim Submit (kurze ✓-Animation vor onDone)
	let submitSuccess = $state(false);

	// Auto-Berechnung Phase/Woche/Tag (Lauri-Logik) — nur neuer Check-in, bis User manuell eingreift
	$effect(() => {
		if (editingCi || ciWeekDayManual) return;
		const pos = currentPhasePosition(grow, allCheckins);
		ciPhase = pos.phase;
		ciWeek = pos.week;
		ciDay = pos.day;
	});

	let ciEcStep = $derived(ciEcUnit === 'mS/cm' ? '0.1' : '10');
	let ciEcPlaceholder = $derived(ciEcUnit === 'mS/cm' ? '1.5' : ciEcUnit === 'ppm500' ? '750' : '1050');

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
		ciVpd === null ? 'var(--color-gb-text-dim)' : 'var(--color-gb-danger)'
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

	const CI_PHASES = ['Seedling', 'Veg', 'Bloom', 'Flush', 'Dry', 'Cure'];
	const CI_TRAININGS = ['LST', 'Topping', 'FIM', 'ScrOG', 'Defoliation'];
	const CI_EC_OPTS: { v: ECEinheit; l: string }[] = [
		{ v: 'mS/cm', l: 'mS/cm' },
		{ v: 'ppm500', l: 'ppm·500' },
		{ v: 'ppm700', l: 'ppm·700' },
	];

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
			const { images, errors } = await compressBatch(files);
			// Original-Dateien merken (1:1-Mapping nur sicher, wenn nichts fehlschlug) →
			// werden beim Speichern als Blob in IndexedDB abgelegt (Originalqualität, rein lokal).
			if (images.length === files.length) {
				for (let i = 0; i < images.length; i++) newFiles.set(images[i], files[i]);
			}
			if (images.length > 0) {
				ciPhotos = [...ciPhotos, ...images].slice(0, MAX_PHOTOS);
			}
			if (errors.length > 0) {
				toastStore.error(`${errors.length} Foto${errors.length > 1 ? 's' : ''} fehlgeschlagen: ${errors[0]}`);
				console.error('[CheckInForm] Foto-Errors:', errors);
			}
		} catch (e: any) {
			toastStore.error('Foto-Upload: ' + (e?.message ?? e?.name ?? 'unbekannter Fehler'));
			console.error('[CheckInForm] handlePhoto Exception:', e);
		} finally {
			compressing = false;
		}
	}

	function removePhoto(idx: number) {
		ciPhotos = ciPhotos.filter((_: string, i: number) => i !== idx);
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
	}

	// Original-Bilder (volle Qualität) → IndexedDB-Blobs. Map: Thumbnail-DataURL → Original-File.
	const newFiles = new Map<string, File>();

	/** Speichert Originale als Blob unter den photo_ids des gerade gespeicherten Check-ins. Best-effort. */
	async function storeOriginals(checkinId: string) {
		if (newFiles.size === 0) return;
		try {
			let ci: any = null;
			growStore.subscribe(s => { ci = s.checkins.find((c: any) => c.id === checkinId); })();
			const ids: string[] = ci?.photo_ids ?? [];
			const thumbs: string[] = ci?.photos_data ?? [];
			for (let i = 0; i < ids.length; i++) {
				const file = thumbs[i] ? newFiles.get(thumbs[i]) : undefined;
				if (file) await putOriginal(ids[i], file);
			}
		} catch { /* best-effort — Thumbnail bleibt Fallback */ }
	}

	async function submitCheckin() {
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
			training: ciTrainings.length > 0 ? ciTrainings.join(',') : null,
			notes: ciNotes.trim(),
		};

		let savedCheckinId: string;
		if (editingCi) {
			await growStore.updateCheckIn(editingCi.id, patch);
			savedCheckinId = editingCi.id;
		} else {
			savedCheckinId = await growStore.addCheckIn({ grow_id: grow.id, ...patch });
			const isFull = !!(validTemp && validRh && validEc && validPh);
			xpStore.awardCheckIn(ciPhotos.length > 0, isFull, multiplierValue);

			// v1.4.0: Streak-Milestones immer prüfen (vorher nur in DailyCheckin)
			// → konsistent egal ob Check-in aus Dashboard oder Grow-Detail kommt
			setTimeout(() => {
				let streakState: any;
				streakStore.subscribe((s) => (streakState = s))();
				let currentS: any;
				currentStreak.subscribe((s) => (currentS = s))();
				const pending = streakStore.pendingMilestones(streakState, currentS.current);
				for (const m of pending) {
					streakStore.markMilestone(m);
					xpStore.awardAchievement(`${m}-Tage-Streak`, m * 5);
				}
				streakStore.updateLongest(currentS.current);
			}, 100);
		}

		// Originale (volle Qualität) lokal als Blob ablegen — best-effort, nicht blockierend
		void storeOriginals(savedCheckinId);

		hapticSuccess();

		// Auto-Sync wenn eingeloggt
		let authState: any;
		authStore.subscribe((a) => (authState = a))();
		if (authState?.user) {
			let snapshot: any;
			growStore.subscribe((s) => (snapshot = s))();
			syncStore.push(authState.user.id, snapshot).catch(() => {});
		}

		// v1.4.8: Success-Burst → 350ms ✓ einblenden, dann onDone
		submitSuccess = true;
		setTimeout(() => {
			submitSuccess = false;
			onDone?.();
		}, 450);
	}
</script>

<div id="checkin-form" class="ci-form">
	<div class="ci-head">
		<h2>{editingCi ? 'Check-in bearbeiten' : tr('checkin.title')}</h2>
		<button type="button" onclick={() => onCancel?.()} class="ci-close" aria-label={tr('checkin.cancel')}>✕</button>
	</div>
	{#if editingCi}
		<div class="bg-gb-warning/10 border border-gb-warning/20 rounded-lg px-3 py-2 text-xs text-gb-warning flex items-center gap-2">
			<span>✏️</span>
			<span>Bearbeitest Check-in vom {formatDate(editingCi.created_at)} ({editingCi.phase} W{editingCi.week}T{editingCi.day})</span>
		</div>
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
			<span class="ci-sec-hint">{ciPrefilled ? '↺ aus letztem Check-in' : 'Temp · RH → VPD'}</span>
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
			<!-- v1.3.79: Hint wenn VPD nicht berechnet werden kann — User weiß sonst nicht warum der Cursor fehlt -->
			{#if ciVpd === null}
				<p class="ci-vpd-hint">Temp + RH eingeben für VPD-Berechnung</p>
			{/if}
		</div>
	</div>

	<!-- Disclosure (v1.3.79: nur EIN State-Indikator — vorher +/- LINKS + Chevron RECHTS waren redundant) -->
	<button type="button" class="ci-disc" onclick={() => {
		ciMore = !ciMore;
		if (typeof localStorage !== 'undefined') localStorage.setItem('growbuddy_ci_more', ciMore ? '1' : '0');
	}} aria-expanded={ciMore}>
		<div class="ci-disc-l">
			<div class="ci-disc-ico">{ciMore ? '−' : '+'}</div>
			<div>
				<div class="ci-disc-title">Mehr erfassen</div>
				<div class="ci-disc-sub">EC · pH · Gießen · Training · Notizen</div>
			</div>
		</div>
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
					{#each CI_TRAININGS as tName}
						<button type="button" class="ci-chip ci-accent" class:active={ciTrainings.includes(tName)}
							onclick={() => ciTrainings = ciTrainings.includes(tName) ? ciTrainings.filter((x) => x !== tName) : [...ciTrainings, tName]}>{tName}</button>
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

	<!-- Submit (v1.3.79: XP-Hint immer sichtbar bei neuen Check-ins, Bonus-Multiplier nur wenn aktiv) -->
	<button type="button" class="ci-cta" onclick={submitCheckin} disabled={submitSuccess}>
		{#if submitSuccess}
			<span class="burst-in" style="font-size: 22px;">✓</span> Gespeichert
		{:else}
			✓ {editingCi ? 'Änderungen speichern' : tr('checkin.save')}{#if !editingCi} · +{Math.round(10 * multiplierValue)} XP{#if multiplierValue > 1} <span class="ci-cta-bonus">({multiplierValue}× Streak)</span>{/if}{/if}
		{/if}
	</button>
</div>

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
		font-size: 18px; cursor: pointer; padding: 4px 8px;
		min-height: 44px; min-width: 44px; /* v1.3.79: 36→44 für WCAG-AA-Touch-Target */
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
	.ci-sec-hint { font-size: 11px; color: var(--color-gb-text-dim); }

	.ci-chip {
		/* v1.3.79: 36→44 für WCAG-AA Touch-Target; padding angepasst damit visuelle Größe ähnlich bleibt */
		min-height: 44px;
		padding: 10px 14px;
		border-radius: 999px;
		font-size: 13px;
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
		color: var(--color-gb-accent-light);
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
	.ci-input::placeholder { color: var(--color-gb-text-dim); }
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
	/* v1.3.79: VPD-Hint wenn Temp/RH fehlen */
	.ci-vpd-hint {
		margin: 8px 0 0;
		font-size: 11px;
		color: var(--color-gb-text-dim);
		text-align: center;
		font-style: italic;
	}
	.ci-scale {
		display: flex;
		justify-content: space-between;
		margin-top: 6px;
		font-size: 10px;
		color: var(--color-gb-text-dim);
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
	/* v1.3.79: .ci-chev entfernt — Chevron war redundant zum +/- Icon links. */
	/* v1.3.79: Streak-Bonus-Suffix im CTA — kleiner & dezenter als der XP-Hauptwert */
	.ci-cta-bonus {
		font-size: 11px;
		font-weight: 500;
		opacity: 0.75;
		margin-left: 2px;
	}

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
		padding: 10px 14px;
		font-size: 12px; font-weight: 500;
		color: var(--color-gb-text-muted);
		background: none; border: none;
		border-radius: 9px;
		min-height: 44px; min-width: 44px; /* v1.3.79: 36→44 für WCAG-AA */
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
		background: var(--color-gb-text-dim);
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
		color: var(--color-gb-accent-light);
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
		color: var(--color-gb-accent-light);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.ci-fp-link {
		font-size: 11px;
		color: var(--color-gb-accent-light);
		text-decoration: none;
		padding: 6px 8px;
		white-space: nowrap;
	}

	.ci-cta {
		width: 100%;
		min-height: 52px;
		background: var(--color-gb-green);
		color: var(--color-gb-bg);
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
