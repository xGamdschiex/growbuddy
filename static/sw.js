/**
 * GrowBuddy Service Worker — Cache-first für App Shell, Network-first für API.
 * Erlaubt vollständige Offline-Nutzung nach erstem Laden.
 */

const CACHE_NAME = 'growbuddy-v1';
const SHELL_FILES = [
	'/',
	'/manifest.json',
	'/favicon.svg',
];

// Install: App Shell cachen
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES))
	);
	self.skipWaiting();
});

// Activate: Alte Caches löschen
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then(keys =>
			Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
		)
	);
	self.clients.claim();
});

// Fetch: Cache-first für statische Assets, Network-first für Navigation
self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// Nur eigene Requests cachen
	if (url.origin !== location.origin) return;

	// Navigations-Requests: Network mit Cache-Fallback (SPA fallback)
	if (event.request.mode === 'navigate') {
		event.respondWith(
			fetch(event.request)
				.then(response => {
					const clone = response.clone();
					caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
					return response;
				})
				.catch(() => caches.match('/') || caches.match(event.request))
		);
		return;
	}

	// Statische Assets: Cache-first
	if (url.pathname.startsWith('/_app/') || url.pathname.match(/\.(js|css|svg|png|jpg|woff2?)$/)) {
		event.respondWith(
			caches.match(event.request).then(cached => {
				if (cached) return cached;
				return fetch(event.request).then(response => {
					const clone = response.clone();
					caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
					return response;
				});
			})
		);
		return;
	}
});
