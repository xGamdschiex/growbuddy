/**
 * GrowBuddy Service Worker v3 — Stale-While-Revalidate + Notification-Handler + Update-Flow.
 */

const CACHE_VERSION = 'growbuddy-v1.3.9';
const SHELL_FILES = [
	'/',
	'/manifest.json',
	'/favicon.svg',
];

// Install: App Shell cachen
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_VERSION).then(cache => cache.addAll(SHELL_FILES))
	);
	// NICHT skipWaiting — User entscheidet wann geupdated wird (via controllerchange)
});

// Activate: Alte Caches löschen
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then(keys =>
			Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
		).then(() => self.clients.claim())
	);
});

// Message-Handler: Client kann skipWaiting triggern
self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Fetch Strategy
self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (url.origin !== location.origin) return;

	// Navigation: Network-first mit Cache-Fallback (SPA)
	if (event.request.mode === 'navigate') {
		event.respondWith(
			fetch(event.request)
				.then(response => {
					if (response.ok) {
						const clone = response.clone();
						caches.open(CACHE_VERSION).then(cache => cache.put('/', clone));
					}
					return response;
				})
				.catch(() => caches.match('/'))
		);
		return;
	}

	// Immutable Assets (mit Hash): Cache-first, ewig gültig
	if (url.pathname.startsWith('/_app/immutable/')) {
		event.respondWith(
			caches.match(event.request).then(cached => {
				if (cached) return cached;
				return fetch(event.request).then(response => {
					if (response.ok) {
						const clone = response.clone();
						caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
					}
					return response;
				});
			})
		);
		return;
	}

	// Andere statische Assets: Stale-While-Revalidate
	if (url.pathname.match(/\.(js|css|svg|png|jpg|webp|woff2?|json)$/)) {
		event.respondWith(
			caches.match(event.request).then(cached => {
				const fetchPromise = fetch(event.request).then(response => {
					if (response.ok) {
						const clone = response.clone();
						caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
					}
					return response;
				}).catch(() => cached);

				return cached || fetchPromise;
			})
		);
		return;
	}
});

// ─── NOTIFICATION HANDLERS ─────────────────────────────────────────────

// Click auf Notification → App öffnen/fokussieren
self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const targetUrl = event.notification.data?.url || '/';

	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
			// Existierenden Tab fokussieren
			for (const client of clients) {
				if ('focus' in client) {
					client.postMessage({ type: 'NAVIGATE', url: targetUrl });
					return client.focus();
				}
			}
			// Sonst neuen Tab öffnen
			if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
		})
	);
});

// Push-Handler (für zukünftiges Server-Push)
self.addEventListener('push', (event) => {
	let payload = { title: 'GrowBuddy', body: 'Zeit für deinen Check-in!', url: '/' };
	try {
		if (event.data) payload = { ...payload, ...event.data.json() };
	} catch {}

	event.waitUntil(
		self.registration.showNotification(payload.title, {
			body: payload.body,
			icon: '/icon-192.png',
			badge: '/icon-192.png',
			tag: 'daily-checkin',
			renotify: true,
			data: { url: payload.url },
		})
	);
});
