<script lang="ts">
	import { xpStore } from '$lib/stores/xp';
	import { t } from '$lib/i18n';
	import { onMount } from 'svelte';
	xpStore.awardToolUse('training');

	let tr = $state<any>((k: string) => k);

	onMount(() => t.subscribe(v => tr = v));

	interface Technique {
		id: string;
		name: string;
		subtitle: string;
		type: 'LST' | 'HST';
		difficulty: 'Anfaenger' | 'Fortgeschritten' | 'Erfahren';
		suitable: 'Auto' | 'Photo' | 'Beide';
		when: string;
		phase: string;
		description: string;
		steps: string[];
		pros: string[];
		risks: string[];
	}

	const techniques: Technique[] = [
		{
			id: 'lst',
			name: 'LST (Low Stress Training)',
			subtitle: 'Biegen und fixieren',
			type: 'LST',
			difficulty: 'Anfaenger',
			suitable: 'Beide',
			when: 'Ab dem 4. Node',
			phase: 'Veg bis Woche 2 Bluete',
			description: 'Die Pflanze wird vorsichtig heruntergebogen und mit Draht oder Clips fixiert. Dadurch entsteht ein flaches, gleichmaessiges Canopy und mehr Bluetenstellen bekommen Licht.',
			steps: [
				'Warte bis die Pflanze 4-5 Nodes hat',
				'Biege den Haupttrieb vorsichtig zur Seite (ca. 90 Grad)',
				'Fixiere mit weichem Draht, Pflanzendraht oder LST-Clips am Topfrand',
				'Wiederhole taeglich mit neuen Trieben, die nach oben wachsen',
				'Stoppe das Training in Woche 2 der Bluete',
			],
			pros: [
				'Kein Stress-Risiko — Pflanze waechst sofort weiter',
				'Ideal fuer Autoflowers (keine Recovery-Zeit noetig)',
				'Mehr Bluetenstellen im Licht = mehr Ertrag',
				'Kombination mit ScrOG moeglich',
			],
			risks: [
				'Bei zu starkem Biegen kann der Trieb abknicken',
				'Muss regelmaessig kontrolliert und nachgebogen werden',
			],
		},
		{
			id: 'topping',
			name: 'Topping',
			subtitle: 'Haupttrieb abschneiden',
			type: 'HST',
			difficulty: 'Anfaenger',
			suitable: 'Photo',
			when: 'Ueber dem 5. Node schneiden',
			phase: 'Vegetative Phase',
			description: 'Der Haupttrieb wird sauber ueber dem 5. Node abgeschnitten. Daraus entstehen 2 neue Haupttriebe. Topping ist die Basis fuer viele weitere Techniken wie Mainlining.',
			steps: [
				'Warte bis die Pflanze mindestens 5-6 Nodes hat',
				'Desinfiziere Schere oder Skalpell mit Alkohol',
				'Schneide den Haupttrieb direkt ueber dem 5. Node sauber ab',
				'Lasse 1-2cm Stumpf stehen (nicht zu knapp schneiden)',
				'Gib der Pflanze 5-7 Tage zur Erholung bevor du weiteres Training machst',
			],
			pros: [
				'Verdoppelt die Haupttriebe (1 wird zu 2)',
				'Gleichmaessigeres Canopy als ohne Training',
				'Einfach durchzufuehren',
				'Kann mehrfach wiederholt werden (Manifold-Aufbau)',
			],
			risks: [
				'NICHT fuer Autoflowers empfohlen — keine Zeit zur Erholung',
				'5-7 Tage Recovery-Zeit (verzoegert den Grow)',
				'Infektionsrisiko bei unsauberen Werkzeugen',
			],
		},
		{
			id: 'fim',
			name: 'FIM (Fuck I Missed)',
			subtitle: '75% der Spitze entfernen',
			type: 'HST',
			difficulty: 'Fortgeschritten',
			suitable: 'Photo',
			when: 'Am 4.-5. Node',
			phase: 'Vegetative Phase',
			description: 'Statt den Trieb komplett abzuschneiden (Topping), werden nur ca. 75% des neuen Wachstums entfernt. Das Ergebnis: bis zu 4 neue Triebe statt nur 2.',
			steps: [
				'Warte bis die Pflanze 4-5 Nodes hat',
				'Identifiziere den neuesten Wachstumspunkt (Spitze)',
				'Entferne ca. 75% des neuen Wachstums — NICHT den ganzen Trieb',
				'Am besten mit den Fingern abknipsen (weniger praezise = gewollt)',
				'Warte 7-10 Tage — es sollten 3-4 neue Triebe erscheinen',
			],
			pros: [
				'Bis zu 4 neue Triebe (statt 2 beim Topping)',
				'Weniger Stress als komplettes Topping',
				'Schnellere Erholung als beim Topping',
			],
			risks: [
				'Ergebnis weniger vorhersehbar als Topping',
				'Manchmal entstehen nur 2 statt 4 Triebe',
				'NICHT fuer Autos empfohlen',
				'Erfordert etwas Uebung fuer die richtige Menge',
			],
		},
		{
			id: 'scrog',
			name: 'ScrOG (Screen of Green)',
			subtitle: 'Netz-Setup und Tuck-Technik',
			type: 'LST',
			difficulty: 'Fortgeschritten',
			suitable: 'Beide',
			when: 'Netz bei ca. 40cm Hoehe installieren',
			phase: 'Spaete Veg bis Woche 2 Bluete',
			description: 'Ein Netz (Maschenweite 5-10cm) wird horizontal ueber den Pflanzen gespannt. Triebe werden systematisch unter dem Netz hindurchgeflochten ("tucken"). Ergibt die besten Ertraege pro Quadratmeter indoor.',
			steps: [
				'Installiere ein Netz (SCROG-Netz oder Rankhilfe) auf ca. 40cm Hoehe',
				'Lasse die Pflanzen ins Netz wachsen',
				'Sobald ein Trieb 5cm ueber das Netz waechst: unter das Netz zurueckstecken (tucken)',
				'Verteile die Triebe gleichmaessig ueber die gesamte Netzflaeche',
				'Tucke taeglich in der Veg-Phase',
				'Ab Woche 2 Bluete: Aufhoeren zu tucken, Triebe wachsen lassen',
				'Das Netz fuellt sich idealerweise zu 70-80% vor dem Umschalten auf 12/12',
			],
			pros: [
				'Beste Ertraege pro Quadratmeter',
				'Perfekt gleichmaessiges Canopy',
				'Weniger Popcorn-Buds (alles auf gleicher Hoehe)',
				'Funktioniert auch mit Autos (ohne Topping)',
			],
			risks: [
				'Pflanzen lassen sich nach dem Netz-Setup kaum noch bewegen',
				'Schwieriger bei Schaedlingsbefall (Zugang eingeschraenkt)',
				'Timing ist wichtig — zu frueh oder zu spaet mindert den Effekt',
			],
		},
		{
			id: 'mainlining',
			name: 'Mainlining / Manifold',
			subtitle: 'Symmetrischer Aufbau',
			type: 'HST',
			difficulty: 'Erfahren',
			suitable: 'Photo',
			when: 'Ab dem 3. Node, mehrere Topping-Runden',
			phase: 'Vegetative Phase (mind. 4-6 Wochen)',
			description: 'Durch gezieltes Topping wird eine perfekt symmetrische Pflanze mit 8, 16 oder 32 gleichmaessigen Colas aufgebaut. Jeder Trieb bekommt exakt gleich viel Naehrstoffe. Braucht viel Veg-Zeit, liefert aber topgleiche Buds.',
			steps: [
				'Toppe die Pflanze ueber dem 3. Node',
				'Entferne ALLE unteren Triebe und Blaetter (nur die 2 neuen Triebe bleiben)',
				'Lasse die 2 Triebe wachsen bis sie jeweils 3-4 Nodes haben',
				'Toppe beide Triebe erneut → jetzt hast du 4 Triebe',
				'Optional: Nochmal toppen → 8 Triebe (Manifold)',
				'Halte alle Triebe mit LST auf gleicher Hoehe',
				'Erst in Bluete wechseln wenn alle Triebe gleichmaessig sind',
			],
			pros: [
				'Alle Colas sind identisch gross',
				'Perfekte Naehrstoffverteilung',
				'Hervorragend in Kombination mit ScrOG',
				'Beeindruckende gleichmaessige Ernte',
			],
			risks: [
				'NUR fuer Photoperiodische Pflanzen',
				'Braucht mindestens 4-6 Wochen extra Veg-Zeit',
				'Mehrfaches Topping = mehrfacher Stress',
				'Fehler in der Symmetrie sind schwer zu korrigieren',
			],
		},
		{
			id: 'defoliation',
			name: 'Defoliation',
			subtitle: 'Lollipop und Schwartz-Methode',
			type: 'HST',
			difficulty: 'Erfahren',
			suitable: 'Photo',
			when: 'Tag 1 + Tag 21 Bluete (Schwartz-Methode)',
			phase: 'Bluete (gezieltes Timing!)',
			description: 'Grosse Faecherblaetter werden entfernt, damit mehr Licht an die Blueten kommt. Die Schwartz-Methode empfiehlt schwere Defoliation an Tag 1 und Tag 21 der Bluete. Lollipopping entfernt alles unterhalb der oberen Blueten.',
			steps: [
				'Lollipopping: Entferne in der letzten Veg-Woche alles im unteren Drittel (kleine Triebe + Blaetter)',
				'Tag 1 Bluete: Entferne alle grossen Faecherblaetter, die Bluetenstellen beschatten',
				'Lasse die Pflanze 3 Wochen in Ruhe wachsen',
				'Tag 21 Bluete: Zweite schwere Defoliation — entferne erneut grosse Faecherblaetter',
				'NICHT nach Woche 4 defolieren — die Pflanze braucht ihre Blaetter zum Reifen',
				'Entferne NUR Faecherblaetter, NIEMALS Zuckerblaetter (die mit Trichomen)',
			],
			pros: [
				'Massiv mehr Licht an den Blueten',
				'Bessere Luftzirkulation (weniger Schimmelrisiko)',
				'Groessere, dichtere Buds',
				'Weniger Popcorn-Buds',
			],
			risks: [
				'Zu viel Defoliation = Pflanze im Stress, Ertragsverlust',
				'NICHT bei Autos empfohlen (zu wenig Erholungszeit)',
				'Timing ist kritisch — falsch getimed kann es den Ertrag ruinieren',
				'Schwere Defoliation NUR fuer gesunde, gut versorgte Pflanzen',
			],
		},
		{
			id: 'supercropping',
			name: 'Super Cropping',
			subtitle: 'Staengel knicken (HST)',
			type: 'HST',
			difficulty: 'Fortgeschritten',
			suitable: 'Photo',
			when: 'Spaete Veg, bei zu hohen Trieben',
			phase: 'Vegetative Phase',
			description: 'Der Staengel wird zwischen den Fingern vorsichtig gequetscht und geknickt (NICHT gebrochen). An der Knickstelle bildet sich ein verdickter Knoten ("Knuckle"), der mehr Naehrstoffe transportiert. Die Pflanze wird staerker und der Trieb bleibt auf der gewuenschten Hoehe.',
			steps: [
				'Waehle einen Trieb der zu hoch waechst',
				'Greife den Staengel zwischen Daumen und Zeigefinger an der gewuenschten Stelle',
				'Rolle und quetsche den Staengel sanft fuer 5-10 Sekunden bis er sich weich anfuehlt',
				'Biege den Staengel vorsichtig um 90 Grad nach unten',
				'Wenn die Aussenhaut reisst: mit Klebeband stuetzen (heilt in 3-5 Tagen)',
				'Die Pflanze repariert die Stelle und bildet einen dicken Knuckle',
				'Nach 1-2 Wochen ist die Stelle staerker als vorher',
			],
			pros: [
				'Kontrolliert die Hoehe ohne zu schneiden',
				'Knuckle transportiert mehr Naehrstoffe → staerkerer Trieb',
				'Stimuliert Abwehrmechanismen (mehr Trichome)',
				'Kann als Notfall-Loesung bei zu hohen Pflanzen helfen',
			],
			risks: [
				'Staengel kann bei zu viel Kraft komplett brechen',
				'Bei verholzten Trieben sehr schwierig (nur junge, gruene Triebe)',
				'Erfordert Fingerspitzengefuehl',
				'NICHT bei Autos empfohlen',
			],
		},
	];

	function difficultyColor(d: string): string {
		if (d === 'Anfaenger') return 'bg-gb-green/20 text-gb-green';
		if (d === 'Fortgeschritten') return 'bg-gb-accent/20 text-gb-accent';
		return 'bg-gb-danger/20 text-gb-danger';
	}

	function difficultyLabel(d: string): string {
		if (d === 'Anfaenger') return 'Anfänger';
		if (d === 'Fortgeschritten') return 'Fortgeschritten';
		return 'Erfahren';
	}

	function suitableColor(s: string): string {
		if (s === 'Beide') return 'bg-gb-green/20 text-gb-green';
		if (s === 'Auto') return 'bg-gb-info/20 text-gb-info';
		return 'bg-gb-warning/20 text-gb-warning';
	}
