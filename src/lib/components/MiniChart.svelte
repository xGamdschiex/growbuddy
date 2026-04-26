<script lang="ts">
	/**
	 * MiniChart V2 — SVG Sparkline mit Tap-Tooltip, X-Achse, Phasen-Markern, Min/Max-Labels.
	 */

	interface PhaseMarker {
		atIndex: number;
		label: string;
	}

	interface PhaseTarget {
		atIndex: number;
		min: number;
		max: number;
	}

	interface Props {
		data: number[];
		days?: number[]; // Tag seit Grow-Start je Datenpunkt (gleicher Index)
		color?: string;
		height?: number;
		width?: number;
		showDots?: boolean;
		showArea?: boolean;
		label?: string;
		unit?: string;
		targets?: { min: number; max: number };
		phaseTargets?: PhaseTarget[]; // Segmentierte Targets je Phase
		phaseMarkers?: PhaseMarker[];
		showMinMax?: boolean;
	}

	let {
		data,
		days,
		color = '#22c55e',
		height = 100,
		width = 320,
		showDots = true,
		showArea = true,
		label = '',
		unit = '',
		targets,
		phaseTargets,
		phaseMarkers = [],
		showMinMax = false,
	}: Props = $props();

	const PADDING = 12;
	const PADDING_BOTTOM = 18; // Platz für X-Achse
	let activeIndex = $state<number | null>(null);

	let bounds = $derived.by(() => {
		const min = Math.min(...data) * 0.95;
		const max = Math.max(...data) * 1.05 || 1;
		return { min, max, range: max - min || 1 };
	});

	let pts = $derived.by(() => {
		if (data.length < 2) return [];
		const w = width - PADDING * 2;
		const h = height - PADDING - PADDING_BOTTOM;
		return data.map((v, i) => ({
			x: PADDING + (i / (data.length - 1)) * w,
			y: PADDING + h - ((v - bounds.min) / bounds.range) * h,
			value: v,
			day: days?.[i] ?? i + 1,
		}));
	});

	let pointsStr = $derived(pts.map(p => `${p.x},${p.y}`).join(' '));

	let areaPath = $derived.by(() => {
		if (pts.length < 2 || !showArea) return '';
		const baseY = height - PADDING_BOTTOM;
		let d = `M ${pts[0].x},${pts[0].y}`;
		for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x},${pts[i].y}`;
		d += ` L ${pts[pts.length - 1].x},${baseY} L ${pts[0].x},${baseY} Z`;
		return d;
	});

	function yMap(v: number): number {
		const h = height - PADDING - PADDING_BOTTOM;
		return PADDING + h - ((v - bounds.min) / bounds.range) * h;
	}

	let targetArea = $derived.by(() => {
		if (!targets || pts.length < 2 || phaseTargets) return null;
		const yMax = yMap(targets.max);
		const yMin = yMap(targets.min);
		return { y: Math.max(0, yMax), height: Math.max(0, yMin - yMax) };
	});

	let segmentedTargets = $derived.by(() => {
		if (!phaseTargets || !phaseTargets.length || pts.length < 2) return [];
		return phaseTargets.map((seg, i) => {
			const next = phaseTargets[i + 1];
			const startX = pts[seg.atIndex]?.x ?? PADDING;
			const endX = next ? (pts[next.atIndex]?.x ?? (width - PADDING)) : (width - PADDING);
			const yMax = yMap(seg.max);
			const yMin = yMap(seg.min);
			return { x: startX, y: Math.max(0, yMax), width: Math.max(0, endX - startX), height: Math.max(0, yMin - yMax) };
		});
	});

	let extremes = $derived.by(() => {
		if (!showMinMax || pts.length < 2) return null;
		let minIdx = 0, maxIdx = 0;
		for (let i = 1; i < data.length; i++) {
			if (data[i] < data[minIdx]) minIdx = i;
			if (data[i] > data[maxIdx]) maxIdx = i;
		}
		return { min: pts[minIdx], max: pts[maxIdx] };
	});

	let lastValue = $derived(data.length > 0 ? data[data.length - 1] : null);

	let active = $derived(activeIndex !== null && pts[activeIndex] ? pts[activeIndex] : null);

	function pickIndex(clientX: number, svg: SVGSVGElement) {
		const rect = svg.getBoundingClientRect();
		const xRatio = (clientX - rect.left) / rect.width;
		const px = xRatio * width;
		let bestIdx = 0;
		let bestDist = Infinity;
		for (let i = 0; i < pts.length; i++) {
			const d = Math.abs(pts[i].x - px);
			if (d < bestDist) { bestDist = d; bestIdx = i; }
		}
		return bestIdx;
	}

	function onPointerMove(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.buttons === 0) return;
		activeIndex = pickIndex(e.clientX, e.currentTarget as SVGSVGElement);
	}
	function onPointerDown(e: PointerEvent) {
		(e.currentTarget as Element).setPointerCapture?.(e.pointerId);
		activeIndex = pickIndex(e.clientX, e.currentTarget as SVGSVGElement);
	}
	function onPointerLeave() {
		activeIndex = null;
	}

	let xLabels = $derived.by(() => {
		if (pts.length < 2) return [];
		const first = pts[0];
		const last = pts[pts.length - 1];
		const out = [{ x: first.x, label: `T${first.day}` }];
		if (pts.length > 4) {
			const mid = pts[Math.floor(pts.length / 2)];
			out.push({ x: mid.x, label: `T${mid.day}` });
		}
		out.push({ x: last.x, label: `T${last.day}` });
		return out;
	});
</script>

<div class="bg-gb-surface rounded-xl p-3">
	{#if label}
		<div class="flex items-center justify-between mb-1">
			<span class="text-xs text-gb-text-muted">{label}</span>
			<div class="flex items-baseline gap-2">
				{#if active}
					<span class="text-[10px] text-gb-text-muted">T{active.day}</span>
					<span class="text-sm font-semibold" style="color: {color}">{active.value.toFixed(1)}{unit}</span>
				{:else if lastValue !== null}
					<span class="text-sm font-semibold" style="color: {color}">{lastValue.toFixed(1)}{unit}</span>
				{/if}
			</div>
		</div>
	{/if}

	{#if data.length >= 2}
		<svg viewBox="0 0 {width} {height}" class="w-full select-none touch-none" style="height: {height}px"
			onpointermove={onPointerMove}
			onpointerdown={onPointerDown}
			onpointerleave={onPointerLeave}
			onpointercancel={onPointerLeave}
			role="img" aria-label={label}>
			{#if targetArea}
				<rect x="0" y={targetArea.y} width={width} height={targetArea.height}
					fill={color} opacity="0.1" />
			{/if}

			{#each segmentedTargets as seg}
				<rect x={seg.x} y={seg.y} width={seg.width} height={seg.height}
					fill={color} opacity="0.12" />
			{/each}

			{#each phaseMarkers as marker}
				{#if pts[marker.atIndex]}
					<line x1={pts[marker.atIndex].x} x2={pts[marker.atIndex].x}
						y1={PADDING} y2={height - PADDING_BOTTOM}
						stroke="currentColor" stroke-width="1" stroke-dasharray="3 3"
						class="text-gb-text-muted" opacity="0.5" />
					<text x={pts[marker.atIndex].x + 3} y={PADDING + 8}
						class="text-[9px] fill-gb-text-muted" font-size="9">{marker.label}</text>
				{/if}
			{/each}

			{#if areaPath}
				<path d={areaPath} fill={color} opacity="0.18" />
			{/if}

			<polyline points={pointsStr} fill="none" stroke={color} stroke-width="2"
				stroke-linecap="round" stroke-linejoin="round" />

			{#if showDots}
				{#each pts as pt, i}
					{#if i === pts.length - 1 && activeIndex === null}
						<circle cx={pt.x} cy={pt.y} r="4" fill={color} />
						<circle cx={pt.x} cy={pt.y} r="6" fill={color} opacity="0.3" />
					{:else}
						<circle cx={pt.x} cy={pt.y} r="2" fill={color} opacity="0.5" />
					{/if}
				{/each}
			{/if}

			{#if active}
				<line x1={active.x} x2={active.x} y1={PADDING} y2={height - PADDING_BOTTOM}
					stroke={color} stroke-width="1" opacity="0.4" />
				<circle cx={active.x} cy={active.y} r="5" fill={color} stroke="white" stroke-width="2" />
			{/if}

			{#if extremes}
				<circle cx={extremes.max.x} cy={extremes.max.y} r="3" fill="none" stroke={color} stroke-width="1.5" opacity="0.7" />
				<text x={extremes.max.x} y={extremes.max.y - 6} text-anchor="middle"
					font-size="9" class="fill-gb-text-muted" opacity="0.8">↑{extremes.max.value.toFixed(1)}</text>
				<circle cx={extremes.min.x} cy={extremes.min.y} r="3" fill="none" stroke={color} stroke-width="1.5" opacity="0.7" />
				<text x={extremes.min.x} y={extremes.min.y + 12} text-anchor="middle"
					font-size="9" class="fill-gb-text-muted" opacity="0.8">↓{extremes.min.value.toFixed(1)}</text>
			{/if}

			{#each xLabels as xl}
				<text x={xl.x} y={height - 4} text-anchor="middle"
					class="fill-gb-text-muted" font-size="9">{xl.label}</text>
			{/each}
		</svg>
	{:else}
		<div class="h-16 flex items-center justify-center text-xs text-gb-text-muted">
			Mindestens 2 Datenpunkte nötig
		</div>
	{/if}
</div>
