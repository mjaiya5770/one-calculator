/* One Calculator service worker — app-shell cache, network-first for pages.
   Calculators keep working offline once visited; ads and APIs are never intercepted. */
const CACHE = 'onecalculator-v1';
const SHELL = [
  '/',
  '/index.html',
  '/assets/style.css',
  '/assets/track.js',
  '/assets/site.webmanifest',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/apple-touch-icon.png',
  '/assets/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ads / analytics / APIs: untouched
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname === '/ads.txt') return; // ad verification file: always live from network

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then((hit) => hit || caches.match('/index.html')))
  );
});
