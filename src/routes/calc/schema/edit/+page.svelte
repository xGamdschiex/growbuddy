<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { t } from '$lib/i18n';
	import { getAllFeedLines, getFeedLine } from '$lib/calc/feedlines/registry';
	import type { FeedLine, FeedSchemaRow, FeedProduct } from '$lib/calc/feedlines/types';
	import { feedlineOverrides, applyRowOverride, hasRowOverride } from '$lib/stores/feedline-overrides';
	import type { SchemaRowOverride, OverridesState } from '$lib/stores/feedline-overrides';
	import { calcStore } from '$lib/stores/calc';
	import type { CalcState } from '$lib/stores/calc';
	import { toastStore } from '$lib/stores/toast';
	import { debounce } from '$lib/utils/debounce';

	let tr = $state<(k: string, params?: Record<string, string | number>) => string>((k) => k);
	let overridesState = $state<OverridesState>({});
	let calcState = $state<CalcState | null>(null);

	onMount(() => {
		const subs = [
			t.subscribe(v => tr = v),
			feedlineOverrides.subscribe(s => overridesState = s),
			calcStore.subscribe(s => calcState = s),
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

	// ─── Akkordeon: nur eine Phase auf einmal offen, Default = aktuelle Calc-Phase ──
	let openPhase = $state<string>('');
	$effect(() => {
		if (line && openPhase === '') {
			openPhase = calcState?.phase ?? line.phasen[0]?.name ?? 'Bloom';
		}
	});

	// ─── Validierung ──────────────────────────────────────────────────────

	type ValidationResult = { ok: boolean; clamped: number; warning?: string };

	function validateEC(raw: number): ValidationResult {
		if (Number.isNaN(raw)) return { ok: false, clamped: 0, warning: tr('schema.validation_ec_max') };
		if (raw < 0) return { ok: false, clamped: 0, warning: tr('schema.validation_dosage_negative') };
		if (raw > 5) return { ok: false, clamped: 5, warning: tr('schema.validation_ec_max') };
		return { ok: true, clamped: raw };
	}

	function validatePH(raw: number): ValidationResult {
		if (Number.isNaN(raw)) return { ok: false, clamped: 6, warning: tr('schema.validation_ph_range') };
		if (raw < 4) return { ok: false, clamped: 4, warning: tr('schema.validation_ph_range') };
		if (raw > 8) return { ok: false, clamped: 8, warning: tr('schema.validation_ph_range') };
		return { ok: true, clamped: raw };
	}

	function validatePercent(raw: number): ValidationResult {
		if (Number.isNaN(raw)) return { ok: false, clamped: 0 };
		if (raw < 0) return { ok: false, clamped: 0 };
		if (raw > 100) return { ok: false, clamped: 100 };
		return { ok: true, clamped: raw };
	}

	function validateNonNeg(raw: number): ValidationResult {
		if (Number.isNaN(raw)) return { ok: false, clamped: 0, warning: tr('schema.validation_dosage_negative') };
		if (raw < 0) return { ok: false, clamped: 0, warning: tr('schema.validation_dosage_negative') };
		return { ok: true, clamped: raw };
	}

	// ─── Debounced Setters (vermeidet localStorage-Spam bei Tippen) ───────

	const debouncedSetRow = debounce((lineId: string, phase: string, woche: number, patch: SchemaRowOverride) => {
		feedlineOverrides.setRow(lineId, phase, woche, patch);
	}, 200);

	function applyValidatedField(phase: string, woche: number, field: keyof SchemaRowOverride, rawValue: number, validator: (n: number) => ValidationResult) {
		if (!line) return;
		const result = validator(rawValue);
		if (result.warning && !result.ok) {
			// Sanftes Feedback ohne Toast-Spam — wir clampen still
		}
		// pH-Ordering checken (ph_min < ph_max)
		if (field === 'ph_min' || field === 'ph_max') {
			const eff = applyRowOverride(line.id, line.schema.find(r => r.phase === phase && r.woche === woche)!);
			const otherField = field === 'ph_min' ? eff.ph_max : eff.ph_min;
			if (field === 'ph_min' && result.clamped >= otherField) {
				result.clamped = Math.max(4, otherField - 0.1);
				toastStore.error(tr('schema.validation_ph_order'));
			} else if (field === 'ph_max' && result.clamped <= otherField) {
				result.clamped = Math.min(8, otherField + 0.1);
				toastStore.error(tr('schema.validation_ph_order'));
			}
		}
		debouncedSetRow(line.id, phase, woche, { [field]: result.clamped });
	}

	function applyProduct(phase: string, woche: number, productKey: string, rawValue: number) {
		if (!line) return;
		const result = validateNonNeg(rawValue);
		debouncedSetRow(line.id, phase, woche, { dosierungen: { [productKey]: result.clamped } });
	}

	function updateKind(phase: string, woche: number, kind: string) {
		if (!line) return;
		if (kind === '—') {
			feedlineOverrides.clearField(line.id, phase, woche, 'kind');
		} else {
			feedlineOverrides.setRow(line.id, phase, woche, { kind: kind as 'build' | 'peak' | 'fade' });
		}
	}

	// ─── Reset-Aktionen ───────────────────────────────────────────────────

	function isOverridden(lineId: string, phase: string, woche: number, field: keyof SchemaRowOverride): boolean {
		const row = overridesState[lineId]?.[phase]?.[woche];
		return row !== undefined && row[field] !== undefined;
	}

	function isProductOverridden(lineId: string, phase: string, woche: number, productKey: string): boolean {
		const row = overridesState[lineId]?.[phase]?.[woche];
		return row?.dosierungen?.[productKey] !== undefined;
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
		const existing = overridesState[line.id]?.[phase]?.[woche] ?? {};
		const replacement: SchemaRowOverride = { ...existing };
		if (Object.keys(next).length === 0) {
			delete replacement.dosierungen;
		} else {
			replacement.dosierungen = next;
		}
		feedlineOverrides.clearRow(line.id, phase, woche);
		if (Object.keys(replacement).length > 0) {
			feedlineOverrides.setRow(line.id, phase, woche, replacement);
		}
	}

	function resetAllDoses(phase: string, woche: number) {
		if (!line) return;
		feedlineOverrides.clearField(line.id, phase, woche, 'dosierungen');
	}

	function resetRow(phase: string, woche: number) {
		if (!line) return;
		feedlineOverrides.clearRow(line.id, phase, woche);
		toastStore.success(tr('schema.toast_week_reset', { phase, week: woche }));
	}

	function resetLineAll() {
		if (!line) return;
		const msg = tr('schema.confirm_line_reset', { line: line.name });
		if (!confirm(msg)) return;
		feedlineOverrides.clearLine(line.id);
		toastStore.success(tr('schema.toast_line_reset', { line: line.name }));
	}

	function exportAll() {
		const json = feedlineOverrides.exportJson();
		const ok = navigator.clipboard?.writeText(json);
		if (ok && typeof ok.then === 'function') {
			ok.then(
				() => toastStore.success(tr('schema.toast_export_ok')),
				() => toastStore.error(tr('schema.toast_export_fail')),
			);
		}
		console.log('[FeedLine-Overrides Export]', json);
	}

	function importAll() {
		const json = prompt(tr('schema.prompt_import'));
		if (!json) return;
		const ok = feedlineOverrides.importJson(json);
		if (ok) toastStore.success(tr('schema.toast_import_ok'));
		else toastStore.error(tr('schema.toast_import_fail'));
	}

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

	function countOverridesForPhase(lineId: string, phase: string): number {
		let n = 0;
		const ph = overridesState[lineId]?.[phase];
		if (!ph) return 0;
		for (const w in ph) {
			const row = ph[Number(w)];
			for (const k of Object.keys(row)) {
				if (k === 'dosierungen') n += Object.keys(row.dosierungen ?? {}).length;
				else n++;
			}
		}
		return n;
	}

	let overrideCount = $derived(line ? countOverridesForLine(line.id) : 0);
</script>

<svelte:head><title>{tr('schema.edit_title')} — GrowBuddy</title></svelte:head>

<div class="px-4 pt-6 max-w-3xl mx-auto pb-24 space-y-5">
	<div>
		<a href="/calc/schema?line={selectedId}" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; {tr('schema.btn_back_viewer')}</a>
		<h1 class="text-2xl font-bold mt-1">✏️ {tr('schema.edit_title')}</h1>
		<p class="text-sm text-gb-text-muted mt-1">{tr('schema.edit_subtitle')}</p>
	</div>

	<div class="bg-gb-warn/10 border border-gb-warn/30 rounded-lg p-3 text-xs text-gb-text leading-snug">
		<b>Hinweis:</b> {tr('schema.edit_disclaimer')}
	</div>

	<div>
		<label for="edit-line" class="block text-xs text-gb-text-muted mb-1">{tr('schema.line_label')}</label>
		<select id="edit-line" bind:value={selectedId}
			class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-3 text-sm">
			{#each allLines as l}
				<option value={l.id}>{l.name} ({l.hersteller})</option>
			{/each}
		</select>
	</div>

	{#if line}
		<div class="bg-gb-surface rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
			<div>
				{#if overrideCount > 0}
					<span class="text-gb-accent font-semibold">✏️ {tr('schema.overrides_count', { n: overrideCount, s: overrideCount === 1 ? '' : 's', line: line.name })}</span>
				{:else}
					<span class="text-gb-text-muted">{tr('schema.no_overrides')}</span>
				{/if}
			</div>
			<div class="flex gap-2">
				<button onclick={exportAll} class="bg-gb-bg border border-gb-border rounded-lg px-3 py-2 hover:bg-gb-border/50" style="min-height:36px;">📤 {tr('schema.btn_export')}</button>
				<button onclick={importAll} class="bg-gb-bg border border-gb-border rounded-lg px-3 py-2 hover:bg-gb-border/50" style="min-height:36px;">📥 {tr('schema.btn_import')}</button>
				{#if overrideCount > 0}
					<button onclick={resetLineAll} class="bg-gb-error/10 border border-gb-error/30 text-gb-error rounded-lg px-3 py-2 hover:bg-gb-error/20" style="min-height:36px;">↺ {tr('schema.btn_line_reset')}</button>
				{/if}
			</div>
		</div>

		<!-- Phase-Akkordeon -->
		{#each line.phasen as phaseConf}
			{@const products = productsInPhase(line, phaseConf.name)}
			{@const rows = line.schema.filter(r => r.phase === phaseConf.name)}
			{@const phaseOvCount = countOverridesForPhase(line.id, phaseConf.name)}
			{#if rows.length > 0}
				<div class="space-y-2">
					<button onclick={() => openPhase = openPhase === phaseConf.name ? '' : phaseConf.name}
						class="w-full bg-gb-surface rounded-xl p-3 flex items-center justify-between text-left hover:bg-gb-surface/80"
						aria-expanded={openPhase === phaseConf.name}>
						<div>
							<h2 class="text-sm font-bold uppercase tracking-wide">
								{phaseConf.name}
								<span class="text-[11px] font-normal normal-case ml-2 text-gb-text-muted">({phaseConf.schema_wochen}W)</span>
								{#if phaseOvCount > 0}
									<span class="ml-2 text-[11px] text-gb-accent">✏️ {phaseOvCount}</span>
								{/if}
							</h2>
							{#if openPhase !== phaseConf.name}
								<p class="text-[11px] text-gb-text-muted">{tr('schema.phase_collapsed_hint')}</p>
							{/if}
						</div>
						<span class="text-gb-text-muted text-lg">{openPhase === phaseConf.name ? '▴' : '▾'}</span>
					</button>

					{#if openPhase === phaseConf.name}
						<div class="space-y-3">
							{#each rows as origRow}
								{@const w = origRow.woche}
								{@const eff = (void overridesState, applyRowOverride(line.id, origRow))}
								{@const rowHasOv = hasRowOverride(line.id, phaseConf.name, w) || (overridesState[line.id]?.[phaseConf.name]?.[w] !== undefined)}
								<div class="bg-gb-surface rounded-xl p-3 space-y-3 {rowHasOv ? 'ring-1 ring-gb-accent/40' : ''}">
									<div class="flex items-baseline justify-between">
										<h3 class="text-sm font-semibold">Woche {w}
											{#if rowHasOv}<span class="ml-2 text-[10px] text-gb-accent">✏️ {tr('schema.row_overridden')}</span>{/if}
										</h3>
										{#if rowHasOv}
											<button onclick={() => resetRow(phaseConf.name, w)}
												class="text-[11px] text-gb-info hover:underline">↺ {tr('schema.reset_week')}</button>
										{/if}
									</div>

									<!-- EC + pH -->
									<div class="grid grid-cols-3 gap-2 text-xs">
										<div>
											<label for="ec-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">{tr('schema.col_ec')}</label>
											<div class="flex gap-1">
												<input id="ec-{phaseConf.name}-{w}" type="number" step="0.1" min="0" max="5"
													value={eff.ec_ziel}
													oninput={(e) => applyValidatedField(phaseConf.name, w, 'ec_ziel', Number(e.currentTarget.value), validateEC)}
													class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isOverridden(line.id, phaseConf.name, w, 'ec_ziel') ? 'border-gb-accent' : ''}" />
												{#if isOverridden(line.id, phaseConf.name, w, 'ec_ziel')}
													<button onclick={() => resetField(phaseConf.name, w, 'ec_ziel')} class="text-gb-info" title={tr('schema.reset_field_title')}>↺</button>
												{/if}
											</div>
										</div>
										<div>
											<label for="phmin-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">{tr('schema.col_phmin')}</label>
											<div class="flex gap-1">
												<input id="phmin-{phaseConf.name}-{w}" type="number" step="0.1" min="4" max="8"
													value={eff.ph_min}
													oninput={(e) => applyValidatedField(phaseConf.name, w, 'ph_min', Number(e.currentTarget.value), validatePH)}
													class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isOverridden(line.id, phaseConf.name, w, 'ph_min') ? 'border-gb-accent' : ''}" />
												{#if isOverridden(line.id, phaseConf.name, w, 'ph_min')}
													<button onclick={() => resetField(phaseConf.name, w, 'ph_min')} class="text-gb-info">↺</button>
												{/if}
											</div>
										</div>
										<div>
											<label for="phmax-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">{tr('schema.col_phmax')}</label>
											<div class="flex gap-1">
												<input id="phmax-{phaseConf.name}-{w}" type="number" step="0.1" min="4" max="8"
													value={eff.ph_max}
													oninput={(e) => applyValidatedField(phaseConf.name, w, 'ph_max', Number(e.currentTarget.value), validatePH)}
													class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isOverridden(line.id, phaseConf.name, w, 'ph_max') ? 'border-gb-accent' : ''}" />
												{#if isOverridden(line.id, phaseConf.name, w, 'ph_max')}
													<button onclick={() => resetField(phaseConf.name, w, 'ph_max')} class="text-gb-info">↺</button>
												{/if}
											</div>
										</div>
									</div>

									<!-- Auto-Faktor fmin/fmax + kind -->
									{#if line.features.auto_faktor}
										<div class="grid grid-cols-3 gap-2 text-xs">
											<div>
												<label for="fmin-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">{tr('schema.col_fmin')}</label>
												<div class="flex gap-1">
													<input id="fmin-{phaseConf.name}-{w}" type="number" step="1" min="0" max="100"
														value={eff.fmin ?? 0}
														oninput={(e) => applyValidatedField(phaseConf.name, w, 'fmin', Number(e.currentTarget.value), validatePercent)}
														class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isOverridden(line.id, phaseConf.name, w, 'fmin') ? 'border-gb-accent' : ''}" />
													{#if isOverridden(line.id, phaseConf.name, w, 'fmin')}
														<button onclick={() => resetField(phaseConf.name, w, 'fmin')} class="text-gb-info">↺</button>
													{/if}
												</div>
											</div>
											<div>
												<label for="fmax-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">{tr('schema.col_fmax')}</label>
												<div class="flex gap-1">
													<input id="fmax-{phaseConf.name}-{w}" type="number" step="1" min="0" max="100"
														value={eff.fmax ?? 0}
														oninput={(e) => applyValidatedField(phaseConf.name, w, 'fmax', Number(e.currentTarget.value), validatePercent)}
														class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isOverridden(line.id, phaseConf.name, w, 'fmax') ? 'border-gb-accent' : ''}" />
													{#if isOverridden(line.id, phaseConf.name, w, 'fmax')}
														<button onclick={() => resetField(phaseConf.name, w, 'fmax')} class="text-gb-info">↺</button>
													{/if}
												</div>
											</div>
											<div>
												<label for="kind-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">{tr('schema.col_kind')}</label>
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
												<label for="ca-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">{tr('schema.col_ca')}</label>
												<div class="flex gap-1">
													<input id="ca-{phaseConf.name}-{w}" type="number" step="1" min="0"
														value={eff.ca_ziel ?? 0}
														oninput={(e) => applyValidatedField(phaseConf.name, w, 'ca_ziel', Number(e.currentTarget.value), validateNonNeg)}
														class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isOverridden(line.id, phaseConf.name, w, 'ca_ziel') ? 'border-gb-accent' : ''}" />
													{#if isOverridden(line.id, phaseConf.name, w, 'ca_ziel')}
														<button onclick={() => resetField(phaseConf.name, w, 'ca_ziel')} class="text-gb-info">↺</button>
													{/if}
												</div>
											</div>
											<div>
												<label for="mg-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">{tr('schema.col_mg')}</label>
												<div class="flex gap-1">
													<input id="mg-{phaseConf.name}-{w}" type="number" step="1" min="0"
														value={eff.mg_ziel ?? 0}
														oninput={(e) => applyValidatedField(phaseConf.name, w, 'mg_ziel', Number(e.currentTarget.value), validateNonNeg)}
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
												<label for="ct1-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">{tr('schema.col_ct1')}</label>
												<div class="flex gap-1">
													<input id="ct1-{phaseConf.name}-{w}" type="number" step="0.5" min="0"
														value={eff.cleanse_t1 ?? 0}
														oninput={(e) => applyValidatedField(phaseConf.name, w, 'cleanse_t1', Number(e.currentTarget.value), validateNonNeg)}
														class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isOverridden(line.id, phaseConf.name, w, 'cleanse_t1') ? 'border-gb-accent' : ''}" />
													{#if isOverridden(line.id, phaseConf.name, w, 'cleanse_t1')}
														<button onclick={() => resetField(phaseConf.name, w, 'cleanse_t1')} class="text-gb-info">↺</button>
													{/if}
												</div>
											</div>
											<div>
												<label for="ct7-{phaseConf.name}-{w}" class="block text-gb-text-muted mb-0.5">{tr('schema.col_ct7')}</label>
												<div class="flex gap-1">
													<input id="ct7-{phaseConf.name}-{w}" type="number" step="0.5" min="0"
														value={eff.cleanse_t7 ?? 0}
														oninput={(e) => applyValidatedField(phaseConf.name, w, 'cleanse_t7', Number(e.currentTarget.value), validateNonNeg)}
														class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isOverridden(line.id, phaseConf.name, w, 'cleanse_t7') ? 'border-gb-accent' : ''}" />
													{#if isOverridden(line.id, phaseConf.name, w, 'cleanse_t7')}
														<button onclick={() => resetField(phaseConf.name, w, 'cleanse_t7')} class="text-gb-info">↺</button>
													{/if}
												</div>
											</div>
										</div>
									{/if}

									<!-- Dosierungen -->
									{#if products.length > 0}
										<div>
											<div class="flex items-baseline justify-between mb-1">
												<p class="text-[11px] text-gb-text-muted">{tr('schema.col_dosierungen')} ({products[0].einheit}/{products[0].pro})</p>
												{#if isOverridden(line.id, phaseConf.name, w, 'dosierungen')}
													<button onclick={() => resetAllDoses(phaseConf.name, w)} class="text-[11px] text-gb-info hover:underline">↺ {tr('schema.reset_all_doses')}</button>
												{/if}
											</div>
											<div class="grid grid-cols-2 gap-2 text-xs">
												{#each products as p}
													<div>
														<label for="dos-{phaseConf.name}-{w}-{p.key}" class="block text-gb-text-muted mb-0.5">{p.name}</label>
														<div class="flex gap-1">
															<input id="dos-{phaseConf.name}-{w}-{p.key}" type="number" step="0.1" min="0"
																value={eff.dosierungen[p.key] ?? 0}
																oninput={(e) => applyProduct(phaseConf.name, w, p.key, Number(e.currentTarget.value))}
																class="w-full bg-gb-bg border border-gb-border rounded px-2 py-1.5 {isProductOverridden(line.id, phaseConf.name, w, p.key) ? 'border-gb-accent' : ''}" />
															{#if isProductOverridden(line.id, phaseConf.name, w, p.key)}
																<button onclick={() => resetProduct(phaseConf.name, w, p.key)} class="text-gb-info" title={tr('schema.reset_field_title')}>↺</button>
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
					{/if}
				</div>
			{/if}
		{/each}

		<div class="bg-gb-surface rounded-xl p-3 flex justify-between text-xs">
			<a href="/calc/schema?line={selectedId}" class="text-gb-info hover:underline">← {tr('schema.btn_back_viewer')}</a>
			<a href="/calc" class="text-gb-info hover:underline">{tr('schema.btn_to_calc')} →</a>
		</div>
	{/if}
</div>

<style>
	input[type="number"] {
		min-height: 36px;
	}
</style>
