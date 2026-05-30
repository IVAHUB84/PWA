const CACHE_VERSION = 'v81';
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
  './modules/serviceImages.js',
  './modules/masters.js',
  './modules/history.js',
  './modules/profile.js',
  './modules/studio.js',
  './modules/review.js',
  './modules/feed.js',
  './modules/admin.js',
  './modules/github.js',
  './modules/notifications.js',
  './modules/scenarios.js',
  './modules/search.js',
  './modules/pin.js',
  './modules/push.js',
  './modules/install.js',
  './modules/inboxStore.js',
  './modules/inbox.js',
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
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(err => console.error('SW install cache failed', err))
  );
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

  // Не перехватываем не-GET, не-HTTP(S) и YCLIENTS API
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;
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

  if (
    url.hostname === 'assets.yclients.com' &&
    (url.pathname.startsWith('/main_service_image/') || url.pathname.startsWith('/gallery_service_image/'))
  ) {
    // Фото услуг YCLIENTS: stale-while-revalidate
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(cache =>
        cache.match(request).then(cached => {
          const revalidate = fetch(request).then(res => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          });
          if (cached) {
            revalidate.catch(() => {});
            return cached;
          }
          return revalidate.catch(() => cached);
        })
      )
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

// ── INBOX (inline) ───────────────────────────────────────────────────────────
// Контракт должен точно совпадать с docs/modules/inboxStore.js:
// DB_NAME, DB_VERSION, STORE, keyPath, формат id, структура записи, LIMIT.
const _IDB_NAME    = 'studio-inbox';
const _IDB_VERSION = 1;
const _IDB_STORE   = 'notifications';
const _IDB_LIMIT   = 50;

function _idbOpen() {
  return new Promise((resolve, reject) => {
    const req = self.indexedDB.open(_IDB_NAME, _IDB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(_IDB_STORE)) {
        db.createObjectStore(_IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

function _idbMakeId(title, body, ts) {
  const bucket = Math.floor(ts / 60000);
  return bucket + ':' + String(title ?? '') + '|' + String(body ?? '');
}

function _idbTrimOldest(db) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(_IDB_STORE, 'readwrite');
    const store = tx.objectStore(_IDB_STORE);
    const allReq = store.getAll();
    allReq.onsuccess = () => {
      const all = allReq.result;
      if (all.length <= _IDB_LIMIT) { resolve(); return; }
      all.sort((a, b) => a.ts - b.ts);
      const toDelete = all.slice(0, all.length - _IDB_LIMIT);
      let pending = toDelete.length;
      if (!pending) { resolve(); return; }
      toDelete.forEach(rec => {
        const del = store.delete(rec.id);
        del.onsuccess = () => { if (--pending === 0) resolve(); };
        del.onerror   = () => { if (--pending === 0) resolve(); };
      });
    };
    allReq.onerror = e => reject(e.target.error);
  });
}

async function _idbAddNotification({ title, body, icon, ts }) {
  const db = await _idbOpen();
  const id  = _idbMakeId(title, body, ts);
  const record = { id, title: String(title ?? ''), body: String(body ?? ''), icon: icon || null, ts, read: false };
  const inserted = await new Promise((resolve, reject) => {
    const tx    = db.transaction(_IDB_STORE, 'readwrite');
    const store = tx.objectStore(_IDB_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      if (getReq.result) { resolve(false); return; }
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(true);
      putReq.onerror   = e => reject(e.target.error);
    };
    getReq.onerror = e => reject(e.target.error);
    tx.onerror = e => reject(e.target.error);
  });
  if (inserted) await _idbTrimOldest(db);
  db.close();
}

// ── PUSH ─────────────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || 'Реснички';
  const opts = {
    body: data.body || '',
    icon: data.icon || './icon-192.png',
    badge: './icon-192.png',
    vibrate: [300, 100, 300],
    data: { url: './' },
  };

  const ts = Date.now();

  const storeHistory = _idbAddNotification({ title, body: data.body || '', icon: data.icon || null, ts })
    .catch(() => {});

  const notifyClients = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then(list => list.forEach(c => c.postMessage({ type: 'PUSH_RECEIVED', ts })))
    .catch(() => {});

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, opts),
      storeHistory,
      notifyClients,
    ])
  );
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
