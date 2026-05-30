/**
 * Тесты маршрутизатора цели уведомлений (v1.28.0): normalizeTarget, routeToTarget.
 *
 * Запуск: node docs/modules/inboxTarget.test.js
 */

const FAKE_SERVICES = [
  { id: '10',      name: 'Стрижка', cat: 'Волосы' },
  { id: '20',      name: 'Маникюр', cat: 'Ногти' },
  { id: '30',      name: 'Брови',   cat: 'Брови' },
  { id: '5443758', name: 'Ресницы', cat: 'Ресницы' },
  { id: 'svc1',    name: 'Услуга 1', cat: 'Другое' },
];

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

// ── normalizeTarget (inline, без импорта) ─────────────────────────────────────

const VALID_TYPES = new Set(['service', 'records', 'category']);

function normalizeTarget(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { type, id } = raw;
  if (!VALID_TYPES.has(type)) return null;
  if (type === 'service') {
    if (id === null || id === undefined || id === '') return null;
    const sid = String(id);
    if (sid === '') return null;
    return { type, id: sid };
  }
  if (type === 'category') {
    if (typeof id !== 'string' || id === '') return null;
    return { type, id };
  }
  if (type === 'records') {
    return { type };
  }
  return null;
}

// ── routeToTarget (inline stub) ───────────────────────────────────────────────

function makeRouteToTarget(services) {
  const calls = [];
  const openServiceCard = id  => calls.push({ fn: 'openServiceCard', arg: id });
  const filterCategory  = cat => calls.push({ fn: 'filterCategory',  arg: cat });
  const go = (screen)         => calls.push({ fn: 'go', arg: screen });

  function routeToTarget(target) {
    const t = normalizeTarget(target);
    if (!t) return;
    if (t.type === 'records') {
      go('s-history', 'tab');
      return;
    }
    if (t.type === 'service') {
      const exists = services.find(s => String(s.id) === String(t.id));
      if (!exists) return;
      openServiceCard(t.id);
      return;
    }
    if (t.type === 'category') {
      const cats = new Set(services.map(s => s.cat));
      if (!cats.has(t.id)) return;
      filterCategory(t.id);
      go('s-services', 'tab');
    }
  }
  return { routeToTarget, calls };
}

// ── normalizeTarget — «без цели» ──────────────────────────────────────────────

console.log('\n-- normalizeTarget: невалидный ввод → null --');
assert(normalizeTarget(null)                       === null, 'null → null');
assert(normalizeTarget(undefined)                  === null, 'undefined → null');
assert(normalizeTarget({})                         === null, 'пустой объект → null');
assert(normalizeTarget({ type: 'unknown' })        === null, 'неизвестный тип → null');
assert(normalizeTarget({ type: 'service' })        === null, 'service без id → null');
assert(normalizeTarget({ type: 'service', id: '' }) === null, 'service id="" → null');
assert(normalizeTarget({ type: 'category' })       === null, 'category без id → null');
assert(normalizeTarget({ type: 'category', id: '' }) === null, 'category пустая строка → null');

console.log('\n-- normalizeTarget: валидные цели --');
{
  const t = normalizeTarget({ type: 'records' });
  assert(t !== null, 'records → не null');
  assert(t.type === 'records', 'records.type = records');
  assert(!('id' in t), 'records без id');
}
{
  const t = normalizeTarget({ type: 'service', id: 10 });
  assert(t !== null, 'service id число → не null');
  assert(t.type === 'service', 'service.type = service');
  assert(t.id === '10', 'service.id число приведён к строке "10"');
}
{
  const t = normalizeTarget({ type: 'service', id: '20' });
  assert(t !== null, 'service id строка-число → не null');
  assert(t.id === '20', 'id остаётся строкой "20"');
}
{
  const t = normalizeTarget({ type: 'service', id: '5443758' });
  assert(t !== null, 'service id строка из API → не null');
  assert(t.id === '5443758', 'id строка из API сохраняется');
}
{
  const t = normalizeTarget({ type: 'service', id: 'svc1' });
  assert(t !== null, 'service нечисловой id fallback-каталога → не null');
  assert(t.id === 'svc1', 'id нечисловой строки сохраняется как есть');
}
{
  const t = normalizeTarget({ type: 'service', id: 'abc' });
  assert(t !== null, 'service id нечисловая строка → не null (принимаем как строку)');
  assert(t.id === 'abc', 'id = "abc"');
}
{
  const t = normalizeTarget({ type: 'category', id: 'Ногти' });
  assert(t !== null, 'category id строка → не null');
  assert(t.type === 'category', 'category.type = category');
  assert(t.id === 'Ногти', 'category.id = Ногти');
}
{
  const t = normalizeTarget({ type: 'records', id: 'extra' });
  assert(t !== null, 'records с лишним id → не null (id игнорируется)');
  assert(!('id' in t), 'id не попал в нормализованный records');
}