</script>

<div class="px-4 pt-6 pb-24 max-w-lg mx-auto space-y-5">
	<div>
		<a href="/tools" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; Tools</a>
		<h1 class="text-xl font-bold mt-2">Pflanzentraining Guide</h1>
		<p class="text-gb-text-muted text-sm">Alle Techniken — wann, wie, für wen</p>
	</div>

	<div class="bg-gb-warning/10 border border-gb-warning/20 rounded-lg p-3 text-sm text-gb-warning">
		<strong>Autoflowers:</strong> NUR LST und ScrOG! Kein Topping, kein HST — Autos haben keine Zeit zur Erholung.
	</div>

	<!-- Legende -->
	<div class="bg-gb-surface rounded-xl p-3 space-y-2">
		<p class="text-xs font-semibold text-gb-text-muted uppercase tracking-wide">Legende</p>
		<div class="flex flex-wrap gap-2 text-xs">
			<span class="px-2 py-0.5 rounded bg-gb-green/20 text-gb-green">LST — Low Stress</span>
			<span class="px-2 py-0.5 rounded bg-gb-accent/20 text-gb-accent">HST — High Stress</span>
		</div>
		<div class="flex flex-wrap gap-2 text-xs">
			<span class="px-2 py-0.5 rounded bg-gb-green/20 text-gb-green">Anfänger</span>
			<span class="px-2 py-0.5 rounded bg-gb-accent/20 text-gb-accent">Fortgeschritten</span>
			<span class="px-2 py-0.5 rounded bg-gb-danger/20 text-gb-danger">Erfahren</span>
		</div>
	</div>

	<!-- Techniken -->
	<div class="space-y-3">
		{#each techniques as tech}
			<details class="bg-gb-surface rounded-xl overflow-hidden group">
				<summary class="p-4 cursor-pointer select-none list-none flex items-start justify-between gap-2 hover:bg-gb-surface-2 transition-colors">
					<div class="flex-1">
						<p class="font-medium">{tech.name}</p>
						<p class="text-xs text-gb-text-muted mt-0.5">{tech.subtitle}</p>
						<div class="flex flex-wrap gap-1.5 mt-2">
							<span class="text-xs px-2 py-0.5 rounded {tech.type === 'LST' ? 'bg-gb-green/20 text-gb-green' : 'bg-gb-accent/20 text-gb-accent'}">
								{tech.type}
							</span>
							<span class="text-xs px-2 py-0.5 rounded {difficultyColor(tech.difficulty)}">
								{difficultyLabel(tech.difficulty)}
							</span>
							<span class="text-xs px-2 py-0.5 rounded {suitableColor(tech.suitable)}">
								{tech.suitable === 'Beide' ? 'Auto + Photo' : tech.suitable === 'Auto' ? 'Auto OK' : 'Nur Photo'}
							</span>
						</div>
					</div>
					<svg class="w-5 h-5 text-gb-text-muted shrink-0 mt-1 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M6 9l6 6 6-6" />
					</svg>
				</summary>

				<div class="px-4 pb-4 space-y-4 border-t border-gb-border">
					<!-- Beschreibung -->
					<p class="text-sm text-gb-text-muted pt-3">{tech.description}</p>

					<!-- Wann & Phase -->
					<div class="grid grid-cols-2 gap-2 text-sm">
						<div class="bg-gb-bg rounded-lg p-2">
							<p class="text-xs text-gb-text-muted">Wann</p>
							<p class="font-medium text-xs mt-0.5">{tech.when}</p>
						</div>
						<div class="bg-gb-bg rounded-lg p-2">
							<p class="text-xs text-gb-text-muted">Phase</p>
							<p class="font-medium text-xs mt-0.5">{tech.phase}</p>
						</div>
					</div>

					<!-- Schritt-fuer-Schritt -->
					<div>
						<h3 class="text-sm font-semibold text-gb-info mb-2">Schritt für Schritt</h3>
						<ol class="space-y-1.5">
							{#each tech.steps as step, i}
								<li class="text-sm text-gb-text-muted flex gap-2">
									<span class="text-gb-info shrink-0 font-mono text-xs mt-0.5">{i + 1}.</span>
									<span>{step}</span>
								</li>
							{/each}
						</ol>
					</div>

					<!-- Vorteile -->
					<div>
						<h3 class="text-sm font-semibold text-gb-green mb-2">Vorteile</h3>
						<ul class="space-y-1">
							{#each tech.pros as pro}
								<li class="text-sm text-gb-text-muted flex gap-2">
									<span class="text-gb-green shrink-0">+</span>{pro}
								</li>
							{/each}
						</ul>
					</div>

					<!-- Risiken -->
					<div>
						<h3 class="text-sm font-semibold text-gb-danger mb-2">Risiken</h3>
						<ul class="space-y-1">
							{#each tech.risks as risk}
								<li class="text-sm text-gb-text-muted flex gap-2">
									<span class="text-gb-danger shrink-0">!</span>{risk}
								</li>
							{/each}
						</ul>
					</div>
				</div>
			</details>
		{/each}
	</div>
</div>
