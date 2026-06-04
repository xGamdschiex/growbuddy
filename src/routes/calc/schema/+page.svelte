<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { t } from '$lib/i18n';
	import { getAllFeedLines, getFeedLine } from '$lib/calc/feedlines/registry';
	import { getSchemaForWeek } from '$lib/calc/feedlines/types';
	import type { FeedLine, FeedSchemaRow } from '$lib/calc/feedlines/types';

	let tr = $state<(k: string) => string>((k) => k);

	onMount(() => {
		const unsub = t.subscribe(v => tr = v);
		return unsub;
	});

	const allLines = getAllFeedLines();

	// URL-Query: ?line=athena-pro
	let selectedId = $state<string>('athena-pro');
	$effect(() => {
		const urlLine = $page.url.searchParams.get('line');
		if (urlLine && allLines.find(l => l.id === urlLine)) {
			selectedId = urlLine;
		}
	});

	let line = $derived<FeedLine | undefined>(getFeedLine(selectedId));

	// Bloom-Dauer-Slider — initial = schema_wochen
	let bloomWeeks = $state(0);
	$effect(() => {
		const bloomPhase = line?.phasen.find(p => p.name === 'Bloom');
		if (bloomPhase && bloomWeeks === 0) {
			bloomWeeks = bloomPhase.schema_wochen;
		}
	});

	type DisplayRow = {
		woche: number;          // Display-Woche (scaled)
		schema: FeedSchemaRow;  // Tatsächliche Schema-Zeile
		isScaled: boolean;       // Wurde aus Stretch erzeugt?
		kindLabel: string;       // 'Peak gehalten' / 'Fade verschoben' / leer
	};

	function rowsForPhase(line: FeedLine, phase: string, totalWeeks: number | undefined): DisplayRow[] {
		const config = line.phasen.find(p => p.name === phase);
		if (!config) return [];
		const max = phase === 'Bloom' && totalWeeks && totalWeeks > 0
			? Math.max(totalWeeks, config.schema_wochen)
			: config.schema_wochen;
		const out: DisplayRow[] = [];
		for (let w = 1; w <= max; w++) {
			const tw = phase === 'Bloom' ? totalWeeks : undefined;
			const r = getSchemaForWeek(line, phase, w, tw);
			if (!r) continue;
			const isScaled = w !== r.woche;
			let kindLabel = '';
			if (isScaled) {
				kindLabel = r.kind === 'fade' ? tr('calc.stretch_fade_shifted') : tr('calc.stretch_peak_held');
			}
			out.push({ woche: w, schema: r, isScaled, kindLabel });
		}
		return out;
	}

	let bloomDisplayRows = $derived(line ? rowsForPhase(line, 'Bloom', bloomWeeks) : []);

	// Produkte für Tabellen-Spalten (nur Produkte mit echten Werten in der jeweiligen Phase)
	function productsInPhase(line: FeedLine, phase: string): typeof line.produkte {
		return line.produkte.filter(p => {
			if (p.nur_phasen && p.nur_phasen.length > 0 && !p.nur_phasen.includes(phase)) return false;
			// Cleanse separat (Athena-Rampe)
			if (p.key === 'cleanse') return false;
			// Nur Produkte mit mind. einer >0-Dosierung in der Phase zeigen
			const rows = line.schema.filter(r => r.phase === phase);
			return rows.some(r => (r.dosierungen[p.key] ?? 0) > 0);
		});
	}

	function fmtNum(n: number | undefined): string {
		if (n === undefined || n === null) return '—';
		return Number.isInteger(n) ? String(n) : n.toFixed(1);
	}
</script>

<svelte:head><title>Düngerschema — GrowBuddy</title></svelte:head>

