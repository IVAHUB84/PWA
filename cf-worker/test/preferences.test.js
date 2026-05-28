/**
 * Тесты предпочтений push и handleCron (v1.6.0).
 *
 * Запуск: node cf-worker/test/preferences.test.js
 */

const { getPrefs, putPrefs, handlePreferences, handleSend, handleCron, endpointHash } =
  await import('../src/index.js');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

function assertEqual(a, b, label) {
  assert(
    JSON.stringify(a) === JSON.stringify(b),
    `${label} (got: ${JSON.stringify(a)}, expected: ${JSON.stringify(b)})`
  );
}

function makeMockKV() {
  const store = new Map();
  const putCalls = [];
  const deleteCalls = [];
  const getCalls = [];
  return {
    store,
    putCalls,
    deleteCalls,
    getCalls,
    async get(key) { getCalls.push(key); return store.has(key) ? store.get(key) : null; },
    async put(key, value, options) { putCalls.push({ key, value, options }); store.set(key, value); },
    async delete(key) { deleteCalls.push(key); store.delete(key); },
    async list({ prefix = '', cursor: _cursor, limit: _limit } = {}) {
      const keys = [...store.keys()]
        .filter(k => k.startsWith(prefix))
        .map(name => ({ name }));
      return { keys, list_complete: true, cursor: undefined };
    },
  };
}

function makeRequest(body, headers = {}, method = 'POST', url = 'https://worker/preferences') {
  return {
    method,
    url,
    json: async () => body,
    headers: {
      get: (h) => headers[h] ?? null,
    },
  };
}

function mockSendOne(status = 201) {
  const calls = [];
  const fn = async (sub) => { calls.push(sub.endpoint); return status; };
  fn.calls = calls;
  return fn;
}

const ENDPOINT_A = 'https://fcm.googleapis.com/fcm/send/device-aaa';
const ENDPOINT_B = 'https://fcm.googleapis.com/fcm/send/device-bbb';
const MOCK_SUB_A = { endpoint: ENDPOINT_A, keys: { p256dh: 'AAAA', auth: 'BBBB' } };
const MOCK_SUB_B = { endpoint: ENDPOINT_B, keys: { p256dh: 'CCCC', auth: 'DDDD' } };

// ── getPrefs / putPrefs: дефолты и толерантность ─────────────────────────────

console.log('\n-- getPrefs: отсутствие ключа → дефолт {promo:true, remind:true} --');
{
  const kv = makeMockKV();
  const env = { SUBSCRIPTIONS: kv };
  const result = await getPrefs(env, 'client1');
  assertEqual(result, { promo: true, remind: true }, 'дефолт при отсутствии ключа');
}

console.log('\n-- putPrefs + getPrefs: запись и чтение --');
{
  const kv = makeMockKV();
  const env = { SUBSCRIPTIONS: kv };
  await putPrefs(env, 'client2', { promo: false, remind: true });
  assert(kv.store.has('prefs:client2'), 'ключ prefs:client2 записан');
  const val = JSON.parse(kv.store.get('prefs:client2'));
  assertEqual(val.promo, false, 'promo === false записано');
  assertEqual(val.remind, true, 'remind === true записано');
  assert(typeof val.ts === 'number', 'ts — число');
  // Повторный getPrefs
  kv.getCalls.length = 0;
  const result = await getPrefs(env, 'client2');
  assertEqual(result, { promo: false, remind: true }, 'getPrefs возвращает сохранённые значения');
}

console.log('\n-- getPrefs: толерантность — частичное значение {promo:false} --');
{
  const kv = makeMockKV();
  kv.store.set('prefs:client3', JSON.stringify({ promo: false }));
  const env = { SUBSCRIPTIONS: kv };
  const result = await getPrefs(env, 'client3');
  assertEqual(result, { promo: false, remind: true }, 'отсутствующий remind → true');
}

