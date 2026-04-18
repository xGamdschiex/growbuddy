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
				<p class="font-semibold">4. Cloud-Sync (optional, nach Login)</p>
				<p class="text-gb-text-muted mt-1">
					Wenn du dich einloggst und Cloud-Sync nutzt, werden deine Grows + Check-ins
					verschlüsselt auf Servern in der EU (Supabase, Frankfurt) gespeichert.
					Fotos werden in einem privaten Storage-Bucket abgelegt, nur du kannst sie lesen
					(Row-Level-Security, Signed URLs mit 7-Tage-Gültigkeit).
					Du kannst Cloud-Sync jederzeit deaktivieren und deine Cloud-Daten löschen.
				</p>
			</div>

			<div>
				<p class="font-semibold">5. AI Plant Doctor (optional, Pro-Feature)</p>
				<p class="text-gb-text-muted mt-1">
					Wenn du den AI Plant Doctor nutzt, wird das Foto + optional Grow-Kontext
					(Phase, Klima, letzter Check-in) an Google Gemini 2.0 API gesendet, um
					die Diagnose zu erstellen. Google verarbeitet die Daten gemäß Google AI
					Datenschutzbestimmungen. Nutze das Feature nur, wenn du damit einverstanden bist.
				</p>
			</div>

			<div>
				<p class="font-semibold">6. Push-Benachrichtigungen</p>
				<p class="text-gb-text-muted mt-1">
					Optional kannst du tägliche Check-in-Reminder aktivieren. Die Zeitplanung
					erfolgt lokal auf deinem Gerät (Service Worker / Capacitor Local Notifications).
					Es werden keine Daten an Server gesendet.
				</p>
			</div>

			<div>
				<p class="font-semibold">7. Authentifizierung</p>
				<p class="text-gb-text-muted mt-1">
					Login erfolgt via Magic-Link (E-Mail) oder Google OAuth über Supabase Auth.
					Deine E-Mail-Adresse wird ausschließlich für Authentifizierung genutzt,
					nicht für Marketing oder Tracking.
				</p>
			</div>

			<div>
				<p class="font-semibold">8. Zahlungen (Pro-Abo)</p>
				<p class="text-gb-text-muted mt-1">
					Pro-Abonnements werden über Stripe abgewickelt. Wir speichern keine
					Zahlungsdaten. Details unter stripe.com/privacy.
				</p>
			</div>

			<div>
				<p class="font-semibold">9. Analytics</p>
				<p class="text-gb-text-muted mt-1">
					Wir verwenden keine Tracking-Tools, Cookies oder Analytics-Dienste.
					Es werden keine Nutzungsdaten an Dritte weitergegeben.
				</p>
			</div>

			<div>
				<p class="font-semibold">10. Deine Rechte (DSGVO)</p>
				<p class="text-gb-text-muted mt-1">
					Du hast das Recht auf Auskunft, Berichtigung, Löschung und Datenübertragbarkeit.
					Lokal: App oder Browser-Cache löschen entfernt alle Daten.
					Cloud-Sync: Nutze "Export" in Einstellungen zum Download, oder kontaktiere uns
					für Komplett-Löschung.
				</p>
			</div>

			<div>
				<p class="font-semibold">11. Kontakt</p>
				<p class="text-gb-text-muted mt-1">
					Bei Fragen zum Datenschutz: kontakt@growbuddy.app
				</p>
			</div>

			<p class="text-xs text-gb-text-muted">Stand: April 2026</p>
		</div>
	{/if}
</div>
