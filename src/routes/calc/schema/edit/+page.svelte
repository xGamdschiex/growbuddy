<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { t } from '$lib/i18n';
	import { getAllFeedLines, getFeedLine } from '$lib/calc/feedlines/registry';
	import type { FeedLine, FeedSchemaRow, FeedProduct } from '$lib/calc/feedlines/types';
	import { feedlineOverrides, applyRowOverride, hasRowOverride } from '$lib/stores/feedline-overrides';
	import type { SchemaRowOverride, OverridesState } from '$lib/stores/feedline-overrides';
	import { toastStore } from '$lib/stores/toast';

	let tr = $state<(k: string) => string>((k) => k);
	let overridesState = $state<OverridesState>({});

	onMount(() => {
		const subs = [
			t.subscribe(v => tr = v),
			feedlineOverrides.subscribe(s => overridesState = s),
		];
		return () => subs.forEach(u => u());
	});

	const allLines = getAllFeedLines();
	let selectedId = $state<string>('athena-pro');

	$effect(() => {
		const urlLine = $page.url.searchParams.get('line');
		if (urlLine && allLines.find(l => l.id === urlLine)) selectedId = urlLine;
	});

	let line = $derived<FeedLine | undefined>(getFeedLine(selectedId));

	// ─── Helper Functions ──────────────────────────────────────────────────

	function getEffectiveRow(line: FeedLine, row: FeedSchemaRow): FeedSchemaRow {
		// Re-read jedes Mal wenn overridesState ändert (Svelte reaktiv via $derived)
		void overridesState;
		return applyRowOverride(line.id, row);
	}

	function isOverridden(lineId: string, phase: string, woche: number, field: keyof SchemaRowOverride): boolean {
		const row = overridesState[lineId]?.[phase]?.[woche];
		return row !== undefined && row[field] !== undefined;
	}

	function isProductOverridden(lineId: string, phase: string, woche: number, productKey: string): boolean {
		const row = overridesState[lineId]?.[phase]?.[woche];
		return row?.dosierungen?.[productKey] !== undefined;
	}

	function updateField(phase: string, woche: number, field: keyof SchemaRowOverride, value: any) {
		if (!line) return;
		feedlineOverrides.setRow(line.id, phase, woche, { [field]: value });
	}

	function updateProduct(phase: string, woche: number, productKey: string, value: number) {
		if (!line) return;
		feedlineOverrides.setRow(line.id, phase, woche, { dosierungen: { [productKey]: value } });
	}

	function updateKind(phase: string, woche: number, kind: string) {
		if (!line) return;
		if (kind === '—') {
			feedlineOverrides.clearField(line.id, phase, woche, 'kind');
		} else {
			feedlineOverrides.setRow(line.id, phase, woche, { kind: kind as 'build' | 'peak' | 'fade' });
		}
	}

	function resetField(phase: string, woche: number, field: keyof SchemaRowOverride) {
		if (!line) return;
		feedlineOverrides.clearField(line.id, phase, woche, field);
	}

	function resetProduct(phase: string, woche: number, productKey: string) {
		if (!line) return;
		const cur = overridesState[line.id]?.[phase]?.[woche]?.dosierungen ?? {};
		const next = { ...cur };
		delete next[productKey];
		if (Object.keys(next).length === 0) {
			feedlineOverrides.clearField(line.id, phase, woche, 'dosierungen');
		} else {
			// Setze die verbleibenden Dosierungen-Overrides neu (komplettes Replace)
			const existing = overridesState[line.id]?.[phase]?.[woche] ?? {};
			const replacement: SchemaRowOverride = { ...existing };
			replacement.dosierungen = next;
			feedlineOverrides.clearRow(line.id, phase, woche);
			feedlineOverrides.setRow(line.id, phase, woche, replacement);
		}
	}

	function resetRow(phase: string, woche: number) {
		if (!line) return;
		feedlineOverrides.clearRow(line.id, phase, woche);
		toastStore.success(`${phase} W${woche} auf Original zurückgesetzt`);
	}

	function resetLineAll() {
		if (!line) return;
		if (!confirm(`Alle Overrides für ${line.name} entfernen?`)) return;
		feedlineOverrides.clearLine(line.id);
		toastStore.success(`${line.name} komplett zurückgesetzt`);
	}

	function exportAll() {
		const json = feedlineOverrides.exportJson();
		navigator.clipboard?.writeText(json).then(
			() => toastStore.success('Overrides als JSON in Zwischenablage kopiert'),
			() => toastStore.error('Clipboard nicht verfügbar — JSON in Konsole geloggt'),
		);
		console.log('[FeedLine-Overrides Export]', json);
	}

	function importAll() {
		const json = prompt('Override-JSON einfügen:');
		if (!json) return;
		const ok = feedlineOverrides.importJson(json);
		if (ok) toastStore.success('Overrides importiert');
		else toastStore.error('Import fehlgeschlagen — JSON ungültig');
	}

	// Produkte für Tabellen-Spalten (gleiche Logik wie Viewer)
	function productsInPhase(line: FeedLine, phase: string): FeedProduct[] {
		return line.produkte.filter(p => {
			if (p.nur_phasen && p.nur_phasen.length > 0 && !p.nur_phasen.includes(phase)) return false;
			if (p.key === 'cleanse') return false;
			const rows = line.schema.filter(r => r.phase === phase);
			return rows.some(r => (r.dosierungen[p.key] ?? 0) > 0);
		});
	}

	function countOverridesForLine(lineId: string): number {
		let n = 0;
		const ov = overridesState[lineId];
		if (!ov) return 0;
		for (const phase in ov) {
			for (const woche in ov[phase]) {
				const row = ov[phase][Number(woche)];
				if (!row) continue;
				for (const k of Object.keys(row)) {
					if (k === 'dosierungen') {
						n += Object.keys(row.dosierungen ?? {}).length;
					} else {
						n++;
					}
				}
			}
		}
		return n;
	}

	let overrideCount = $derived(line ? countOverridesForLine(line.id) : 0);
