<script lang="ts">
	/**
	 * Grow bearbeiten — alle Setup-Felder nachträglich änderbar.
	 *
	 * Felder NICHT änderbar hier:
	 *  - status (Active/Harvested/Abandoned) → separater Flow im Grow-Detail (Ernten/Abbrechen)
	 *  - is_public → separater Toggle im Grow-Detail
	 *  - grow_score (auto) / yield_g (durch confirmHarvest)
	 */
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { growStore } from '$lib/stores/grow';
	import { isPro } from '$lib/stores/pro';
	import { t } from '$lib/i18n';
	import { onMount } from 'svelte';
	import { getAllFeedLines } from '$lib/calc/feedlines/registry';
	import type { StrainType, GrowSystem, Grow, GrowStrainEntry } from '$lib/stores/grow';
	import type { Medium } from '$lib/data/science';
	import { hapticSuccess, hapticMedium } from '$lib/utils/haptic';
	import { toastStore } from '$lib/stores/toast';
	import type { GrowStatus } from '$lib/stores/grow';
	import StrainList from '$lib/components/StrainList.svelte';
	import SpacePicker from '$lib/components/SpacePicker.svelte';
	import { getStrainEntries, joinedStrainName, totalPlantCount, validateStrains } from '$lib/utils/grow-strains';
	import { householdStore } from '$lib/stores/household';
	import { plantLimit } from '$lib/utils/compliance';

	let tr: (key: string, params?: Record<string, string | number>) => string = $state((k: string) => k);
	const feedlines = getAllFeedLines();

	let growId = $derived($page.params.id);
	let growState: any = $state({ grows: [], checkins: [] });
	let userIsPro = $state(false);
	let adults = $state(1);

	let grow = $derived<Grow | undefined>(growState?.grows?.find((g: Grow) => g.id === growId));
	let checkinCount = $derived(growState?.checkins?.filter((c: any) => c.grow_id === growId).length ?? 0);

	// Form-State (wird aus grow gefüllt sobald geladen)
	let name = $state('');
	let strainEntries = $state<GrowStrainEntry[]>([{ strain: '', plant_count: 1 }]);
	let strainType = $state<StrainType>('photo');
	let medium = $state<Medium>('coco');
	let space = $state('60x60');
	let feedlineId = $state('athena-pro');
	let lightInfo = $state('');
	let notes = $state('');
	let startDate = $state(new Date().toISOString().slice(0, 10));
	let system = $state<GrowSystem>('topf');
	let cocoPerliteRatio = $state(70);
	let status = $state<GrowStatus>('active');
	let yieldG = $state(0);
	let loaded = $state(false);

	let strainsValid = $derived(validateStrains(strainEntries));
	let showDeleteConfirm = $state(false);

	// Compliance: andere aktive Grows + aktuell editierte Anzahl vs. Limit (3 × Erwachsene, §9 KCanG)
	let otherActivePlants = $derived(
		(growState?.grows ?? [])
			.filter((g: Grow) => g.status === 'active' && g.id !== growId)
			.reduce((s: number, g: Grow) => s + (g.plant_count || 0), 0)
	);
	let editedPlants = $derived(strainEntries.reduce((s, e) => s + (e.plant_count > 0 ? e.plant_count : 0), 0));
	let plantLimitTotal = $derived(plantLimit(adults));
	let wouldExceedLimit = $derived(status === 'active' && (otherActivePlants + editedPlants) > plantLimitTotal);

	onMount(() => {
		const subs = [
			t.subscribe(v => tr = v),
			growStore.subscribe(v => growState = v),
			isPro.subscribe(v => userIsPro = v),
			householdStore.subscribe(v => adults = v.adults),
		];
		return () => subs.forEach(u => u());
	});

	// Form-State aus grow-Daten füllen (einmal beim ersten Laden)
	$effect(() => {
		if (grow && !loaded) {
			name = grow.name ?? '';
			// Multi-Strain: aus grow.strains laden oder aus Legacy synthesisieren
			const existing = getStrainEntries(grow);
			strainEntries = existing.length > 0 ? existing.map(e => ({ ...e })) : [{ strain: grow.strain ?? '', plant_count: grow.plant_count ?? 1 }];
			strainType = grow.strain_type ?? 'photo';
			medium = (grow.medium as Medium) ?? 'coco';
			space = grow.space ?? '60x60';
			feedlineId = grow.feedline_id ?? 'athena-pro';
			lightInfo = grow.light_info ?? '';
			notes = grow.notes ?? '';
			startDate = grow.started_at ? new Date(grow.started_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
			system = (grow.system as GrowSystem) ?? 'topf';
			cocoPerliteRatio = grow.coco_perlite_ratio ?? 70;
			status = (grow.status as GrowStatus) ?? 'active';
			yieldG = grow.yield_g ?? 0;
			loaded = true;
		}
	});

	let originalStartDate = $derived(grow?.started_at ? new Date(grow.started_at).toISOString().slice(0, 10) : null);
	let startDateChanged = $derived(originalStartDate && startDate !== originalStartDate);

	function selectSystem(s: GrowSystem) {
		if (s !== 'topf' && !userIsPro) {
			toastStore.error('Hydro-Systeme sind Pro-Feature');
			return;
		}
		system = s;
	}

	function saveGrow() {
		if (!grow) return;
		if (!strainsValid.ok) {
			toastStore.error(strainsValid.error ?? 'Strain-Liste ungültig');
			return;
		}
		const cleanedEntries = strainEntries.filter(e => e.strain && e.strain.trim() && e.plant_count > 0)
			.map(e => ({
				strain: e.strain.trim(),
				plant_count: e.plant_count,
				// flowering_weeks pro Strain mitspeichern (sonst geht die Blütezeit-Eingabe verloren)
				...(typeof e.flowering_weeks === 'number' && e.flowering_weeks > 0
					? { flowering_weeks: e.flowering_weeks }
					: {}),
			}));
		const joinedStrain = joinedStrainName(cleanedEntries);
		const totalPlants = totalPlantCount({ strain: joinedStrain, plant_count: 0, strains: cleanedEntries });
		const patch: any = {
			name: name.trim() || `${cleanedEntries[0].strain} #1`,
			strain: joinedStrain,
			strain_type: strainType,
			medium,
			space,
			feedline_id: feedlineId,
			light_info: lightInfo.trim(),
			plant_count: totalPlants,
			strains: cleanedEntries,
			notes: notes.trim(),
			system,
			coco_perlite_ratio: medium === 'coco' ? cocoPerliteRatio : undefined,
			started_at: new Date(startDate).toISOString(),
			status,
			yield_g: status === 'harvested' ? yieldG : null,
		};
		// Wenn Status auf 'active' zurückgesetzt wird → harvested_at clearen
		if (status === 'active' && grow.status !== 'active') {
			patch.harvested_at = null;
		}
		growStore.updateGrow(grow.id, patch);
		hapticSuccess();
		toastStore.success('Grow aktualisiert');
		goto(`/grow/${grow.id}`);
	}

	function cancel() {
		goto(`/grow/${growId}`);
	}

	function confirmDelete() {
		if (!grow) return;
		growStore.deleteGrow(grow.id);
		hapticMedium();
		toastStore.success(`Grow „${grow.name}" gelöscht`);
		goto('/grow');
	}
</script>

<svelte:head>
	<title>Grow bearbeiten — GrowBuddy</title>
</svelte:head>

{#if !grow}
	<div class="px-4 pt-6 max-w-lg mx-auto text-center">
		<p class="text-gb-text-muted">{tr('grow.not_found')}</p>
		<a href="/grow" class="text-gb-green text-sm">{tr('grow.back')}</a>
	</div>
{:else}
	<div class="px-4 pt-6 max-w-lg mx-auto space-y-5 pb-24">
		<div>
			<a href="/grow/{grow.id}" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; Zurück zum Grow</a>
			<h1 class="text-xl font-bold mt-2">✏️ Grow bearbeiten</h1>
			<p class="text-xs text-gb-text-muted mt-1">{checkinCount} Check-in{checkinCount === 1 ? '' : 's'} · Änderungen werden sofort übernommen</p>
		</div>

		<!-- Strains (Multi: pro Strain Name + Pflanzen-Anzahl + Blütezeit) -->
		<div>
			<span class="block text-xs text-gb-text-muted mb-2">Strain(s) + Anzahl Pflanzen *</span>
			<StrainList bind:entries={strainEntries} placeholder={tr('grow.strain_placeholder')} {strainType} />
		</div>

		<!-- Name (optional) -->
		<div>
			<label for="edit-name" class="block text-xs text-gb-text-muted mb-1">{tr('grow.name')}</label>
			<input id="edit-name" type="text" bind:value={name} placeholder={tr('grow.name_placeholder')}
				class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm placeholder:text-gb-border" />
		</div>

		<!-- Strain Type -->
		<div>
			<span class="block text-xs text-gb-text-muted mb-2">{tr('grow.type')}</span>
			<div class="grid grid-cols-2 gap-2">
				<button onclick={() => strainType = 'auto'}
					class="px-3 py-2.5 rounded-lg text-sm transition-colors
						{strainType === 'auto' ? 'bg-gb-green text-gb-bg font-semibold' : 'bg-gb-surface-2 text-gb-text-muted'}">
					{tr('general.auto')}
				</button>
				<button onclick={() => strainType = 'photo'}
					class="px-3 py-2.5 rounded-lg text-sm transition-colors
						{strainType === 'photo' ? 'bg-gb-green text-gb-bg font-semibold' : 'bg-gb-surface-2 text-gb-text-muted'}">
					{tr('general.photo')}
				</button>
			</div>
		</div>

		<!-- Medium -->
		<div>
			<span class="block text-xs text-gb-text-muted mb-2">{tr('grow.medium')}</span>
			<div class="grid grid-cols-3 gap-2">
				{#each [['soil', tr('grow.medium_soil')], ['coco', tr('grow.medium_coco')], ['hydro', tr('grow.medium_hydro')]] as [val, label]}
					<button onclick={() => medium = val as Medium}
						class="px-3 py-2.5 rounded-lg text-sm transition-colors
							{medium === val ? 'bg-gb-green text-gb-bg font-semibold' : 'bg-gb-surface-2 text-gb-text-muted'}">
						{label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Coco / Perlite -->
		{#if medium === 'coco'}
			<div>
				<label for="edit-cocoperlite" class="block text-xs text-gb-text-muted mb-2">
					Kokos/Perlite-Mix: <span class="text-gb-text">{cocoPerliteRatio}% Kokos · {100 - cocoPerliteRatio}% Perlite</span>
				</label>
				<input id="edit-cocoperlite" type="range" min="50" max="100" step="5" bind:value={cocoPerliteRatio}
					class="w-full accent-gb-green" />
			</div>
		{/if}

		<!-- System -->
		<div>
			<span class="block text-xs text-gb-text-muted mb-2">Anbausystem</span>
			<div class="grid grid-cols-2 gap-2">
				{#each [
					{ val: 'topf', label: '🪴 Topf' },
					{ val: 'autopot', label: '💧 AutoPot', pro: true },
					{ val: 'dwc', label: '🫧 DWC', pro: true },
					{ val: 'rdwc', label: '♻️ RDWC', pro: true }
				] as opt}
					<button onclick={() => selectSystem(opt.val as GrowSystem)}
						disabled={opt.pro && !userIsPro}
						class="px-3 py-2.5 rounded-lg text-sm text-left transition-colors
							{system === opt.val ? 'bg-gb-green text-gb-bg font-semibold' : 'bg-gb-surface-2 text-gb-text-muted'}
							{opt.pro && !userIsPro ? 'opacity-50 cursor-not-allowed' : ''}">
						<div class="flex items-center justify-between">
							<span>{opt.label}</span>
							{#if opt.pro && !userIsPro}
								<span class="text-[10px] bg-gb-accent/20 text-gb-accent px-1.5 py-0.5 rounded">PRO</span>
							{/if}
						</div>
					</button>
				{/each}
			</div>
		</div>

		<!-- Space (Preset oder Custom Größe) -->
		<div>
			<span class="block text-xs text-gb-text-muted mb-1">{tr('grow.space')}</span>
			<SpacePicker bind:value={space} />
		</div>

		<!-- Feedline -->
		<div>
			<label for="edit-feedline" class="block text-xs text-gb-text-muted mb-1">{tr('grow.feedline')}</label>
			<select id="edit-feedline" bind:value={feedlineId} class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm">
				{#each feedlines as fl}
					<option value={fl.id}>{fl.name}</option>
				{/each}
			</select>
		</div>

		<!-- Licht -->
		<div>
			<label for="edit-light" class="block text-xs text-gb-text-muted mb-1">{tr('grow.light')}</label>
			<input id="edit-light" type="text" bind:value={lightInfo} placeholder={tr('grow.light_placeholder')}
				class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm placeholder:text-gb-border" />
		</div>

		<!-- Notizen -->
		<div>
			<label for="edit-notes" class="block text-xs text-gb-text-muted mb-1">{tr('grow.notes')}</label>
			<textarea id="edit-notes" bind:value={notes} rows="2" placeholder={tr('grow.notes_placeholder')}
				class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm placeholder:text-gb-border resize-none"></textarea>
		</div>

		<!-- Startdatum -->
		<div>
			<label for="edit-startdate" class="block text-xs text-gb-text-muted mb-1">Startdatum</label>
			<input id="edit-startdate" type="date" bind:value={startDate} max={new Date().toISOString().slice(0, 10)}
				class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
			{#if startDateChanged}
				<p class="text-xs text-gb-warning mt-1 leading-relaxed">
					⚠️ Bei Änderung werden alle Phasen-Berechnungen (Tage in Phase, aktuelle Position, Harvest-Predict) neu berechnet.
				</p>
			{/if}
		</div>

		<!-- Status (Recovery falls aus Versehen geerntet/abgebrochen) -->
		<div>
			<span class="block text-xs text-gb-text-muted mb-2">Status</span>
			<div class="grid grid-cols-3 gap-2">
				{#each [
					{ val: 'active', label: '🌱 Aktiv', desc: 'läuft' },
					{ val: 'harvested', label: '✂️ Geerntet', desc: 'fertig' },
					{ val: 'abandoned', label: '❌ Abgebrochen', desc: 'verworfen' }
				] as opt}
					<button onclick={() => status = opt.val as GrowStatus}
						class="px-2 py-2 rounded-lg text-xs transition-colors
							{status === opt.val ? 'bg-gb-green text-gb-bg font-semibold' : 'bg-gb-surface-2 text-gb-text-muted'}">
						{opt.label}
					</button>
				{/each}
			</div>
			{#if status !== grow.status}
				<p class="text-xs text-gb-warning mt-1 leading-relaxed">
					⚠️ Status-Wechsel: {grow.status} → {status}
					{#if grow.status !== 'active' && status === 'active'}(Harvest-Datum + Yield werden gelöscht){/if}
				</p>
			{/if}
		</div>

		<!-- Yield (nur bei status=harvested) -->
		{#if status === 'harvested'}
			<div>
				<label for="edit-yield" class="block text-xs text-gb-text-muted mb-1">Ertrag (g, trocken)</label>
				<input id="edit-yield" type="number" bind:value={yieldG} min="0" max="9999" step="1"
					class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-2.5 text-sm" />
			</div>
		{/if}

		<!-- Compliance-Warnung: Pflanzen-Limit (Soft, blockiert nicht) -->
		{#if wouldExceedLimit}
			<div class="bg-gb-warning/10 border border-gb-warning/30 rounded-xl p-3">
				<p class="text-sm font-medium text-gb-warning">⚠️ Über dem Pflanzen-Limit</p>
				<p class="text-xs text-gb-text-muted mt-1 leading-relaxed">
					Insgesamt <strong>{otherActivePlants + editedPlants}</strong> lebende Pflanzen in aktiven Grows.
					In Deutschland sind max. <strong>{plantLimitTotal}</strong> erlaubt ({adults} × 3, §9 KCanG).
					Personen im Haushalt änderst du in den
					<a href="/settings" class="text-gb-green underline">Einstellungen</a>.
				</p>
			</div>
		{/if}

		<!-- Buttons -->
		<div class="grid grid-cols-2 gap-3 pt-2">
			<button onclick={cancel}
				class="bg-gb-surface border border-gb-border text-gb-text-muted font-medium py-3 rounded-lg text-sm
					hover:bg-gb-surface-2 transition-colors">
				Abbrechen
			</button>
			<button onclick={saveGrow}
				disabled={!strainsValid.ok}
				class="bg-gb-green text-gb-bg font-semibold py-3 rounded-lg text-sm
					hover:bg-gb-green-light transition-colors
					disabled:opacity-30 disabled:cursor-not-allowed">
				💾 Speichern
			</button>
		</div>

		<!-- Danger Zone: Grow löschen -->
		<div class="border-t border-gb-border/30 pt-4 mt-6">
			<p class="text-xs text-gb-text-muted uppercase tracking-wide font-semibold mb-2">⚠️ Danger Zone</p>
			<button onclick={() => showDeleteConfirm = true}
				class="w-full bg-gb-error/10 border border-gb-error/30 text-gb-error font-medium py-2.5 rounded-lg text-sm
					hover:bg-gb-error/20 transition-colors">
				🗑️ Grow löschen
			</button>
			<p class="text-[10px] text-gb-text-muted mt-1 leading-relaxed">
				Löscht den Grow + alle {checkinCount} Check-ins inkl. Fotos. Kann nicht rückgängig gemacht werden.
			</p>
		</div>

		<!-- Delete-Bestätigung Modal -->
		{#if showDeleteConfirm}
			<div class="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
				role="presentation" onclick={() => showDeleteConfirm = false}>
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<div class="bg-gb-surface rounded-xl p-5 max-w-md w-full"
					role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()}>
					<h3 class="text-lg font-bold mb-3">🗑️ Grow „{grow.name}" wirklich löschen?</h3>
					<p class="text-sm text-gb-text-muted mb-4 leading-relaxed">
						{checkinCount} Check-in{checkinCount === 1 ? '' : 's'} + alle Fotos + Notizen werden permanent gelöscht.
						<strong class="text-gb-text">Diese Aktion kann nicht rückgängig gemacht werden.</strong>
					</p>
					<div class="grid grid-cols-2 gap-3">
						<button onclick={() => showDeleteConfirm = false}
							class="bg-gb-surface-2 border border-gb-border text-gb-text-muted font-medium py-2.5 rounded-lg text-sm
								hover:bg-gb-surface transition-colors">
							Abbrechen
						</button>
						<button onclick={confirmDelete}
							class="bg-gb-error text-white font-semibold py-2.5 rounded-lg text-sm
								hover:bg-gb-error/80 transition-colors">
							🗑️ Endgültig löschen
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}
