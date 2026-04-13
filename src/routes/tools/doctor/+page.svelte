<script lang="ts">
	import { t } from '$lib/i18n';
	import { isPro } from '$lib/stores/pro';
	import { xpStore } from '$lib/stores/xp';
	import { toastStore } from '$lib/stores/toast';
	import { hapticSuccess, hapticError } from '$lib/utils/haptic';
	import { diagnosePlant } from '$lib/utils/gemini';
	import type { Diagnosis } from '$lib/utils/gemini';

	let tr = $derived.by(() => { let v: any = (k: string) => k; t.subscribe(x => v = x)(); return v; });
	let userIsPro = $derived.by(() => { let v = false; isPro.subscribe(x => v = x)(); return v; });

	let photo = $state<string | null>(null);
	let loading = $state(false);
	let diagnosis = $state<Diagnosis | null>(null);
	let error = $state<string | null>(null);

	function handlePhoto(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!input.files?.[0]) return;
		const file = input.files[0];
		const reader = new FileReader();
		reader.onload = () => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement('canvas');
				const maxSize = 1024;
				let w = img.width, h = img.height;
				if (w > maxSize || h > maxSize) {
					if (w > h) { h = (h / w) * maxSize; w = maxSize; }
					else { w = (w / h) * maxSize; h = maxSize; }
				}
				canvas.width = w;
				canvas.height = h;
				canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
				photo = canvas.toDataURL('image/jpeg', 0.8);
				diagnosis = null;
				error = null;
			};
			img.src = reader.result as string;
		};
		reader.readAsDataURL(file);
	}

	async function analyze() {
		if (!photo) return;
		loading = true;
		error = null;
		diagnosis = null;

		try {
			diagnosis = await diagnosePlant(photo);
			hapticSuccess();
			xpStore.awardToolUse('doctor');
			toastStore.xp('+5 XP — Diagnose abgeschlossen');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unbekannter Fehler';
			hapticError();
		} finally {
			loading = false;
		}
	}

	function statusColor(status: string): string {
		if (status === 'healthy') return 'text-gb-green';
		if (status === 'issue') return 'text-gb-warning';
		return 'text-gb-danger';
	}

	function statusIcon(status: string): string {
		if (status === 'healthy') return '✅';
		if (status === 'issue') return '⚠️';
		return '🚨';
	}

	function statusLabel(status: string): string {
		if (status === 'healthy') return 'Gesund';
		if (status === 'issue') return 'Problem erkannt';
		return 'Kritisch';
	}

	function confidenceColor(c: string): string {
		if (c === 'high') return 'bg-gb-danger/20 text-gb-danger';
		if (c === 'medium') return 'bg-gb-warning/20 text-gb-warning';
		return 'bg-gb-info/20 text-gb-info';
	}

	function confidenceLabel(c: string): string {
		if (c === 'high') return 'Sicher';
		if (c === 'medium') return 'Wahrscheinlich';
		return 'Möglich';
	}

	function reset() {
		photo = null;
		diagnosis = null;
		error = null;
	}
</script>