console.log('\n-- getPrefs: толерантность — битый JSON → дефолт --');
{
  const kv = makeMockKV();
  kv.store.set('prefs:client4', 'not-json{{{');
  const env = { SUBSCRIPTIONS: kv };
  const result = await getPrefs(env, 'client4');
  assertEqual(result, { promo: true, remind: true }, 'битый JSON → дефолт');
}

console.log('\n-- putPrefs: идемпотентная перезапись --');
{
  const kv = makeMockKV();
  const env = { SUBSCRIPTIONS: kv };
  await putPrefs(env, 'c5', { promo: true, remind: true });
  await putPrefs(env, 'c5', { promo: false, remind: false });
  const result = await getPrefs(env, 'c5');
  assertEqual(result, { promo: false, remind: false }, 'перезапись работает');
}

// ── Эндпоинт /preferences ────────────────────────────────────────────────────

console.log('\n-- POST /preferences: сохраняет prefs и возвращает {ok:true} --');
{
  const kv = makeMockKV();
  const env = { SUBSCRIPTIONS: kv };
  const req = makeRequest({ clientId: 'c10', promo: false, remind: true });
  const resp = await handlePreferences(req, env);
  const result = await resp.json();
  assertEqual(result, { ok: true }, 'ответ {ok:true}');
  assert(kv.store.has('prefs:c10'), 'ключ prefs:c10 записан');
  const val = JSON.parse(kv.store.get('prefs:c10'));
  assertEqual(val.promo, false, 'promo сохранён false');
  assertEqual(val.remind, true, 'remind сохранён true');
}

console.log('\n-- GET /preferences: без записи → {promo:true, remind:true} --');
{
  const kv = makeMockKV();
  const env = { SUBSCRIPTIONS: kv };
  const req = makeRequest(null, {}, 'GET', 'https://worker/preferences?clientId=c11');
  const resp = await handlePreferences(req, env);
  assertEqual(resp.status, 200, 'статус 200');
  const result = await resp.json();
  assertEqual(result, { promo: true, remind: true }, 'дефолт без записи');
}

console.log('\n-- POST /preferences без clientId → missing_fields, 400 --');
{
  const kv = makeMockKV();
  const env = { SUBSCRIPTIONS: kv };
  const req = makeRequest({ promo: false, remind: true });
  const resp = await handlePreferences(req, env);
  assertEqual(resp.status, 400, 'статус 400');
  const result = await resp.json();
  assertEqual(result.error, 'missing_fields', 'error missing_fields');
}

console.log('\n-- GET /preferences без clientId → missing_fields, 400 --');
{
  const kv = makeMockKV();
  const env = { SUBSCRIPTIONS: kv };
  const req = makeRequest(null, {}, 'GET', 'https://worker/preferences');
  const resp = await handlePreferences(req, env);
  assertEqual(resp.status, 400, 'статус 400');
  const result = await resp.json();
  assertEqual(result.error, 'missing_fields', 'error missing_fields');
}

// ── handleSend учитывает promo ────────────────────────────────────────────────

console.log('\n-- handleSend: клиент с promo:false не получает рассылку --');
{
  const kv = makeMockKV();
  const hashA = await endpointHash(ENDPOINT_A);
  kv.store.set(`sub:20:${hashA}`, JSON.stringify({ subscription: MOCK_SUB_A, clientId: '20', endpoint: ENDPOINT_A }));
  kv.store.set('prefs:20', JSON.stringify({ promo: false, remind: true, ts: 1 }));

  const fakeSend = mockSendOne(201);
  const req = makeRequest(
    { title: 'Test', body: 'Hi' },
    { 'X-Admin-Secret': 'secret' }
  );
  const env = { SUBSCRIPTIONS: kv, ADMIN_SECRET: 'secret' };
  const resp = await handleSend(req, env, fakeSend);
  const result = await resp.json();

  assertEqual(fakeSend.calls.length, 0, 'sendOne не вызван для promo:false');
  assertEqual(result.sent, 0, 'sent === 0');
}