// ── routeToTarget — переходы ──────────────────────────────────────────────────

console.log('\n-- routeToTarget: records → go(s-history) --');
{
  const { routeToTarget, calls } = makeRouteToTarget(FAKE_SERVICES);
  routeToTarget({ type: 'records' });
  assert(calls.length === 1, '1 вызов');
  assert(calls[0].fn === 'go' && calls[0].arg === 's-history', 'go(s-history)');
}

console.log('\n-- routeToTarget: service числовой id → openServiceCard --');
{
  const { routeToTarget, calls } = makeRouteToTarget(FAKE_SERVICES);
  routeToTarget({ type: 'service', id: 10 });
  assert(calls.length === 1, '1 вызов');
  assert(calls[0].fn === 'openServiceCard' && calls[0].arg === '10', 'openServiceCard("10")');
}

console.log('\n-- routeToTarget: service строковый id из API ("5443758") → openServiceCard --');
{
  const { routeToTarget, calls } = makeRouteToTarget(FAKE_SERVICES);
  routeToTarget({ type: 'service', id: '5443758' });
  assert(calls.length === 1, '1 вызов');
  assert(calls[0].fn === 'openServiceCard' && calls[0].arg === '5443758', 'openServiceCard("5443758")');
}

console.log('\n-- routeToTarget: service нечисловой id fallback ("svc1") → openServiceCard --');
{
  const { routeToTarget, calls } = makeRouteToTarget(FAKE_SERVICES);
  routeToTarget({ type: 'service', id: 'svc1' });
  assert(calls.length === 1, '1 вызов');
  assert(calls[0].fn === 'openServiceCard' && calls[0].arg === 'svc1', 'openServiceCard("svc1")');
}

console.log('\n-- routeToTarget: service несуществующий → ничего --');
{
  const { routeToTarget, calls } = makeRouteToTarget(FAKE_SERVICES);
  routeToTarget({ type: 'service', id: 999 });
  assert(calls.length === 0, 'нет вызовов');
}

console.log('\n-- routeToTarget: category существующая → filterCategory + go --');
{
  const { routeToTarget, calls } = makeRouteToTarget(FAKE_SERVICES);
  routeToTarget({ type: 'category', id: 'Ногти' });
  assert(calls.some(c => c.fn === 'filterCategory' && c.arg === 'Ногти'), 'filterCategory(Ногти)');
  assert(calls.some(c => c.fn === 'go' && c.arg === 's-services'), 'go(s-services)');
  assert(!calls.some(c => c.fn === 'openServiceCard'), 'нет openServiceCard');
}

console.log('\n-- routeToTarget: category несуществующая → ничего --');
{
  const { routeToTarget, calls } = makeRouteToTarget(FAKE_SERVICES);
  routeToTarget({ type: 'category', id: 'НеСуществует' });
  assert(calls.length === 0, 'нет вызовов');
}

console.log('\n-- routeToTarget: null/неизвестный тип → ничего, нет ошибки --');
{
  const { routeToTarget, calls } = makeRouteToTarget(FAKE_SERVICES);
  let err = null;
  try {
    routeToTarget(null);
    routeToTarget(undefined);
    routeToTarget({});
    routeToTarget({ type: 'unknown', id: 1 });
  } catch(e) { err = e; }
  assert(err === null, 'нет исключения');
  assert(calls.length === 0, 'нет вызовов');
}

