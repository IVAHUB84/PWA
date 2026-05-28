/**
 * Тесты мультидевайс-подписок (v1.5.1).
 *
 * Запуск: node cf-worker/test/subscriptions.test.js
 */

// Node 24 exposes globalThis.crypto (Web Crypto) natively — no polyfill needed

const { endpointHash, handleSubscribe, handleUnsubscribe, handleSend, handleCron } =
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
  return {
    store,
    putCalls,
    deleteCalls,
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { putCalls.push(key); store.set(key, value); },
    async delete(key) { deleteCalls.push(key); store.delete(key); },
    async list({ prefix = '', cursor: _cursor, limit: _limit } = {}) {
      const keys = [...store.keys()]
        .filter(k => k.startsWith(prefix))
        .map(name => ({ name }));
      return { keys, list_complete: true, cursor: undefined };
    },
  };
}

function makeRequest(body, headers = {}) {
  return {
    json: async () => body,
    headers: {
      get: (h) => headers[h] ?? null,
    },
  };
}

const ENDPOINT_A = 'https://fcm.googleapis.com/fcm/send/device-aaa';
const ENDPOINT_B = 'https://fcm.googleapis.com/fcm/send/device-bbb';

const MOCK_SUB_A = { endpoint: ENDPOINT_A, keys: { p256dh: 'AAAA', auth: 'BBBB' } };
const MOCK_SUB_B = { endpoint: ENDPOINT_B, keys: { p256dh: 'CCCC', auth: 'DDDD' } };

function mockSendOne(status = 201) {
  const calls = [];
  const fn = async (sub) => { calls.push(sub.endpoint); return status; };
  fn.calls = calls;
  return fn;
}

function mockSendOneSequence(statuses) {
  const calls = [];
  let i = 0;
  const fn = async (sub) => { calls.push(sub.endpoint); return statuses[i++] ?? 201; };
  fn.calls = calls;
  return fn;
}

// ── Хелпер endpointHash: детерминированность ─────────────────────────────────

console.log('\n-- endpointHash: детерминированность --');
{
  const h1 = await endpointHash(ENDPOINT_A);
  const h2 = await endpointHash(ENDPOINT_A);
  assertEqual(h1, h2, 'один endpoint → один хеш (детерминирован)');
  assert(typeof h1 === 'string' && h1.length > 0, 'хеш — непустая строка');

  const hb = await endpointHash(ENDPOINT_B);
  assert(h1 !== hb, 'разные endpoint → разные хеши');
}

// ── handleSubscribe: схема ключей и идемпотентность ──────────────────────────

console.log('\n-- handleSubscribe: два устройства создают два разных ключа --');
{
  const kv = makeMockKV();
  const env = { SUBSCRIPTIONS: kv };

  await handleSubscribe(makeRequest({ subscription: MOCK_SUB_A, clientId: '42', phone: '' }), env);
  await handleSubscribe(makeRequest({ subscription: MOCK_SUB_B, clientId: '42', phone: '' }), env);

  const hashA = await endpointHash(ENDPOINT_A);
  const hashB = await endpointHash(ENDPOINT_B);
  const keyA = `sub:42:${hashA}`;
  const keyB = `sub:42:${hashB}`;

  assert(kv.store.has(keyA), `ключ для устройства A существует (${keyA})`);
  assert(kv.store.has(keyB), `ключ для устройства B существует (${keyB})`);
  assert(keyA !== keyB, 'ключи разные');
  assertEqual(kv.store.size, 2, 'в KV ровно 2 записи');
}

console.log('\n-- handleSubscribe: повторная подписка того же endpoint → тот же ключ --');
{
  const kv = makeMockKV();
  const env = { SUBSCRIPTIONS: kv };

  await handleSubscribe(makeRequest({ subscription: MOCK_SUB_A, clientId: '42', phone: '' }), env);
  await handleSubscribe(makeRequest({ subscription: MOCK_SUB_A, clientId: '42', phone: '9001' }), env);

  assertEqual(kv.store.size, 1, 'в KV одна запись (без дубля)');
  assertEqual(kv.putCalls.length, 2, 'put вызван дважды (оба раза один ключ)');
  assertEqual(kv.putCalls[0], kv.putCalls[1], 'оба put — один ключ');

  const val = JSON.parse([...kv.store.values()][0]);
  assertEqual(val.phone, '9001', 'второй put обновил запись (phone)');
}

console.log('\n-- handleSubscribe: значение содержит поле endpoint --');
{
  const kv = makeMockKV();
  await handleSubscribe(makeRequest({ subscription: MOCK_SUB_A, clientId: '7', phone: '' }), { SUBSCRIPTIONS: kv });
  const val = JSON.parse([...kv.store.values()][0]);
  assertEqual(val.endpoint, ENDPOINT_A, 'значение содержит endpoint');
}

// ── handleSend: две подписки → sent === 2 ────────────────────────────────────

