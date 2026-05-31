const _storage = {};
globalThis.localStorage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(_storage, k) ? _storage[k] : null; },
  setItem(k, v) { _storage[k] = String(v); },
  removeItem(k) { delete _storage[k]; },
  clear() { Object.keys(_storage).forEach(k => delete _storage[k]); },
};

const { readCatalogSnapshot, writeCatalogSnapshot, readPricesSnapshot, writePricesSnapshot } = await import('./dataCache.js');

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

const SAMPLE_SERVICES = [
  { id: 'svc1', name: 'Тест', cat: 'Брови', dur: 60, price_min: 1000, priceStr: '1 000 ₽', comment: '', photos: [] },
];
const SAMPLE_MASTERS = [
  { id: 'm1', name: 'Мастер А', short: 'Мастер А.', role: 'Мастер', exp: '3 года' },
];
const SAMPLE_PRICE_RANGE = { svc1: { min: 1000, max: 2000 } };
const SAMPLE_STAFF_PRICE = { m1: { svc1: 1500 } };

console.log('\n-- readCatalogSnapshot: пустое хранилище → null --');
{
  localStorage.clear();
  assertEqual(readCatalogSnapshot(), null, 'null при отсутствии снимка');
}

console.log('\n-- writeCatalogSnapshot / readCatalogSnapshot: round-trip --');
{
  localStorage.clear();
  writeCatalogSnapshot(SAMPLE_SERVICES, SAMPLE_MASTERS);
  const snap = readCatalogSnapshot();
  assert(snap !== null, 'снимок считан');
  assertEqual(snap.services.length, 1, 'одна услуга');
  assertEqual(snap.services[0].id, 'svc1', 'id услуги сохранён');
  assertEqual(snap.services[0].name, 'Тест', 'name сохранён');
  assertEqual(snap.masters.length, 1, 'один мастер');
  assertEqual(snap.masters[0].id, 'm1', 'id мастера сохранён');
}

console.log('\n-- writeCatalogSnapshot: токен не попадает в снимок --');
{
  localStorage.clear();
  const serviceWithToken = [
    { id: 'svc1', name: 'Тест', cat: 'Брови', dur: 60, price_min: 1000, priceStr: '1 000 ₽', comment: '', photos: [],
      userToken: 'secret123', YC_TOKEN: 'abc' },
  ];
  writeCatalogSnapshot(serviceWithToken, SAMPLE_MASTERS);
  const snap = readCatalogSnapshot();
  assert(snap !== null, 'снимок записан');
  assert(!('userToken' in snap.services[0]), 'userToken не попал в снимок');
  assert(!('YC_TOKEN' in snap.services[0]), 'YC_TOKEN не попал в снимок');
}

console.log('\n-- readCatalogSnapshot: повреждённый JSON → null --');
{
  localStorage.clear();
  localStorage.setItem('yc_catalog_cache_v1', '{broken');
  assertEqual(readCatalogSnapshot(), null, 'null при повреждённом JSON');
}

console.log('\n-- readCatalogSnapshot: неверная схема → null --');
{
  localStorage.clear();
  localStorage.setItem('yc_catalog_cache_v1', JSON.stringify({ services: 'bad', masters: [] }));
  assertEqual(readCatalogSnapshot(), null, 'null если services не массив');

  localStorage.setItem('yc_catalog_cache_v1', JSON.stringify({ services: [], masters: 'bad' }));
  assertEqual(readCatalogSnapshot(), null, 'null если masters не массив');
}

console.log('\n-- readPricesSnapshot: пустое хранилище → null --');
{
  localStorage.clear();
  assertEqual(readPricesSnapshot(), null, 'null при отсутствии снимка');
}

console.log('\n-- writePricesSnapshot / readPricesSnapshot: round-trip --');
{
  localStorage.clear();
  writePricesSnapshot(SAMPLE_PRICE_RANGE, SAMPLE_STAFF_PRICE);
  const snap = readPricesSnapshot();
  assert(snap !== null, 'снимок цен считан');
  assertEqual(snap.servicePriceRange.svc1.min, 1000, 'min сохранён');
  assertEqual(snap.servicePriceRange.svc1.max, 2000, 'max сохранён');
  assertEqual(snap.staffServicePrice.m1.svc1, 1500, 'цена мастера сохранена');
}

console.log('\n-- readPricesSnapshot: повреждённый JSON → null --');
{
  localStorage.clear();
  localStorage.setItem('yc_prices_cache_v1', '{broken');
  assertEqual(readPricesSnapshot(), null, 'null при повреждённом JSON');
}

console.log('\n-- readPricesSnapshot: неверная схема → null --');
{
  localStorage.clear();
  localStorage.setItem('yc_prices_cache_v1', JSON.stringify({ servicePriceRange: null, staffServicePrice: {} }));
  assertEqual(readPricesSnapshot(), null, 'null если servicePriceRange не объект');

  localStorage.setItem('yc_prices_cache_v1', JSON.stringify({ servicePriceRange: {}, staffServicePrice: null }));
  assertEqual(readPricesSnapshot(), null, 'null если staffServicePrice не объект');
}

