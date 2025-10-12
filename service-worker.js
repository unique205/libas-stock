// service-worker.js
const CACHE_VERSION = 'libas-shell-v2'; // bump this when you make big changes
const SHELL_ASSETS = [
  '/', // for GH Pages root -> index.html
  '/index.html',
  '/logo.png',
  // add any other static files you serve from repo root:
  // '/styles.css',
  // '/app.js',
];

// list of file extensions to treat as network-first (we want fresh excel)
const NETWORK_FIRST_URL_PARTS = ['.xlsx', '.xls'];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_VERSION ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

function shouldUseNetworkFirst(request) {
  return NETWORK_FIRST_URL_PARTS.some((part) => request.url.toLowerCase().includes(part));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Navigation requests -> serve index.html (app shell)
  if (req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(
      caches.match('/index.html').then((cached) => cached || fetch(req).catch(() => cached))
    );
    return;
  }

  // Network-first for .xlsx (get fresh file if online, fallback to cache if offline)
  if (shouldUseNetworkFirst(req)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // cache a copy for offline
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Default: cache-first for static assets
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      // cache the fetched resource
      const copy = res.clone();
      caches.open(CACHE_VERSION).then((cache) => {
        // only cache GET requests and same-origin resources
        if (req.method === 'GET' && new URL(req.url).origin === self.location.origin) {
          cache.put(req, copy);
        }
      });
      return res;
    }).catch(() => cached))
  );
});