<div class="px-4 pt-6 max-w-3xl mx-auto pb-24 space-y-5">
	<div>
		<a href="/calc" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; Rechner</a>
		<h1 class="text-2xl font-bold mt-1">📋 Düngerschema</h1>
		<p class="text-sm text-gb-text-muted mt-1">Alle Werte pro Phase und Woche im Überblick.</p>
	</div>

	<!-- Line-Auswahl -->
	<div>
		<label for="schema-line" class="block text-xs text-gb-text-muted mb-1">Düngerlinie</label>
		<select id="schema-line" bind:value={selectedId}
			class="w-full bg-gb-surface border border-gb-border rounded-lg px-3 py-3 text-sm">
			{#each allLines as l}
				<option value={l.id}>{l.name} ({l.hersteller})</option>
			{/each}
		</select>
	</div>

	{#if line}
		<!-- Line-Meta -->
		<div class="bg-gb-surface rounded-xl p-3 space-y-1 text-xs">
			<div class="flex flex-wrap gap-x-4 gap-y-1 text-gb-text-muted">
				<span><b class="text-gb-text">Typ:</b> {line.typ}</span>
				<span><b class="text-gb-text">Medien:</b> {line.medien.join(', ')}</span>
				<span><b class="text-gb-text">Auto-Faktor:</b> {line.features.auto_faktor ? '✓' : '–'}</span>
				{#if line.features.cleanse_rampe}<span><b class="text-gb-text">Cleanse-Rampe:</b> ✓</span>{/if}
				{#if line.features.calmag_ziele}<span><b class="text-gb-text">Ca/Mg-Ziele:</b> ✓</span>{/if}
			</div>
		</div>

		<!-- Bloom-Wochen-Slider (nur wenn Bloom-Phase vorhanden) -->
		{#if line.phasen.find(p => p.name === 'Bloom')}
			{@const bp = line.phasen.find(p => p.name === 'Bloom')!}
			<div class="bg-gb-surface rounded-xl p-3">
				<div class="flex items-baseline justify-between mb-1">
					<label for="schema-bloom-weeks" class="text-xs text-gb-text-muted">{tr('calc.total_weeks_label')}</label>
					<span class="text-[11px] text-gb-text-muted">Schema: {bp.schema_wochen}W · Max: {bp.max_wochen}W</span>
				</div>
				<div class="flex items-center gap-2">
					<input id="schema-bloom-weeks" type="range" min={bp.schema_wochen} max={bp.max_wochen} step="1"
						bind:value={bloomWeeks}
						class="flex-1 accent-gb-accent" />
					<span class="text-sm font-semibold w-12 text-right">{bloomWeeks}W</span>
				</div>
				<p class="text-[11px] text-gb-text-muted mt-1 leading-snug">{tr('calc.total_weeks_hint')}</p>
			</div>
		{/if}

		<!-- Tabellen pro Phase -->
		{#each line.phasen as phaseConf}
			{@const products = productsInPhase(line, phaseConf.name)}
			{@const rows = phaseConf.name === 'Bloom'
				? bloomDisplayRows
				: line.schema.filter(r => r.phase === phaseConf.name).map(s => ({ woche: s.woche, schema: s, isScaled: false, kindLabel: '' }))}
			{#if rows.length > 0}
				<div class="space-y-2">
					<h2 class="text-sm font-bold uppercase tracking-wide text-gb-text-muted">
						{phaseConf.name}
						<span class="text-[11px] font-normal normal-case ml-2 text-gb-text-muted">
							({phaseConf.schema_wochen}W Schema, max {phaseConf.max_wochen}W)
						</span>
					</h2>
					<div class="bg-gb-surface rounded-xl overflow-x-auto">
						<table class="w-full text-xs">
							<thead class="text-gb-text-muted border-b border-gb-border">
								<tr>
									<th class="px-2 py-2 text-left font-medium">W</th>
									<th class="px-2 py-2 text-right font-medium">EC</th>
									<th class="px-2 py-2 text-right font-medium">pH</th>
									{#if line.features.auto_faktor}
										<th class="px-2 py-2 text-right font-medium">fmin → fmax</th>
									{/if}
									{#each products as p}
										<th class="px-2 py-2 text-right font-medium whitespace-nowrap">{p.name}<br/><span class="text-[10px] text-gb-text-muted">{p.einheit}/{p.pro}</span></th>
									{/each}
									{#if line.features.calmag_ziele}
										<th class="px-2 py-2 text-right font-medium">Ca/Mg<br/><span class="text-[10px] text-gb-text-muted">mg/L</span></th>
									{/if}
									{#if line.features.cleanse_rampe}
										<th class="px-2 py-2 text-right font-medium">Cleanse<br/><span class="text-[10px] text-gb-text-muted">T1→T7</span></th>
									{/if}
								</tr>
							</thead>
							<tbody>
								{#each rows as row}
									<tr class="border-b border-gb-border/40 last:border-b-0
										{row.isScaled ? 'bg-gb-accent/5' : ''}
										{row.schema.kind === 'fade' ? 'opacity-90' : ''}">
										<td class="px-2 py-2 font-semibold">
											{row.woche}
											{#if row.isScaled}
												<span class="block text-[9px] text-gb-accent leading-tight" title={row.kindLabel}>
													{row.schema.kind === 'fade' ? '↓ Fade' : '↻ Peak'}
												</span>
											{:else if row.schema.kind === 'fade'}
												<span class="block text-[9px] text-gb-text-muted leading-tight">Fade</span>
											{/if}
										</td>
										<td class="px-2 py-2 text-right">{fmtNum(row.schema.ec_ziel)}</td>
										<td class="px-2 py-2 text-right whitespace-nowrap">{row.schema.ph_min}–{row.schema.ph_max}</td>
										{#if line.features.auto_faktor}
											<td class="px-2 py-2 text-right whitespace-nowrap">
												{row.schema.fmin ?? '–'}→{row.schema.fmax ?? '–'}%
											</td>
										{/if}
										{#each products as p}
											<td class="px-2 py-2 text-right">{fmtNum(row.schema.dosierungen[p.key])}</td>
										{/each}
										{#if line.features.calmag_ziele}
											<td class="px-2 py-2 text-right whitespace-nowrap">{fmtNum(row.schema.ca_ziel)}/{fmtNum(row.schema.mg_ziel)}</td>
										{/if}
										{#if line.features.cleanse_rampe}
											<td class="px-2 py-2 text-right whitespace-nowrap">{fmtNum(row.schema.cleanse_t1)}→{fmtNum(row.schema.cleanse_t7)}</td>
										{/if}
									</tr>
									{#if row.schema.hinweis}
										<tr class="bg-gb-bg/40">
											<td colspan="20" class="px-2 py-1 text-[11px] text-gb-text-muted italic">↳ {row.schema.hinweis}</td>
										</tr>
									{/if}
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		{/each}

		<!-- Line-Hinweise -->
		{#if line.hinweise && line.hinweise.length > 0}
			<div class="bg-gb-surface rounded-xl p-3 space-y-1">
				<h3 class="text-xs font-semibold text-gb-text-muted uppercase tracking-wide">Hinweise</h3>
				<ul class="text-xs text-gb-text space-y-1 list-disc list-inside">
					{#each line.hinweise as h}
						<li>{h}</li>
					{/each}
				</ul>
			</div>
		{/if}

		<!-- Legende -->
		<div class="bg-gb-bg/60 border border-gb-border rounded-lg p-2 text-[11px] text-gb-text-muted leading-relaxed">
			<b class="text-gb-text">Legende:</b>
			<span class="inline-flex items-center gap-1 ml-2"><span class="inline-block w-3 h-3 rounded bg-gb-accent/20 border border-gb-accent/40"></span> Skalierte Woche (Peak gehalten oder Fade verschoben)</span>
			<span class="inline-block ml-2">EC in mS/cm, Dosierungen pro angegebener Bezugsgröße (z.B. g/10L oder mL/L).</span>
		</div>
	{/if}
</div>
