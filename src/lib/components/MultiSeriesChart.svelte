<script lang="ts">
	/**
	 * MultiSeriesChart — überlagert mehrere Metrik-Verläufe in EINEM SVG.
	 * Jede Series hat eigene Y-Skala (normalisiert auf 0-1), damit
	 * Werte mit komplett unterschiedlichen Ranges (Temp 20-30°C, Wasser 0-100L)
	 * gemeinsam darstellbar sind.
	 *
	 * Tap → vertikale Linie + Tooltip mit Original-Werten aller aktiver Series.
	 */

	export interface ChartSeries {
		key: string;
		label: string;
		color: string;
		unit: string;
		values: number[];
		days: number[]; // Tag seit Grow-Start je Datenpunkt
	}

	interface Props {
		series: ChartSeries[];
		/** Welche Series-Keys aktuell sichtbar sind. */
		enabledKeys: string[];
		height?: number;
		width?: number;
	}

	let { series, enabledKeys, height = 200, width = 320 }: Props = $props();

	const PADDING = 12;
	const PADDING_BOTTOM = 22;

	let activeSeries = $derived(series.filter(s => enabledKeys.includes(s.key) && s.values.length >= 2));

	// Gemeinsame X-Achse: min/max Day über alle aktiven Series
	let xRange = $derived.by(() => {
		const days: number[] = [];
		for (const s of activeSeries) for (const d of s.days) days.push(d);
		if (!days.length) return { min: 1, max: 1, range: 1 };
		const min = Math.min(...days);
		const max = Math.max(...days);
		return { min, max, range: Math.max(1, max - min) };
	});

	function xMap(day: number): number {
		const w = width - PADDING * 2;
		return PADDING + ((day - xRange.min) / xRange.range) * w;
	}

	// Pro Series: Min/Max für eigene Y-Skala (0-1 normalisiert)
	function bounds(s: ChartSeries) {
		const min = Math.min(...s.values);
		const max = Math.max(...s.values);
		const range = max - min;
		return { min, max, range: range || 1 };
	}

	function yMap(value: number, b: { min: number; range: number }): number {
		const h = height - PADDING - PADDING_BOTTOM;
		const norm = (value - b.min) / b.range; // 0..1
		return PADDING + h - norm * h;
	}

	// Polyline-Points pro Series
	function pointsFor(s: ChartSeries) {
		const b = bounds(s);
		return s.values.map((v, i) => ({
			x: xMap(s.days[i]),
			y: yMap(v, b),
			value: v,
			day: s.days[i],
		}));
	}

	// Min/Max + Last-Value pro Series für Inline-Labels
	function extremesFor(s: ChartSeries) {
		if (s.values.length < 2) return null;
		const ps = pointsFor(s);
		let minIdx = 0, maxIdx = 0;
		for (let i = 1; i < s.values.length; i++) {
			if (s.values[i] < s.values[minIdx]) minIdx = i;
			if (s.values[i] > s.values[maxIdx]) maxIdx = i;
		}
		return { min: ps[minIdx], max: ps[maxIdx], last: ps[ps.length - 1] };
	}

	// Format-Helper: kürzt unnötige Dezimalen je nach Wert
	function fmt(v: number, unit: string): string {
		const abs = Math.abs(v);
		const dp = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
		return v.toFixed(dp) + unit.trim();
	}

	// Tap-Tooltip: zeigt für gewählten Day pro aktiver Series den Original-Wert
	let activeDay = $state<number | null>(null);

	function pickDay(clientX: number, svg: SVGSVGElement) {
		const rect = svg.getBoundingClientRect();
		const xRatio = (clientX - rect.left) / rect.width;
		const px = xRatio * width;
		// Inverse xMap
		const w = width - PADDING * 2;
		const dayFloat = xRange.min + ((px - PADDING) / w) * xRange.range;
		const day = Math.round(dayFloat);
		return Math.max(xRange.min, Math.min(xRange.max, day));
	}

	function onPointer(e: PointerEvent) {
		const svg = e.currentTarget as SVGSVGElement;
		activeDay = pickDay(e.clientX, svg);
	}

	function onLeave() {
		activeDay = null;
	}

	// Findet den nächstgelegenen Datenpunkt einer Series zu einem Day
	function valueAt(s: ChartSeries, day: number): { value: number; day: number } | null {
		if (!s.values.length) return null;
		let bestIdx = 0;
		let bestDist = Infinity;
		for (let i = 0; i < s.days.length; i++) {
			const d = Math.abs(s.days[i] - day);
			if (d < bestDist) { bestDist = d; bestIdx = i; }
		}
		return { value: s.values[bestIdx], day: s.days[bestIdx] };
	}

	let tooltipX = $derived(activeDay !== null ? xMap(activeDay) : 0);
	let tooltipValues = $derived.by(() => {
		if (activeDay === null) return [];
		return activeSeries.map(s => ({
			key: s.key,
			label: s.label,
			color: s.color,
			unit: s.unit,
			point: valueAt(s, activeDay!),
		}));
	});

	// X-Axis Ticks (4 Werte über range)
	let xTicks = $derived.by(() => {
		const ticks: number[] = [];
		const steps = 3;
		for (let i = 0; i <= steps; i++) {
			ticks.push(Math.round(xRange.min + (i / steps) * xRange.range));
		}
		return Array.from(new Set(ticks));
	});
