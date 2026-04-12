<script lang="ts">
	import { t } from '$lib/i18n';
	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
	let tab = $state<'impressum' | 'datenschutz'>('impressum');
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-6 pb-24">
	<div>
		<a href="/profile" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; {tr('general.back')}</a>
		<h1 class="text-xl font-bold mt-2">{tr('legal.title')}</h1>
	</div>

	<!-- Tabs -->
	<div class="bg-gb-surface rounded-xl p-1 flex">
		<button onclick={() => tab = 'impressum'}
			class="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors
				{tab === 'impressum' ? 'bg-gb-green text-black' : 'text-gb-text-muted'}">
			{tr('legal.impressum')}
		</button>
		<button onclick={() => tab = 'datenschutz'}
			class="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors
				{tab === 'datenschutz' ? 'bg-gb-green text-black' : 'text-gb-text-muted'}">
			{tr('legal.privacy')}
		</button>
	</div>

	{#if tab === 'impressum'}
		<div class="bg-gb-surface rounded-xl p-5 space-y-4 text-sm leading-relaxed">
			<h2 class="font-bold text-lg">Impressum</h2>

			<div>
				<p class="font-semibold">Angaben gemäß § 5 TMG</p>
				<p class="text-gb-text-muted mt-1">
					GrowBuddy<br>
					Lauritz Wirtz<br>
					[Adresse auf Anfrage]<br>
					Deutschland
				</p>
			</div>

			<div>
				<p class="font-semibold">Kontakt</p>
				<p class="text-gb-text-muted mt-1">
					E-Mail: kontakt@growbuddy.app
				</p>
			</div>

			<div>
				<p class="font-semibold">Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</p>
				<p class="text-gb-text-muted mt-1">Lauritz Wirtz</p>
			</div>

			<div>
				<p class="font-semibold">Haftungsausschluss</p>
				<p class="text-gb-text-muted mt-1">
					Die Inhalte dieser App wurden mit größter Sorgfalt erstellt. Für die Richtigkeit,
					Vollständigkeit und Aktualität der Inhalte übernehmen wir keine Gewähr.
					Die berechneten Nährstoffmengen und Messwerte dienen als Richtwerte und ersetzen
					nicht die eigene Kontrolle mit kalibrierten Messgeräten.
				</p>
			</div>

			<div>
				<p class="font-semibold">Hinweis</p>
				<p class="text-gb-text-muted mt-1">
					GrowBuddy ist ein Werkzeug für legalen Pflanzenanbau. Der Nutzer ist selbst
					verantwortlich für die Einhaltung geltender Gesetze in seinem Land/Bundesland.
				</p>
			</div>
		</div>
	{:else}
		<div class="bg-gb-surface rounded-xl p-5 space-y-4 text-sm leading-relaxed">
			<h2 class="font-bold text-lg">Datenschutzerklärung</h2>

			<div>
				<p class="font-semibold">1. Datenspeicherung</p>
				<p class="text-gb-text-muted mt-1">
					GrowBuddy speichert alle Daten <strong>ausschließlich lokal</strong> auf deinem Gerät
					(localStorage). Es werden keine Daten an Server übertragen, solange du keinen
					Cloud-Sync aktivierst.
				</p>
			</div>

			<div>
				<p class="font-semibold">2. Welche Daten werden gespeichert?</p>
				<p class="text-gb-text-muted mt-1">
					• Grow-Daten: Strain, Messwerte, Fotos (komprimiert, lokal)<br>
					• Check-in-Daten: Temperatur, Luftfeuchte, VPD, EC, pH<br>
					• Einstellungen: Sprache, Erinnerungszeiten, Tier-Status<br>
					• XP/Level: Spielfortschritt und Achievements
				</p>
			</div>

			<div>
				<p class="font-semibold">3. Fotos</p>
				<p class="text-gb-text-muted mt-1">
					Fotos werden auf max. 800px verkleinert und als JPEG (Qualität 70%) komprimiert
					im localStorage gespeichert. Fotos verlassen nie dein Gerät, es sei denn du
					aktivierst Cloud-Sync (zukünftig).
				</p>
			</div>

			<div>
				<p class="font-semibold">4. Cloud-Sync (optional, zukünftig)</p>
				<p class="text-gb-text-muted mt-1">
					Wenn Cloud-Sync aktiviert wird, werden deine Daten verschlüsselt auf Servern
					in der EU (Supabase, Frankfurt) gespeichert. Du kannst Cloud-Sync jederzeit
					deaktivieren und deine Cloud-Daten löschen.
				</p>
			</div>

			<div>
				<p class="font-semibold">5. Analytics</p>
				<p class="text-gb-text-muted mt-1">
					Wir verwenden keine Tracking-Tools, Cookies oder Analytics-Dienste.
					Es werden keine Nutzungsdaten an Dritte weitergegeben.
				</p>
			</div>

			<div>
				<p class="font-semibold">6. Deine Rechte (DSGVO)</p>
				<p class="text-gb-text-muted mt-1">
					Du hast das Recht auf Auskunft, Berichtigung, Löschung und Datenübertragbarkeit.
					Da alle Daten lokal auf deinem Gerät liegen, hast du volle Kontrolle.
					Lösche einfach die App oder den Browser-Cache um alle Daten zu entfernen.
				</p>
			</div>

			<div>
				<p class="font-semibold">7. Kontakt</p>
				<p class="text-gb-text-muted mt-1">
					Bei Fragen zum Datenschutz: kontakt@growbuddy.app
				</p>
			</div>

			<p class="text-xs text-gb-text-muted">Stand: April 2026</p>
		</div>
	{/if}
</div>
