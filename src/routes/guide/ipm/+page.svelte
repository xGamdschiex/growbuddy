<script lang="ts">
	import { PESTS } from '$lib/data/ipm';
	import { xpStore } from '$lib/stores/xp';
	import { t } from '$lib/i18n';

	xpStore.awardToolUse('ipm');

	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });

	function pestIcon(id: string): string {
		if (id.includes('mite')) return '🕷️';
		if (id.includes('thrip')) return '🪲';
		if (id.includes('gnat')) return '🦟';
		if (id.includes('white')) return '🪰';
		if (id.includes('aphid')) return '🐛';
		if (id.includes('mildew')) return '🍄';
		if (id.includes('botrytis')) return '💀';
		if (id.includes('caterpillar')) return '🐛';
		return '🐞';
	}

	function solutionTypeLabel(type: string): string {
		switch (type) {
			case 'beneficial': return 'Nützling';
			case 'biological': return 'Biologisch';
			case 'mechanical': return 'Mechanisch';
			case 'cultural': return 'Kulturell';
			default: return type;
		}
	}

	function solutionTypeColor(type: string): string {
		switch (type) {
			case 'beneficial': return 'bg-gb-green/20 text-gb-green';
			case 'biological': return 'bg-gb-accent/20 text-gb-accent';
			case 'mechanical': return 'bg-gb-info/20 text-gb-info';
			case 'cultural': return 'bg-gb-warning/20 text-gb-warning';
			default: return 'bg-gb-surface-2 text-gb-text-muted';
		}
	}
</script>

