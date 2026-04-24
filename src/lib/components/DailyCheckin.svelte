<script lang="ts">
	/**
	 * DailyCheckin — Modal/Inline-Formular für täglichen Check-in.
	 * Wird vom Dashboard (Quick-Checkin) und grow/[id] (Full-Checkin) genutzt.
	 */
	import { growStore, activeGrows } from '$lib/stores/grow';
	import { authStore } from '$lib/stores/auth';
	import { syncStore } from '$lib/stores/sync';
	import { streakStore, currentStreak, streakMultiplier, hasCheckinToday, STREAK_MILESTONES } from '$lib/stores/streak';
	import { xpStore } from '$lib/stores/xp';
	import { toastStore } from '$lib/stores/toast';
	import { hapticSuccess } from '$lib/utils/haptic';
	import { calcVPD, getVPDStatus } from '$lib/data/science';
	import { clampNumber } from '$lib/utils/validation';
	import { toMsPerCm, type ECEinheit } from '$lib/calc/units';
	import { compressBatch, MAX_PHOTOS } from '$lib/utils/photo';
	import { getFeedLine } from '$lib/calc/feedlines/registry';
	import type { Grow } from '$lib/stores/grow';

	interface Props {
		/** Optional: fester Grow. Wenn leer → User wählt aus aktiven Grows */
		growId?: string;
		/** Called when check-in submitted successfully */
		onDone?: () => void;
		/** Called when user cancels */
		onCancel?: () => void;
		/** Compact-Mode: nur Essentials (Foto + Phase + Temp/RH) */
		compact?: boolean;
	}

	let { growId, onDone, onCancel, compact = false }: Props = $props();

	let active = $derived.by(() => { let v: Grow[] = []; activeGrows.subscribe(x => v = x)(); return v; });
	let multiplier = $derived.by(() => { let v = 1; streakMultiplier.subscribe(x => v = x)(); return v; });
	let streakInfo = $derived.by(() => { let v = { current: 0, graceActive: false, lastCheckinDate: null as string | null }; currentStreak.subscribe(x => v = x)(); return v; });
	let alreadyToday = $derived.by(() => { let v = false; hasCheckinToday.subscribe(x => v = x)(); return v; });

	let selectedGrowId = $state(growId ?? '');
	let selectedGrow = $derived(active.find(g => g.id === selectedGrowId));
	let feedlineLabel = $derived.by(() => {
		if (!selectedGrow?.feedline_id) return null;
		const line = getFeedLine(selectedGrow.feedline_id);
		return line ? `${line.name} · ${selectedGrow.medium}` : null;
	});

	// Auto-select wenn nur ein Grow aktiv
	$effect(() => {
		if (!selectedGrowId && active.length === 1) selectedGrowId = active[0]!.id;
	});

	function cycleGrow() {
		if (active.length < 2) return;
		const i = active.findIndex(g => g.id === selectedGrowId);
		selectedGrowId = active[(i + 1) % active.length].id;
	}

	// Form State
	let phase = $state('Veg');
	let week = $state(1);
	let day = $state(1);
	let weekDayManual = $state(false);

	// Auto-Berechnung aus started_at — User kann manuell overriden
	$effect(() => {
		if (!selectedGrow || weekDayManual) return;
		const started = new Date(selectedGrow.started_at).getTime();
		if (Number.isNaN(started)) return;
		const daysSince = Math.max(1, Math.floor((Date.now() - started) / 86400000) + 1);
		week = Math.max(1, Math.ceil(daysSince / 7));
		day = ((daysSince - 1) % 7) + 1;
	});
	let temp = $state<number | null>(null);
	let rh = $state<number | null>(null);
	let ec = $state<number | null>(null);
	let ecUnit = $state<ECEinheit>(
		(typeof localStorage !== 'undefined' ? (localStorage.getItem('growbuddy_ec_unit') as ECEinheit | null) : null) ?? 'mS/cm'
	);
	$effect(() => {
		if (typeof localStorage !== 'undefined') localStorage.setItem('growbuddy_ec_unit', ecUnit);
	});
	let ecStep = $derived(ecUnit === 'mS/cm' ? 0.1 : 10);
	let ecPlaceholder = $derived(ecUnit === 'mS/cm' ? '1.5' : ecUnit === 'ppm500' ? '750' : '1050');
	let ph = $state<number | null>(null);
	let watered = $state(false);
	let nutrients = $state(false);
	let waterMl = $state<number | null>(null);
	let nutrientMl = $state<number | null>(null);
	let training = $state<string | null>(null);
	let notes = $state('');
	let photos = $state<string[]>([]);
	let submitting = $state(false);
	let more = $state(false);

	let vpd = $derived(temp !== null && rh !== null ? calcVPD(temp, rh) : null);
	let vpdPhaseKey = $derived(phase === 'Bloom' || phase === 'Flush' ? 'early_flower' : 'vegetative');
	let vpdStatusVal = $derived(vpd !== null ? getVPDStatus(vpd, vpdPhaseKey) : 'idle');

	// VPD Zonen (nur für Gauge-Anzeige)
	let vpdZones = $derived(
		phase === 'Bloom' || phase === 'Flush'
			? { opt: [1.2, 1.6], warn: [0.8, 2.0] }
			: { opt: [0.8, 1.2], warn: [0.4, 1.6] }
	);
	const VPD_MIN = 0;
	const VPD_MAX = 2.5;
	function toPct(k: number) {
		return Math.max(0, Math.min(100, ((k - VPD_MIN) / (VPD_MAX - VPD_MIN)) * 100));
	}
	let vpdColor = $derived(
		vpdStatusVal === 'optimal' ? 'var(--color-gb-green)' :
		vpdStatusVal === 'warn' ? 'var(--color-gb-warning)' :
		vpd === null ? '#666' : 'var(--color-gb-danger)'
	);
	let vpdLabel = $derived(
		vpdStatusVal === 'optimal' ? 'optimal' :
		vpdStatusVal === 'warn' ? 'grenzwertig' :
		vpd === null ? '' : 'kritisch'
	);

	let compressing = $state(false);

	async function handlePhoto(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files?.length) return;
		const remaining = MAX_PHOTOS - photos.length;
		const all = Array.from(input.files);
		const files = all.slice(0, remaining);
		if (all.length > remaining) {
			toastStore.warning(`Max ${MAX_PHOTOS} Fotos — ${all.length - remaining} ignoriert`);
		}
		input.value = '';
		if (!files.length) return;
		compressing = true;
		try {
			const compressed = await compressBatch(files);
			photos = [...photos, ...compressed].slice(0, MAX_PHOTOS);
		} catch {
			toastStore.warning('Foto konnte nicht verarbeitet werden');
		} finally {
			compressing = false;
		}
	}

	function removePhoto(idx: number) {
		photos = photos.filter((_, i) => i !== idx);
	}

	function stepWeek(delta: number) {
		week = Math.max(1, Math.min(30, week + delta));
		weekDayManual = true;
	}
	function stepDay(delta: number) {
		day = Math.max(1, Math.min(7, day + delta));
		weekDayManual = true;
	}

	function submit() {
		if (!selectedGrow || submitting) return;
		submitting = true;

		// Input-Validation
		const validTemp = temp !== null ? clampNumber(temp, 0, 50) : null;
		const validRh = rh !== null ? clampNumber(rh, 0, 100) : null;
		const ecMs = ec !== null ? toMsPerCm(ec, ecUnit) : null;
		const validEc = ecMs !== null ? clampNumber(ecMs, 0, 5) : null;
		const validPh = ph !== null ? clampNumber(ph, 0, 14) : null;
		const validVpd = validTemp !== null && validRh !== null ? calcVPD(validTemp, validRh) : null;

		growStore.addCheckIn({
			grow_id: selectedGrow.id,
			phase,
			week,
			day,
			photo_data: photos[0] ?? null,
			photos_data: photos,
			temp: validTemp,
			rh: validRh,
			vpd: validVpd,
			ec_measured: validEc,
			ph_measured: validPh,
			watered,
			nutrients_given: nutrients,
			water_ml: waterMl,
			nutrient_ml: nutrientMl,
			training,
			notes: notes.trim(),
		});

		// XP mit Streak-Multiplier
		const hasPhoto = photos.length > 0;
		const isFull = !!(validTemp && validRh && validEc && validPh);
		xpStore.awardCheckIn(hasPhoto, isFull, multiplier);

		// Streak-Milestones prüfen (Streak ist nach diesem Check-in aktualisiert)
		setTimeout(() => {
			let streakState: any;
			streakStore.subscribe(s => streakState = s)();
			let currentS: any;
			currentStreak.subscribe(s => currentS = s)();

			const pending = streakStore.pendingMilestones(streakState, currentS.current);
			for (const m of pending) {
				streakStore.markMilestone(m);
				xpStore.awardAchievement(`${m}-Tage-Streak`, m * 5);
			}
			streakStore.updateLongest(currentS.current);
		}, 100);

		hapticSuccess();
		toastStore.success('Check-in gespeichert');

		// Auto-Sync wenn eingeloggt
		let authState: any;
		authStore.subscribe(a => authState = a)();
		if (authState?.user) {
			let growState: any;
			growStore.subscribe(s => growState = s)();
			syncStore.push(authState.user.id, growState).catch(() => {});
		}

		submitting = false;
		onDone?.();
	}

	const PHASES = ['Seedling', 'Veg', 'Bloom', 'Flush', 'Dry', 'Cure'];
	const TRAININGS = ['LST', 'Topping', 'FIM', 'ScrOG', 'Defoliation'];
	const EC_UNIT_OPTS: { v: ECEinheit; l: string }[] = [
		{ v: 'mS/cm', l: 'mS/cm' },
		{ v: 'ppm500', l: 'ppm·500' },
		{ v: 'ppm700', l: 'ppm·700' },
	];

	let today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'short' });
