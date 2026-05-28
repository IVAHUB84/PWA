import { getSession } from './storage.js';

const _KEY_URL      = 'yc_worker_url';
const _KEY_SUB      = 'yc_push_subscribed';
const _KEY_SECRET   = 'yc_push_secret';

function _workerUrl() {
  return (localStorage.getItem(_KEY_URL) || '').replace(/\/$/, '');
}

let _vapidKey = null;

export async function initPush() {
  const url = _workerUrl();
  if (!url) return;
  try {
    const r = await fetch(`${url}/vapid-public-key`);
    if (!r.ok) return;
    const data = await r.json();
    _vapidKey = data.key || null;
  } catch {}
}

function _urlB64ToUint8(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

export async function subscribePush(clientId, phone) {
  const url = _workerUrl();
  if (!url) { console.warn('[push] no worker URL'); return; }
  if (!_vapidKey) await initPush();
  if (!_vapidKey) { console.warn('[push] no VAPID key after initPush'); return; }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[push] PushManager not supported');
    return;
  }
  try {
    const perm = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (perm !== 'granted') { console.warn('[push] permission denied:', perm); return; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlB64ToUint8(_vapidKey),
      });
    }
    const r = await fetch(`${url}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), clientId: String(clientId), phone: phone || '' }),
    });
    if (r.ok) {
      localStorage.setItem(_KEY_SUB, '1');
      console.log('[push] subscribed OK for client', clientId);
    } else {
      console.warn('[push] worker /subscribe returned', r.status);
    }
  } catch(e) {
    console.error('[push] subscribe failed:', e);
  }
}

export async function unsubscribePush() {
  const url = _workerUrl();
  const sess = getSession();
  if (!url || !sess?.client_id) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await fetch(`${url}/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: String(sess.client_id), endpoint }),
      });
      await sub.unsubscribe();
    }
    localStorage.removeItem(_KEY_SUB);
  } catch {}
}

export async function sendAdminPush(title, body, targetClientId) {
  const url = _workerUrl();
  const secret = localStorage.getItem(_KEY_SECRET);
  if (!url || !secret) return { ok: false, sent: 0, error: 'no_config' };
  try {
    const payload = { title, body };
    if (targetClientId) payload.targetClientId = String(targetClientId);
    const r = await fetch(`${url}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
      body: JSON.stringify(payload),
    });
    if (!r.ok) return { ok: false, sent: 0, error: r.status };
    return await r.json();
  } catch(e) { return { ok: false, sent: 0, error: String(e) }; }
}

Object.assign(window, { subscribePush, unsubscribePush });