console.log('\n-- handleSend: target с двумя подписками → sent === 2 --');
{
  const kv = makeMockKV();
  const hashA = await endpointHash(ENDPOINT_A);
  const hashB = await endpointHash(ENDPOINT_B);
  kv.store.set(`sub:99:${hashA}`, JSON.stringify({ subscription: MOCK_SUB_A, clientId: '99', endpoint: ENDPOINT_A }));
  kv.store.set(`sub:99:${hashB}`, JSON.stringify({ subscription: MOCK_SUB_B, clientId: '99', endpoint: ENDPOINT_B }));

  const fakeSend = mockSendOne(201);
  const req = makeRequest(
    { title: 'Test', body: 'Hello', targetClientId: '99' },
    { 'X-Admin-Secret': 'secret' }
  );
  const env = { SUBSCRIPTIONS: kv, ADMIN_SECRET: 'secret' };

  const resp = await handleSend(req, env, fakeSend);
  const result = await resp.json();

  assertEqual(result.sent, 2, 'sent === 2');
  assertEqual(result.failed, 0, 'failed === 0');
  assertEqual(fakeSend.calls.length, 2, 'sendOne вызван дважды');
}

// ── handleSend: 410 удаляет только конкретный ключ ───────────────────────────

console.log('\n-- handleSend: 410 от одной подписки удаляет только её ключ --');
{
  const kv = makeMockKV();
  const hashA = await endpointHash(ENDPOINT_A);
  const hashB = await endpointHash(ENDPOINT_B);
  const keyA = `sub:55:${hashA}`;
  const keyB = `sub:55:${hashB}`;
  kv.store.set(keyA, JSON.stringify({ subscription: MOCK_SUB_A, clientId: '55', endpoint: ENDPOINT_A }));
  kv.store.set(keyB, JSON.stringify({ subscription: MOCK_SUB_B, clientId: '55', endpoint: ENDPOINT_B }));

  const fakeSend = mockSendOneSequence([410, 201]);
  const req = makeRequest(
    { title: 'Test', body: 'Hi', targetClientId: '55' },
    { 'X-Admin-Secret': 'secret' }
  );
  const env = { SUBSCRIPTIONS: kv, ADMIN_SECRET: 'secret' };

  await handleSend(req, env, fakeSend);

  assertEqual(kv.deleteCalls.length, 1, 'delete вызван ровно один раз');
  const deletedKey = kv.deleteCalls[0];
  assert(deletedKey === keyA || deletedKey === keyB, `удалён один из ключей (${deletedKey})`);
  assertEqual([...kv.store.keys()].length, 1, 'вторая подписка осталась в KV');
}

// ── handleSend: лог содержит хост, но не полный endpoint ─────────────────────

console.log('\n-- handleSend: в лог пишется хост, а не полный endpoint --');
{
  const kv = makeMockKV();
  const hashA = await endpointHash(ENDPOINT_A);
  kv.store.set(`sub:11:${hashA}`, JSON.stringify({ subscription: MOCK_SUB_A, clientId: '11', endpoint: ENDPOINT_A }));

  const logLines = [];
  const origLog = console.log;
  const origWarn = console.warn;
  console.log = (...args) => { logLines.push(args.join(' ')); origLog(...args); };
  console.warn = (...args) => { logLines.push(args.join(' ')); origWarn(...args); };

  const fakeSend = mockSendOne(200);
  const req = makeRequest(
    { title: 'T', body: 'B', targetClientId: '11' },
    { 'X-Admin-Secret': 's' }
  );
  await handleSend(req, { SUBSCRIPTIONS: kv, ADMIN_SECRET: 's' }, fakeSend);

  console.log = origLog;
  console.warn = origWarn;

  const sendLines = logLines.filter(l => l.includes('[send]'));
  assert(sendLines.length > 0, 'есть строка [send] в логе');
  const line = sendLines[0];
  assert(line.includes('fcm.googleapis.com'), 'лог содержит хост endpoint');
  assert(!line.includes(ENDPOINT_A), 'лог НЕ содержит полный endpoint');
  assert(!line.includes('/fcm/send/'), 'лог НЕ содержит path endpoint');
}

// ── handleUnsubscribe: по endpoint удаляет один ключ ─────────────────────────

console.log('\n-- handleUnsubscribe: с endpoint удаляет один ключ --');
{
  const kv = makeMockKV();
  const hashA = await endpointHash(ENDPOINT_A);
  const hashB = await endpointHash(ENDPOINT_B);
  kv.store.set(`sub:33:${hashA}`, 'valA');
  kv.store.set(`sub:33:${hashB}`, 'valB');

  const req = makeRequest({ clientId: '33', endpoint: ENDPOINT_A });
  await handleUnsubscribe(req, { SUBSCRIPTIONS: kv });

  assertEqual(kv.deleteCalls.length, 1, 'delete вызван один раз');
  assertEqual(kv.deleteCalls[0], `sub:33:${hashA}`, 'удалён ключ устройства A');
  assert(kv.store.has(`sub:33:${hashB}`), 'ключ устройства B остался');
}

