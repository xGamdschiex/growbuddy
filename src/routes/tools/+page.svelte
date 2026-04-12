<script lang="ts">
	const tools = [
		{ href: '/tools/vpd', icon: '🌡️', label: 'VPD Rechner', desc: 'Klima optimieren' },
		{ href: '/tools/dli', icon: '☀️', label: 'DLI Rechner', desc: 'Licht optimieren' },
		{ href: '/tools/dry', icon: '🌿', label: 'Trocknungs-Timer', desc: 'Trocknung tracken' },
		{ href: '/guide/ipm', icon: '🐛', label: 'IPM Guide', desc: 'Schädlinge bekämpfen' },
		{ href: '/guide/training', icon: '✂️', label: 'Training Guide', desc: 'LST, Topping, ScrOG' },
	];
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-6">
	<div>
		<h1 class="text-xl font-bold">Tools & Guides</h1>
		<p class="text-gb-text-muted text-sm">Wissenschaftlich korrekte Grow-Werkzeuge</p>
	</div>

	<div class="space-y-3">
		{#each tools as tool}
			<a href={tool.href} class="flex items-center gap-4 bg-gb-surface rounded-xl p-4 hover:bg-gb-surface-2 transition-colors">
				<span class="text-2xl">{tool.icon}</span>
				<div>
					<p class="font-medium">{tool.label}</p>
					<p class="text-sm text-gb-text-muted">{tool.desc}</p>
				</div>
				<svg class="w-5 h-5 text-gb-text-muted ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M9 18l6-6-6-6" />
				</svg>
			</a>
		{/each}
	</div>
</div>
