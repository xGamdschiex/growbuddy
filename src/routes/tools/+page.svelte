<script lang="ts">
	import { t } from '$lib/i18n';
	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });

	const tools = [
		{ href: '/tools/doctor', icon: '🤖', key: 'tools.doctor', descKey: 'tools.doctor_desc', pro: true },
		{ href: '/tools/vpd', icon: '🌡️', key: 'tools.vpd', descKey: 'tools.vpd_desc' },
		{ href: '/tools/dli', icon: '☀️', key: 'tools.dli', descKey: 'tools.dli_desc' },
		{ href: '/tools/dry', icon: '🌿', key: 'tools.dry', descKey: 'tools.dry_desc' },
		{ href: '/guide/ipm', icon: '🐛', key: 'tools.ipm', descKey: 'tools.ipm_desc' },
		{ href: '/guide/training', icon: '✂️', key: 'tools.training', descKey: 'tools.training_desc' },
	];
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-6">
	<div>
		<h1 class="text-xl font-bold">{tr('tools.title')}</h1>
	</div>

	<div class="space-y-3">
		{#each tools as tool}
			<a href={tool.href} class="flex items-center gap-4 bg-gb-surface rounded-xl p-4 hover:bg-gb-surface-2 transition-colors">
				<span class="text-2xl">{tool.icon}</span>
				<div>
					<p class="font-medium">
						{tr(tool.key)}
						{#if tool.pro}<span class="ml-1.5 text-[10px] bg-gb-accent/20 text-gb-accent px-1.5 py-0.5 rounded-full font-bold">PRO</span>{/if}
					</p>
					<p class="text-sm text-gb-text-muted">{tr(tool.descKey)}</p>
				</div>
				<svg class="w-5 h-5 text-gb-text-muted ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M9 18l6-6-6-6" />
				</svg>
			</a>
		{/each}
	</div>
</div>
