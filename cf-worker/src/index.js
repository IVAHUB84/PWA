// Cloudflare Worker — VAPID Web Push
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY_JWK, ADMIN_SECRET, YC_TOKEN, YC_USER_TOKEN, YC_COMPANY
// KV binding: SUBSCRIPTIONS

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// ── Base64url helpers ────────────────────────────────────────────────────────

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromB64url(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

// ── HKDF (full Extract+Expand via Web Crypto) ────────────────────────────────

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key, length * 8
  );
  return new Uint8Array(bits);
}

// ── RFC 8291 payload encryption (aes128gcm) ──────────────────────────────────

async function encryptPayload(subscription, plaintext) {
  const p256dh = fromB64url(subscription.keys.p256dh);
  const auth   = fromB64url(subscription.keys.auth);

  const receiverPub = await crypto.subtle.importKey(
    'raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, true, []
  );

  const senderKP = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const senderPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', senderKP.publicKey));

  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: receiverPub }, senderKP.privateKey, 256
  ));

  // IKM = HKDF(salt=auth, ikm=ecdh_secret, info="WebPush: info\0"||recv_pub||send_pub, 32)
  const ikmLabel = new TextEncoder().encode('WebPush: info\0');
  const ikmInfo = new Uint8Array(ikmLabel.length + 65 + 65);
  ikmInfo.set(ikmLabel);
  ikmInfo.set(p256dh, ikmLabel.length);
  ikmInfo.set(senderPubRaw, ikmLabel.length + 65);
  const IKM = await hkdf(auth, ecdhSecret, ikmInfo, 32);

  const contentSalt = crypto.getRandomValues(new Uint8Array(16));

  const cekInfo   = new Uint8Array([...new TextEncoder().encode('Content-Encoding: aes128gcm'), 0x00]);
  const nonceInfo = new Uint8Array([...new TextEncoder().encode('Content-Encoding: nonce'), 0x00]);
  const CEK   = await hkdf(contentSalt, IKM, cekInfo, 16);
  const NONCE = await hkdf(contentSalt, IKM, nonceInfo, 12);

  const aesKey = await crypto.subtle.importKey('raw', CEK, { name: 'AES-GCM' }, false, ['encrypt']);

  const msg    = new TextEncoder().encode(plaintext);
  const padded = new Uint8Array(msg.length + 1);
  padded.set(msg);
  padded[msg.length] = 0x02; // delimiter

  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: NONCE }, aesKey, padded
  ));

  // aes128gcm header: salt(16) + rs(4 BE) + idlen(1=65) + sender_pub(65)
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(contentSalt);
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = 65;
  header.set(senderPubRaw, 21);

  const body = new Uint8Array(header.length + ciphertext.length);
  body.set(header);
  body.set(ciphertext, header.length);
  return body;
}

// ── VAPID JWT ────────────────────────────────────────────────────────────────

async function vapidToken(endpoint, env) {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 43200;

  const hdr = b64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const pld = b64url(new TextEncoder().encode(JSON.stringify({ aud, exp, sub: 'mailto:admin@studio.ru' })));
  const input = `${hdr}.${pld}`;

  const privKey = await crypto.subtle.importKey(
    'jwk', JSON.parse(env.VAPID_PRIVATE_KEY_JWK),
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, new TextEncoder().encode(input));
  return `${input}.${b64url(sig)}`;
}

// ── Send one push ────────────────────────────────────────────────────────────

async function sendOne(subscription, payload, env) {
  const jwt = await vapidToken(subscription.endpoint, env);
  const body = await encryptPayload(subscription, payload);
  const resp = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'TTL': '86400',
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'Authorization': `vapid t=${jwt},k=${env.VAPID_PUBLIC_KEY}`,
    },
    body,
  });
  return resp.status;
}

// ── Route handlers ───────────────────────────────────────────────────────────

