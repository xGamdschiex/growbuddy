/**
 * GrowBuddy Service Worker v2 — Stale-While-Revalidate für App Shell,
 * Cache-first für Assets, Network-first für Navigation.
 * Volle Offline-Fähigkeit nach erstem Laden.
 */

const CACHE_VERSION = 'growbuddy-v2';
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
	self.skipWaiting();
});

// Activate: Alte Caches löschen, sofort übernehmen
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then(keys =>
			Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
		)
	);
	self.clients.claim();
});

// Fetch Strategy
self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// Nur eigene Requests
	if (url.origin !== location.origin) return;

	// Navigation: Network mit Cache-Fallback (SPA)
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