console.log('\n-- handleSend: клиент с promo:true/без записи получает рассылку --');
{
  const kv = makeMockKV();
  const hashA = await endpointHash(ENDPOINT_A);
  kv.store.set(`sub:21:${hashA}`, JSON.stringify({ subscription: MOCK_SUB_A, clientId: '21', endpoint: ENDPOINT_A }));

  const fakeSend = mockSendOne(201);
  const req = makeRequest(
    { title: 'Test', body: 'Hi' },
    { 'X-Admin-Secret': 'secret' }
  );
  const env = { SUBSCRIPTIONS: kv, ADMIN_SECRET: 'secret' };
  const resp = await handleSend(req, env, fakeSend);
  const result = await resp.json();

  assertEqual(fakeSend.calls.length, 1, 'sendOne вызван для клиента без записи prefs (дефолт true)');
  assertEqual(result.sent, 1, 'sent === 1');
}

console.log('\n-- handleSend: мультидевайс promo:true — prefs читается один раз --');
{
  const kv = makeMockKV();
  const hashA = await endpointHash(ENDPOINT_A);
  const hashB = await endpointHash(ENDPOINT_B);
  kv.store.set(`sub:22:${hashA}`, JSON.stringify({ subscription: MOCK_SUB_A, clientId: '22', endpoint: ENDPOINT_A }));
  kv.store.set(`sub:22:${hashB}`, JSON.stringify({ subscription: MOCK_SUB_B, clientId: '22', endpoint: ENDPOINT_B }));
  kv.store.set('prefs:22', JSON.stringify({ promo: true, remind: true, ts: 1 }));

  const fakeSend = mockSendOne(201);
  const req = makeRequest(
    { title: 'Test', body: 'Hi', targetClientId: '22' },
    { 'X-Admin-Secret': 'secret' }
  );
  const env = { SUBSCRIPTIONS: kv, ADMIN_SECRET: 'secret' };

  kv.getCalls.length = 0;
  const resp = await handleSend(req, env, fakeSend);
  const result = await resp.json();

  assertEqual(fakeSend.calls.length, 2, 'sendOne вызван дважды (оба устройства)');
  assertEqual(result.sent, 2, 'sent === 2');
  const prefsGets = kv.getCalls.filter(k => k === 'prefs:22');
  assertEqual(prefsGets.length, 1, 'prefs читается из KV ровно один раз (кэш)');
}

// ── handleCron: remind, soon, анти-дубли, TZ ─────────────────────────────────

// Вспомогательная функция для мока YCLIENTS (два запроса: today и tomorrow)
function mockYclients(todayRecords, tomorrowRecords) {
  return async (url) => {
    if (!url.includes('yclients')) return { status: 200 };
    const urlObj = new URL(url);
    const startDate = urlObj.searchParams.get('start_date');
    const records = startDate === tomorrowDateStr() ? tomorrowRecords : todayRecords;
    return {
      ok: true,
      json: async () => ({ success: true, data: records }),
    };
  };
}

// Вычисляет «завтра» в локальном времени студии (UTC+3) для заданного nowMs
function localDateStr(nowMs, offsetDays = 0) {
  const local = new Date(nowMs + 180 * 60000);
  const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + offsetDays));
  return d.toISOString().slice(0, 10);
}

// Фиксированный nowMs для тестов: UTC 07:00 → локальное 10:00 (UTC+3)
// 2026-05-29T07:00:00Z → локальное 2026-05-29 10:00
const TEST_NOW_MS = Date.UTC(2026, 4, 29, 7, 0, 0); // месяц 0-based: 4 = май

function tomorrowDateStr() {
  return localDateStr(TEST_NOW_MS, 1);
}
function todayDateStr() {
  return localDateStr(TEST_NOW_MS, 0);
}

function makeRecord(id, clientId, dateStr) {
  return {
    id,
    deleted: false,
    client: { id: clientId },
    services: [{ title: 'Тест-услуга' }],
    date: dateStr,
  };
}

