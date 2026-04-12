<script lang="ts">
	/**
	 * MiniChart — Lightweight SVG Sparkline/Line Chart.
	 * Kein externes Package, reines SVG.
	 */

	interface Props {
		data: number[];
		color?: string;
		height?: number;
		width?: number;
		showDots?: boolean;
		showArea?: boolean;
		label?: string;
		unit?: string;
		targets?: { min: number; max: number };
	}

	let {
		data,
		color = '#22c55e',
		height = 80,
		width = 280,
		showDots = true,
		showArea = true,
		label = '',
		unit = '',
		targets,
	}: Props = $props();

	let points = $derived.by(() => {
		if (data.length < 2) return '';
		const min = Math.min(...data) * 0.9;
		const max = Math.max(...data) * 1.1 || 1;
		const range = max - min || 1;
		const padding = 8;
		const w = width - padding * 2;
		const h = height - padding * 2;

		return data.map((v, i) => {
			const x = padding + (i / (data.length - 1)) * w;
			const y = padding + h - ((v - min) / range) * h;
			return `${x},${y}`;
		}).join(' ');
	});

	let areaPath = $derived.by(() => {
		if (data.length < 2 || !showArea) return '';
		const min = Math.min(...data) * 0.9;
		const max = Math.max(...data) * 1.1 || 1;
		const range = max - min || 1;
		const padding = 8;
		const w = width - padding * 2;
		const h = height - padding * 2;

		const pts = data.map((v, i) => {
			const x = padding + (i / (data.length - 1)) * w;
			const y = padding + h - ((v - min) / range) * h;
			return { x, y };
		});

		let d = `M ${pts[0].x},${pts[0].y}`;
		for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x},${pts[i].y}`;
		d += ` L ${pts[pts.length - 1].x},${padding + h} L ${pts[0].x},${padding + h} Z`;
		return d;
	});

	let targetArea = $derived.by(() => {
		if (!targets || data.length < 2) return null;
		const min = Math.min(...data) * 0.9;
		const max = Math.max(...data) * 1.1 || 1;
		const range = max - min || 1;
		const padding = 8;
		const h = height - padding * 2;

		const yMin = padding + h - ((targets.max - min) / range) * h;
		const yMax = padding + h - ((targets.min - min) / range) * h;
		return { y: Math.max(0, yMin), height: Math.max(0, yMax - yMin) };
	});

	let lastValue = $derived(data.length > 0 ? data[data.length - 1] : null);

	let dotPoints = $derived.by(() => {
		if (!showDots || data.length < 2) return [];
		const min = Math.min(...data) * 0.9;
		const max = Math.max(...data) * 1.1 || 1;
		const range = max - min || 1;
		const padding = 8;
		const w = width - padding * 2;
		const h = height - padding * 2;

		return data.map((v, i) => ({
			x: padding + (i / (data.length - 1)) * w,
			y: padding + h - ((v - min) / range) * h,
		}));
	});
</script>

<div class="bg-gb-surface rounded-xl p-3">
	{#if label}
		<div class="flex items-center justify-between mb-1">
			<span class="text-xs text-gb-text-muted">{label}</span>
			{#if lastValue !== null}
				<span class="text-sm font-semibold" style="color: {color}">{lastValue.toFixed(1)}{unit}</span>
			{/if}
		</div>
	{/if}

	{#if data.length >= 2}
		<svg viewBox="0 0 {width} {height}" class="w-full" style="height: {height}px">
			<!-- Target Zone -->
			{#if targetArea}
				<rect x="0" y={targetArea.y} width={width} height={targetArea.height}
					fill={color} opacity="0.08" />
			{/if}

			<!-- Area Fill -->
			{#if areaPath}
				<path d={areaPath} fill={color} opacity="0.15" />
			{/if}

			<!-- Line -->
			<polyline points={points} fill="none" stroke={color} stroke-width="2"
				stroke-linecap="round" stroke-linejoin="round" />

			<!-- Dots -->
			{#if showDots}
				{#each dotPoints as pt, i}
					{#if i === dotPoints.length - 1}
						<circle cx={pt.x} cy={pt.y} r="4" fill={color} />
						<circle cx={pt.x} cy={pt.y} r="6" fill={color} opacity="0.3" />
					{:else}
						<circle cx={pt.x} cy={pt.y} r="2" fill={color} opacity="0.5" />
					{/if}
				{/each}
			{/if}
		</svg>
	{:else}
		<div class="h-16 flex items-center justify-center text-xs text-gb-text-muted">
			Mindestens 2 Datenpunkte nötig
		</div>
	{/if}
</div>