async function handleSubscribe(req, env) {
  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const { subscription, clientId, phone } = body;
  if (!subscription?.endpoint || !clientId) return json({ error: 'missing_fields' }, 400);
  await env.SUBSCRIPTIONS.put(
    `sub:${clientId}`,
    JSON.stringify({ subscription, clientId: String(clientId), phone: phone || '', ts: Date.now() })
  );
  return json({ ok: true });
}

async function handleUnsubscribe(req, env) {
  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const { clientId } = body;
  if (!clientId) return json({ error: 'missing_fields' }, 400);
  await env.SUBSCRIPTIONS.delete(`sub:${clientId}`);
  return json({ ok: true });
}

async function handleSend(req, env) {
  if (req.headers.get('X-Admin-Secret') !== env.ADMIN_SECRET) return new Response('Unauthorized', { status: 401 });
  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const { title, body: text, targetClientId } = body;
  if (!title || !text) return json({ error: 'missing_fields' }, 400);

  const payload = JSON.stringify({ title, body: text, icon: './icon-192.png' });
  let sent = 0, failed = 0;

  if (targetClientId) {
    const val = await env.SUBSCRIPTIONS.get(`sub:${targetClientId}`);
    if (!val) return json({ ok: false, error: 'not_found' });
    const { subscription } = JSON.parse(val);
    const status = await sendOne(subscription, payload, env);
    if (status === 410) await env.SUBSCRIPTIONS.delete(`sub:${targetClientId}`);
    status < 300 ? sent++ : failed++;
  } else {
    let cursor = undefined;
    do {
      const list = await env.SUBSCRIPTIONS.list({ prefix: 'sub:', cursor, limit: 100 });
      for (const key of list.keys) {
        const val = await env.SUBSCRIPTIONS.get(key.name);
        if (!val) continue;
        const { subscription } = JSON.parse(val);
        const status = await sendOne(subscription, payload, env);
        if (status === 410) await env.SUBSCRIPTIONS.delete(key.name);
        status < 300 ? sent++ : failed++;
      }
      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);
  }

  return json({ ok: true, sent, failed });
}

// ── Cron: send reminders for tomorrow's bookings ─────────────────────────────

async function handleCron(env) {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);

  const r = await fetch(
    `https://api.yclients.com/api/v1/records/${env.YC_COMPANY}?start_date=${dateStr}&end_date=${dateStr}&count=200`,
    {
      headers: {
        Authorization: `Bearer ${env.YC_TOKEN}, User ${env.YC_USER_TOKEN}`,
        Accept: 'application/vnd.yclients.v2+json',
        'Content-Type': 'application/json',
      },
    }
  );
  if (!r.ok) { console.error('YCLIENTS records fetch failed', r.status); return; }
  const data = await r.json();
  if (!data.success || !Array.isArray(data.data)) return;

  const records = data.data.filter(rec => !rec.deleted);
  let sent = 0;

  for (const rec of records) {
    const clientId = rec.client?.id;
    if (!clientId) continue;
    const val = await env.SUBSCRIPTIONS.get(`sub:${clientId}`);
    if (!val) continue;
    const { subscription } = JSON.parse(val);
    const svc = rec.services?.[0]?.title || 'процедура';
    const time = (rec.date || '').slice(11, 16);
    const payload = JSON.stringify({
      title: 'Реснички · Напоминание о визите',
      body: `Завтра в ${time}: ${svc}. Ждём вас!`,
      icon: './icon-192.png',
    });
    const status = await sendOne(subscription, payload, env);
    if (status === 410) await env.SUBSCRIPTIONS.delete(`sub:${clientId}`);
    if (status < 300) sent++;
  }

  console.log(`Cron reminders: ${sent} sent for ${dateStr}`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/vapid-public-key') {
      return json({ key: env.VAPID_PUBLIC_KEY });
    }
    if (req.method === 'POST' && url.pathname === '/subscribe')   return handleSubscribe(req, env);
    if (req.method === 'POST' && url.pathname === '/unsubscribe') return handleUnsubscribe(req, env);
    if (req.method === 'POST' && url.pathname === '/send')        return handleSend(req, env);

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(handleCron(env));
  },
};