</script>

<div class="bg-gb-surface rounded-xl p-3 space-y-2 select-none">
	{#if activeSeries.length === 0}
		<p class="text-xs text-gb-text-muted text-center py-6">Wähle mindestens eine Metrik aus.</p>
	{:else}
		<svg
			viewBox="0 0 {width} {height}"
			class="w-full h-auto touch-none"
			onpointerdown={onPointer}
			onpointermove={onPointer}
			onpointerleave={onLeave}
			role="img"
			aria-label="Multi-Series-Verlauf"
		>
			<!-- Grid (horizontal Lines bei 25/50/75%) -->
			{#each [0.25, 0.5, 0.75] as r}
				<line x1={PADDING} y1={PADDING + (height - PADDING - PADDING_BOTTOM) * r}
					x2={width - PADDING} y2={PADDING + (height - PADDING - PADDING_BOTTOM) * r}
					stroke="rgba(255,255,255,0.04)" stroke-width="1" />
			{/each}

			<!-- Polylines pro aktiver Series -->
			{#each activeSeries as s}
				{@const ps = pointsFor(s)}
				<polyline
					points={ps.map(p => `${p.x},${p.y}`).join(' ')}
					fill="none"
					stroke={s.color}
					stroke-width="2"
					stroke-linejoin="round"
					stroke-linecap="round"
				/>
			{/each}

			<!-- Min/Max + Last-Value Labels pro aktiver Series -->
			{#each activeSeries as s}
				{@const ext = extremesFor(s)}
				{#if ext}
					<!-- Min-Label (unter dem Punkt) -->
					<text x={ext.min.x} y={ext.min.y + 12} font-size="9" font-weight="600"
						text-anchor="middle" fill={s.color} stroke="#0a0a0a" stroke-width="3" paint-order="stroke">
						{fmt(ext.min.value, s.unit)}
					</text>
					<!-- Max-Label (über dem Punkt) -->
					{#if ext.max.x !== ext.min.x || ext.max.y !== ext.min.y}
						<text x={ext.max.x} y={ext.max.y - 5} font-size="9" font-weight="600"
							text-anchor="middle" fill={s.color} stroke="#0a0a0a" stroke-width="3" paint-order="stroke">
							{fmt(ext.max.value, s.unit)}
						</text>
					{/if}
					<!-- Last-Value rechts (nur wenn nicht == max/min) -->
					{#if ext.last.x !== ext.min.x && ext.last.x !== ext.max.x}
						<text x={Math.min(ext.last.x + 4, width - 2)} y={ext.last.y + 3} font-size="9" font-weight="600"
							text-anchor={ext.last.x > width - 30 ? 'end' : 'start'}
							fill={s.color} stroke="#0a0a0a" stroke-width="3" paint-order="stroke">
							{fmt(ext.last.value, s.unit)}
						</text>
					{/if}
				{/if}
			{/each}

			<!-- Tap-Linie + Punkte -->
			{#if activeDay !== null}
				<line x1={tooltipX} y1={PADDING} x2={tooltipX} y2={height - PADDING_BOTTOM}
					stroke="rgba(255,255,255,0.3)" stroke-width="1" stroke-dasharray="2 3" />
				{#each activeSeries as s}
					{@const p = valueAt(s, activeDay)}
					{#if p}
						{@const b = bounds(s)}
						<circle cx={xMap(p.day)} cy={yMap(p.value, b)} r="4" fill={s.color} stroke="#0a0a0a" stroke-width="1.5" />
					{/if}
				{/each}
			{/if}

			<!-- X-Axis Tick-Labels -->
			{#each xTicks as t}
				<text x={xMap(t)} y={height - 6} text-anchor="middle"
					font-size="10" fill="rgba(255,255,255,0.4)">T{t}</text>
			{/each}
		</svg>

		<!-- Tooltip-Werte unter dem Chart -->
		{#if activeDay !== null}
			<div class="bg-gb-bg/70 rounded-lg p-2 space-y-1">
				<p class="text-[10px] text-gb-text-muted">Tag {activeDay}</p>
				<div class="grid grid-cols-2 gap-x-3 gap-y-0.5">
					{#each tooltipValues as t}
						{#if t.point}
							<div class="flex items-center gap-1.5 text-[11px]">
								<span class="w-2 h-2 rounded-full shrink-0" style="background-color: {t.color}"></span>
								<span class="text-gb-text-muted">{t.label}:</span>
								<span class="font-semibold ml-auto">{t.point.value.toFixed(2)}{t.unit}</span>
							</div>
						{/if}
					{/each}
				</div>
			</div>
		{:else}
			<p class="text-[10px] text-gb-text-muted text-center">Tippe für Werte am Tag</p>
		{/if}
	{/if}
</div>
