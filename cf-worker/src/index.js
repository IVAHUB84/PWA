// Cloudflare Worker — VAPID Web Push
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY_JWK, ADMIN_SECRET, YC_TOKEN, YC_USER_TOKEN, YC_COMPANY
// KV binding: SUBSCRIPTIONS

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret',
};

const STUDIO_TZ_OFFSET_MIN = 180; // UTC+3 (Москва)

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

// ── Endpoint hash ────────────────────────────────────────────────────────────

export async function endpointHash(endpoint) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return b64url(buf);
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

// ── Preferences helpers ──────────────────────────────────────────────────────

export async function getPrefs(env, clientId) {
  try {
    const raw = await env.SUBSCRIPTIONS.get(`prefs:${clientId}`);
    if (!raw) return { promo: true, remind: true };
    const parsed = JSON.parse(raw);
    return {
      promo:  parsed.promo  === false ? false : true,
      remind: parsed.remind === false ? false : true,
    };
  } catch {
    return { promo: true, remind: true };
  }
}

export async function putPrefs(env, clientId, { promo, remind }) {
  await env.SUBSCRIPTIONS.put(
    `prefs:${clientId}`,
    JSON.stringify({ promo: Boolean(promo), remind: Boolean(remind), ts: Date.now() })
  );
}

// ── Route handlers ───────────────────────────────────────────────────────────

export async function handleSubscribe(req, env) {
  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const { subscription, clientId, phone } = body;
  if (!subscription?.endpoint || !clientId) return json({ error: 'missing_fields' }, 400);
  const hash = await endpointHash(subscription.endpoint);
  await env.SUBSCRIPTIONS.put(
    `sub:${clientId}:${hash}`,
    JSON.stringify({
      subscription,
      clientId: String(clientId),
      phone: phone || '',
      endpoint: subscription.endpoint,
      ts: Date.now(),
    })
  );
  return json({ ok: true });
}

export async function handleUnsubscribe(req, env) {
  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const { clientId, endpoint } = body;
  if (!clientId || !endpoint) return json({ error: 'missing_fields' }, 400);
  const hash = await endpointHash(endpoint);
  await env.SUBSCRIPTIONS.delete(`sub:${clientId}:${hash}`);
  return json({ ok: true });
}

export async function handlePreferences(req, env) {
  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
    const { clientId, promo, remind } = body;
    if (!clientId) return json({ error: 'missing_fields' }, 400);
    await putPrefs(env, clientId, {
      promo:  promo  !== false,
      remind: remind !== false,
    });
    return json({ ok: true });
  }

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const clientId = url.searchParams.get('clientId');
    if (!clientId) return json({ error: 'missing_fields' }, 400);
    const prefs = await getPrefs(env, clientId);
    return json(prefs);
  }

  return new Response('Method Not Allowed', { status: 405 });
}