</script>

<div class="ci-root">
	{#if active.length === 0}
		<div class="card empty">
			<p class="muted">Noch kein aktiver Grow</p>
			<a href="/grow/new" class="cta cta-link">Grow starten</a>
		</div>
	{:else if selectedGrow}
		<!-- Header -->
		<div class="head">
			<div>
				<h2>Check-in</h2>
				<div class="sub">{today}</div>
			</div>
			<div class="head-right">
				{#if streakInfo.current > 0}
					<span class="streak">🔥 {streakInfo.current}T{#if multiplier > 1} · {multiplier}×{/if}</span>
				{/if}
				{#if onCancel}
					<button type="button" onclick={onCancel} class="close" aria-label="Abbrechen">✕</button>
				{/if}
			</div>
		</div>

		<!-- Grow-Card -->
		<div class="card grow-card">
			<div class="row between">
				<div class="grow-meta">
					<div class="title">{selectedGrow.name} · {selectedGrow.strain}</div>
					<div class="sub">Woche {week} · Tag {day}{!weekDayManual ? ' · auto' : ''}</div>
					{#if feedlineLabel}
						<div class="feedline-chip">
							<svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 2v6a6 6 0 1 0 12 0V2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 8h12" stroke="currentColor" stroke-width="2"/></svg>
							{feedlineLabel}
						</div>
					{/if}
				</div>
				{#if active.length > 1 && !growId}
					<button type="button" class="chip" onclick={cycleGrow}>wechseln</button>
				{/if}
			</div>
		</div>

		<!-- Fotos -->
		<div class="card">
			<div class="sec-head">
				<span class="sec-title">Fotos</span>
				<span class="sec-hint">{photos.length}/{MAX_PHOTOS}{compact ? ' · empfohlen' : ''}</span>
			</div>
			<div class="photos">
				{#each photos as src, idx}
					<div class="photo">
						<img {src} alt="Foto {idx + 1}" />
						<button type="button" class="rm" onclick={() => removePhoto(idx)} aria-label="Foto entfernen">✕</button>
					</div>
				{/each}
				{#if photos.length < MAX_PHOTOS}
					<label class="photo add" class:busy={compressing}>
						{#if compressing}
							<span class="add-ico">⏳</span>
							<span>Lade…</span>
						{:else}
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 8l2-3h4l1-2h4l1 2h4l2 3v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="13" r="4" stroke="currentColor" stroke-width="1.5"/></svg>
							<span>{photos.length === 0 ? 'Foto' : '+'}</span>
						{/if}
						<input type="file" accept="image/*" multiple onchange={handlePhoto} disabled={compressing} />
					</label>
				{/if}
			</div>
		</div>

		<!-- Phase & Zeit -->
		<div class="card">
			<div class="sec-head"><span class="sec-title">Phase &amp; Zeit</span></div>
			<div class="chip-row">
				{#each PHASES as p}
					<button type="button" class="chip" class:active={phase === p} onclick={() => phase = p}>{p}</button>
				{/each}
			</div>
			<div class="grid-2 mt10">
				<div class="stepper">
					<button type="button" onclick={() => stepWeek(-1)} aria-label="Woche minus">−</button>
					<div class="val">{week}<small>Woche{weekDayManual ? '' : ' · auto'}</small></div>
					<button type="button" onclick={() => stepWeek(1)} aria-label="Woche plus">+</button>
				</div>
				<div class="stepper">
					<button type="button" onclick={() => stepDay(-1)} aria-label="Tag minus">−</button>
					<div class="val">{day}<small>Tag{weekDayManual ? '' : ' · auto'}</small></div>
					<button type="button" onclick={() => stepDay(1)} aria-label="Tag plus">+</button>
				</div>
			</div>
		</div>

		<!-- Klima -->
		<div class="card">
			<div class="sec-head">
				<span class="sec-title">Klima</span>
				<span class="sec-hint">Temp · RH → VPD</span>
			</div>
			<div class="grid-2 mb10">
				<label class="field">
					<span class="field-label">Temperatur °C</span>
					<input class="input" type="number" step="0.5" min="0" max="50" placeholder="25" bind:value={temp} />
				</label>
				<label class="field">
					<span class="field-label">Feuchte %</span>
					<input class="input" type="number" step="1" min="0" max="100" placeholder="60" bind:value={rh} />
				</label>
			</div>
			<div class="card-2 vpd">
				<div class="row between vpd-head">
					<span class="vpd-label">VPD · {phase === 'Bloom' || phase === 'Flush' ? 'Bloom' : 'Veg'}</span>
					<span class="vpd-val" style="color: {vpdColor}">
						{vpd === null ? '— kPa' : `${vpd.toFixed(2)} kPa`}
						{#if vpdLabel}<em class="vpd-state">· {vpdLabel}</em>{/if}
					</span>
				</div>
				<div class="gauge">
					<div class="gauge-crit"></div>
					<div class="gauge-warn" style="left: {toPct(vpdZones.warn[0])}%; width: {toPct(vpdZones.warn[1]) - toPct(vpdZones.warn[0])}%;"></div>
					<div class="gauge-opt" style="left: {toPct(vpdZones.opt[0])}%; width: {toPct(vpdZones.opt[1]) - toPct(vpdZones.opt[0])}%;"></div>
					{#if vpd !== null}
						<div class="gauge-cursor" style="left: calc({toPct(vpd)}% - 1.5px); background: {vpdColor}"></div>
					{/if}
				</div>
				<div class="scale">
					<span>0.0</span><span>0.5</span><span>1.0</span><span>1.5</span><span>2.0</span><span>2.5</span>
				</div>
			</div>
		</div>

		{#if !compact}
			<!-- Disclosure -->
			<button type="button" class="disc" onclick={() => more = !more}>
				<div class="disc-l">
					<div class="disc-ico">{more ? '−' : '+'}</div>
					<div>
						<div class="disc-title">Mehr erfassen</div>
						<div class="disc-sub">EC · pH · Gießen · Training · Notizen</div>
					</div>
				</div>
				<div class="chev">{more ? '▾' : '▸'}</div>
			</button>

			<div class="fold" style="max-height: {more ? '2000px' : '0'}; opacity: {more ? 1 : 0};">
				<div class="fold-inner">
					<!-- EC + pH -->
					<div class="card">
						<div class="sec-head">
							<span class="sec-title">Messwerte</span>
							<div class="seg">
								{#each EC_UNIT_OPTS as opt}
									<button type="button" class:on={ecUnit === opt.v} onclick={() => ecUnit = opt.v}>{opt.l}</button>
								{/each}
							</div>
						</div>
						<div class="grid-2">
							<label class="field">
								<span class="field-label">EC</span>
								<input class="input" type="number" step={ecStep} min="0" placeholder={ecPlaceholder} bind:value={ec} />
							</label>
							<label class="field">
								<span class="field-label">pH</span>
								<input class="input" type="number" step="0.1" min="0" max="14" placeholder="6.0" bind:value={ph} />
							</label>
						</div>
					</div>

					<!-- Gießen & Düngen -->
					<div class="card">
						<div class="sec-head"><span class="sec-title">Gießen &amp; Düngen</span></div>
						<div class="toggle-row">
							<button type="button" class="toggle-card" class:on={watered} onclick={() => watered = !watered}>
								<span>💧 Gegossen</span>
								<div class="sw" class:on={watered}></div>
							</button>
							<button type="button" class="toggle-card" class:on={nutrients} onclick={() => nutrients = !nutrients}>
								<span>🧪 Gedüngt</span>
								<div class="sw" class:on={nutrients}></div>
							</button>
						</div>
						{#if nutrients && feedlineLabel}
							<div class="feedline-panel">
								<div class="fp-l">
									<div class="fi">
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 2v6a6 6 0 1 0 12 0V2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 8h12" stroke="currentColor" stroke-width="2"/></svg>
									</div>
									<div class="fp-t">
										<div class="fp-cap">Düngerlinie</div>
										<div class="fp-name">{feedlineLabel}</div>
									</div>
								</div>
								<a href="/calc" class="fp-link">zu Calc →</a>
							</div>
						{/if}
						{#if watered || nutrients}
							<div class="grid-2 mt10">
								{#if watered}
									<label class="field">
										<span class="field-label">Wasser (mL)</span>
										<input class="input" type="number" min="0" step="100" placeholder="1000" bind:value={waterMl} />
									</label>
								{/if}
								{#if nutrients}
									<label class="field">
										<span class="field-label">Dünger (mL)</span>
										<input class="input" type="number" min="0" step="1" placeholder="10" bind:value={nutrientMl} />
									</label>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Training -->
					<div class="card">
						<div class="sec-head"><span class="sec-title">Training</span></div>
						<div class="chip-row wrap">
							{#each TRAININGS as t}
								<button type="button" class="chip accent" class:active={training === t} onclick={() => training = training === t ? null : t}>{t}</button>
							{/each}
						</div>
					</div>

					<!-- Notizen -->
					<div class="card">
						<div class="sec-head"><span class="sec-title">Notizen</span></div>
						<textarea class="input notes" rows="3" placeholder="Beobachtungen…" bind:value={notes}></textarea>
					</div>
				</div>
			</div>
		{/if}

		<!-- Submit -->
		<button type="button" class="cta" onclick={submit} disabled={submitting}>
			{alreadyToday ? '✓ Weiteren Check-in' : '✓ Check-in speichern'}{#if multiplier > 1} · +{Math.round(10 * multiplier)} XP{/if}
		</button>
	{/if}
</div>

<style>
	.ci-root {
		display: flex;
		flex-direction: column;
		gap: 12px;
		color: var(--color-gb-text);
	}

	.card {
		background: var(--color-gb-surface);
		border-radius: 16px;
		padding: 14px;
	}
	.card-2 {
		background: var(--color-gb-surface-2);
		border-radius: 12px;
		padding: 12px;
	}
	.empty { text-align: center; padding: 20px; }

	.row { display: flex; gap: 8px; align-items: center; }
	.row.between { justify-content: space-between; }
	.muted { color: var(--color-gb-text-muted); margin: 0 0 12px; font-size: 14px; }
	.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
	.mt10 { margin-top: 10px; }
	.mb10 { margin-bottom: 10px; }

	/* Header */
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 2px;
	}
	.head h2 {
		margin: 0;
		font-size: 22px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.head .sub {
		font-size: 12px;
		color: var(--color-gb-text-muted);
		margin-top: 2px;
	}
	.head-right { display: flex; align-items: center; gap: 8px; }
	.close {
		background: none; border: none; color: var(--color-gb-text-muted);
		font-size: 18px; cursor: pointer; padding: 4px 8px; min-height: 36px; min-width: 36px;
	}

	.streak {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: rgba(245, 158, 11, 0.12);
		border: 1px solid rgba(245, 158, 11, 0.3);
		color: var(--color-gb-warning);
		padding: 4px 10px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 600;
	}

	/* Grow card */
	.grow-card { padding: 10px 12px; }
	.grow-meta { min-width: 0; flex: 1; }
	.grow-meta .title { font-size: 13px; font-weight: 600; }
	.grow-meta .sub { font-size: 11px; color: var(--color-gb-text-muted); margin-top: 1px; }

	.feedline-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 3px 8px;
		background: rgba(168, 85, 247, 0.12);
		border: 1px solid rgba(168, 85, 247, 0.3);
		border-radius: 999px;
		font-size: 10px;
		color: #d8b4fe;
		font-weight: 500;
		margin-top: 6px;
	}

	/* Chips */
	.chip {
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
	.chip.active {
		background: rgba(34, 197, 94, 0.14);
		border-color: var(--color-gb-green);
		color: var(--color-gb-green);
	}
	.chip.accent.active {
		background: rgba(168, 85, 247, 0.16);
		border-color: var(--color-gb-accent);
		color: #d8b4fe;
	}
	.chip-row {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		padding-bottom: 2px;
	}
	.chip-row.wrap { flex-wrap: wrap; overflow: visible; }
	.chip-row::-webkit-scrollbar { display: none; }

	/* Section head */
	.sec-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 10px;
		gap: 8px;
	}
	.sec-title {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-gb-text-muted);
	}
	.sec-hint { font-size: 11px; color: #666; }

	/* Inputs */
	.field { display: flex; flex-direction: column; gap: 4px; }
	.field-label { font-size: 11px; color: var(--color-gb-text-muted); }
	.input {
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
	.input:focus {
		border-color: var(--color-gb-green);
		outline: none;
	}
	.input::placeholder { color: #555; }
	.input.notes { resize: none; min-height: 80px; }

	/* Stepper */
	.stepper {
		display: grid;
		grid-template-columns: 44px 1fr 44px;
		align-items: center;
		background: var(--color-gb-bg);
		border: 1px solid var(--color-gb-border);
		border-radius: 12px;
		overflow: hidden;
		min-height: 44px;
	}
	.stepper button {
		background: none;
		border: none;
		min-height: 44px;
		color: var(--color-gb-text-muted);
		font-size: 20px;
		font-weight: 300;
		cursor: pointer;
	}
	.stepper .val {
		text-align: center;
		font-size: 15px;
		font-weight: 600;
		color: var(--color-gb-text);
	}
	.stepper .val small {
		display: block;
		color: var(--color-gb-text-muted);
		font-size: 10px;
		font-weight: 500;
		margin-top: 1px;
	}

	/* Photos */
	.photos {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 6px;
	}
	.photo {
		aspect-ratio: 1;
		background: var(--color-gb-surface-2);
		border-radius: 10px;
		position: relative;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.photo .rm {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 22px;
		height: 22px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.65);
		color: white;
		font-size: 11px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		cursor: pointer;
	}
	.photo.add {
		border: 1.5px dashed var(--color-gb-border);
		background: transparent;
		color: var(--color-gb-text-muted);
		font-size: 10px;
		font-weight: 500;
		gap: 4px;
		flex-direction: column;
		min-height: 44px;
		cursor: pointer;
	}
	.photo.add:hover { border-color: var(--color-gb-green); color: var(--color-gb-green); }
	.photo.add.busy { opacity: 0.6; pointer-events: none; }
	.photo.add input { display: none; }
	.photo.add .add-ico { font-size: 16px; }

	/* VPD Gauge */
	.vpd { padding: 12px 14px; }
	.vpd-head { margin-bottom: 8px; }
	.vpd-label {
		font-size: 11px;
		color: var(--color-gb-text-muted);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.vpd-val { font-size: 14px; font-weight: 700; }
	.vpd-state {
		font-size: 10px;
		font-weight: 500;
		color: var(--color-gb-text-muted);
		margin-left: 6px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-style: normal;
	}
	.gauge {
		height: 6px;
		background: var(--color-gb-surface);
		border-radius: 999px;
		overflow: visible;
		position: relative;
	}
	.gauge-crit, .gauge-warn, .gauge-opt {
		position: absolute;
		top: 0;
		bottom: 0;
		border-radius: 999px;
	}
	.gauge-crit { inset: 0; background: var(--color-gb-danger); opacity: 0.35; }
	.gauge-warn { background: var(--color-gb-warning); opacity: 0.55; }
	.gauge-opt { background: var(--color-gb-green); opacity: 0.85; }
	.gauge-cursor {
		position: absolute;
		top: -3px;
		width: 3px;
		height: 12px;
		border-radius: 2px;
	}
	.scale {
		display: flex;
		justify-content: space-between;
		margin-top: 6px;
		font-size: 10px;
		color: #666;
	}

	/* Disclosure */
	.disc {
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
	.disc-l { display: flex; align-items: center; gap: 12px; }
	.disc-ico {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: var(--color-gb-surface-2);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-gb-text-muted);
		font-size: 18px;
	}
	.disc-title { font-size: 14px; font-weight: 500; }
	.disc-sub { font-size: 11px; color: var(--color-gb-text-muted); margin-top: 1px; }
	.chev { color: #555; font-size: 18px; }

	.fold {
		overflow: hidden;
		transition: max-height 0.25s ease, opacity 0.2s ease;
	}
	.fold-inner {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-top: 12px;
	}

	/* Segmented EC-Unit */
	.seg {
		display: inline-flex;
		background: var(--color-gb-bg);
		border: 1px solid var(--color-gb-border);
		border-radius: 12px;
		padding: 3px;
		gap: 2px;
	}
	.seg button {
		padding: 8px 12px;
		font-size: 12px;
		font-weight: 500;
		color: var(--color-gb-text-muted);
		background: none;
		border: none;
		border-radius: 9px;
		min-height: 36px;
		min-width: 44px;
		cursor: pointer;
		font-family: inherit;
	}
	.seg button.on {
		background: var(--color-gb-surface-2);
		color: var(--color-gb-text);
		box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	/* Toggle cards */
	.toggle-row { display: flex; gap: 8px; }
	.toggle-card {
		flex: 1;
		padding: 12px;
		background: var(--color-gb-surface-2);
		border: 1px solid transparent;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		color: var(--color-gb-text);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		font-family: inherit;
	}
	.toggle-card.on { border-color: var(--color-gb-green); }

	.sw {
		width: 40px;
		height: 24px;
		border-radius: 999px;
		background: var(--color-gb-surface-2);
		position: relative;
		border: 1px solid var(--color-gb-border);
		flex-shrink: 0;
		transition: background 0.15s ease;
	}
	.sw::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 18px;
		height: 18px;
		border-radius: 999px;
		background: #666;
		transition: all 0.15s ease;
	}
	.sw.on {
		background: rgba(34, 197, 94, 0.25);
		border-color: var(--color-gb-green);
	}
	.sw.on::after {
		left: 18px;
		background: var(--color-gb-green);
	}

	/* Feedline panel (bei nutrients) */
	.feedline-panel {
		padding: 8px 10px;
		background: rgba(168, 85, 247, 0.08);
		border: 1px solid rgba(168, 85, 247, 0.25);
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-top: 10px;
	}
	.fp-l { display: flex; align-items: center; gap: 8px; min-width: 0; }
	.fi {
		width: 28px; height: 28px;
		border-radius: 8px;
		background: rgba(168, 85, 247, 0.18);
		display: flex; align-items: center; justify-content: center;
		color: #d8b4fe;
		flex-shrink: 0;
	}
	.fp-t { min-width: 0; }
	.fp-cap {
		font-size: 10px;
		color: var(--color-gb-text-muted);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.fp-name {
		font-size: 13px;
		font-weight: 600;
		color: #e9d5ff;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.fp-link {
		font-size: 11px;
		color: #d8b4fe;
		text-decoration: none;
		padding: 6px 8px;
		white-space: nowrap;
	}

	/* CTA */
	.cta {
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
		box-shadow: 0 10px 30px -10px rgba(34, 197, 94, 0.55);
		font-family: inherit;
	}
	.cta:disabled { opacity: 0.6; cursor: not-allowed; }
	.cta:active:not(:disabled) { transform: scale(0.98); }
	.cta-link {
		text-decoration: none;
		display: inline-flex;
		width: auto;
		padding: 0 24px;
	}

	button:active:not(:disabled) { transform: scale(0.97); transition: transform 0.05s ease; }
</style>
