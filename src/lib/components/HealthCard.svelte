<script lang="ts">
	/**
	 * HealthCard — 3 Health-KPIs (Konsistenz · VPD optimal · letzter Check-in) als
	 * tappbare Buttons mit Erklärungs-Modal.
	 *
	 * Geteilt von grow/[id] + grow/[id]/stats (v1.3.73 — vorher dupliziert).
	 * Rendert nichts wenn `consistency` null ist.
	 */
	import type { ConsistencyStats, StressCount } from '$lib/utils/grow-stats';

	interface Props {
		consistency: ConsistencyStats | null;
		vpdStress: StressCount;
	}
	let { consistency, vpdStress }: Props = $props();

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
</script>

{#if consistency}
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
