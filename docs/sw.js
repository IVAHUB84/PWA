const CACHE_VERSION = 'v32';
const STATIC_CACHE  = `studio-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `studio-runtime-${CACHE_VERSION}`;

const APP_SHELL = [
  './prototype.html',
  './style.css',
  './app.js',
  './modules/constants.js',
  './modules/utils.js',
  './modules/state.js',
  './modules/storage.js',
  './modules/api.js',
  './modules/navigation.js',
  './modules/auth.js',
  './modules/consent.js',
  './modules/booking.js',
  './modules/slots.js',
  './modules/services.js',
  './modules/masters.js',
  './modules/history.js',
  './modules/profile.js',
  './modules/review.js',
  './modules/feed.js',
  './modules/admin.js',
  './modules/github.js',
  './modules/notifications.js',
  './modules/scenarios.js',
  './modules/search.js',
  './modules/pin.js',
  './modules/push.js',
  './manifest.json',
  './logo.png',
  './logobest.png',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
];

// Эти домены — только сеть, никогда не кэшировать
const NETWORK_ONLY_HOSTS = ['api.yclients.com'];

// ── INSTALL: кэшируем app shell ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(err => console.error('SW install cache failed', err))
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// ── ACTIVATE: удаляем старые кэши ───────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Не перехватываем не-GET и YCLIENTS API
  if (request.method !== 'GET') return;
  if (NETWORK_ONLY_HOSTS.some(h => url.hostname.includes(h))) return;

  const isSameOrigin = url.origin === self.location.origin;
  const isJs = isSameOrigin && (url.pathname.endsWith('.js'));
  const isShell = isSameOrigin && !isJs &&
    APP_SHELL.some(p => url.pathname.endsWith(p.replace('./', '/')));

  if (isJs) {
    // JS-модули: network-first, fallback на кэш (чтобы фиксы применялись сразу)
    event.respondWith(
      fetch(request).then(res => {
        if (res.ok) { const c2 = res.clone(); caches.open(STATIC_CACHE).then(c => c.put(request, c2)); }
        return res;
      }).catch(() => caches.match(request))
    );
    return;
  }

  if (isShell) {
    // HTML/CSS/иконки: cache-first + фоновое обновление
    event.respondWith(
      caches.match(request).then(cached => {
        const networkFetch = fetch(request).then(res => {
          if (res.ok) { const c2 = res.clone(); caches.open(STATIC_CACHE).then(c => c.put(request, c2)); }
          return res;
        });
        return cached || networkFetch;
      })
    );
    return;
  }

  if (!isSameOrigin) {
    // CDN (EmailJS, jsdelivr): cache-first
    event.respondWith(
      caches.match(request).then(cached =>
        cached || fetch(request).then(res => {
          if (res.ok) { const c2 = res.clone(); caches.open(RUNTIME_CACHE).then(c => c.put(request, c2)); }
          return res;
        }).catch(() => cached)
      )
    );
    return;
  }

  // Всё остальное (same-origin): network-first с fallback на кэш
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) { const c2 = res.clone(); caches.open(RUNTIME_CACHE).then(c => c.put(request, c2)); }
        return res;
      })
      .catch(() => caches.match(request).then(cached =>
        cached || new Response('Нет соединения', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      ))
  );
});

// ── PUSH ─────────────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || 'Реснички';
  const opts = {
    body: data.body || '',
    icon: data.icon || './icon-192.png',
    badge: './icon-192.png',
    data: { url: './' },
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