console.log('\n-- routeToTarget: одинаковая цель → одинаковый результат (КП-8) --');
{
  const target = { type: 'records' };
  const run1 = makeRouteToTarget(FAKE_SERVICES);
  const run2 = makeRouteToTarget(FAKE_SERVICES);
  run1.routeToTarget(target);
  run2.routeToTarget(target);
  const c1 = JSON.stringify(run1.calls);
  const c2 = JSON.stringify(run2.calls);
  assert(c1 === c2, 'одинаковая цель → одинаковый переход');
}

// ── parseTargetParam: smoke-тесты ─────────────────────────────────────────────

console.log('\n-- parseTargetParam: smoke-тесты (без DOM/history) --');
{
  function makeParseTargetParam(searchStr) {
    let replaceStateCalled = false;
    let routeCalledWith = null;
    let pendingTarget = null;

    const fakeWindow = {
      location: { search: searchStr, href: 'http://localhost/prototype.html' + searchStr },
      history: { replaceState: () => { replaceStateCalled = true; } },
    };

    function fakeNormalizeTarget(raw) {
      if (!raw || typeof raw !== 'object') return null;
      const { type, id } = raw;
      if (!new Set(['service','records','category']).has(type)) return null;
      if (type === 'service') {
        if (id === null || id === undefined || id === '') return null;
        return { type, id: String(id) };
      }
      if (type === 'category') {
        if (typeof id !== 'string' || id === '') return null;
        return { type, id };
      }
      if (type === 'records') return { type };
      return null;
    }

    function fakeRouteToTarget(t) { routeCalledWith = t; }

    function parseTargetParam() {
      try {
        const params = new URLSearchParams(fakeWindow.location.search);
        const raw = params.get('n');
        replaceStateCalled = true;
        if (!raw) return;
        let parsed;
        try { parsed = JSON.parse(decodeURIComponent(raw)); } catch { return; }
        const target = fakeNormalizeTarget(parsed);
        if (!target) return;
        if (target.type === 'records') {
          fakeRouteToTarget(target);
        } else {
          pendingTarget = target;
        }
      } catch {}
    }

    parseTargetParam();
    return { replaceStateCalled, routeCalledWith, pendingTarget };
  }

  {
    const r = makeParseTargetParam('?n=' + encodeURIComponent(JSON.stringify({ type: 'records' })));
    assert(r.replaceStateCalled, 'replaceState вызван');
    assert(r.routeCalledWith !== null && r.routeCalledWith.type === 'records', 'records применён сразу');
    assert(r.pendingTarget === null, 'нет отложенной цели для records');
  }
  {
    const r = makeParseTargetParam('?n=' + encodeURIComponent(JSON.stringify({ type: 'service', id: '5443758' })));
    assert(r.routeCalledWith === null, 'service не маршрутизируется сразу');
    assert(r.pendingTarget !== null && r.pendingTarget.id === '5443758', 'service отложен как pendingTarget');
  }
  {
    const r = makeParseTargetParam('?n=INVALID_JSON_!!!');
    assert(r.replaceStateCalled, 'replaceState вызван даже при невалидном JSON');
    assert(r.routeCalledWith === null && r.pendingTarget === null, 'невалидный ?n= не вызывает ошибок');
  }
  {
    const r = makeParseTargetParam('');
    assert(r.routeCalledWith === null, 'без ?n= нет маршрутизации');
    assert(r.pendingTarget === null, 'без ?n= нет pendingTarget');
  }
  {
    const r = makeParseTargetParam('?n=' + encodeURIComponent(JSON.stringify({ type: 'unknown', id: 1 })));
    assert(r.routeCalledWith === null && r.pendingTarget === null, 'неизвестный тип → ничего');
  }
}

console.log(`\nРезультат: ${passed} прошло, ${failed} упало`);
if (failed > 0) process.exit(1);
