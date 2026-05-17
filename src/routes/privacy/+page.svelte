<script lang="ts">
	/**
	 * Datenschutzerklärung — DSGVO-konform.
	 * Erreichbar via /privacy (App + Web/Vercel).
	 *
	 * Status: Beta-Draft. Vor Play-Store-Submission anwaltlich prüfen lassen.
	 * Quelle: docs/marketing/privacy-policy-draft.md
	 */
	const STAND = '10. Mai 2026';
	const VERSION = '1.0';
	const CONTACT = 'lauritz.wirtz@gmail.com';
</script>

<svelte:head>
	<title>Datenschutz — GrowBuddy</title>
	<meta name="description" content="Datenschutzerklärung von GrowBuddy — DSGVO-konform, lokale Datenhoheit, optionale Cloud-Synchronisation." />
</svelte:head>

<div class="px-4 pt-6 max-w-2xl mx-auto pb-24 space-y-6">
	<div>
		<a href="/about" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; Über</a>
		<h1 class="text-2xl font-bold mt-1">🔒 Datenschutzerklärung</h1>
		<p class="text-xs text-gb-text-muted mt-1">Stand: {STAND} · Version {VERSION}</p>
	</div>

	<!-- v1.4.0: Beta-Disclaimer-Box entfernt — Beta-Status steht zentral in /about, Privacy bleibt fachlich. -->

	<section class="space-y-2">
		<h2 class="text-lg font-bold">1. Verantwortlicher</h2>
		<p class="text-sm leading-relaxed text-gb-text-muted">
			Lauritz Wirtz · 55116 Mainz · Deutschland<br />
			E-Mail: <a href="mailto:{CONTACT}" class="text-gb-info hover:underline">{CONTACT}</a>
		</p>
		<p class="text-xs text-gb-text-muted italic">
			Vollständige Anschrift wird vor Play-Store-Release ergänzt.
		</p>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-bold">2. Überblick</h2>
		<p class="text-sm leading-relaxed">
			GrowBuddy ist ein <strong>offline-first</strong> Grow-Journal. Deine Daten werden primär
			<strong>lokal auf deinem Gerät</strong> gespeichert (localStorage / WebView Storage).
			Cloud-Synchronisation ist <strong>optional</strong> und nur nach expliziter Zustimmung
			(Login mit E-Mail oder Google OAuth) aktiv.
		</p>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-bold">3. Welche Daten werden verarbeitet?</h2>

		<h3 class="text-sm font-semibold mt-3">3.1 Lokale Daten (auf deinem Gerät, immer)</h3>
		<ul class="text-sm space-y-1 list-disc list-inside text-gb-text-muted leading-relaxed">
			<li>Grows (Name, Strain, Substrat, Phase, Notizen)</li>
			<li>Check-ins (Datum, Foto, Temperatur, EC, pH, VPD, Bewässerung)</li>
			<li>Einstellungen (Sprache, Reminder-Zeit, EC-Einheit)</li>
			<li>App-State (Onboarding-Status, XP, Streak)</li>
		</ul>
		<p class="text-xs text-gb-text-muted">
			<strong>Speicherort:</strong> Browser-localStorage / WebView-Storage auf deinem Gerät.
			<strong>Zugriff:</strong> Nur du. Wir haben keinen Zugriff auf lokale Daten.
		</p>

		<h3 class="text-sm font-semibold mt-3">3.2 Cloud-Daten (optional, nur bei aktiver Anmeldung)</h3>
		<p class="text-sm leading-relaxed">
			Wenn du dich mit E-Mail-Magic-Link oder Google OAuth anmeldest, synchronisieren wir folgende
			Daten mit unserem Backend (Supabase, EU-Server):
		</p>
		<ul class="text-sm space-y-1 list-disc list-inside text-gb-text-muted leading-relaxed">
			<li>E-Mail-Adresse (Account-ID)</li>
			<li>User-Profil: Username, Bio, Avatar (optional)</li>
			<li>Grows + Check-ins (deine eigenen)</li>
			<li>Cloud-Sync-Metadaten (<code class="text-xs">updated_at</code>, Konflikt-Resolution)</li>
		</ul>
		<p class="text-xs text-gb-text-muted">
			<strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung — Cloud-Sync).<br />
			<strong>Speicherort:</strong> Supabase EU (Frankfurt am Main, Deutschland).<br />
			<strong>Speicherdauer:</strong> Bis zur Konto-Löschung (Anfrage via E-Mail).
		</p>

		<h3 class="text-sm font-semibold mt-3">3.3 Public-Posts (Community-Feed)</h3>
		<p class="text-sm leading-relaxed">
			Wenn du einen Grow oder Check-in als &quot;Public&quot; markierst, ist er im Community-Feed
			für andere eingeloggte Nutzer sichtbar. Sichtbar werden:
		</p>
		<ul class="text-sm space-y-1 list-disc list-inside text-gb-text-muted leading-relaxed">
			<li>Username + Avatar</li>
			<li>Grow-Name + Strain</li>
			<li>Check-in-Inhalt (Foto, Phase, Notizen, Messwerte)</li>
		</ul>
		<p class="text-xs text-gb-text-muted">
			Du kannst jederzeit auf &quot;Privat&quot; zurückstellen — Posts werden sofort aus
			dem Feed anderer Nutzer entfernt.
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
		</ul>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-bold">5. Drittanbieter</h2>

		<h3 class="text-sm font-semibold mt-3">5.1 Supabase (EU)</h3>
		<p class="text-xs text-gb-text-muted leading-relaxed">
			Cloud-Sync läuft über Supabase Inc., Server in Frankfurt am Main.
			<a href="https://supabase.com/privacy" target="_blank" rel="noopener" class="text-gb-info hover:underline">supabase.com/privacy</a>
		</p>

		<h3 class="text-sm font-semibold mt-3">5.2 Google OAuth (optional)</h3>
		<p class="text-xs text-gb-text-muted leading-relaxed">
			Bei &quot;Mit Google anmelden&quot; erhalten wir deine E-Mail + Google-User-ID.
			<a href="https://policies.google.com/privacy" target="_blank" rel="noopener" class="text-gb-info hover:underline">policies.google.com/privacy</a>
		</p>

		<h3 class="text-sm font-semibold mt-3">5.3 Vercel (Web-Hosting)</h3>
		<p class="text-xs text-gb-text-muted leading-relaxed">
			Statisches Hosting der Web-Version (growbuddy-app.vercel.app).
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
				<span class="text-xs">→ In-App: Profil → Daten → Export</span>
			</li>
			<li><strong>Widerspruch</strong> (Art. 21 DSGVO): Cloud-Sync deaktivieren = Logout</li>
		</ul>
		<p class="text-xs text-gb-text-muted">
			Anfragen an <a href="mailto:{CONTACT}" class="text-gb-info hover:underline">{CONTACT}</a>
		</p>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-bold">7. Foto-Berechtigung</h2>
		<p class="text-sm leading-relaxed">
			Die Kamera-Berechtigung wird <strong>nur lokal</strong> für Check-in-Fotos benötigt.
			Fotos werden komprimiert (max 256x256 Avatar, ~800px Check-ins) und in deinem lokalen
			Storage gespeichert. Bei aktivem Cloud-Sync werden sie als Base64 in deinen Account hochgeladen.
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
		<h2 class="text-lg font-bold">9. Kinder</h2>
		<p class="text-sm leading-relaxed">
			GrowBuddy ist nicht für Kinder unter 18 Jahren bestimmt.
		</p>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-bold">10. Änderungen</h2>
		<p class="text-sm leading-relaxed">
			Wir können diese Datenschutzerklärung anpassen. Die jeweils aktuelle Version
			ist immer in der App (Profil → Über GrowBuddy → Datenschutz) und unter
			<a href="https://growbuddy-app.vercel.app/privacy" target="_blank" rel="noopener" class="text-gb-info hover:underline">growbuddy-app.vercel.app/privacy</a>
			einsehbar.
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
