// GAA Match Stats — Service Worker
// Caches the app shell so it works fully offline at the pitch
const CACHE_NAME = 'gaa-stats-v7';
// Files to cache on install
const PRECACHE_URLS = [
  './index.html',
  './manifest.json'
];
// ── INSTALL: cache app shell ──────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});
// ── ACTIVATE: clear old caches ────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});
// ── FETCH: always go to network ─────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request));
});
