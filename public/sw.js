// Offline shell. Cache first: at 4am on one bar of signal the capture screen
// must paint from the cache immediately, never wait on the network. A fresh
// copy is fetched in the background and used on the next open.
const CACHE = 'dream-v2';
const SHELL = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'core.js',
  'icon.svg',
  'manifest.webmanifest',
  'fonts/newsreader-latin-wght-normal.woff2',
  'fonts/newsreader-latin-wght-italic.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  const key = e.request.mode === 'navigate' ? 'index.html' : e.request;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(key, { ignoreSearch: true });
      const refresh = fetch(e.request)
        .then((res) => {
          if (res.ok) cache.put(key, res.clone());
          return res;
        })
        .catch(() => hit);
      if (hit) {
        e.waitUntil(refresh);
        return hit;
      }
      return refresh;
    }),
  );
});
