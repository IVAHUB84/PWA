/**
 * Тесты postComment → Cloudflare Worker (v1.4.0).
 *
 * Запуск: node docs/modules/post-comment-worker.test.js
 */

globalThis.window = globalThis.window || {};
const _storage = {};
globalThis.localStorage = {
  getItem: (k) => Object.prototype.hasOwnProperty.call(_storage, k) ? _storage[k] : null,
  setItem: (k, v) => { _storage[k] = v; },
  removeItem: (k) => { delete _storage[k]; },
};
globalThis.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
};

const { postComment } = await import('./api.js');
const { WORKER_URL } = await import('./constants.js');

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
  assert(JSON.stringify(a) === JSON.stringify(b), `${label} (got: ${JSON.stringify(a)}, expected: ${JSON.stringify(b)})`);
}

function mockFetch(status, responseBody) {
  return async (_url, _opts) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => responseBody,
  });
}

// ── Успешный ответ Worker ───────────────────────────────────────────────────

console.log('\n-- postComment: Worker { ok: true } → возвращает { ok: true } --');
{
  const result = await postComment(
    { rating: 5, text: 'Отлично', staffId: 10, recordId: 20 },
    mockFetch(200, { ok: true })
  );
  assertEqual(result, { ok: true }, 'HTTP 200 + ok:true → { ok: true }');
}

// ── Не-2xx от Worker ────────────────────────────────────────────────────────

console.log('\n-- postComment: Worker 502 → возвращает { ok: false } --');
{
  const result = await postComment(
    { rating: 3, text: '', staffId: 1, recordId: 2 },
    mockFetch(502, { ok: false, status: 502 })
  );
  assertEqual(result, { ok: false }, 'HTTP 502 → { ok: false }');
}

console.log('\n-- postComment: Worker 400 → возвращает { ok: false } --');
{
  const result = await postComment(
    { rating: 1, text: '', staffId: 1, recordId: 2 },
    mockFetch(400, { error: 'missing_fields' })
  );
  assertEqual(result, { ok: false }, 'HTTP 400 → { ok: false }');
}

// ── Сетевая ошибка / таймаут ────────────────────────────────────────────────

console.log('\n-- postComment: fetch бросает исключение → { ok: false } --');
{
  const throwingFetch = async () => { throw new Error('network error'); };
  const result = await postComment(
    { rating: 4, text: 'OK', staffId: 5, recordId: 6 },
    throwingFetch
  );
  assertEqual(result, { ok: false }, 'исключение fetch → { ok: false }');
}

console.log('\n-- postComment: AbortError (таймаут) → { ok: false } --');
{
  const abortingFetch = async () => { const e = new Error('timeout'); e.name = 'AbortError'; throw e; };
  const result = await postComment(
    { rating: 2, text: '', staffId: 5, recordId: 6 },
    abortingFetch
  );
  assertEqual(result, { ok: false }, 'AbortError → { ok: false }');
}

// ── Запрос идёт на Worker /review, не на api.yclients.com ──────────────────

console.log('\n-- postComment: запрос уходит на Worker URL /review --');
{
  let capturedUrl = null;
  const capturingFetch = async (url, _opts) => {
    capturedUrl = url;
    return { ok: true, json: async () => ({ ok: true }) };
  };
  await postComment({ rating: 5, text: '', staffId: 1, recordId: 2 }, capturingFetch);

  assert(capturedUrl !== null, 'fetch был вызван');
  assert(capturedUrl.endsWith('/review'), `URL оканчивается на /review (got: ${capturedUrl})`);
  assert(capturedUrl.startsWith(WORKER_URL), `URL начинается с WORKER_URL (got: ${capturedUrl})`);
  assert(!capturedUrl.includes('api.yclients.com'), 'URL не содержит api.yclients.com');
}

// ── Тело запроса содержит snake_case поля ──────────────────────────────────

console.log('\n-- postComment: тело запроса содержит staff_id и record_id (snake_case) --');
{
  let capturedBody = null;
  const capturingFetch = async (_url, opts) => {
    capturedBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ ok: true }) };
  };
  await postComment({ rating: 4, text: 'Хорошо', staffId: 77, recordId: 88 }, capturingFetch);

  assert(capturedBody !== null, 'тело запроса передано');
  assertEqual(capturedBody.staff_id, 77, 'staff_id = staffId');
  assertEqual(capturedBody.record_id, 88, 'record_id = recordId');
  assertEqual(capturedBody.rating, 4, 'rating передан');
  assertEqual(capturedBody.text, 'Хорошо', 'text передан');
  assert(!('staffId' in capturedBody), 'нет camelCase staffId');
  assert(!('recordId' in capturedBody), 'нет camelCase recordId');
}

// ── Worker возвращает ok:false при ok:true HTTP ─────────────────────────────

console.log('\n-- postComment: HTTP 200 но ok:false в теле → { ok: false } --');
{
  const result = await postComment(
    { rating: 5, text: '', staffId: 1, recordId: 2 },
    mockFetch(200, { ok: false })
  );
  assertEqual(result, { ok: false }, 'HTTP 200 + ok:false → { ok: false }');
}

console.log(`\nРезультат: ${passed} прошло, ${failed} упало`);
if (failed > 0) process.exit(1);