console.log('\n-- handleCron: клиент с remind:false не получает напоминание --');
{
  const kv = makeMockKV();
  const hashA = await endpointHash(ENDPOINT_A);
  kv.store.set(`sub:30:${hashA}`, JSON.stringify({ subscription: MOCK_SUB_A, clientId: '30', endpoint: ENDPOINT_A }));
  kv.store.set('prefs:30', JSON.stringify({ promo: true, remind: false, ts: 1 }));

  // Запись на завтра в 18:30 локального времени
  const tomorrowAt1830 = `${tomorrowDateStr()}T18:30:00`;
  const rec = makeRecord(1001, 30, tomorrowAt1830);

  const origFetch = globalThis.fetch;
  globalThis.fetch = mockYclients([], [rec]);

  const fakeSend = mockSendOne(200);
  const env = { SUBSCRIPTIONS: kv, YC_COMPANY: '123', YC_TOKEN: 'tok', YC_USER_TOKEN: 'utok' };

  // nowMs: локальное 18:00
  const nowAt18Local = Date.UTC(2026, 4, 28, 15, 0, 0); // UTC 15:00 → локальное 18:00
  await handleCron(env, fakeSend, nowAt18Local);
  globalThis.fetch = origFetch;

  assertEqual(fakeSend.calls.length, 0, 'sendOne не вызван для remind:false');
}

console.log('\n-- handleCron: day-напоминание отправляется при localHour===18, маркер записывается --');
{
  const kv = makeMockKV();
  const hashA = await endpointHash(ENDPOINT_A);
  kv.store.set(`sub:31:${hashA}`, JSON.stringify({ subscription: MOCK_SUB_A, clientId: '31', endpoint: ENDPOINT_A }));

  const nowAt18Local = Date.UTC(2026, 4, 28, 15, 0, 0); // UTC 15:00 → локальное 18:00
  const tomorrowStr = localDateStr(nowAt18Local, 1);
  const rec = makeRecord(1002, 31, `${tomorrowStr}T15:00:00`);

  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (!url.includes('yclients')) return { status: 200 };
    const urlObj = new URL(url);
    const startDate = urlObj.searchParams.get('start_date');
    const records = startDate === tomorrowStr ? [rec] : [];
    return { ok: true, json: async () => ({ success: true, data: records }) };
  };

  const fakeSend = mockSendOne(200);
  const env = { SUBSCRIPTIONS: kv, YC_COMPANY: '123', YC_TOKEN: 'tok', YC_USER_TOKEN: 'utok' };

  await handleCron(env, fakeSend, nowAt18Local);
  globalThis.fetch = origFetch;

  assertEqual(fakeSend.calls.length, 1, 'sendOne вызван один раз (day)');
  const markerPut = kv.putCalls.find(c => c.key === 'reminded:1002:day');
  assert(markerPut !== undefined, 'маркер reminded:1002:day записан');
  assertEqual(markerPut?.options?.expirationTtl, 172800, 'TTL маркера = 172800');
}

console.log('\n-- handleCron: анти-дубль day — повторный вызов не шлёт повторно --');
{
  const kv = makeMockKV();
  const hashA = await endpointHash(ENDPOINT_A);
  kv.store.set(`sub:31:${hashA}`, JSON.stringify({ subscription: MOCK_SUB_A, clientId: '31', endpoint: ENDPOINT_A }));
  kv.store.set('reminded:1002:day', '1'); // маркер уже стоит

  const nowAt18Local = Date.UTC(2026, 4, 28, 15, 0, 0);
  const tomorrowStr = localDateStr(nowAt18Local, 1);
  const rec = makeRecord(1002, 31, `${tomorrowStr}T15:00:00`);

  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (!url.includes('yclients')) return { status: 200 };
    const urlObj = new URL(url);
    const startDate = urlObj.searchParams.get('start_date');
    const records = startDate === tomorrowStr ? [rec] : [];
    return { ok: true, json: async () => ({ success: true, data: records }) };
  };

  const fakeSend = mockSendOne(200);
  const env = { SUBSCRIPTIONS: kv, YC_COMPANY: '123', YC_TOKEN: 'tok', YC_USER_TOKEN: 'utok' };

  await handleCron(env, fakeSend, nowAt18Local);
  globalThis.fetch = origFetch;

  assertEqual(fakeSend.calls.length, 0, 'sendOne не вызван повторно (анти-дубль)');
}