export async function handleSend(req, env, _sendOne = sendOne) {
  if (req.headers.get('X-Admin-Secret') !== env.ADMIN_SECRET) return new Response('Unauthorized', { status: 401 });
  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const { title, body: text, targetClientId, target } = body;
  if (!title || !text) return json({ error: 'missing_fields' }, 400);

  const payloadData = { title, body: text, icon: './icon-192.png' };
  if (target !== undefined) payloadData.target = target;
  const payload = JSON.stringify(payloadData);
  let sent = 0, failed = 0;

  const prefsCache = new Map();

  const prefix = targetClientId ? `sub:${targetClientId}:` : 'sub:';
  let cursor = undefined;
  do {
    const list = await env.SUBSCRIPTIONS.list({ prefix, cursor, limit: 100 });
    for (const key of list.keys) {
      const val = await env.SUBSCRIPTIONS.get(key.name);
      if (!val) continue;
      const parsed = JSON.parse(val);
      const subscription = parsed.subscription;
      if (!subscription?.endpoint) continue;

      const clientId = String(parsed.clientId || '');
      if (clientId) {
        if (!prefsCache.has(clientId)) {
          prefsCache.set(clientId, await getPrefs(env, clientId));
        }
        if (prefsCache.get(clientId).promo === false) continue;
      }

      const host = new URL(subscription.endpoint).host;
      const status = await _sendOne(subscription, payload, env);
      if (status < 300) {
        console.log(`[send] host=${host} status=${status}`);
        sent++;
      } else {
        console.warn(`[send] host=${host} status=${status}`);
        failed++;
      }
      if (status === 410) await env.SUBSCRIPTIONS.delete(key.name);
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  if (targetClientId && sent === 0 && failed === 0) {
    return json({ ok: false, error: 'not_found' });
  }

  return json({ ok: true, sent, failed });
}

// ── Review proxy ─────────────────────────────────────────────────────────────

async function handleReview(req, env) {
  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  if (!body || body.rating == null || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
    return json({ error: 'missing_fields' }, 400);
  }
  const { rating, text, staff_id, record_id, client_id } = body;
  const ycUrl = `https://api.yclients.com/api/v1/comments/${env.YC_COMPANY}`;
  const headers = {
    Authorization: `Bearer ${env.YC_TOKEN}, User ${env.YC_USER_TOKEN}`,
    Accept: 'application/vnd.yclients.v2+json',
    'Content-Type': 'application/json',
  };
  let ycResp, data;
  try {
    ycResp = await fetch(ycUrl, { method: 'POST', headers, body: JSON.stringify({ rating, text, staff_id, record_id, client_id }) });
    data = await ycResp.json().catch(() => ({}));
  } catch (e) {
    return json({ ok: false, status: 0 }, 502);
  }
  if (ycResp.ok && data.success === true) return json({ ok: true });
  return json({ ok: false, status: ycResp.status }, 502);
}

// ── Cron: send reminders ──────────────────────────────────────────────────────

export async function handleCron(env, _sendOne = sendOne, _nowMs = null) {
  const nowMs = _nowMs !== null ? _nowMs : Date.now();
  // «Локальное сейчас» студии (UTC+3): сдвигаем UTC на смещение и используем UTC-геттеры
  const localNow = new Date(nowMs + STUDIO_TZ_OFFSET_MIN * 60000);
  const localYear  = localNow.getUTCFullYear();
  const localMonth = localNow.getUTCMonth();
  const localDay   = localNow.getUTCDate();
  const localHour  = localNow.getUTCHours();

  const todayStr    = `${localYear}-${String(localMonth + 1).padStart(2, '0')}-${String(localDay).padStart(2, '0')}`;
  const tomorrowDt  = new Date(Date.UTC(localYear, localMonth, localDay + 1));
  const tomorrowStr = tomorrowDt.toISOString().slice(0, 10);

  // Выборка записей на сегодня и на завтра
  async function fetchRecords(dateStr) {
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
    if (!r.ok) { console.error('YCLIENTS records fetch failed', r.status); return []; }
    const data = await r.json();
    if (!data.success || !Array.isArray(data.data)) return [];
    return data.data.filter(rec => !rec.deleted);
  }

  const [todayRecords, tomorrowRecords] = await Promise.all([
    fetchRecords(todayStr),
    fetchRecords(tomorrowStr),
  ]);

  let sent = 0;

  // Обработка одного вида напоминания для одной записи
  async function processReminder(rec, kind) {
    const recordId = rec.id;
    if (!recordId) return;

    const clientId = rec.client?.id;
    if (!clientId) return;

    // Анти-дубль
    const markerKey = `reminded:${recordId}:${kind}`;
    const existing = await env.SUBSCRIPTIONS.get(markerKey);
    if (existing) return;

    const prefs = await getPrefs(env, clientId);
    if (prefs.remind === false) return;

    const svc = rec.services?.[0]?.title || 'процедура';
    const time = (rec.date || '').slice(11, 16);

    const payloadBody = kind === 'day'
      ? `Завтра в ${time}: ${svc}. Ждём вас!`
      : `Сегодня в ${time}: ${svc}. Скоро ждём вас!`;

    const payload = JSON.stringify({
      title: 'Реснички · Напоминание о визите',
      body: payloadBody,
      icon: './icon-192.png',
      target: { type: 'records' },
    });

    let anySuccess = false;
    let cursor = undefined;
    do {
      const list = await env.SUBSCRIPTIONS.list({ prefix: `sub:${clientId}:`, cursor, limit: 100 });
      for (const key of list.keys) {
        const val = await env.SUBSCRIPTIONS.get(key.name);
        if (!val) continue;
        const parsed = JSON.parse(val);
        const subscription = parsed.subscription;
        if (!subscription?.endpoint) continue;
        const host = new URL(subscription.endpoint).host;
        const status = await _sendOne(subscription, payload, env);
        if (status < 300) {
          console.log(`[cron:${kind}] host=${host} status=${status}`);
          sent++;
          anySuccess = true;
        } else {
          console.warn(`[cron:${kind}] host=${host} status=${status}`);
        }
        if (status === 410) await env.SUBSCRIPTIONS.delete(key.name);
      }
      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);

    if (anySuccess) {
      await env.SUBSCRIPTIONS.put(markerKey, '1', { expirationTtl: 172800 });
    }
  }

  // Вид «day» — накануне, только при localHour === 18
  if (localHour === 18) {
    for (const rec of tomorrowRecords) {
      await processReminder(rec, 'day');
    }
  }

  // Вид «soon» — окно [now+90, now+150) минут до визита.
  // Используем абсолютные ms: recDateStr — локальное время студии «YYYY-MM-DDTHH:MM:SS»,
  // переводим его в UTC (вычитая смещение UTC+3), чтобы корректно обрабатывать
  // визиты 00:00–01:29, для которых «2 часа назад» — предыдущие сутки.
  // Перебираем записи и сегодня, и завтра — ранне-утренние визиты следующего дня
  // могут попасть в окно к концу текущего вечера.
  for (const rec of [...todayRecords, ...tomorrowRecords]) {
    const recDateStr = rec.date || '';
    if (!recDateStr) continue;
    // recDateStr — локальное время студии «YYYY-MM-DDTHH:MM:SS».
    // Парсим как UTC через Date.UTC, чтобы не зависеть от системной TZ среды исполнения,
    // затем вычитаем смещение UTC+3 → получаем истинный UTC-момент визита.
    const [datePart, timePart = '00:00:00'] = recDateStr.replace(' ', 'T').split('T');
    const [yr, mo, dy] = datePart.split('-').map(Number);
    const [hh, mm, ss = 0] = timePart.split(':').map(Number);
    const recLocalMs = Date.UTC(yr, mo - 1, dy, hh, mm, ss);
    if (isNaN(recLocalMs)) continue;
    const recUtcMs = recLocalMs - STUDIO_TZ_OFFSET_MIN * 60000;
    const diffMin = (recUtcMs - nowMs) / 60000;
    if (diffMin >= 90 && diffMin < 150) {
      await processReminder(rec, 'soon');
    }
  }

  console.log(`Cron reminders: ${sent} sent (today=${todayStr}, tomorrow=${tomorrowStr})`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/vapid-public-key') {
      return json({ key: env.VAPID_PUBLIC_KEY });
    }
    if (req.method === 'POST' && url.pathname === '/subscribe')    return handleSubscribe(req, env);
    if (req.method === 'POST' && url.pathname === '/unsubscribe')  return handleUnsubscribe(req, env);
    if (req.method === 'POST' && url.pathname === '/send')         return handleSend(req, env);
    if (req.method === 'POST' && url.pathname === '/review')       return handleReview(req, env);
    if ((req.method === 'POST' || req.method === 'GET') && url.pathname === '/preferences') {
      return handlePreferences(req, env);
    }
    return new Response('Not Found', { status: 404 });
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(handleCron(env));
  },
};
