/**
 * Тесты отправки отзыва (контракт postComment) и признака «оценено».
 *
 * Запуск: node docs/modules/review-post.test.js
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
const { _loadReviewedIds, _saveReviewedId } = await import('./review.js');

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

function clearStorage() {
  Object.keys(_storage).forEach(k => delete _storage[k]);
}

function mockFetch(status, responseBody) {
  return async (_url, _opts) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => responseBody,
  });
}

// ── postComment: тело запроса ───────────────────────────────────────────────

console.log('\n-- postComment: формирует корректное тело --');
{
  let capturedBody = null;
  const capturingFetch = async (_url, opts) => {
    capturedBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ ok: true }) };
  };

  await postComment({ rating: 5, text: 'Отличная работа', staffId: 123, recordId: 456 }, capturingFetch);

  assertEqual(capturedBody.rating, 5, 'rating = 5');
  assertEqual(capturedBody.text, 'Отличная работа', 'text передан');
  assertEqual(capturedBody.staff_id, 123, 'staff_id = staffId');
  assertEqual(capturedBody.record_id, 456, 'record_id = recordId');
  assert(!('name' in capturedBody), 'имя автора не в теле');
  assert(!('phone' in capturedBody), 'телефон не в теле');
  assert(!('email' in capturedBody), 'email не в теле');
  assert(!('tips' in capturedBody), 'чаевые не в теле');
}

console.log('\n-- postComment: рейтинг 1–5 передаётся как есть --');
{
  for (const r of [1, 2, 3, 4, 5]) {
    let capturedBody = null;
    const capturingFetch = async (_url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ ok: true }) };
    };
    await postComment({ rating: r, text: '', staffId: 1, recordId: 1 }, capturingFetch);
    assertEqual(capturedBody.rating, r, `rating ${r} передан`);
  }
}

console.log('\n-- postComment: пустой текст допустим --');
{
  let capturedBody = null;
  const capturingFetch = async (_url, opts) => {
    capturedBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ ok: true }) };
  };
  await postComment({ rating: 4, text: '', staffId: 1, recordId: 1 }, capturingFetch);
  assertEqual(capturedBody.text, '', 'text пустая строка передана');
}

console.log('\n-- postComment: ok:true → { ok: true } --');
{
  const result = await postComment({ rating: 5, text: '', staffId: 1, recordId: 1 }, mockFetch(200, { ok: true }));
  assertEqual(result, { ok: true }, 'ok:true → ok:true');
}

console.log('\n-- postComment: ok:false → { ok: false } --');
{
  const result = await postComment({ rating: 5, text: '', staffId: 1, recordId: 1 }, mockFetch(200, { ok: false }));
  assertEqual(result, { ok: false }, 'ok:false → ok:false');
}

console.log('\n-- postComment: HTTP 4xx → { ok: false } --');
{
  const result = await postComment({ rating: 5, text: '', staffId: 1, recordId: 1 }, mockFetch(403, {}));
  assertEqual(result, { ok: false }, 'HTTP 403 → ok:false');
}

console.log('\n-- postComment: исключение (сеть) → { ok: false } --');
{
  const throwingFetch = async () => { throw new Error('network error'); };
  const result = await postComment({ rating: 5, text: '', staffId: 1, recordId: 1 }, throwingFetch);
  assertEqual(result, { ok: false }, 'исключение → ok:false');
}

console.log('\n-- postComment: один запрос на вызов --');
{
  let callCount = 0;
  const countingFetch = async () => { callCount++; return { ok: true, json: async () => ({ ok: true }) }; };
  await postComment({ rating: 3, text: 'Хорошо', staffId: 10, recordId: 20 }, countingFetch);
  assertEqual(callCount, 1, 'ровно один вызов fetch');
}

// ── признак «оценено»: yc_reviewed_ids ─────────────────────────────────────

console.log('\n-- yc_reviewed_ids: начально пустой массив --');
{
  clearStorage();
  const ids = _loadReviewedIds();
  assertEqual(ids, [], '_loadReviewedIds() = [] при отсутствии ключа');
}

console.log('\n-- yc_reviewed_ids: _saveReviewedId записывает id через _loadReviewedIds --');
{
  clearStorage();
  _saveReviewedId('rec-42');

  const stored = JSON.parse(localStorage.getItem('yc_reviewed_ids') || '[]');
  assert(Array.isArray(stored), 'yc_reviewed_ids — массив');

  assert(_loadReviewedIds().includes('rec-42'), '_loadReviewedIds возвращает сохранённый id');
}

console.log('\n-- yc_reviewed_ids: _loadReviewedIds читает из правильного ключа --');
{
  clearStorage();
  localStorage.setItem('yc_reviewed_ids', JSON.stringify(['111', '222']));
  localStorage.setItem('yc_reviews', JSON.stringify([{ recordId: '999' }]));
  const ids = _loadReviewedIds();
  assert(ids.includes('111'), 'читает 111 из yc_reviewed_ids');
  assert(ids.includes('222'), 'читает 222 из yc_reviewed_ids');
  assert(!ids.includes('999'), 'не читает из yc_reviews');
}

console.log('\n-- yc_reviewed_ids: невалидный JSON не ломает _loadReviewedIds --');
{
  clearStorage();
  localStorage.setItem('yc_reviewed_ids', 'not-json');
  const ids = _loadReviewedIds();
  assertEqual(ids, [], 'возвращает [] при невалидном JSON');
}

console.log('\n-- _saveReviewedId: сохраняет id и не дублирует --');
{
  clearStorage();
  _saveReviewedId('rec-42');
  assert(_loadReviewedIds().includes('rec-42'), '_saveReviewedId записывает id в yc_reviewed_ids');
  _saveReviewedId('rec-42');
  assert(_loadReviewedIds().filter(x => x === 'rec-42').length === 1, '_saveReviewedId не дублирует id');
}

console.log(`\nРезультат: ${passed} прошло, ${failed} упало`);
if (failed > 0) process.exit(1);