console.log('\n-- handleCron: soon-напоминание для записи в окне [now+90, now+150) --');
{
  const kv = makeMockKV();
  const hashA = await endpointHash(ENDPOINT_A);
  kv.store.set(`sub:32:${hashA}`, JSON.stringify({ subscription: MOCK_SUB_A, clientId: '32', endpoint: ENDPOINT_A }));

  // nowMs: UTC 07:00 → локальное 10:00
  // Запись на сегодня в 12:00 локального → diff = 120 минут → в окне [90,150)
  const rec = makeRecord(1003, 32, `${todayDateStr()}T12:00:00`);

  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (!url.includes('yclients')) return { status: 200 };
    const urlObj = new URL(url);
    const startDate = urlObj.searchParams.get('start_date');
    const records = startDate === todayDateStr() ? [rec] : [];
    return { ok: true, json: async () => ({ success: true, data: records }) };
  };

  const fakeSend = mockSendOne(200);
  const env = { SUBSCRIPTIONS: kv, YC_COMPANY: '123', YC_TOKEN: 'tok', YC_USER_TOKEN: 'utok' };

  await handleCron(env, fakeSend, TEST_NOW_MS);
  globalThis.fetch = origFetch;

  assertEqual(fakeSend.calls.length, 1, 'sendOne вызван для soon (запись в 12:00, now=10:00, diff=120 мин)');
  const markerPut = kv.putCalls.find(c => c.key === 'reminded:1003:soon');
  assert(markerPut !== undefined, 'маркер reminded:1003:soon записан');
}

console.log('\n-- handleCron: анти-дубль soon — повторный вызов не шлёт --');
{
  const kv = makeMockKV();
  const hashA = await endpointHash(ENDPOINT_A);
  kv.store.set(`sub:32:${hashA}`, JSON.stringify({ subscription: MOCK_SUB_A, clientId: '32', endpoint: ENDPOINT_A }));
  kv.store.set('reminded:1003:soon', '1'); // маркер уже стоит

  const rec = makeRecord(1003, 32, `${todayDateStr()}T12:00:00`);

  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (!url.includes('yclients')) return { status: 200 };
    const urlObj = new URL(url);
    const startDate = urlObj.searchParams.get('start_date');
    const records = startDate === todayDateStr() ? [rec] : [];
    return { ok: true, json: async () => ({ success: true, data: records }) };
  };

  const fakeSend = mockSendOne(200);
  const env = { SUBSCRIPTIONS: kv, YC_COMPANY: '123', YC_TOKEN: 'tok', YC_USER_TOKEN: 'utok' };

  await handleCron(env, fakeSend, TEST_NOW_MS);
  globalThis.fetch = origFetch;

  assertEqual(fakeSend.calls.length, 0, 'sendOne не вызван повторно (анти-дубль soon)');
}

console.log('\n-- handleCron: TZ UTC+3 — запись в 12:00 локального попадает в окно при UTC 07:00 --');
{
  const kv = makeMockKV();
  const hashA = await endpointHash(ENDPOINT_A);
  kv.store.set(`sub:33:${hashA}`, JSON.stringify({ subscription: MOCK_SUB_A, clientId: '33', endpoint: ENDPOINT_A }));

  // TEST_NOW_MS = UTC 07:00 → локальное 10:00
  // Запись 12:00 локального → diff 120 мин → в окне [90,150) → soon-напоминание
  const rec = makeRecord(1004, 33, `${todayDateStr()}T12:00:00`);

  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (!url.includes('yclients')) return { status: 200 };
    const urlObj = new URL(url);
    const startDate = urlObj.searchParams.get('start_date');
    const records = startDate === todayDateStr() ? [rec] : [];
    return { ok: true, json: async () => ({ success: true, data: records }) };
  };

  const fakeSend = mockSendOne(200);
  const env = { SUBSCRIPTIONS: kv, YC_COMPANY: '123', YC_TOKEN: 'tok', YC_USER_TOKEN: 'utok' };

  await handleCron(env, fakeSend, TEST_NOW_MS);
  globalThis.fetch = origFetch;

  assertEqual(fakeSend.calls.length, 1, 'TZ корректен: 12:00 локального в окне при UTC 07:00 (лок. 10:00)');

  // Проверяем, что без коррекции TZ (если бы now считался UTC без сдвига = 07:00 UTC)
  // запись 12:00 UTC-noon давала бы diff = 5*60 = 300 мин, что не попало бы в окно
  // Этот комментарий подтверждает: мы именно учитываем смещение UTC+3
}

