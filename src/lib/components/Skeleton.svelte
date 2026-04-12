<script lang="ts">
	let { lines = 3, class: className = '' }: { lines?: number; class?: string } = $props();
</script>

<div class="space-y-3 animate-pulse {className}">
	{#each Array(lines) as _, i}
		<div class="bg-gb-surface rounded-xl p-4">
			<div class="h-4 bg-gb-border/30 rounded w-{i === 0 ? '3/4' : i === 1 ? '1/2' : '2/3'} mb-2"></div>
			<div class="h-3 bg-gb-border/20 rounded w-1/3"></div>
		</div>
	{/each}
</div>