console.log('\n-- writeCatalogSnapshot: ошибка setItem не пробрасывается --');
{
  const origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  let threw = false;
  try {
    writeCatalogSnapshot(SAMPLE_SERVICES, SAMPLE_MASTERS);
  } catch {
    threw = true;
  }
  assert(!threw, 'ошибка записи каталога не пробрасывается наружу');
  localStorage.setItem = origSetItem;
}

console.log('\n-- writePricesSnapshot: ошибка setItem не пробрасывается --');
{
  const origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  let threw = false;
  try {
    writePricesSnapshot(SAMPLE_PRICE_RANGE, SAMPLE_STAFF_PRICE);
  } catch {
    threw = true;
  }
  assert(!threw, 'ошибка записи цен не пробрасывается наружу');
  localStorage.setItem = origSetItem;
}

console.log('\n-- readCatalogSnapshot: ошибка getItem не пробрасывается → null --');
{
  const origGetItem = localStorage.getItem.bind(localStorage);
  localStorage.getItem = () => { throw new Error('storage error'); };
  let result;
  let threw = false;
  try {
    result = readCatalogSnapshot();
  } catch {
    threw = true;
  }
  assert(!threw, 'ошибка чтения не пробрасывается');
  assertEqual(result, null, 'возвращает null при ошибке чтения');
  localStorage.getItem = origGetItem;
}

// ── hydratePrices ──

const { servicePriceRange, staffServicePrice, hydratePrices } = await import('./state.js');

console.log('\n-- hydratePrices: наполнение из снимка --');
{
  hydratePrices({ servicePriceRange: { svc1: { min: 1000, max: 2000 } }, staffServicePrice: { m1: { svc1: 1500 } } });
  assertEqual(servicePriceRange.svc1?.min, 1000, 'min из снимка');
  assertEqual(servicePriceRange.svc1?.max, 2000, 'max из снимка');
  assertEqual(staffServicePrice.m1?.svc1, 1500, 'цена мастера из снимка');
}

console.log('\n-- hydratePrices: null очищает структуры --');
{
  hydratePrices(null);
  assertEqual(Object.keys(servicePriceRange).length, 0, 'servicePriceRange пуст после null');
  assertEqual(Object.keys(staffServicePrice).length, 0, 'staffServicePrice пуст после null');
}

console.log('\n-- hydratePrices: мусорные диапазоны (NaN/Infinity) отфильтровываются --');
{
  hydratePrices({
    servicePriceRange: {
      svc1: { min: 1000, max: 2000 },
      svc2: { min: NaN, max: 2000 },
      svc3: { min: 1000, max: Infinity },
      svc4: { min: null, max: 500 },
    },
    staffServicePrice: {},
  });
  assert('svc1' in servicePriceRange, 'валидный диапазон принят');
  assert(!('svc2' in servicePriceRange), 'диапазон с NaN min отфильтрован');
  assert(!('svc3' in servicePriceRange), 'диапазон с Infinity max отфильтрован');
  assert(!('svc4' in servicePriceRange), 'диапазон с null min отфильтрован');
}

console.log('\n-- writeCatalogSnapshot: снимок мастеров содержит поля рендера и не содержит токенов --');
{
  localStorage.clear();
  // Реальный маппинг мастеров из initApp: {id, name, short, role, exp, avatar, emoji, grad, cats, fav, avail, availText}.
  // Токены/секреты в этот маппинг не входят — тест фиксирует контракт маппинга.
  const masterFromInitApp = {
    id: 'm1', name: 'Мастер А', short: 'Мастер А.', role: 'Мастер ПМ', exp: '3 года',
    avatar: 'https://example.com/avatar.jpg', emoji: '👩',
    grad: 'linear-gradient(135deg,#F4B8CF,#E8729A)', cats: ['Брови'],
    fav: false, avail: true, availText: '● Есть окна сегодня',
  };
  const servicesClean = [
    { id: 'svc1', name: 'Тест', cat: 'Брови', dur: 60, price_min: 1000, priceStr: '1 000 ₽', comment: '', photos: [] },
  ];
  writeCatalogSnapshot(servicesClean, [masterFromInitApp]);
  const snap = readCatalogSnapshot();
  assert(snap !== null, 'снимок записан');
  const master = snap.masters[0];
  assert('grad' in master, 'поле grad (нужно для рендера) присутствует');
  assert('cats' in master, 'поле cats (нужно для фильтрации) присутствует');
  assert('avatar' in master, 'поле avatar присутствует');
  assert(!('userToken' in master), 'userToken не в маппинге мастера — в снимок не попадает');
  assert(!('YC_TOKEN' in master), 'YC_TOKEN не в маппинге мастера — в снимок не попадает');
}

console.log(`\nРезультат: ${passed} прошло, ${failed} упало`);
if (failed > 0) process.exit(1);
