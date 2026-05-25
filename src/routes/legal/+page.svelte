<script lang="ts">
	import { t } from '$lib/i18n';
	import { onMount } from 'svelte';
	let tr = $state<any>((k: string) => k);
	let tab = $state<'impressum' | 'datenschutz' | 'cannabis'>('impressum');

	onMount(() => {
		const unsub = t.subscribe(v => tr = v);
		// Tab per URL vorwählbar (z.B. /legal?tab=cannabis aus den Einstellungen)
		const urlTab = new URLSearchParams(window.location.search).get('tab');
		if (urlTab === 'cannabis' || urlTab === 'datenschutz') tab = urlTab;
		return unsub;
	});
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-6 pb-24">
	<div>
		<a href="/profile" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; {tr('general.back')}</a>
		<h1 class="text-xl font-bold mt-2">{tr('legal.title')}</h1>
	</div>

	<!-- Tabs -->
	<div class="bg-gb-surface rounded-xl p-1 flex gap-1">
		<button onclick={() => tab = 'impressum'}
			class="flex-1 py-2.5 rounded-lg text-xs font-medium transition-colors
				{tab === 'impressum' ? 'bg-gb-green text-gb-bg' : 'text-gb-text-muted'}">
			{tr('legal.impressum')}
		</button>
		<button onclick={() => tab = 'datenschutz'}
			class="flex-1 py-2.5 rounded-lg text-xs font-medium transition-colors
				{tab === 'datenschutz' ? 'bg-gb-green text-gb-bg' : 'text-gb-text-muted'}">
			{tr('legal.privacy')}
		</button>
		<button onclick={() => tab = 'cannabis'}
			class="flex-1 py-2.5 rounded-lg text-xs font-medium transition-colors
				{tab === 'cannabis' ? 'bg-gb-green text-gb-bg' : 'text-gb-text-muted'}">
			{tr('legal.cannabis')}
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
	{:else if tab === 'datenschutz'}
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
	{:else}
		<!-- Cannabis-Recht (DE KCanG) — vereinfachte Zusammenfassung, keine Rechtsberatung -->
		<div class="bg-gb-surface rounded-xl p-5 space-y-4 text-sm leading-relaxed">
			<h2 class="font-bold text-lg">Cannabis-Recht (Deutschland)</h2>
			<p class="text-gb-text-muted">
				Seit dem 1. April 2024 (Konsumcannabisgesetz, KCanG) ist der private Eigenanbau
				für Volljährige unter Auflagen erlaubt. Die wichtigsten Grenzen im Überblick:
			</p>

			<div>
				<p class="font-semibold">🌿 Pflanzen</p>
				<p class="text-gb-text-muted mt-1">
					Max. <strong>3 lebende Pflanzen gleichzeitig pro volljähriger Person</strong> im Haushalt.
					Leben mehrere Erwachsene zusammen, steigt das Limit entsprechend (2 → 6, 3 → 9 …).
					Die Personenzahl stellst du in den <a href="/settings" class="text-gb-green">Einstellungen</a> ein.
				</p>
			</div>

			<div>
				<p class="font-semibold">⚖️ Besitz</p>
				<p class="text-gb-text-muted mt-1">
					Zuhause bis zu <strong>50 g</strong> getrocknetes Cannabis, unterwegs bis zu <strong>25 g</strong>.
				</p>
			</div>

			<div>
				<p class="font-semibold">🔞 Alter</p>
				<p class="text-gb-text-muted mt-1">Nur für Volljährige (18+).</p>
			</div>

			<div>
				<p class="font-semibold">🔒 Lagerung &amp; Jugendschutz</p>
				<p class="text-gb-text-muted mt-1">
					Pflanzen und Ernte müssen vor dem Zugriff von Kindern und Jugendlichen geschützt
					(z. B. abschließbar) und nicht öffentlich einsehbar aufbewahrt werden.
				</p>
			</div>

			<div>
				<p class="font-semibold">🚫 Konsum-Verbotszonen</p>
				<p class="text-gb-text-muted mt-1">
					Kein Konsum innerhalb von 100 m um Schulen, Spielplätze, Kinder- und Jugendeinrichtungen
					sowie Sportstätten. In Fußgängerzonen erst ab 20 Uhr.
				</p>
			</div>

			<div>
				<p class="font-semibold">🤝 Keine Weitergabe</p>
				<p class="text-gb-text-muted mt-1">
					Anbau ausschließlich für den Eigenbedarf. Die Abgabe, der Verkauf oder das Verschenken
					an andere ist verboten.
				</p>
			</div>

			<div class="bg-gb-warning/10 border border-gb-warning/30 rounded-lg p-3">
				<p class="text-xs text-gb-text-muted leading-relaxed">
					<strong class="text-gb-warning">Keine Rechtsberatung.</strong>
					Vereinfachte Zusammenfassung (Stand 2024/25). Maßgeblich ist allein das KCanG;
					Bundesländer können Details abweichend regeln. Im Zweifel rechtlich prüfen lassen.
				</p>
			</div>
		</div>
	{/if}
</div>
