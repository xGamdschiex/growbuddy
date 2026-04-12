<script lang="ts">
	import { calcVPD, getVPDStatus, VPD_TARGETS, PHASE_LABELS } from '$lib/data/science';
	import { xpStore } from '$lib/stores/xp';
	xpStore.awardToolUse('vpd');

	let temp = $state(25);
	let rh = $state(60);
	let leafOffset = $state(-2);
	let phase = $state<string>('vegetative');

	let vpd = $derived(calcVPD(temp, rh, leafOffset));
	let status = $derived(getVPDStatus(vpd, phase));
	let target = $derived(VPD_TARGETS[phase]);

	const phases = Object.entries(VPD_TARGETS).map(([key, val]) => ({
		key,
		label: PHASE_LABELS[key as keyof typeof PHASE_LABELS] ?? key,
	}));

	function statusColor(s: string): string {
		if (s === 'optimal') return 'text-gb-green';
		if (s === 'low') return 'text-gb-info';
		return 'text-gb-danger';
	}

	function statusLabel(s: string): string {
		if (s === 'optimal') return 'Optimal';
		if (s === 'low') return 'Zu niedrig';
		return 'Zu hoch';
	}
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-6">
	<div>
		<h1 class="text-xl font-bold">VPD Rechner</h1>
		<p class="text-gb-text-muted text-sm">Vapor Pressure Deficit — Transpiration optimieren</p>
	</div>

	<!-- VPD Ergebnis -->
	<div class="bg-gb-surface rounded-xl p-6 text-center">
		<p class="text-5xl font-bold {statusColor(status)}">{vpd.toFixed(2)}</p>
		<p class="text-sm text-gb-text-muted mt-1">kPa</p>
		<p class="text-sm font-medium mt-2 {statusColor(status)}">{statusLabel(status)}</p>
		{#if target}
			<p class="text-xs text-gb-text-muted mt-1">Ziel: {target.min} – {target.max} kPa</p>
		{/if}
	</div>

	<!-- Phase -->
	<div>
		<label class="block text-sm text-gb-text-muted mb-2">Phase</label>
		<div class="grid grid-cols-2 gap-2">
			{#each phases as p}
				<button
					onclick={() => phase = p.key}
					class="px-3 py-2 rounded-lg text-sm transition-colors
						{phase === p.key ? 'bg-gb-green text-black font-semibold' : 'bg-gb-surface-2 text-gb-text-muted hover:text-gb-text'}"
				>
					{p.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Temperatur -->
	<div>
		<div class="flex justify-between text-sm mb-2">
			<span class="text-gb-text-muted">Lufttemperatur</span>
			<span class="font-medium">{temp}°C</span>
		</div>
		<input type="range" min="15" max="35" step="0.5" bind:value={temp}
			class="w-full accent-gb-green" />
		{#if target}
			<p class="text-xs text-gb-text-muted mt-1">Empfohlen: {target.temp_min}–{target.temp_max}°C</p>
		{/if}
	</div>

	<!-- Luftfeuchtigkeit -->
	<div>
		<div class="flex justify-between text-sm mb-2">
			<span class="text-gb-text-muted">Luftfeuchtigkeit</span>
			<span class="font-medium">{rh}%</span>
		</div>
		<input type="range" min="20" max="90" step="1" bind:value={rh}
			class="w-full accent-gb-green" />
		{#if target}
			<p class="text-xs text-gb-text-muted mt-1">Empfohlen: {target.rh_min}–{target.rh_max}%</p>
		{/if}
	</div>

	<!-- Blatt-Offset -->
	<div>
		<div class="flex justify-between text-sm mb-2">
			<span class="text-gb-text-muted">Blatt-Offset</span>
			<span class="font-medium">{leafOffset}°C</span>
		</div>
		<input type="range" min="-5" max="0" step="0.5" bind:value={leafOffset}
			class="w-full accent-gb-green" />
		<p class="text-xs text-gb-text-muted mt-1">Blatttemperatur = Luft {leafOffset}°C (Standard: -2°C)</p>
	</div>

	<!-- Info -->
	<div class="bg-gb-surface rounded-xl p-4 text-sm text-gb-text-muted space-y-2">
		<p><strong class="text-gb-text">Was ist VPD?</strong></p>
		<p>VPD misst das Dampfdruckdefizit — die Differenz zwischen dem Wasserdampf den die Luft halten kann und dem tatsächlichen Gehalt. Höherer VPD = mehr Transpiration = stärkerer Nährstofftransport.</p>
		<p><strong class="text-gb-text">Zu niedrig:</strong> Schimmelgefahr, schlechte Nährstoffaufnahme</p>
		<p><strong class="text-gb-text">Zu hoch:</strong> Pflanzen schließen Stomata, Wachstum stoppt</p>
	</div>
</div>
