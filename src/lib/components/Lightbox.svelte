<script lang="ts">
	interface Props {
		photos: string[];
		startIndex?: number;
		onClose: () => void;
	}
	let { photos, startIndex = 0, onClose }: Props = $props();

	let current = $state(startIndex);
	let touchStartX = $state(0);
	let touchEndX = $state(0);

	function prev() {
		current = (current - 1 + photos.length) % photos.length;
	}
	function next() {
		current = (current + 1) % photos.length;
	}

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
		else if (e.key === 'ArrowLeft') prev();
		else if (e.key === 'ArrowRight') next();
	}

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.changedTouches[0].screenX;
	}
	function handleTouchEnd(e: TouchEvent) {
		touchEndX = e.changedTouches[0].screenX;
		const delta = touchEndX - touchStartX;
		if (Math.abs(delta) > 50) {
			if (delta > 0) prev();
			else next();
		}
	}
</script>

<svelte:window onkeydown={handleKey} />

<div
	class="fixed inset-0 z-50 bg-black/95 flex items-center justify-center touch-none select-none"
	role="dialog"
	aria-modal="true"
	ontouchstart={handleTouchStart}
	ontouchend={handleTouchEnd}
	onclick={onClose}
	onkeydown={(e) => e.key === 'Enter' && onClose()}
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

	<!-- Main Image -->
	<img
		src={photos[current]}
		alt="Foto {current + 1}"
		class="max-w-full max-h-[90vh] object-contain"
		onclick={(e) => e.stopPropagation()}
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
