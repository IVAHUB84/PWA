const CACHE = 'resnichki-v5';
const ASSETS = [
  './prototype.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./prototype.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request)
      .then(r => r || fetch(e.request))
  );
});
