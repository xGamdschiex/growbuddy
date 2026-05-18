<script lang="ts">
	/**
	 * About-Seite — Version, Build-Info, Beta-Status, Tester-Channel.
	 * Wichtig für Closed-Testing-Submission: Datenschutz-Link + Feedback-Kanal pflicht.
	 */

	// Vite-injected: __APP_VERSION__ aus package.json (declared in src/app.d.ts)
	const VERSION = __APP_VERSION__;
	// Beta-Phase: realer Kanal. Spätere Migration auf feedback@growbuddy.app möglich.
	const FEEDBACK_EMAIL = 'lauritz.wirtz@gmail.com';
	const PRIVACY_URL = '/privacy';

	// Build-Datum aus aktuellem Browser-Time bei Mount (lokal)
	let buildInfo = $state<string>('');
	$effect(() => {
		buildInfo = `v${VERSION}`;
	});
</script>

<svelte:head><title>Über GrowBuddy</title></svelte:head>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-5 pb-24">
	<div>
		<a href="/profile" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; Profil</a>
		<h1 class="text-2xl font-bold mt-1">ℹ️ Über GrowBuddy</h1>
	</div>

	<!-- App-Identität -->
	<div class="bg-gb-surface rounded-xl p-5 text-center space-y-3">
		<div class="text-5xl"><span class="idle-sway">🌱</span></div>
		<div>
			<p class="font-bold text-lg">GrowBuddy</p>
			<p class="text-xs text-gb-text-muted">Grow Journal &amp; Plant Care</p>
		</div>
		<div class="inline-flex items-center gap-2 bg-gb-accent/15 text-gb-accent text-xs font-semibold px-3 py-1 rounded-full">
			<span class="w-1.5 h-1.5 bg-gb-accent rounded-full animate-pulse"></span>
			Beta · {buildInfo}
		</div>
	</div>

	<!-- v1.4.0: Beta-Disclaimer-Card entfernt — Pill oben sagt es schon, Doppelung war Unfertig-Eindruck. -->

	<!-- Tester-Feedback-Channel -->
	<div class="bg-gb-surface rounded-xl p-4 space-y-3">
		<p class="font-semibold text-sm">💬 Feedback &amp; Bug-Reports</p>
		<p class="text-xs text-gb-text-muted leading-relaxed">
			Dein Feedback hilft uns, GrowBuddy bis zum offiziellen Release zu polieren.
			Was nervt? Was fehlt? Was läuft super?
		</p>
		<a href="mailto:{FEEDBACK_EMAIL}?subject=GrowBuddy%20{buildInfo}%20Feedback"
			class="inline-flex items-center gap-2 bg-gb-green/10 border border-gb-green/30 text-gb-green font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-gb-green/20 transition-colors w-full justify-center"
			style="min-height:44px;">
			📧 Feedback senden
		</a>
		<p class="text-[11px] text-gb-text-muted text-center break-all">{FEEDBACK_EMAIL}</p>
	</div>

	<!-- Datenschutz + Rechtliches -->
	<div class="bg-gb-surface rounded-xl p-4 space-y-3">
		<p class="font-semibold text-sm">🔒 Datenschutz &amp; Rechtliches</p>
		<div class="space-y-2 text-xs">
			<div class="flex justify-between items-center">
				<span class="text-gb-text-muted">Datenschutzerklärung</span>
				<a href={PRIVACY_URL} class="text-gb-info hover:underline">Lesen &rarr;</a>
			</div>
			<div class="flex justify-between items-center">
				<span class="text-gb-text-muted">Lokale Daten</span>
				<span class="text-gb-text-muted">localStorage</span>
			</div>
			<div class="flex justify-between items-center">
				<span class="text-gb-text-muted">Cloud-Sync</span>
				<span class="text-gb-text-muted">Supabase (EU)</span>
			</div>
		</div>
		<p class="text-[11px] text-gb-text-muted leading-relaxed pt-1">
			GrowBuddy speichert deine Daten primär lokal. Cloud-Sync ist optional und an deinen
			Account gebunden. Keine Werbung, kein Tracking.
		</p>
	</div>

	<!-- Tech-Stack (für Tester-Transparenz) -->
	<div class="bg-gb-surface rounded-xl p-4 space-y-2">
		<p class="font-semibold text-sm">⚙️ Tech</p>
		<div class="text-xs text-gb-text-muted space-y-1">
			<div class="flex justify-between"><span>App</span><span>SvelteKit · Capacitor</span></div>
			<div class="flex justify-between"><span>Backend</span><span>Supabase (PostgreSQL)</span></div>
			<div class="flex justify-between"><span>Build</span><span>{buildInfo}</span></div>
		</div>
	</div>

	<!-- Roadmap-Teaser -->
	<div class="bg-gradient-to-br from-gb-accent/10 to-gb-green/5 border border-gb-accent/20 rounded-xl p-4 space-y-2">
		<p class="font-semibold text-sm">🚀 Was kommt nach Beta?</p>
		<ul class="text-xs text-gb-text-muted space-y-1 leading-relaxed list-disc list-inside">
			<li>Mehr Düngerlinien-Module</li>
			<li>Vergleichsmodus für mehrere Grows</li>
			<li>AI-Daily-Tipp (Pro)</li>
			<li>Harvest-Predict via lineare Regression</li>
		</ul>
	</div>

	<p class="text-center text-[11px] text-gb-text-muted pt-2">
		Made with 🌱 in Mainz · {new Date().getFullYear()}
	</p>
</div>
