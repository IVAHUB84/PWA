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
  if (!url || !_vapidKey) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _urlB64ToUint8(_vapidKey),
    });
    await fetch(`${url}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), clientId: String(clientId), phone: phone || '' }),
    });
    localStorage.setItem(_KEY_SUB, '1');
  } catch(e) {
    console.warn('Push subscribe failed:', e);
  }
}

export async function unsubscribePush() {
  const url = _workerUrl();
  const sess = getSession();
  if (!url || !sess?.client_id) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    await fetch(`${url}/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: String(sess.client_id) }),
    });
    localStorage.removeItem(_KEY_SUB);
  } catch {}
}

export async function sendAdminPush(title, body, targetClientId) {
  const url = _workerUrl();
  const secret = localStorage.getItem(_KEY_SECRET);
  if (!url || !secret) return false;
  try {
    const payload = { title, body };
    if (targetClientId) payload.targetClientId = String(targetClientId);
    const r = await fetch(`${url}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
      body: JSON.stringify(payload),
    });
    return r.ok;
  } catch { return false; }
}

Object.assign(window, { subscribePush, unsubscribePush });
