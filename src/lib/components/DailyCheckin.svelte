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

	// Auto-select wenn nur ein Grow aktiv
	$effect(() => {
		if (!selectedGrowId && active.length === 1) selectedGrowId = active[0]!.id;
	});

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
	let ecStep = $derived(ecUnit === 'mS/cm' ? '0.1' : '10');
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

	let vpd = $derived(temp !== null && rh !== null ? calcVPD(temp, rh) : null);

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
</script>

<div class="bg-gb-surface rounded-xl p-4 space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="font-semibold">Täglicher Check-in</h2>
			{#if streakInfo.current > 0}
				<p class="text-xs text-gb-warning">🔥 {streakInfo.current}-Tage-Streak{#if multiplier > 1} · {multiplier}x XP{/if}</p>
			{/if}
		</div>
		{#if onCancel}
			<button onclick={onCancel} class="text-gb-text-muted text-sm" aria-label="Abbrechen">✕</button>
		{/if}
	</div>

	{#if active.length === 0}
		<div class="bg-gb-bg rounded-lg p-4 text-center">
			<p class="text-sm text-gb-text-muted mb-3">Noch kein aktiver Grow</p>
			<a href="/grow/new" class="inline-block bg-gb-green text-black font-semibold text-sm px-4 py-2 rounded-lg">
				Grow starten
			</a>
		</div>
	{:else}
		<!-- Grow-Auswahl wenn mehrere aktiv -->
		{#if active.length > 1 && !growId}
			<div>
				<label for="grow-select" class="block text-xs text-gb-text-muted mb-1">Grow auswählen</label>
				<select id="grow-select" bind:value={selectedGrowId}
					class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm">
					<option value="" disabled>— wähle —</option>
					{#each active as g}
						<option value={g.id}>{g.name} · {g.strain}</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if selectedGrow}
			<!-- Fotos (max 5) -->
			<div>
				<label class="block text-xs text-gb-text-muted mb-1">Fotos ({photos.length}/{MAX_PHOTOS}){compact ? ' (empfohlen)' : ''}</label>
				{#if photos.length > 0}
					<div class="grid grid-cols-3 gap-1 mb-2">
						{#each photos as src, idx}
							<div class="relative">
								<img {src} alt="Foto {idx + 1}" class="aspect-square object-cover rounded-lg w-full" />
								<button type="button" onclick={() => removePhoto(idx)}
									class="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center leading-none">
									✕
								</button>
							</div>
						{/each}
					</div>
				{/if}
				{#if photos.length < MAX_PHOTOS}
					<label class="block w-full bg-gb-bg border border-dashed border-gb-border rounded-lg p-3 text-center text-sm text-gb-text-muted cursor-pointer hover:border-gb-green transition-colors {compressing ? 'opacity-60 pointer-events-none' : ''}">
						{compressing ? '⏳ Verarbeite…' : `📸 ${photos.length === 0 ? 'Foto aufnehmen' : 'Weiteres Foto'}`}
						<input type="file" accept="image/*" multiple onchange={handlePhoto} class="hidden" disabled={compressing} />
					</label>
				{/if}
			</div>

			<!-- Phase/Week/Day -->
			<div class="grid grid-cols-3 gap-2">
				<div>
					<label for="ci-phase" class="block text-xs text-gb-text-muted mb-1">Phase</label>
					<select id="ci-phase" bind:value={phase} class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm">
						{#each ['Seedling', 'Veg', 'Bloom', 'Flush', 'Dry', 'Cure'] as p}
							<option>{p}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="ci-week" class="block text-xs text-gb-text-muted mb-1">Woche{weekDayManual ? '' : ' (auto)'}</label>
					<input id="ci-week" type="number" bind:value={week} oninput={() => weekDayManual = true} min="1" max="30"
						class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm" />
				</div>
				<div>
					<label for="ci-day" class="block text-xs text-gb-text-muted mb-1">Tag{weekDayManual ? '' : ' (auto)'}</label>
					<input id="ci-day" type="number" bind:value={day} oninput={() => weekDayManual = true} min="1" max="7"
						class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm" />
				</div>
			</div>

			<!-- Messwerte -->
			<div class="grid grid-cols-2 gap-2">
				<div>
					<label for="ci-temp" class="block text-xs text-gb-text-muted mb-1">Temp °C</label>
					<input id="ci-temp" type="number" bind:value={temp} step="0.5" min="0" max="50" placeholder="25"
						class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm placeholder:text-gb-border" />
				</div>
				<div>
					<label for="ci-rh" class="block text-xs text-gb-text-muted mb-1">RH %</label>
					<input id="ci-rh" type="number" bind:value={rh} step="1" min="0" max="100" placeholder="60"
						class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm placeholder:text-gb-border" />
				</div>
				{#if !compact}
					<div>
						<label for="ci-ec" class="block text-xs text-gb-text-muted mb-1">EC ({ecUnit})</label>
						<input id="ci-ec" type="number" bind:value={ec} step={ecStep} min="0" placeholder={ecPlaceholder}
							class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm placeholder:text-gb-border" />
					</div>
					<div>
						<label for="ci-ph" class="block text-xs text-gb-text-muted mb-1">pH</label>
						<input id="ci-ph" type="number" bind:value={ph} step="0.1" min="0" max="14" placeholder="6.0"
							class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm placeholder:text-gb-border" />
					</div>
				{/if}
			</div>

			{#if !compact}
				<!-- EC-Einheit Selector -->
				<div>
					<span class="block text-xs text-gb-text-muted mb-1">EC-Einheit</span>
					<div class="grid grid-cols-3 gap-2">
						{#each [{v:'mS/cm',l:'mS/cm'},{v:'ppm500',l:'ppm (500)'},{v:'ppm700',l:'ppm (700)'}] as opt}
							<button type="button" onclick={() => ecUnit = opt.v as ECEinheit}
								class="px-2 py-1.5 rounded-lg text-xs font-medium border {ecUnit === opt.v ? 'bg-gb-green/20 border-gb-green text-gb-green' : 'bg-gb-bg border-gb-border text-gb-text-muted'}">{opt.l}</button>
						{/each}
					</div>
				</div>
			{/if}

			{#if vpd !== null}
				<div class="bg-gb-bg rounded-lg p-2 text-center text-sm">
					VPD: <span class="font-bold {getVPDStatus(vpd, phase.toLowerCase() === 'veg' ? 'vegetative' : 'early_flower') === 'optimal' ? 'text-gb-green' : 'text-gb-warning'}">{vpd.toFixed(2)} kPa</span>
				</div>
			{/if}

			{#if !compact}
				<!-- Toggles -->
				<div class="flex gap-3">
					<label class="flex items-center gap-2 bg-gb-bg rounded-lg px-3 py-2 flex-1">
						<input type="checkbox" bind:checked={watered} class="accent-gb-green" />
						<span class="text-sm">Gegossen</span>
					</label>
					<label class="flex items-center gap-2 bg-gb-bg rounded-lg px-3 py-2 flex-1">
						<input type="checkbox" bind:checked={nutrients} class="accent-gb-green" />
						<span class="text-sm">Gedüngt</span>
					</label>
				</div>

				<!-- Mengen -->
				{#if watered || nutrients}
					<div class="grid grid-cols-2 gap-2">
						{#if watered}
							<div>
								<label class="block text-xs text-gb-text-muted mb-1">Wasser (mL)</label>
								<input type="number" bind:value={waterMl} min="0" step="100" placeholder="1000"
									class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm placeholder:text-gb-border" />
							</div>
						{/if}
						{#if nutrients}
							<div>
								<label class="block text-xs text-gb-text-muted mb-1">Dünger (mL)</label>
								<input type="number" bind:value={nutrientMl} min="0" step="1" placeholder="10"
									class="w-full bg-gb-bg border border-gb-border rounded-lg px-2 py-2 text-sm placeholder:text-gb-border" />
							</div>
						{/if}
					</div>
				{/if}

				<!-- Training -->
				<div>
					<span class="block text-xs text-gb-text-muted mb-1">Training</span>
					<div class="flex flex-wrap gap-2">
						{#each ['LST', 'Topping', 'FIM', 'ScrOG', 'Defoliation'] as t}
							<button type="button" onclick={() => training = training === t ? null : t}
								class="px-3 py-1.5 rounded-lg text-xs transition-colors
									{training === t ? 'bg-gb-accent text-white' : 'bg-gb-bg text-gb-text-muted'}">
								{t}
							</button>
						{/each}
					</div>
				</div>

				<!-- Notizen -->
				<div>
					<label for="ci-notes" class="block text-xs text-gb-text-muted mb-1">Notizen</label>
					<textarea id="ci-notes" bind:value={notes} rows="2" placeholder="Beobachtungen..."
						class="w-full bg-gb-bg border border-gb-border rounded-lg px-3 py-2 text-sm placeholder:text-gb-border resize-none"></textarea>
				</div>
			{/if}

			<!-- Submit -->
			<button type="button" onclick={submit} disabled={submitting}
				class="w-full bg-gb-green text-black font-semibold py-3 rounded-lg text-sm hover:bg-gb-green-light transition-colors disabled:opacity-60">
				{alreadyToday ? '✓ Weiteren Check-in speichern' : '✓ Check-in speichern'}
			</button>
		{/if}
	{/if}
</div>
