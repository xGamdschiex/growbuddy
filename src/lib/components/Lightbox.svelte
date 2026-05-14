<script lang="ts">
	interface Props {
		photos: string[];
		startIndex?: number;
		onClose: () => void;
	}
	let { photos, startIndex = 0, onClose }: Props = $props();

	// startIndex nur initial nehmen (Prev/Next override später)
	// svelte-ignore state_referenced_locally
	let current = $state(startIndex);

	// ── Zoom & Pan ──────────────────────────────────────────────────────
	let scale = $state(1);
	let tx = $state(0);
	let ty = $state(0);
	let smooth = $state(false); // CSS-Transition nur bei Doppeltipp, nicht bei Pinch/Pan

	const MAX_SCALE = 4;
	const ZOOM_LEVEL = 2.5; // Doppeltipp-Zoom

	// Gesten-Tracking (nicht-reaktiv)
	let mode: 'none' | 'pinch' | 'pan' | 'swipe' = 'none';
	let pinchStartDist = 0;
	let pinchStartScale = 1;
	let panStartX = 0, panStartY = 0, panStartTx = 0, panStartTy = 0;
	let swipeStartX = 0;
	let lastTapTime = 0;

	function resetZoom(animate = true) {
		smooth = animate;
		scale = 1; tx = 0; ty = 0;
		if (animate) setTimeout(() => (smooth = false), 220);
	}

	function prev() {
		current = (current - 1 + photos.length) % photos.length;
		resetZoom(false);
	}
	function next() {
		current = (current + 1) % photos.length;
		resetZoom(false);
	}

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
		else if (e.key === 'ArrowLeft') prev();
		else if (e.key === 'ArrowRight') next();
	}

	function touchDist(t: TouchList): number {
		const dx = t[0].clientX - t[1].clientX;
		const dy = t[0].clientY - t[1].clientY;
		return Math.hypot(dx, dy);
	}

	function handleTouchStart(e: TouchEvent) {
		if (e.touches.length === 2) {
			mode = 'pinch';
			smooth = false;
			pinchStartDist = touchDist(e.touches);
			pinchStartScale = scale;
			return;
		}
		if (e.touches.length === 1) {
			const now = Date.now();
			// Doppeltipp → Zoom rein/raus
			if (now - lastTapTime < 300) {
				lastTapTime = 0;
				smooth = true;
				if (scale > 1) { scale = 1; tx = 0; ty = 0; }
				else { scale = ZOOM_LEVEL; }
				setTimeout(() => (smooth = false), 220);
				mode = 'none';
				return;
			}
			lastTapTime = now;
			if (scale > 1) {
				mode = 'pan';
				smooth = false;
				panStartX = e.touches[0].clientX;
				panStartY = e.touches[0].clientY;
				panStartTx = tx;
				panStartTy = ty;
			} else {
				mode = 'swipe';
				swipeStartX = e.touches[0].clientX;
			}
		}
	}

	function handleTouchMove(e: TouchEvent) {
		if (mode === 'pinch' && e.touches.length === 2) {
			const d = touchDist(e.touches);
			scale = Math.min(MAX_SCALE, Math.max(1, pinchStartScale * (d / pinchStartDist)));
		} else if (mode === 'pan' && e.touches.length === 1) {
			tx = panStartTx + (e.touches[0].clientX - panStartX);
			ty = panStartTy + (e.touches[0].clientY - panStartY);
		}
	}

	function handleTouchEnd(e: TouchEvent) {
		if (mode === 'pinch') {
			mode = 'none';
			if (scale <= 1.05) resetZoom(true);
		} else if (mode === 'pan') {
			mode = 'none';
		} else if (mode === 'swipe') {
			mode = 'none';
			const delta = e.changedTouches[0].clientX - swipeStartX;
			if (Math.abs(delta) > 50) {
				if (delta > 0) prev();
				else next();
			}
		}
	}
</script>

<svelte:window onkeydown={handleKey} />

<div
	class="fixed inset-0 z-50 bg-black/95 flex items-center justify-center touch-none select-none overflow-hidden"
	role="dialog"
	aria-modal="true"
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
	onclick={() => { if (scale === 1) onClose(); }}
	onkeydown={(e) => e.key === 'Enter' && scale === 1 && onClose()}
	tabindex="-1"
>
	<!-- Close Button -->
	<button
		onclick={(e) => { e.stopPropagation(); onClose(); }}
		class="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl backdrop-blur-sm z-10"
		aria-label="Schließen"
	>
		✕
	</button>

	<!-- Counter -->
	{#if photos.length > 1}
		<div class="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-white/10 text-white text-sm backdrop-blur-sm z-10">
			{current + 1} / {photos.length}
		</div>
	{/if}

	<!-- Zoom-Hinweis (nur bei scale 1) -->
	{#if scale === 1}
		<div class="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-white/10 text-white/70 text-[11px] backdrop-blur-sm z-10">
			Doppeltippen oder ziehen zum Zoomen
		</div>
	{/if}

	<!-- Main Image -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<img
		src={photos[current]}
		alt="Foto {current + 1}"
		class="max-w-full max-h-[90vh] object-contain"
		style="transform: translate({tx}px, {ty}px) scale({scale}); transition: {smooth ? 'transform 0.2s ease' : 'none'}; will-change: transform;"
		onclick={(e) => e.stopPropagation()}
		draggable="false"
	/>

	<!-- Nav Buttons -->
	{#if photos.length > 1}
		<button
			onclick={(e) => { e.stopPropagation(); prev(); }}
			class="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl backdrop-blur-sm"
			aria-label="Vorheriges"
		>
			‹
		</button>
		<button
			onclick={(e) => { e.stopPropagation(); next(); }}
			class="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xl backdrop-blur-sm"
			aria-label="Nächstes"
		>
			›
		</button>
	{/if}
</div>