</script>

<svelte:head><title>Schema bearbeiten — GrowBuddy</title></svelte:head>

<div class="px-4 pt-6 max-w-3xl mx-auto pb-24 space-y-5">
	<div>
		<a href="/calc/schema?line={selectedId}" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; Schema-Viewer</a>
		<h1 class="text-2xl font-bold mt-1">✏️ Schema bearbeiten</h1>
		<p class="text-sm text-gb-text-muted mt-1">Hersteller-Werte überschreiben — alle Änderungen lokal, jederzeit rücksetzbar.</p>
	</div>

	<!-- Disclaimer -->
	<div class="bg-gb-warn/10 border border-gb-warn/30 rounded-lg p-3 text-xs text-gb-text leading-snug">
		<b>Hinweis:</b> Originale Hersteller-Werte werden NICHT verändert. Deine Anpassungen werden nur lokal gespeichert
		und überschreiben die Default-Werte bei jeder Berechnung. Reset jederzeit möglich.
	</div>

	<!-- Line-Auswahl -->
	<div>
		<label for="edit-line" class="block text-xs text-gb-text-muted mb-1">Düngerlinie</label>
		<select id="edit-line" bind:value={selectedId}
			class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-3 text-sm">
			{#each allLines as l}
				<option value={l.id}>{l.name} ({l.hersteller})</option>
			{/each}
		</select>
	</div>

	{#if line}
		<!-- Override-Status + Aktionen -->
		<div class="bg-gb-surface rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
			<div>
				{#if overrideCount > 0}
					<span class="text-gb-accent font-semibold">✏️ {overrideCount} Override{overrideCount === 1 ? '' : 's'}</span>
					für {line.name}
				{:else}
					<span class="text-gb-text-muted">Keine Overrides — alle Werte Original.</span>
				{/if}
			</div>
			<div class="flex gap-2">
				<button onclick={exportAll} class="bg-gb-bg border border-gb-border rounded-lg px-3 py-2 hover:bg-gb-border/50">📤 Export</button>
				<button onclick={importAll} class="bg-gb-bg border border-gb-border rounded-lg px-3 py-2 hover:bg-gb-border/50">📥 Import</button>
				{#if overrideCount > 0}
					<button onclick={resetLineAll} class="bg-gb-error/10 border border-gb-error/30 text-gb-error rounded-lg px-3 py-2 hover:bg-gb-error/20">↺ Line-Reset</button>
				{/if}
			</div>
		</div>

		<!-- Editor-Tabellen pro Phase -->
		{#each line.phasen as phaseConf}
			{@const products = productsInPhase(line, phaseConf.name)}
			{@const rows = line.schema.filter(r => r.phase === phaseConf.name)}
			{#if rows.length > 0}
				<div class="space-y-2">
					<h2 class="text-sm font-bold uppercase tracking-wide text-gb-text-muted">
						{phaseConf.name}
						<span class="text-[11px] font-normal normal-case ml-2 text-gb-text-muted">({phaseConf.schema_wochen}W Schema)</span>
					</h2>
					<div class="space-y-3">
						{#each rows as origRow}
							{@const w = origRow.woche}
							{@const eff = getEffectiveRow(line, origRow)}
							{@const rowHasOv = hasRowOverride(line.id, phaseConf.name, w) || (overridesState[line.id]?.[phaseConf.name]?.[w] !== undefined)}
							<div class="bg-gb-surface rounded-xl p-3 space-y-3 {rowHasOv ? 'ring-1 ring-gb-accent/40' : ''}">
								<div class="flex items-baseline justify-between">
									<h3 class="text-sm font-semibold">Woche {w}
										{#if rowHasOv}<span class="ml-2 text-[10px] text-gb-accent">✏️ angepasst</span>{/if}
									</h3>
									{#if rowHasOv}
										<button onclick={() => resetRow(phaseConf.name, w)}
											class="text-[11px] text-gb-info hover:underline">↺ Woche zurücksetzen</button>
									{/if}
								</div>

								<!-- EC + pH -->
								<div class="grid grid-cols-3 gap-2 text-xs">
									<div>
										<label for="ec-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">EC mS/cm</label>
										<div class="flex gap-1">
											<input id="ec-{phaseConf.name}-{w}" type="number" step="0.1" min="0" max="5"
												value={eff.ec_ziel}
												oninput={(e) => updateField(phaseConf.name, w, 'ec_ziel', Number(e.currentTarget.value))}
												class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isOverridden(line.id, phaseConf.name, w, 'ec_ziel') ? 'border-gb-accent' : ''}" />
											{#if isOverridden(line.id, phaseConf.name, w, 'ec_ziel')}
												<button onclick={() => resetField(phaseConf.name, w, 'ec_ziel')} class="text-gb-info" title="Zurücksetzen">↺</button>
											{/if}
										</div>
									</div>
									<div>
										<label for="phmin-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">pH min</label>
										<div class="flex gap-1">
											<input id="phmin-{phaseConf.name}-{w}" type="number" step="0.1" min="4" max="8"
												value={eff.ph_min}
												oninput={(e) => updateField(phaseConf.name, w, 'ph_min', Number(e.currentTarget.value))}
												class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isOverridden(line.id, phaseConf.name, w, 'ph_min') ? 'border-gb-accent' : ''}" />
											{#if isOverridden(line.id, phaseConf.name, w, 'ph_min')}
												<button onclick={() => resetField(phaseConf.name, w, 'ph_min')} class="text-gb-info" title="Zurücksetzen">↺</button>
											{/if}
										</div>
									</div>
									<div>
										<label for="phmax-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">pH max</label>
										<div class="flex gap-1">
											<input id="phmax-{phaseConf.name}-{w}" type="number" step="0.1" min="4" max="8"
												value={eff.ph_max}
												oninput={(e) => updateField(phaseConf.name, w, 'ph_max', Number(e.currentTarget.value))}
												class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isOverridden(line.id, phaseConf.name, w, 'ph_max') ? 'border-gb-accent' : ''}" />
											{#if isOverridden(line.id, phaseConf.name, w, 'ph_max')}
												<button onclick={() => resetField(phaseConf.name, w, 'ph_max')} class="text-gb-info" title="Zurücksetzen">↺</button>
											{/if}
										</div>
									</div>
								</div>

								<!-- Auto-Faktor fmin/fmax -->
								{#if line.features.auto_faktor}
									<div class="grid grid-cols-3 gap-2 text-xs">
										<div>
											<label for="fmin-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">fmin %</label>
											<div class="flex gap-1">
												<input id="fmin-{phaseConf.name}-{w}" type="number" step="1" min="0" max="100"
													value={eff.fmin ?? 0}
													oninput={(e) => updateField(phaseConf.name, w, 'fmin', Number(e.currentTarget.value))}
													class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isOverridden(line.id, phaseConf.name, w, 'fmin') ? 'border-gb-accent' : ''}" />
												{#if isOverridden(line.id, phaseConf.name, w, 'fmin')}
													<button onclick={() => resetField(phaseConf.name, w, 'fmin')} class="text-gb-info">↺</button>
												{/if}
											</div>
										</div>
										<div>
											<label for="fmax-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">fmax %</label>
											<div class="flex gap-1">
												<input id="fmax-{phaseConf.name}-{w}" type="number" step="1" min="0" max="100"
													value={eff.fmax ?? 0}
													oninput={(e) => updateField(phaseConf.name, w, 'fmax', Number(e.currentTarget.value))}
													class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isOverridden(line.id, phaseConf.name, w, 'fmax') ? 'border-gb-accent' : ''}" />
												{#if isOverridden(line.id, phaseConf.name, w, 'fmax')}
													<button onclick={() => resetField(phaseConf.name, w, 'fmax')} class="text-gb-info">↺</button>
												{/if}
											</div>
										</div>
										<div>
											<label for="kind-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">Phase-Typ</label>
											<select id="kind-{phaseConf.name}-{w}" value={eff.kind ?? '—'}
												onchange={(e) => updateKind(phaseConf.name, w, e.currentTarget.value)}
												class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isOverridden(line.id, phaseConf.name, w, 'kind') ? 'border-gb-accent' : ''}">
												<option value="—">—</option>
												<option value="build">Build</option>
												<option value="peak">Peak</option>
												<option value="fade">Fade</option>
											</select>
										</div>
									</div>
								{/if}

								<!-- Athena Ca/Mg + Cleanse -->
								{#if line.features.calmag_ziele}
									<div class="grid grid-cols-2 gap-2 text-xs">
										<div>
											<label for="ca-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">Ca-Ziel mg/L</label>
											<div class="flex gap-1">
												<input id="ca-{phaseConf.name}-{w}" type="number" step="1" min="0"
													value={eff.ca_ziel ?? 0}
													oninput={(e) => updateField(phaseConf.name, w, 'ca_ziel', Number(e.currentTarget.value))}
													class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isOverridden(line.id, phaseConf.name, w, 'ca_ziel') ? 'border-gb-accent' : ''}" />
												{#if isOverridden(line.id, phaseConf.name, w, 'ca_ziel')}
													<button onclick={() => resetField(phaseConf.name, w, 'ca_ziel')} class="text-gb-info">↺</button>
												{/if}
											</div>
										</div>
										<div>
											<label for="mg-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">Mg-Ziel mg/L</label>
											<div class="flex gap-1">
												<input id="mg-{phaseConf.name}-{w}" type="number" step="1" min="0"
													value={eff.mg_ziel ?? 0}
													oninput={(e) => updateField(phaseConf.name, w, 'mg_ziel', Number(e.currentTarget.value))}
													class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isOverridden(line.id, phaseConf.name, w, 'mg_ziel') ? 'border-gb-accent' : ''}" />
												{#if isOverridden(line.id, phaseConf.name, w, 'mg_ziel')}
													<button onclick={() => resetField(phaseConf.name, w, 'mg_ziel')} class="text-gb-info">↺</button>
												{/if}
											</div>
										</div>
									</div>
								{/if}
								{#if line.features.cleanse_rampe}
									<div class="grid grid-cols-2 gap-2 text-xs">
										<div>
											<label for="ct1-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">Cleanse T1 mL/10L</label>
											<div class="flex gap-1">
												<input id="ct1-{phaseConf.name}-{w}" type="number" step="0.5" min="0"
													value={eff.cleanse_t1 ?? 0}
													oninput={(e) => updateField(phaseConf.name, w, 'cleanse_t1', Number(e.currentTarget.value))}
													class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isOverridden(line.id, phaseConf.name, w, 'cleanse_t1') ? 'border-gb-accent' : ''}" />
												{#if isOverridden(line.id, phaseConf.name, w, 'cleanse_t1')}
													<button onclick={() => resetField(phaseConf.name, w, 'cleanse_t1')} class="text-gb-info">↺</button>
												{/if}
											</div>
										</div>
										<div>
											<label for="ct7-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">Cleanse T7 mL/10L</label>
											<div class="flex gap-1">
												<input id="ct7-{phaseConf.name}-{w}" type="number" step="0.5" min="0"
													value={eff.cleanse_t7 ?? 0}
													oninput={(e) => updateField(phaseConf.name, w, 'cleanse_t7', Number(e.currentTarget.value))}
													class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isOverridden(line.id, phaseConf.name, w, 'cleanse_t7') ? 'border-gb-accent' : ''}" />
												{#if isOverridden(line.id, phaseConf.name, w, 'cleanse_t7')}
													<button onclick={() => resetField(phaseConf.name, w, 'cleanse_t7')} class="text-gb-info">↺</button>
												{/if}
											</div>
										</div>
									</div>
								{/if}

								<!-- Dosierungen pro Produkt -->
								{#if products.length > 0}
									<div>
										<p class="text-[11px] text-gb-text-muted mb-1">Dosierungen ({products[0].einheit}/{products[0].pro})</p>
										<div class="grid grid-cols-2 gap-2 text-xs">
											{#each products as p}
												<div>
													<label for="dos-{phaseConf.name}-{w}-{p.key}" class="block text-gb-text-muted mb-0.5">{p.name}</label>
													<div class="flex gap-1">
														<input id="dos-{phaseConf.name}-{w}-{p.key}" type="number" step="0.1" min="0"
															value={eff.dosierungen[p.key] ?? 0}
															oninput={(e) => updateProduct(phaseConf.name, w, p.key, Number(e.currentTarget.value))}
															class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isProductOverridden(line.id, phaseConf.name, w, p.key) ? 'border-gb-accent' : ''}" />
														{#if isProductOverridden(line.id, phaseConf.name, w, p.key)}
															<button onclick={() => resetProduct(phaseConf.name, w, p.key)} class="text-gb-info" title="Zurücksetzen">↺</button>
														{/if}
													</div>
												</div>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/each}

		<!-- Footer-Aktionen -->
		<div class="bg-gb-surface rounded-xl p-3 flex justify-between text-xs">
			<a href="/calc/schema?line={selectedId}" class="text-gb-info hover:underline">← Zurück zum Viewer</a>
			<a href="/calc" class="text-gb-info hover:underline">Zum Rechner →</a>
		</div>
	{/if}
</div>

<style>
	input[type="number"] {
		min-height: 36px;
	}
</style>
