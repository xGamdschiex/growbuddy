<script lang="ts">
	/**
	 * Datenschutzerklärung — DSGVO-orientiert.
	 * Erreichbar via /privacy (App + Web).
	 *
	 * Private App für einen begrenzten Nutzerkreis (kein öffentlicher Store-Release).
	 * Keine Rechtsberatung — vor Verlass im Zweifel anwaltlich prüfen lassen.
	 */
	const STAND = '27. Mai 2026';
	const VERSION = '2.0';
	const CONTACT = 'lauritz.wirtz@gmail.com';
</script>

<svelte:head>
	<title>Datenschutz — GrowBuddy</title>
	<meta name="description" content="Datenschutzerklärung von GrowBuddy — lokale Datenhoheit, Fotos verlassen das Gerät nie, optionale Metadaten-Synchronisation." />
</svelte:head>

<div class="px-4 pt-6 max-w-2xl mx-auto pb-24 space-y-6">
	<div>
		<a href="/about" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; Über</a>
		<h1 class="text-2xl font-bold mt-1">🔒 Datenschutzerklärung</h1>
		<p class="text-xs text-gb-text-muted mt-1">Stand: {STAND} · Version {VERSION}</p>
	</div>

	<section class="space-y-2">
		<h2 class="text-lg font-bold">1. Verantwortlicher</h2>
		<p class="text-sm leading-relaxed text-gb-text-muted">
			Lauritz Wirtz · 55116 Mainz · Deutschland<br />
			E-Mail: <a href="mailto:{CONTACT}" class="text-gb-info hover:underline">{CONTACT}</a>
		</p>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-bold">2. Überblick</h2>
		<p class="text-sm leading-relaxed">
			GrowBuddy ist ein <strong>lokal-first</strong> Grow-Journal. Alle Daten werden
			<strong>auf deinem Gerät</strong> gespeichert. <strong>Fotos verlassen dein Gerät nie</strong> —
			sie liegen ausschließlich lokal (IndexedDB). Eine Cloud-Synchronisation der reinen
			Textdaten ist <strong>optional</strong> und nur nach Login aktiv; sie lässt sich mit dem
			Schalter „Nur lokal" jederzeit komplett abschalten.
		</p>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-bold">3. Welche Daten werden verarbeitet?</h2>

		<h3 class="text-sm font-semibold mt-3">3.1 Lokale Daten (auf deinem Gerät, immer)</h3>
		<ul class="text-sm space-y-1 list-disc list-inside text-gb-text-muted leading-relaxed">
			<li>Grows (Name, Strain, Substrat, Phase, Notizen)</li>
			<li>Check-ins (Datum, Temperatur, EC, pH, VPD, Bewässerung, Notizen)</li>
			<li><strong>Fotos</strong> (Thumbnail + Original) — in der IndexedDB deines Geräts</li>
			<li>Einstellungen (Sprache, Reminder-Zeit, EC-Einheit, Haushalts-Größe)</li>
			<li>App-State (Onboarding-Status, XP, Streak)</li>
		</ul>
		<p class="text-xs text-gb-text-muted">
			<strong>Speicherort:</strong> localStorage (Textdaten) + IndexedDB (Fotos) auf deinem Gerät.
			<strong>Zugriff:</strong> Nur du. Wir haben keinen Zugriff auf lokale Daten.
		</p>

		<h3 class="text-sm font-semibold mt-3">3.2 Cloud-Daten (optional, nur bei aktiver Anmeldung)</h3>
		<p class="text-sm leading-relaxed">
			Wenn du dich mit E-Mail-Magic-Link oder Google OAuth anmeldest und „Nur lokal" nicht
			aktiv ist, synchronisieren wir folgende Daten mit unserem Backend (Supabase, EU-Server):
		</p>
		<ul class="text-sm space-y-1 list-disc list-inside text-gb-text-muted leading-relaxed">
			<li>E-Mail-Adresse (Account-ID)</li>
			<li>Grows + Check-ins — <strong>nur Text & Messwerte, KEINE Fotos</strong></li>
			<li>Sync-Metadaten (<code class="text-xs">updated_at</code>, Konflikt-Auflösung)</li>
		</ul>
		<p class="text-xs text-gb-text-muted">
			<strong>Fotos werden nicht hochgeladen</strong> und bleiben rein lokal.<br />
			<strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung — Sync).<br />
			<strong>Speicherort:</strong> Supabase EU (Frankfurt am Main, Deutschland).<br />
			<strong>Speicherdauer:</strong> Bis zur Konto-Löschung (in der App: Einstellungen → Konto löschen).
		</p>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-bold">4. Was wir NICHT erheben</h2>
		<ul class="text-sm space-y-1 leading-relaxed">
			<li>❌ Keine Werbung, kein Tracking</li>
			<li>❌ Keine Analyse-Tools (Google Analytics, Firebase Analytics, etc.)</li>
			<li>❌ Keine Cookies (außer technisch nötige Session-Tokens bei Cloud-Sync)</li>
			<li>❌ Kein Verkauf an Dritte</li>
			<li>❌ Keine automatischen Crash-Reports</li>
			<li>❌ Kein Standort, keine Kontakte, keine Telefon-IDs</li>
			<li>❌ Kein Foto-Upload, kein öffentliches Profil, kein Community-Feed</li>
		</ul>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-bold">5. Drittanbieter</h2>

		<h3 class="text-sm font-semibold mt-3">5.1 Supabase (EU) — nur bei Login</h3>
		<p class="text-xs text-gb-text-muted leading-relaxed">
			Synchronisation der Textdaten über Supabase Inc., Server in Frankfurt am Main.
			<a href="https://supabase.com/privacy" target="_blank" rel="noopener" class="text-gb-info hover:underline">supabase.com/privacy</a>
		</p>

		<h3 class="text-sm font-semibold mt-3">5.2 Google OAuth (optional)</h3>
		<p class="text-xs text-gb-text-muted leading-relaxed">
			Bei &quot;Mit Google anmelden&quot; erhalten wir deine E-Mail + Google-User-ID.
			<a href="https://policies.google.com/privacy" target="_blank" rel="noopener" class="text-gb-info hover:underline">policies.google.com/privacy</a>
		</p>

		<h3 class="text-sm font-semibold mt-3">5.3 Google Gemini (nur bei AI-Pflanzen-Doktor)</h3>
		<p class="text-xs text-gb-text-muted leading-relaxed">
			Nur wenn du den AI-Pflanzen-Doktor aktiv nutzt, wird das betreffende Foto (optional mit
			Grow-Kontext) an die Google-Gemini-API gesendet, um eine Diagnose zu erstellen. Ohne
			Nutzung dieses Features verlässt kein Foto das Gerät.
			<a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener" class="text-gb-info hover:underline">ai.google.dev</a>
		</p>

		<h3 class="text-sm font-semibold mt-3">5.4 Vercel (Web-Version)</h3>
		<p class="text-xs text-gb-text-muted leading-relaxed">
			Statisches Hosting der Web-Version.
			<a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener" class="text-gb-info hover:underline">vercel.com/legal/privacy-policy</a>
		</p>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-bold">6. Deine Rechte (DSGVO)</h2>
		<p class="text-sm leading-relaxed">Du hast jederzeit Anspruch auf:</p>
		<ul class="text-sm space-y-1 list-disc list-inside text-gb-text-muted leading-relaxed">
			<li><strong>Auskunft</strong> (Art. 15 DSGVO): Welche Daten haben wir gespeichert?</li>
			<li><strong>Berichtigung</strong> (Art. 16 DSGVO): Falsche Daten korrigieren</li>
			<li><strong>Löschung</strong> (Art. 17 DSGVO): &quot;Recht auf Vergessenwerden&quot;</li>
			<li><strong>Einschränkung</strong> (Art. 18 DSGVO): Verarbeitung pausieren</li>
			<li><strong>Datenübertragbarkeit</strong> (Art. 20 DSGVO): JSON-Export deiner Daten<br />
				<span class="text-xs">→ In-App: Einstellungen → Daten → Export</span>
			</li>
			<li><strong>Widerspruch</strong> (Art. 21 DSGVO): Cloud-Sync abschalten via „Nur lokal" oder Logout</li>
		</ul>
		<p class="text-xs text-gb-text-muted">
			Anfragen an <a href="mailto:{CONTACT}" class="text-gb-info hover:underline">{CONTACT}</a>
		</p>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-bold">7. Fotos &amp; Kamera</h2>
		<p class="text-sm leading-relaxed">
			Die Kamera-/Medien-Berechtigung wird <strong>nur lokal</strong> für Check-in-Fotos benötigt.
			Fotos werden als kleines Anzeige-Bild <strong>und im Original</strong> ausschließlich in der
			IndexedDB deines Geräts gespeichert. <strong>Sie werden nicht in die Cloud hochgeladen</strong>
			und nicht geteilt. Einzige Ausnahme: Wenn du den AI-Pflanzen-Doktor (Abschnitt 5.3) nutzt,
			wird das jeweilige Foto an Google Gemini gesendet.
		</p>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-bold">8. Push-Benachrichtigungen</h2>
		<p class="text-sm leading-relaxed">
			Lokale Benachrichtigungen für tägliche Check-in-Erinnerungen werden <strong>nur lokal
			auf deinem Gerät</strong> geplant (Capacitor LocalNotifications). Wir versenden keine
			Server-Push-Nachrichten.
		</p>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-bold">9. Kinder &amp; Jugendschutz</h2>
		<p class="text-sm leading-relaxed">
			GrowBuddy ist ausschließlich für volljährige Personen (18+) bestimmt.
		</p>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-bold">10. Änderungen</h2>
		<p class="text-sm leading-relaxed">
			Diese Datenschutzerklärung kann angepasst werden. Die jeweils aktuelle Version
			ist immer in der App (Einstellungen → Rechtliches → Datenschutz) einsehbar.
		</p>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-bold">11. Beschwerderecht</h2>
		<p class="text-sm leading-relaxed">
			Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren:
		</p>
		<p class="text-xs text-gb-text-muted leading-relaxed">
			Landesbeauftragter für den Datenschutz Rheinland-Pfalz<br />
			Hintere Bleiche 34, 55116 Mainz<br />
			<a href="https://www.datenschutz.rlp.de" target="_blank" rel="noopener" class="text-gb-info hover:underline">datenschutz.rlp.de</a>
		</p>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-bold">12. Kontakt</h2>
		<p class="text-sm leading-relaxed">
			Datenschutz-Anfragen + allgemeine Fragen:<br />
			<a href="mailto:{CONTACT}" class="text-gb-info hover:underline">{CONTACT}</a>
		</p>
	</section>

	<hr class="border-gb-border" />

	<p class="text-[11px] text-gb-text-muted text-center pt-2">
		GrowBuddy · Made with 🌱 in Mainz · {new Date().getFullYear()}
	</p>
</div>
