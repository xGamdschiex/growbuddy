<script lang="ts">
	/**
	 * DailyCheckin — Wrapper für CheckInForm mit Grow-Selector + Streak-Header.
	 *
	 * v1.4.0: Aus 1012 Zeilen Code-Duplikat zu Thin-Wrapper (~120 Zeilen).
	 * CheckInForm ist die kanonische Implementation, DailyCheckin reichert nur an:
	 *  - Grow-Selector (wenn keine growId Prop + mehrere Grows aktiv)
	 *  - Streak-Pill im Header (Dashboard-Kontext)
	 *  - Streak-Milestone-XP nach erfolgreichem Check-in
	 *
	 * Wird nur vom Dashboard genutzt. grow/[id] nutzt CheckInForm direkt.
	 */
	import { growStore, activeGrows } from '$lib/stores/grow';
	import { currentStreak, streakMultiplier, hasCheckinToday } from '$lib/stores/streak';
	import { toastStore } from '$lib/stores/toast';
	import type { Grow, CheckIn } from '$lib/stores/grow';
	import CheckInForm from './CheckInForm.svelte';
	import { onMount } from 'svelte';

	interface Props {
		/** Optional: fester Grow. Wenn leer → User wählt aus aktiven Grows */
		growId?: string;
		/** Called nach erfolgreichem Check-in */
		onDone?: () => void;
		/** Called bei Abbrechen */
		onCancel?: () => void;
		/** Compact-Mode (durchgereicht an CheckInForm) — derzeit ohne Funktion, für API-Kompat. */
		compact?: boolean;
	}

	let { growId, onDone, onCancel }: Props = $props();

	let active: Grow[] = $state([]);
	let allCheckins: CheckIn[] = $state([]);
	let multiplier = $state(1);
	let streakInfo = $state({ current: 0, graceActive: false, lastCheckinDate: null as string | null });
	let alreadyToday = $state(false);

	onMount(() => {
		const subs = [
			activeGrows.subscribe(v => active = v),
			growStore.subscribe(v => allCheckins = v.checkins),
			streakMultiplier.subscribe(v => multiplier = v),
			currentStreak.subscribe(v => streakInfo = v),
			hasCheckinToday.subscribe(v => alreadyToday = v),
		];
		return () => subs.forEach(u => u());
	});

	// svelte-ignore state_referenced_locally
	let selectedGrowId = $state(growId ?? '');
	let selectedGrow = $derived(active.find(g => g.id === selectedGrowId));

	// Auto-select wenn nur ein Grow aktiv
	$effect(() => {
		if (!selectedGrowId && active.length === 1) selectedGrowId = active[0]!.id;
	});

	function cycleGrow() {
		if (active.length < 2) return;
		const i = active.findIndex(g => g.id === selectedGrowId);
		selectedGrowId = active[(i + 1) % active.length].id;
	}

	let today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'short' });

	/**
	 * Nach erfolgreichem Check-in: Toast (XP/Sync/Streak-Milestones laufen in CheckInForm).
	 */
	function handleDone() {
		toastStore.success('Check-in gespeichert');
		onDone?.();
	}
</script>

<div class="dc-root">
	{#if active.length === 0}
		<div class="dc-empty">
			<p class="dc-muted">Noch kein aktiver Grow</p>
			<a href="/grow/new" class="dc-cta-link">Grow starten</a>
		</div>
	{:else if selectedGrow}
		<!-- Header mit Streak + Date -->
		<div class="dc-head">
			<div>
				<h2>Check-in</h2>
				<div class="dc-sub">{today}</div>
			</div>
			<div class="dc-head-right">
				{#if streakInfo.current > 0}
					<span class="dc-streak">🔥 {streakInfo.current}T{#if multiplier > 1} · {multiplier}×{/if}</span>
				{/if}
				{#if alreadyToday}
					<span class="dc-already">✓ heute</span>
				{/if}
			</div>
		</div>

		<!-- Grow-Wechsler (nur wenn mehrere aktive + nicht fest) -->
		{#if active.length > 1 && !growId}
			<button type="button" class="dc-switcher" onclick={cycleGrow}>
				<span class="dc-switcher-l">
					<span class="dc-switcher-name">{selectedGrow.name}</span>
					<span class="dc-switcher-strain">· {selectedGrow.strain}</span>
				</span>
				<span class="dc-switcher-act">wechseln →</span>
			</button>
		{/if}

		<!-- Form (kanonisch in CheckInForm) -->
		<CheckInForm grow={selectedGrow} allCheckins={allCheckins} onDone={handleDone} {onCancel} />
	{/if}
</div>

<style>
	.dc-root {
		display: flex;
		flex-direction: column;
		gap: 12px;
		color: var(--color-gb-text);
	}
	.dc-empty {
		background: var(--color-gb-surface);
		border-radius: 16px;
		padding: 20px;
		text-align: center;
	}
	.dc-muted { color: var(--color-gb-text-muted); margin: 0 0 12px; font-size: 14px; }
	.dc-cta-link {
		display: inline-flex;
		min-height: 44px;
		padding: 0 24px;
		align-items: center;
		justify-content: center;
		background: var(--color-gb-green);
		color: var(--color-gb-bg);
		font-weight: 700;
		font-size: 15px;
		border-radius: 14px;
		text-decoration: none;
	}

	.dc-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 2px;
	}
	.dc-head h2 {
		margin: 0;
		font-size: 22px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.dc-sub {
		font-size: 12px;
		color: var(--color-gb-text-muted);
		margin-top: 2px;
	}
	.dc-head-right { display: flex; align-items: center; gap: 8px; }
	.dc-streak {
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
	.dc-already {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: rgba(34, 197, 94, 0.12);
		border: 1px solid rgba(34, 197, 94, 0.3);
		color: var(--color-gb-green);
		padding: 4px 10px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 600;
	}

	.dc-switcher {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 14px;
		background: var(--color-gb-surface);
		border: 1px solid var(--color-gb-border);
		border-radius: 12px;
		color: var(--color-gb-text);
		font-family: inherit;
		cursor: pointer;
		min-height: 44px;
		text-align: left;
		width: 100%;
	}
	.dc-switcher-l { display: flex; gap: 4px; align-items: baseline; min-width: 0; }
	.dc-switcher-name { font-size: 14px; font-weight: 600; }
	.dc-switcher-strain { font-size: 12px; color: var(--color-gb-text-muted); }
	.dc-switcher-act {
		font-size: 11px;
		color: var(--color-gb-text-muted);
		white-space: nowrap;
	}
</style>
