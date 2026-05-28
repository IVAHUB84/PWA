/**
 * Тесты логики фильтрации мастеров по услуге (v1.2.0).
 *
 * Запуск: node docs/modules/masters-filter.test.js
 */

globalThis.window = globalThis.window || {};
globalThis.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
};
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
};

const { _intersectWithMasters } = await import('./masters.js');
const { fetchStaffByService } = await import('./api.js');

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
  assert(a === b, `${label} (got: ${JSON.stringify(a)}, expected: ${JSON.stringify(b)})`);
}

const MASTERS = [
  { id: '10', name: 'Мастер А' },
  { id: '20', name: 'Мастер Б' },
  { id: '30', name: 'Мастер В' },
];

console.log('\n-- _intersectWithMasters: непустой ответ YCLIENTS --');
{
  const staffResult = [{ id: 10 }, { id: 30 }];
  const { masters, empty, error } = _intersectWithMasters(staffResult, MASTERS);
  assertEqual(masters.length, 2, 'два мастера в пересечении');
  assert(masters.some(m => m.id === '10'), 'Мастер А в списке');
  assert(masters.some(m => m.id === '30'), 'Мастер В в списке');
  assert(!masters.some(m => m.id === '20'), 'Мастер Б отсутствует');
  assertEqual(empty, false, 'empty = false');
  assertEqual(error, false, 'error = false');
}

console.log('\n-- _intersectWithMasters: пустой успешный ответ YCLIENTS --');
{
  const { masters, empty, error } = _intersectWithMasters([], MASTERS);
  assertEqual(masters.length, 0, 'список пустой');
  assertEqual(empty, true, 'empty = true');
  assertEqual(error, false, 'error = false');
}

console.log('\n-- _intersectWithMasters: ошибка API (null) → fail-open --');
{
  const { masters, empty, error } = _intersectWithMasters(null, MASTERS);
  assertEqual(masters.length, 3, 'fail-open: все мастера');
  assertEqual(empty, false, 'empty = false');
  assertEqual(error, true, 'error = true');
}

console.log('\n-- _intersectWithMasters: ни один из YCLIENTS нет в MASTERS_DATA → пустое состояние --');
{
  const staffResult = [{ id: 999 }, { id: 888 }];
  const { masters, empty, error } = _intersectWithMasters(staffResult, MASTERS);
  assertEqual(masters.length, 0, 'ни одного совпадения → пустой список');
  assertEqual(empty, true, 'empty = true');
  assertEqual(error, false, 'error = false');
}

console.log('\n-- _intersectWithMasters: числовые и строковые id нормализуются --');
{
  const staffResult = [{ id: 10 }, { id: '30' }];
  const { masters } = _intersectWithMasters(staffResult, MASTERS);
  assertEqual(masters.length, 2, 'id 10 (число) и "30" (строка) совпадают с MASTERS_DATA');
}

console.log('\n-- _intersectWithMasters: один из YCLIENTS отсутствует в MASTERS_DATA — отбрасывается --');
{
  const staffResult = [{ id: 10 }, { id: 999 }];
  const { masters } = _intersectWithMasters(staffResult, MASTERS);
  assertEqual(masters.length, 1, 'только найденный в MASTERS_DATA мастер');
  assertEqual(masters[0].id, '10', 'Мастер А найден');
}

console.log('\n-- fetchStaffByService: непустой ответ → массив --');
{
  const mockGet = async () => ({ success: true, data: [{ id: 1 }, { id: 2 }] });
  const result = await fetchStaffByService('svc1', mockGet);
  assert(Array.isArray(result), 'возвращает массив');
  assertEqual(result.length, 2, 'два элемента');
}

console.log('\n-- fetchStaffByService: пустой успешный ответ → пустой массив --');
{
  const mockGet = async () => ({ success: true, data: [] });
  const result = await fetchStaffByService('svc1', mockGet);
  assert(Array.isArray(result), 'возвращает массив');
  assertEqual(result.length, 0, 'пустой массив');
}

console.log('\n-- fetchStaffByService: success:false → null --');
{
  const mockGet = async () => ({ success: false });
  const result = await fetchStaffByService('svc1', mockGet);
  assertEqual(result, null, 'возвращает null');
}

console.log('\n-- fetchStaffByService: исключение → null --');
{
  const mockGet = async () => { throw new Error('network'); };
  const result = await fetchStaffByService('svc1', mockGet);
  assertEqual(result, null, 'возвращает null при исключении');
}

console.log('\n-- fetchStaffByService: data не массив → null --');
{
  const mockGet = async () => ({ success: true, data: 'broken' });
  const result = await fetchStaffByService('svc1', mockGet);
  assertEqual(result, null, 'возвращает null если data не массив');
}

console.log('\n-- fetchStaffByService: data отсутствует → null --');
{
  const mockGet = async () => ({ success: true });
  const result = await fetchStaffByService('svc1', mockGet);
  assertEqual(result, null, 'возвращает null если data отсутствует');
}

console.log('\n-- кэш: успешный результат кэшируется, повторный вызов не идёт в сеть --');
{
  let callCount = 0;
  const mockGet = async () => { callCount++; return { success: true, data: [{ id: 1 }] }; };
  const cache = new Map();
  const serviceId = 'svc42';

  for (let i = 0; i < 2; i++) {
    let staffResult;
    if (!cache.has(serviceId)) {
      staffResult = await fetchStaffByService(serviceId, mockGet);
      if (staffResult !== null) cache.set(serviceId, staffResult);
    } else {
      staffResult = cache.get(serviceId);
    }
    void staffResult;
  }

  assertEqual(callCount, 1, 'сеть вызвана ровно один раз (кэш работает)');
  assertEqual(cache.get(serviceId).length, 1, 'закэшированный результат корректен');
}

console.log('\n-- кэш: результат null (ошибка) не кэшируется --');
{
  let callCount = 0;
  const mockGet = async () => { callCount++; return { success: false }; };
  const cache = new Map();
  const serviceId = 'svc-err';

  for (let i = 0; i < 2; i++) {
    let staffResult;
    if (!cache.has(serviceId)) {
      staffResult = await fetchStaffByService(serviceId, mockGet);
      if (staffResult !== null) cache.set(serviceId, staffResult);
    } else {
      staffResult = cache.get(serviceId);
    }
    void staffResult;
  }

  assertEqual(callCount, 2, 'сеть вызвана дважды — ошибка не кэшируется');
  assertEqual(cache.has(serviceId), false, 'ключ отсутствует в кэше');
}

console.log('\n-- кэш: пустой массив (успех) кэшируется --');
{
  let callCount = 0;
  const mockGet = async () => { callCount++; return { success: true, data: [] }; };
  const cache = new Map();
  const serviceId = 'svc-empty';

  for (let i = 0; i < 2; i++) {
    let staffResult;
    if (!cache.has(serviceId)) {
      staffResult = await fetchStaffByService(serviceId, mockGet);
      if (staffResult !== null) cache.set(serviceId, staffResult);
    } else {
      staffResult = cache.get(serviceId);
    }
    void staffResult;
  }

  assertEqual(callCount, 1, 'пустой успешный массив кэшируется — второй запрос не идёт');
}

console.log(`\nРезультат: ${passed} прошло, ${failed} упало`);
if (failed > 0) process.exit(1);