console.log('\n-- handleCron: TZ UTC+3 — запись в 12:00 ошибочно как UTC не попадёт в окно --');
{
  // Если бы код неправильно считал time без UTC+3, то «локальное 12:00» = UTC 12:00,
  // а наш now = UTC 07:00 → diff = 300 мин, не в окне.
  // Этот тест проверяет, что если мы возьмём nowMs = UTC 09:00 (лок. 12:00),
  // то запись в 14:00 локального (UTC 11:00) попадает в окно.
  const kv = makeMockKV();
  const hashA = await endpointHash(ENDPOINT_A);
  kv.store.set(`sub:34:${hashA}`, JSON.stringify({ subscription: MOCK_SUB_A, clientId: '34', endpoint: ENDPOINT_A }));

  // nowMs: UTC 09:00 → локальное 12:00
  // Запись на сегодня в 14:00 локального → diff = 120 мин → в окне [90,150)
  const nowMs2 = Date.UTC(2026, 4, 29, 9, 0, 0); // UTC 09:00 → локальное 12:00
  const todayStr2 = localDateStr(nowMs2, 0);
  const rec = makeRecord(1005, 34, `${todayStr2}T14:00:00`);

  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (!url.includes('yclients')) return { status: 200 };
    const urlObj = new URL(url);
    const startDate = urlObj.searchParams.get('start_date');
    const records = startDate === todayStr2 ? [rec] : [];
    return { ok: true, json: async () => ({ success: true, data: records }) };
  };

  const fakeSend = mockSendOne(200);
  const env = { SUBSCRIPTIONS: kv, YC_COMPANY: '123', YC_TOKEN: 'tok', YC_USER_TOKEN: 'utok' };

  await handleCron(env, fakeSend, nowMs2);
  globalThis.fetch = origFetch;

  assertEqual(fakeSend.calls.length, 1, 'TZ тест 2: 14:00 локального при лок. now=12:00 → в окне');
}

console.log('\n-- handleCron: маркер один на запись, не на устройство (мультидевайс) --');
{
  const kv = makeMockKV();
  const hashA = await endpointHash(ENDPOINT_A);
  const hashB = await endpointHash(ENDPOINT_B);
  kv.store.set(`sub:35:${hashA}`, JSON.stringify({ subscription: MOCK_SUB_A, clientId: '35', endpoint: ENDPOINT_A }));
  kv.store.set(`sub:35:${hashB}`, JSON.stringify({ subscription: MOCK_SUB_B, clientId: '35', endpoint: ENDPOINT_B }));

  const rec = makeRecord(1006, 35, `${todayDateStr()}T12:00:00`);

  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (!url.includes('yclients')) return { status: 200 };
    const urlObj = new URL(url);
    const startDate = urlObj.searchParams.get('start_date');
    const records = startDate === todayDateStr() ? [rec] : [];
    return { ok: true, json: async () => ({ success: true, data: records }) };
  };

  const fakeSend = mockSendOne(200);
  const env = { SUBSCRIPTIONS: kv, YC_COMPANY: '123', YC_TOKEN: 'tok', YC_USER_TOKEN: 'utok' };

  await handleCron(env, fakeSend, TEST_NOW_MS);
  globalThis.fetch = origFetch;

  assertEqual(fakeSend.calls.length, 2, 'sendOne вызван для обоих устройств');
  const markerPuts = kv.putCalls.filter(c => c.key === 'reminded:1006:soon');
  assertEqual(markerPuts.length, 1, 'маркер записан ровно один раз (не на каждое устройство)');
}

