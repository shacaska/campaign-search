// Minimal service worker: makes the site installable and lets the saved-file viewer work offline.
// Network first (so updates to the site show up immediately), cache as a fallback.
const CACHE = 'campaign-search-v1';
const SHELL = ['./', 'index.html', 'assets/style.css', 'assets/app.js', 'assets/search.js', 'assets/campaign-url.js',
  'assets/bookmarklet.txt', 'assets/bookmarklet-full.txt', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      // Shared links arrive as ./?url=... — fall back to the cached page for any navigation
      .catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' })),
  );
});
