<script lang="ts">
	import { TRAINING_TECHNIQUES } from '$lib/data/science';
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-5">
	<div>
		<a href="/tools" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; Tools</a>
		<h1 class="text-xl font-bold mt-2">Training Guide</h1>
		<p class="text-gb-text-muted text-sm">Pflanzentraining — wann, wie, für wen</p>
	</div>

	<div class="bg-gb-warning/10 border border-gb-warning/20 rounded-lg p-3 text-sm text-gb-warning">
		Automatics: NUR LST! Kein Topping, kein HST — Autos haben keine Zeit zur Erholung.
	</div>

	<div class="space-y-3">
		{#each TRAINING_TECHNIQUES as tech}
			<div class="bg-gb-surface rounded-xl p-4 space-y-2">
				<div class="flex items-start justify-between">
					<div>
						<p class="font-medium">{tech.name}</p>
						<p class="text-xs text-gb-text-muted mt-0.5">{tech.when}</p>
					</div>
					<div class="flex gap-1.5 shrink-0">
						<span class="text-xs px-2 py-0.5 rounded {tech.type === 'LST' ? 'bg-gb-green/20 text-gb-green' : 'bg-gb-accent/20 text-gb-accent'}">
							{tech.type}
						</span>
						<span class="text-xs px-2 py-0.5 rounded {tech.auto_safe ? 'bg-gb-green/20 text-gb-green' : 'bg-gb-danger/20 text-gb-danger'}">
							{tech.auto_safe ? 'Auto OK' : 'Nur Photo'}
						</span>
					</div>
				</div>
				<p class="text-sm text-gb-text-muted">{tech.description}</p>
			</div>
		{/each}
	</div>
</div>