console.log('\n-- handleCron: day НЕ отправляется при localHour ≠ 18 --');
{
  const kv = makeMockKV();
  const hashA = await endpointHash(ENDPOINT_A);
  kv.store.set(`sub:40:${hashA}`, JSON.stringify({ subscription: MOCK_SUB_A, clientId: '40', endpoint: ENDPOINT_A }));
  // remind:true — клиент хочет напоминания
  kv.store.set('prefs:40', JSON.stringify({ promo: true, remind: true, ts: 1 }));

  // nowMs: UTC 10:00 → локальное 13:00 (≠ 18)
  const nowNotAt18 = Date.UTC(2026, 4, 28, 10, 0, 0);
  const tomorrowStr = localDateStr(nowNotAt18, 1);
  const rec = makeRecord(2001, 40, `${tomorrowStr}T15:00:00`);

  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (!url.includes('yclients')) return { status: 200 };
    const urlObj = new URL(url);
    const startDate = urlObj.searchParams.get('start_date');
    const records = startDate === tomorrowStr ? [rec] : [];
    return { ok: true, json: async () => ({ success: true, data: records }) };
  };

  const fakeSend = mockSendOne(200);
  const env = { SUBSCRIPTIONS: kv, YC_COMPANY: '123', YC_TOKEN: 'tok', YC_USER_TOKEN: 'utok' };

  await handleCron(env, fakeSend, nowNotAt18);
  globalThis.fetch = origFetch;

  assertEqual(fakeSend.calls.length, 0, 'sendOne не вызван (day не отправляется при localHour=13)');
  const markerPut = kv.putCalls.find(c => c.key === 'reminded:2001:day');
  assert(markerPut === undefined, 'маркер reminded:2001:day НЕ записан');
}

console.log('\n-- handleCron: soon для визита в 00:30 следующего дня (стык суток) --');
{
  // nowMs: UTC 19:01 → локальное 22:01; визит завтра в 00:30 локального
  // diff = (00:30 лок. следующего дня) - (22:01 лок.) = 149 мин → в окне [90,150)
  const kv = makeMockKV();
  const hashA = await endpointHash(ENDPOINT_A);
  kv.store.set(`sub:41:${hashA}`, JSON.stringify({ subscription: MOCK_SUB_A, clientId: '41', endpoint: ENDPOINT_A }));

  const nowMs_2200 = Date.UTC(2026, 4, 28, 19, 1, 0); // UTC 19:01 → лок. 22:01 (diff до 00:30 = 149 мин → в окне)
  const tomorrowStr = localDateStr(nowMs_2200, 1);     // 2026-05-29
  const rec = makeRecord(2002, 41, `${tomorrowStr}T00:30:00`);

  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (!url.includes('yclients')) return { status: 200 };
    const urlObj = new URL(url);
    const startDate = urlObj.searchParams.get('start_date');
    const todayStr = localDateStr(nowMs_2200, 0);
    const records = startDate === tomorrowStr ? [rec] : (startDate === todayStr ? [] : []);
    return { ok: true, json: async () => ({ success: true, data: records }) };
  };

  const fakeSend = mockSendOne(200);
  const env = { SUBSCRIPTIONS: kv, YC_COMPANY: '123', YC_TOKEN: 'tok', YC_USER_TOKEN: 'utok' };

  await handleCron(env, fakeSend, nowMs_2200);
  globalThis.fetch = origFetch;

  assertEqual(fakeSend.calls.length, 1, 'soon отправлен для визита в 00:30 следующего дня (стык суток)');
  const markerPut = kv.putCalls.find(c => c.key === 'reminded:2002:soon');
  assert(markerPut !== undefined, 'маркер reminded:2002:soon записан');
}

// ── Итог ─────────────────────────────────────────────────────────────────────

console.log(`\nРезультат: ${passed} прошло, ${failed} упало`);
if (failed > 0) process.exit(1);
