<!--
 * PWA Install-Prompt — zeigt A2HS-Banner wenn verfügbar.
 * Hört auf `beforeinstallprompt`, cached Event, zeigt CTA.
 * Dismiss-State wird persistiert (14 Tage).
-->
<script lang="ts">
	interface BeforeInstallPromptEvent extends Event {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
	}

	const DISMISS_KEY = 'growbuddy_install_dismissed';
	const DISMISS_DAYS = 14;

	let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);
	let visible = $state(false);
	let isIOS = $state(false);
	let showIOSHint = $state(false);

	function isDismissed(): boolean {
		if (typeof localStorage === 'undefined') return true;
		const raw = localStorage.getItem(DISMISS_KEY);
		if (!raw) return false;
		const ts = parseInt(raw, 10);
		if (isNaN(ts)) return false;
		const age = Date.now() - ts;
		return age < DISMISS_DAYS * 24 * 60 * 60 * 1000;
	}

	function isStandalone(): boolean {
		if (typeof window === 'undefined') return false;
		return window.matchMedia('(display-mode: standalone)').matches
			|| (window.navigator as any).standalone === true;
	}

	$effect(() => {
		if (typeof window === 'undefined') return;

		// Bereits installiert oder kürzlich dismissed → nichts zeigen
		if (isStandalone() || isDismissed()) return;

		// iOS-Detection (kein beforeinstallprompt-Event)
		const ua = window.navigator.userAgent.toLowerCase();
		isIOS = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;

		const handler = (e: Event) => {
			e.preventDefault();
			deferredPrompt = e as BeforeInstallPromptEvent;
			visible = true;
		};

		const installedHandler = () => {
			visible = false;
			deferredPrompt = null;
		};

		window.addEventListener('beforeinstallprompt', handler);
		window.addEventListener('appinstalled', installedHandler);

		// iOS: Banner nach 10s zeigen (kein Auto-Prompt verfügbar)
		let iosTimer: number | undefined;
		if (isIOS) {
			iosTimer = window.setTimeout(() => { visible = true; }, 10_000);
		}

		return () => {
			window.removeEventListener('beforeinstallprompt', handler);
			window.removeEventListener('appinstalled', installedHandler);
			if (iosTimer) clearTimeout(iosTimer);
		};
	});

	async function install() {
		if (isIOS) {
			showIOSHint = true;
			return;
		}
		if (!deferredPrompt) return;
		await deferredPrompt.prompt();
		const result = await deferredPrompt.userChoice;
		if (result.outcome === 'accepted') {
			visible = false;
		} else {
			dismiss();
		}
		deferredPrompt = null;
	}

	function dismiss() {
		visible = false;
		showIOSHint = false;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(DISMISS_KEY, Date.now().toString());
		}
	}
</script>

{#if visible}
	<div class="fixed bottom-20 left-4 right-4 max-w-lg mx-auto z-40 animate-slide-up">
		<div class="bg-gb-surface border border-gb-green/40 rounded-xl p-4 shadow-2xl">
			{#if showIOSHint}
				<div class="space-y-2">
					<p class="font-semibold text-sm">📱 Zum Home-Bildschirm hinzufügen</p>
					<p class="text-xs text-gb-text-muted">
						Tippe auf <span class="font-mono">Teilen</span> ⎋ unten im Browser,
						dann <span class="font-semibold">„Zum Home-Bildschirm"</span>.
					</p>
					<button onclick={dismiss}
						class="w-full mt-2 text-xs text-gb-text-muted py-2">
						Verstanden
					</button>
				</div>
			{:else}
				<div class="flex items-start gap-3">
					<div class="text-2xl">🌱</div>
					<div class="flex-1 min-w-0">
						<p class="font-semibold text-sm">GrowBuddy installieren</p>
						<p class="text-xs text-gb-text-muted mt-0.5">
							Als App — schneller Start, Offline-Nutzung, Push-Reminder
						</p>
					</div>
				</div>
				<div class="flex gap-2 mt-3">
					<button onclick={dismiss}
						class="flex-1 text-xs text-gb-text-muted py-2 rounded-lg hover:bg-gb-surface-2">
						Später
					</button>
					<button onclick={install}
						class="flex-1 bg-gb-green text-black font-medium text-xs py-2 rounded-lg hover:bg-gb-green/90 transition-colors">
						Installieren
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	@keyframes slide-up {
		from { transform: translateY(120%); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}
	.animate-slide-up {
		animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}
</style>
