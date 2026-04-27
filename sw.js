// GAA Match Stats — Service Worker
// Caches the app shell so it works fully offline at the pitch

const CACHE_NAME = 'gaa-stats-v1';

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

// ── FETCH: serve from cache, fall back to network ─
self.addEventListener('fetch', event => {
  // Skip non-GET and cross-origin requests (e.g. Google Fonts)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // For Google Fonts and other external resources — network first, cache fallback
  if (!url.origin.includes(self.location.origin)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For local app files — cache first, network fallback
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
});