<div class="px-4 pt-6 pb-12 max-w-lg mx-auto space-y-5">
	<!-- Header -->
	<div>
		<a href="/tools" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; {tr('nav.back')}</a>
		<h1 class="text-xl font-bold mt-2">{tr('ipm.title')}</h1>
		<p class="text-gb-text-muted text-sm">Integrierte Schädlingsbekämpfung — wissenschaftlich fundiert, evidenzbasiert</p>
	</div>

	<!-- Neem Warning -->
	<div class="bg-gb-danger/10 border border-gb-danger/20 rounded-lg p-3 text-sm text-gb-danger font-medium">
		Kein Neem-Öl bei Cannabis! Azadirachtin-Rückstände sind gesundheitsschädlich und bei consumable Cannabis nicht zugelassen.
	</div>

	<!-- Prevention Overview -->
	<details class="bg-gb-surface rounded-xl overflow-hidden">
		<summary class="p-4 cursor-pointer font-semibold flex items-center gap-2 hover:bg-gb-surface-2 transition-colors">
			<span class="text-lg">🛡️</span>
			<span>Prävention — Die wichtigste Maßnahme</span>
		</summary>
		<div class="px-4 pb-4 space-y-3 border-t border-gb-border">
			<p class="text-sm text-gb-text-muted pt-3">
				80% aller Schädlingsprobleme lassen sich durch korrekte Prävention vermeiden.
				Behandlung ist immer der letzte Ausweg.
			</p>
			<div class="space-y-2">
				<div class="flex gap-2 items-start text-sm">
					<span class="text-gb-green shrink-0 font-bold">1.</span>
					<div>
						<p class="font-medium">Luftzirkulation</p>
						<p class="text-gb-text-muted text-xs">Oszillierende Ventilatoren, keine toten Ecken. Stehende Luft = Schädlinge + Schimmel.</p>
					</div>
				</div>
				<div class="flex gap-2 items-start text-sm">
					<span class="text-gb-green shrink-0 font-bold">2.</span>
					<div>
						<p class="font-medium">VPD / Luftfeuchtigkeit kontrollieren</p>
						<p class="text-gb-text-muted text-xs">Veg: 55-65% RH. Blüte: 40-55% RH. Spinnmilben lieben trockene Luft, Mehltau liebt feuchte.</p>
					</div>
				</div>
				<div class="flex gap-2 items-start text-sm">
					<span class="text-gb-green shrink-0 font-bold">3.</span>
					<div>
						<p class="font-medium">Saubere Umgebung</p>
						<p class="text-gb-text-muted text-xs">Pflanzenreste entfernen, Werkzeug desinfizieren, Growraum regelmäßig reinigen.</p>
					</div>
				</div>
				<div class="flex gap-2 items-start text-sm">
					<span class="text-gb-green shrink-0 font-bold">4.</span>
					<div>
						<p class="font-medium">Quarantäne neuer Pflanzen</p>
						<p class="text-gb-text-muted text-xs">Neue Stecklinge/Pflanzen mindestens 7 Tage separat halten und auf Befall prüfen.</p>
					</div>
				</div>
				<div class="flex gap-2 items-start text-sm">
					<span class="text-gb-green shrink-0 font-bold">5.</span>
					<div>
						<p class="font-medium">Regelmäßige Inspektion</p>
						<p class="text-gb-text-muted text-xs">Blattunterseiten prüfen, Gelbtafeln aufhängen, bei erstem Anzeichen sofort handeln.</p>
					</div>
				</div>
			</div>
		</div>
	</details>

	<!-- Pest Sections -->
	<h2 class="text-base font-semibold text-gb-text-muted pt-2">Schädlinge & Krankheiten</h2>

	{#each PESTS as pest}
		<details class="bg-gb-surface rounded-xl overflow-hidden">
			<summary class="p-4 cursor-pointer hover:bg-gb-surface-2 transition-colors flex items-center gap-3">
				<span class="text-2xl shrink-0">{pestIcon(pest.id)}</span>
				<div class="flex-1 min-w-0">
					<p class="font-semibold">{pest.german}</p>
					<p class="text-xs text-gb-text-muted truncate">{pest.name} — {pest.symptoms[0]}</p>
				</div>
				<svg class="w-5 h-5 text-gb-text-muted shrink-0 transition-transform details-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M9 18l6-6-6-6" />
				</svg>
			</summary>

			<div class="px-4 pb-4 space-y-4 border-t border-gb-border">
				<!-- Erkennung -->
				<div class="pt-3">
					<h3 class="text-sm font-semibold text-gb-danger mb-2">Erkennung / Symptome</h3>
					<ul class="space-y-1">
						{#each pest.symptoms as s}
							<li class="text-sm text-gb-text-muted flex gap-2">
								<span class="text-gb-danger shrink-0">•</span>{s}
							</li>
						{/each}
					</ul>
				</div>

				<!-- Prävention -->
				<div>
					<h3 class="text-sm font-semibold text-gb-info mb-2">Prävention</h3>
					<ul class="space-y-1">
						{#each pest.prevention as p}
							<li class="text-sm text-gb-text-muted flex gap-2">
								<span class="text-gb-info shrink-0">•</span>{p}
							</li>
						{/each}
					</ul>
				</div>

				<!-- Biologische Bekämpfung -->
				<div>
					<h3 class="text-sm font-semibold text-gb-green mb-2">Bekämpfung</h3>
					<div class="space-y-2">
						{#each pest.solutions as sol}
							<div class="bg-gb-bg rounded-lg p-3">
								<div class="flex items-start justify-between gap-2">
									<div class="min-w-0 flex-1">
										<p class="font-medium text-sm">{sol.name}</p>
										<div class="flex flex-wrap gap-1.5 mt-1">
											<span class="text-xs px-1.5 py-0.5 rounded {solutionTypeColor(sol.type)}">
												{solutionTypeLabel(sol.type)}
											</span>
											<span class="text-xs px-1.5 py-0.5 rounded {sol.safe_in_flower ? 'bg-gb-green/20 text-gb-green' : 'bg-gb-warning/20 text-gb-warning'}">
												{sol.safe_in_flower ? 'Blüte OK' : 'Nur Veg'}
											</span>
										</div>
										{#if sol.product}
											<p class="text-xs text-gb-accent mt-1">Produkt: {sol.product}</p>
										{/if}
										<p class="text-xs text-gb-text-muted mt-1">{sol.note}</p>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</details>
	{/each}

	<!-- Biologische Helfer Übersicht -->
	<details class="bg-gb-surface rounded-xl overflow-hidden">
		<summary class="p-4 cursor-pointer font-semibold flex items-center gap-2 hover:bg-gb-surface-2 transition-colors">
			<span class="text-lg">🐞</span>
			<span>Nützlinge — Biologische Helfer</span>
		</summary>
		<div class="px-4 pb-4 border-t border-gb-border">
			<p class="text-sm text-gb-text-muted pt-3 mb-3">
				Nützlinge sind die sicherste und effektivste Bekämpfungsmethode —
				auch in der Blüte einsetzbar, keine Rückstände.
			</p>
			<div class="space-y-2 text-sm">
				<div class="bg-gb-bg rounded-lg p-3">
					<p class="font-medium">Phytoseiulus persimilis</p>
					<p class="text-xs text-gb-text-muted">Raubmilbe gegen Spinnmilben. Braucht hohe RH (>60%).</p>
				</div>
				<div class="bg-gb-bg rounded-lg p-3">
					<p class="font-medium">Amblyseius swirskii</p>
					<p class="text-xs text-gb-text-muted">Breitband-Raubmilbe gegen Thripse, Weiße Fliege, Spinnmilben.</p>
				</div>
				<div class="bg-gb-bg rounded-lg p-3">
					<p class="font-medium">Amblyseius californicus</p>
					<p class="text-xs text-gb-text-muted">Raubmilbe, überlebt auch ohne Beute — ideal zur Prävention.</p>
				</div>
				<div class="bg-gb-bg rounded-lg p-3">
					<p class="font-medium">Orius laevigatus</p>
					<p class="text-xs text-gb-text-muted">Raubwanze, sehr effektiv gegen Thripse.</p>
				</div>
				<div class="bg-gb-bg rounded-lg p-3">
					<p class="font-medium">Chrysoperla carnea</p>
					<p class="text-xs text-gb-text-muted">Florfliegenlarven — Generalisten, fressen Blattläuse, Thripse, Spinnmilben.</p>
				</div>
				<div class="bg-gb-bg rounded-lg p-3">
					<p class="font-medium">Hypoaspis miles</p>
					<p class="text-xs text-gb-text-muted">Bodenraubmilbe gegen Trauermücken-Larven und Thripse-Puppen.</p>
				</div>
				<div class="bg-gb-bg rounded-lg p-3">
					<p class="font-medium">Encarsia formosa</p>
					<p class="text-xs text-gb-text-muted">Schlupfwespe gegen Weiße Fliege.</p>
				</div>
				<div class="bg-gb-bg rounded-lg p-3">
					<p class="font-medium">Trichogramma</p>
					<p class="text-xs text-gb-text-muted">Schlupfwespen gegen Raupeneier (Outdoor).</p>
				</div>
			</div>
		</div>
	</details>

	<!-- Bio-Mittel Übersicht -->
	<details class="bg-gb-surface rounded-xl overflow-hidden">
		<summary class="p-4 cursor-pointer font-semibold flex items-center gap-2 hover:bg-gb-surface-2 transition-colors">
			<span class="text-lg">🧪</span>
			<span>Biologische Mittel — Übersicht</span>
		</summary>
		<div class="px-4 pb-4 border-t border-gb-border">
			<p class="text-sm text-gb-text-muted pt-3 mb-3">
				Nur organische, evidenzbasierte Mittel. Immer Herstellerangaben beachten.
			</p>
			<div class="space-y-2 text-sm">
				<div class="bg-gb-bg rounded-lg p-3">
					<div class="flex justify-between items-start">
						<p class="font-medium">Bacillus thuringiensis (Bt/Bti)</p>
						<span class="text-xs px-1.5 py-0.5 rounded bg-gb-green/20 text-gb-green shrink-0">Blüte OK</span>
					</div>
					<p class="text-xs text-gb-text-muted mt-1">Bt kurstaki gegen Raupen, Bti gegen Trauermücken. Spezifisch, keine Nützlingsschäden.</p>
				</div>
				<div class="bg-gb-bg rounded-lg p-3">
					<div class="flex justify-between items-start">
						<p class="font-medium">Spinosad</p>
						<span class="text-xs px-1.5 py-0.5 rounded bg-gb-warning/20 text-gb-warning shrink-0">Nur Veg</span>
					</div>
					<p class="text-xs text-gb-text-muted mt-1">Aus Saccharopolyspora spinosa, wirksam gegen Thripse und Raupen. Min. 3 Tage Karenzzeit.</p>
				</div>
				<div class="bg-gb-bg rounded-lg p-3">
					<div class="flex justify-between items-start">
						<p class="font-medium">Kaliseife (Schmierseife)</p>
						<span class="text-xs px-1.5 py-0.5 rounded bg-gb-warning/20 text-gb-warning shrink-0">Nur Veg</span>
					</div>
					<p class="text-xs text-gb-text-muted mt-1">Kontaktmittel gegen weichhäutige Insekten. Nie in der Blüte — Geschmack/Rückstände auf Buds.</p>
				</div>
				<div class="bg-gb-bg rounded-lg p-3">
					<div class="flex justify-between items-start">
						<p class="font-medium">Beauveria bassiana</p>
						<span class="text-xs px-1.5 py-0.5 rounded bg-gb-green/20 text-gb-green shrink-0">Blüte OK</span>
					</div>
					<p class="text-xs text-gb-text-muted mt-1">Entomopathogener Pilz, infiziert Schädlinge bei Kontakt. Wirksam gegen Spinnmilben, Thripse, Weiße Fliege.</p>
				</div>
				<div class="bg-gb-bg rounded-lg p-3">
					<div class="flex justify-between items-start">
						<p class="font-medium">Bacillus amyloliquefaciens</p>
						<span class="text-xs px-1.5 py-0.5 rounded bg-gb-green/20 text-gb-green shrink-0">Blüte OK</span>
					</div>
					<p class="text-xs text-gb-text-muted mt-1">Biologisches Fungizid gegen Mehltau. Konkurrenz um Nährstoffe auf der Blattoberfläche.</p>
				</div>
				<div class="bg-gb-bg rounded-lg p-3">
					<div class="flex justify-between items-start">
						<p class="font-medium">Steinernema feltiae</p>
						<span class="text-xs px-1.5 py-0.5 rounded bg-gb-green/20 text-gb-green shrink-0">Blüte OK</span>
					</div>
					<p class="text-xs text-gb-text-muted mt-1">Nematoden zum Gießen. Parasitieren Trauermücken-Larven im Substrat.</p>
				</div>
			</div>
		</div>
	</details>

	<!-- Disclaimer -->
	<div class="bg-gb-surface-2 rounded-lg p-3 text-xs text-gb-text-muted">
		<p class="font-medium mb-1">Hinweis</p>
		<p>
			Dieser Guide basiert auf aktueller IPM-Forschung für Cannabis. Lokale Gesetze zu Pflanzenschutzmitteln beachten.
			Bei starkem Befall: Professionelle Beratung einholen. Produkte nur nach Herstellerangaben anwenden.
		</p>
	</div>
</div>

<style>
	details[open] > summary svg {
		transform: rotate(90deg);
	}
</style>
