// Схема IndexedDB: DB_NAME='studio-inbox', DB_VERSION=1, STORE='notifications',
// keyPath='id', формат id: "<bucket>:<title>|<body>" (bucket = floor(ts/60000)),
// структура записи: {id, title, body, icon?, ts, read, target?}, LIMIT=50.
// target = {type,id?} (нормализованный) или null/отсутствует (= «без цели»).
// Инлайн-копия этого контракта хранится в docs/sw.js (_IDB_*) — при изменении синхронизировать.
const DB_NAME = 'studio-inbox';
const DB_VERSION = 1;
const STORE = 'notifications';
const LIMIT = 50;

function _openDB() {
  return new Promise((resolve, reject) => {
    const idb = self.indexedDB || indexedDB;
    const req = idb.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

function _makeId(title, body, ts) {
  const bucket = Math.floor(ts / 60000);
  const content = String(title ?? '') + '|' + String(body ?? '');
  return bucket + ':' + content;
}

export async function addNotification({ title, body, icon, ts, target }) {
  try {
    const db = await _openDB();
    const id = _makeId(title, body, ts);
    const record = { id, title: String(title ?? ''), body: String(body ?? ''), icon: icon || null, ts, read: false, target: target ?? null };

    const inserted = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
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

    if (inserted) await _trimOldest(db);
    db.close();
  } catch {}
}

async function _trimOldest(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const allReq = store.getAll();
    allReq.onsuccess = () => {
      const all = allReq.result;
      if (all.length <= LIMIT) { resolve(); return; }
      all.sort((a, b) => a.ts - b.ts);
      const toDelete = all.slice(0, all.length - LIMIT);
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

export async function getAllNotifications() {
  try {
    const db = await _openDB();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = e => reject(e.target.error);
    });
    db.close();
    return result.sort((a, b) => b.ts - a.ts);
  } catch {
    return [];
  }
}

export async function getUnreadCount() {
  try {
    const db = await _openDB();
    const count = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      let n = 0;
      const req = store.openCursor();
      req.onsuccess = e => {
        const cursor = e.target.result;
        if (cursor) {
          if (!cursor.value.read) n++;
          cursor.continue();
        } else {
          resolve(n);
        }
      };
      req.onerror = e => reject(e.target.error);
    });
    db.close();
    return count;
  } catch {
    return 0;
  }
}

export async function markAllRead() {
  try {
    const db = await _openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const allReq = store.getAll();
      allReq.onsuccess = () => {
        const all = allReq.result;
        let pending = all.filter(n => !n.read).length;
        if (!pending) { resolve(); return; }
        all.forEach(rec => {
          if (rec.read) return;
          rec.read = true;
          const putReq = store.put(rec);
          putReq.onsuccess = () => { if (--pending === 0) resolve(); };
          putReq.onerror   = () => { if (--pending === 0) resolve(); };
        });
      };
      allReq.onerror = e => reject(e.target.error);
    });
    db.close();
  } catch {}
}

export async function deleteNotification(id) {
  try {
    const db = await _openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
    db.close();
  } catch {}
}

export async function setRead(id, read) {
  try {
    const db = await _openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const rec = getReq.result;
        if (!rec) { resolve(); return; }
        rec.read = !!read;
        const putReq = store.put(rec);
        putReq.onsuccess = () => resolve();
        putReq.onerror   = e => reject(e.target.error);
      };
      getReq.onerror = e => reject(e.target.error);
    });
    db.close();
  } catch {}
}

export async function clearAll() {
  try {
    const db = await _openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).clear();
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
    db.close();
  } catch {}
}