<div class="px-4 pt-6 max-w-lg mx-auto space-y-5 pb-24">
	<div>
		<a href="/tools" class="text-gb-text-muted text-sm hover:text-gb-text">&larr; {tr('nav.tools')}</a>
		<h1 class="text-xl font-bold mt-2">AI Plant Doctor</h1>
		<p class="text-gb-text-muted text-sm">Foto machen — sofortige Diagnose per KI</p>
	</div>

	<!-- Pro Gate -->
	{#if !userIsPro}
		<div class="bg-gb-accent/10 border border-gb-accent/20 rounded-xl p-5 text-center">
			<span class="text-3xl block mb-2">🤖</span>
			<p class="font-semibold">AI Plant Doctor — Pro Feature</p>
			<p class="text-sm text-gb-text-muted mt-1">Lade ein Foto hoch und erhalte eine sofortige Diagnose deiner Pflanze per KI.</p>
			<a href="/pro" class="inline-block mt-3 bg-gb-accent text-white font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-gb-accent/80 transition-colors">
				{tr('grow.unlock_pro')}
			</a>
		</div>
	{:else}
		<!-- Photo Upload -->
		{#if !photo}
			<label class="block bg-gb-surface border-2 border-dashed border-gb-border rounded-xl p-8 text-center cursor-pointer hover:border-gb-green transition-colors">
				<svg class="w-16 h-16 text-gb-border mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
					<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
					<circle cx="12" cy="13" r="4" />
				</svg>
				<p class="font-medium text-sm">Pflanze fotografieren</p>
				<p class="text-xs text-gb-text-muted mt-1">Kamera oder Galerie — Blätter nah aufnehmen für beste Ergebnisse</p>
				<input type="file" accept="image/*" capture="environment" onchange={handlePhoto} class="hidden" />
			</label>
		{:else}
			<!-- Photo Preview -->
			<div class="relative">
				<img src={photo} alt="Pflanzenfoto" class="w-full rounded-xl max-h-72 object-cover" />
				<button onclick={reset}
					class="absolute top-2 right-2 bg-black/60 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm hover:bg-black/80">
					✕
				</button>
			</div>

			<!-- Analyze Button -->
			{#if !diagnosis && !loading}
				<button onclick={analyze}
					class="w-full bg-gb-green text-black font-semibold py-3 rounded-lg text-sm hover:bg-gb-green-light transition-colors">
					🔍 Diagnose starten
				</button>
			{/if}

			<!-- Loading -->
			{#if loading}
				<div class="bg-gb-surface rounded-xl p-6 text-center">
					<div class="w-12 h-12 border-3 border-gb-green border-t-transparent rounded-full animate-spin mx-auto"></div>
					<p class="text-sm text-gb-text-muted mt-3">Analysiere Pflanze...</p>
					<p class="text-xs text-gb-text-muted mt-1">Gemini AI untersucht Blätter, Stängel & Verfärbungen</p>
				</div>
			{/if}

			<!-- Error -->
			{#if error}
				<div class="bg-gb-danger/10 border border-gb-danger/20 rounded-xl p-4">
					<p class="text-sm text-gb-danger font-medium">Fehler bei der Analyse</p>
					<p class="text-xs text-gb-text-muted mt-1">{error}</p>
					<button onclick={analyze}
						class="mt-3 bg-gb-danger/20 text-gb-danger font-medium text-xs px-4 py-2 rounded-lg">
						Erneut versuchen
					</button>
				</div>
			{/if}

			<!-- Diagnosis Result -->
			{#if diagnosis}
				<!-- Status Header -->
				<div class="bg-gb-surface rounded-xl p-5 text-center">
					<span class="text-4xl block mb-2">{statusIcon(diagnosis.status)}</span>
					<p class="font-bold text-lg {statusColor(diagnosis.status)}">{statusLabel(diagnosis.status)}</p>
					<p class="text-sm text-gb-text-muted mt-2">{diagnosis.summary}</p>
				</div>

				<!-- Problems -->
				{#if diagnosis.problems.length > 0}
					<div class="space-y-3">
						<h2 class="text-sm font-semibold text-gb-text-muted uppercase tracking-wide">Erkannte Probleme</h2>
						{#each diagnosis.problems as problem}
							<div class="bg-gb-surface rounded-xl p-4 space-y-3">
								<div class="flex items-start justify-between gap-2">
									<p class="font-semibold text-sm">{problem.name}</p>
									<span class="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 {confidenceColor(problem.confidence)}">
										{confidenceLabel(problem.confidence)}
									</span>
								</div>
								<p class="text-sm text-gb-text-muted">{problem.description}</p>
								<div>
									<p class="text-xs text-gb-text-muted font-medium">Ursache:</p>
									<p class="text-sm">{problem.cause}</p>
								</div>
								<div>
									<p class="text-xs text-gb-text-muted font-medium">Lösung:</p>
									<ul class="space-y-1 mt-1">
										{#each problem.solution as step}
											<li class="text-sm flex gap-2">
												<span class="text-gb-green shrink-0">→</span>
												<span>{step}</span>
											</li>
										{/each}
									</ul>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Care Tips -->
				{#if diagnosis.care_tips.length > 0}
					<div class="bg-gb-green/10 border border-gb-green/20 rounded-xl p-4">
						<h3 class="font-semibold text-sm text-gb-green mb-2">Pflegetipps</h3>
						<ul class="space-y-1.5">
							{#each diagnosis.care_tips as tip}
								<li class="text-sm flex gap-2">
									<span class="text-gb-green shrink-0">🌱</span>
									<span>{tip}</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				<!-- New Photo -->
				<label class="block w-full bg-gb-surface-2 text-center font-medium text-sm py-3 rounded-lg cursor-pointer hover:bg-gb-surface transition-colors">
					📷 Neue Diagnose starten
					<input type="file" accept="image/*" capture="environment" onchange={handlePhoto} class="hidden" />
				</label>
			{/if}
		{/if}

		<!-- Info -->
		<div class="bg-gb-surface rounded-xl p-4 text-xs text-gb-text-muted space-y-1">
			<p><strong class="text-gb-text">Wie funktioniert's?</strong></p>
			<p>Gemini AI analysiert dein Foto auf Schädlinge, Nährstoffmängel, Krankheiten und Umweltstress. Für beste Ergebnisse: Blätter nah aufnehmen, gute Beleuchtung, mehrere Winkel.</p>
			<p class="text-gb-warning">Hinweis: KI-Diagnosen ersetzen nicht die eigene Erfahrung. Bei Unsicherheit mehrere Fotos analysieren.</p>
		</div>
	{/if}
</div>