console.log('\n-- handleUnsubscribe: без endpoint → missing_fields, delete не вызван --');
{
  const kv = makeMockKV();
  const req = makeRequest({ clientId: '33' });
  const resp = await handleUnsubscribe(req, { SUBSCRIPTIONS: kv });
  const result = await resp.json();

  assertEqual(result.error, 'missing_fields', 'ответ missing_fields');
  assertEqual(resp.status, 400, 'статус 400');
  assertEqual(kv.deleteCalls.length, 0, 'delete не вызван');
}

// ── handleCron: все устройства клиента получают напоминание ──────────────────

console.log('\n-- handleCron: клиент с двумя подписками получает sendOne дважды --');
{
  const kv = makeMockKV();
  const hashA = await endpointHash(ENDPOINT_A);
  const hashB = await endpointHash(ENDPOINT_B);
  kv.store.set(`sub:77:${hashA}`, JSON.stringify({ subscription: MOCK_SUB_A, clientId: '77', endpoint: ENDPOINT_A }));
  kv.store.set(`sub:77:${hashB}`, JSON.stringify({ subscription: MOCK_SUB_B, clientId: '77', endpoint: ENDPOINT_B }));

  // nowMs: UTC 15:00 2026-05-28 → локальное 18:00 2026-05-28; завтра = 2026-05-29
  const cronNowMs = Date.UTC(2026, 4, 28, 15, 0, 0);

  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.includes('yclients')) {
      const urlObj = new URL(url);
      const startDate = urlObj.searchParams.get('start_date');
      // Запись на завтра 2026-05-29
      const data = startDate === '2026-05-29' ? [{
        id: 9999,
        deleted: false,
        client: { id: 77 },
        services: [{ title: 'Ламинирование' }],
        date: '2026-05-29T15:00:00',
      }] : [];
      return { ok: true, json: async () => ({ success: true, data }) };
    }
    return { status: 200 };
  };

  const fakeSend = mockSendOne(200);
  const env = {
    SUBSCRIPTIONS: kv,
    YC_COMPANY: '123',
    YC_TOKEN: 'tok',
    YC_USER_TOKEN: 'utok',
  };

  await handleCron(env, fakeSend, cronNowMs);
  globalThis.fetch = origFetch;

  assertEqual(fakeSend.calls.length, 2, 'sendOne вызван дважды (оба устройства)');
}

// ── handleSend: targetClientId без подписок → not_found, sendOne не вызван ────

console.log('\n-- handleSend: targetClientId без подписок → not_found --');
{
  const kv = makeMockKV();
  const fakeSend = mockSendOne(201);
  const req = makeRequest(
    { title: 'Test', body: 'Hi', targetClientId: '999' },
    { 'X-Admin-Secret': 'secret' }
  );
  const env = { SUBSCRIPTIONS: kv, ADMIN_SECRET: 'secret' };

  const resp = await handleSend(req, env, fakeSend);
  const result = await resp.json();

  assertEqual(result.ok, false, 'ok === false');
  assertEqual(result.error, 'not_found', 'error === not_found');
  assertEqual(fakeSend.calls.length, 0, 'sendOne не вызван');
}

// ── handleSend: старый ключ sub:${clientId} не захватывается target-префиксом ─

console.log('\n-- handleSend: старый ключ sub:42 не захватывается target sub:42: --');
{
  const kv = makeMockKV();
  kv.store.set('sub:42', JSON.stringify({ subscription: MOCK_SUB_A, clientId: '42', phone: '' }));

  const fakeSend = mockSendOne(201);
  const req = makeRequest(
    { title: 'Test', body: 'Hi', targetClientId: '42' },
    { 'X-Admin-Secret': 'secret' }
  );
  const env = { SUBSCRIPTIONS: kv, ADMIN_SECRET: 'secret' };

  const resp = await handleSend(req, env, fakeSend);
  const result = await resp.json();

  assertEqual(fakeSend.calls.length, 0, 'sendOne не вызван (старый ключ не совпадает с prefix sub:42:)');
  assertEqual(result.ok, false, 'target-выборка пуста → not_found (деградация до переподписки)');
  assertEqual(result.error, 'not_found', 'error === not_found');
}

// ── Толерантность к старому формату sub:${clientId} ──────────────────────────

console.log('\n-- handleSend: толерантность к старому формату sub:${clientId} --');
{
  const kv = makeMockKV();
  kv.store.set('sub:88', JSON.stringify({ subscription: MOCK_SUB_A, clientId: '88', phone: '' }));

  const fakeSend = mockSendOne(200);
  const req = makeRequest(
    { title: 'T', body: 'B' },
    { 'X-Admin-Secret': 'sec' }
  );
  const env = { SUBSCRIPTIONS: kv, ADMIN_SECRET: 'sec' };
  const resp = await handleSend(req, env, fakeSend);
  const result = await resp.json();

  assert(result.ok === true, 'broadcast со старым форматом не ломается');
  assertEqual(fakeSend.calls.length, 1, 'sendOne вызван один раз для старой записи');
}

// ── Итог ─────────────────────────────────────────────────────────────────────

console.log(`\nРезультат: ${passed} прошло, ${failed} упало`);
if (failed > 0) process.exit(1);
