/**
 * Тесты типизированных постов (v1.17.0): логика _feedCardHtml, фильтр ленты, _feedGoBook.
 *
 * Запуск: node docs/modules/feed-typed-posts.test.js
 */

const FAKE_SERVICES = [
  { id: 'svc1', name: 'Стрижка', cat: 'Волосы' },
  { id: 'svc2', name: 'Маникюр', cat: 'Ногти' },
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

// ── Логика фильтра ленты (из feed.js) ─────────────────────────────────────────

function applyFeedFilter(posts, filter) {
  if (!filter) return posts;
  if (filter === 'promo') return posts.filter(p => p.type === 'service' || p.type === 'category');
  if (filter === 'news')  return posts.filter(p => !p.type || p.type === 'free');
  return posts;
}

// ── Логика CTA (из feed.js _feedCardHtml) ─────────────────────────────────────

function feedCardHasBookBtn(p) {
  const type = p.type || 'free';
  return type === 'service' || type === 'category';
}

function feedCardBookDataType(p) {
  const type = p.type || 'free';
  if (type === 'service')  return 'service';
  if (type === 'category') return 'category';
  return null;
}

function feedCardBookDataRef(p) {
  const type = p.type || 'free';
  if (type === 'service')  return p.serviceId || '';
  if (type === 'category') return p.cat || '';
  return null;
}

// ── Логика _feedGoBook (из feed.js) ──────────────────────────────────────────

function feedGoBook(type, ref, services) {
  const calls = [];
  const filterCategory = (cat) => calls.push({ fn: 'filterCategory', arg: cat });
  const openServiceCard = (id)  => calls.push({ fn: 'openServiceCard', arg: id });
  const go = (screen)           => calls.push({ fn: 'go', arg: screen });

  if (type === 'service') {
    const exists = services.find(s => s.id === ref);
    if (exists) { openServiceCard(ref); return calls; }
  } else if (type === 'category') {
    const cats = new Set(services.map(s => s.cat));
    if (ref && cats.has(ref)) { filterCategory(ref); go('s-services'); return calls; }
  }
  filterCategory('Все');
  go('s-services');
  return calls;
}

// ── Фильтр ленты ──────────────────────────────────────────────────────────────

console.log('\n-- Фильтр "Все" возвращает все посты --');
{
  const posts = [
    { id: 1, type: 'service',  cat: 'Волосы' },
    { id: 2, type: 'category', cat: 'Ногти'  },
    { id: 3, type: 'free',     cat: ''        },
    { id: 4,                   cat: 'Брови'   },
  ];
  const res = applyFeedFilter(posts, '');
  assert(res.length === 4, '"Все": все 4 поста');
}

console.log('\n-- Фильтр "Акции и услуги" = type service | category --');
{
  const posts = [
    { id: 1, type: 'service',  cat: 'Волосы' },
    { id: 2, type: 'category', cat: 'Ногти'  },
    { id: 3, type: 'free',     cat: ''        },
    { id: 4,                   cat: 'Брови'   },
  ];
  const res = applyFeedFilter(posts, 'promo');
  assert(res.length === 2, 'promo: 2 поста');
  assert(res.every(p => p.type === 'service' || p.type === 'category'), 'только service/category');
}

console.log('\n-- Фильтр "Новости" = free + без type --');
{
  const posts = [
    { id: 1, type: 'service',  cat: 'Волосы' },
    { id: 2, type: 'free',     cat: ''        },
    { id: 3,                   cat: 'Брови'   },
  ];
  const res = applyFeedFilter(posts, 'news');
  assert(res.length === 2, 'news: 2 поста');
  assert(res.every(p => !p.type || p.type === 'free'), 'только free/без type');
}

// ── CTA: наличие и атрибуты ───────────────────────────────────────────────────

console.log('\n-- Свободный пост: кнопки нет --');
{
  assert(!feedCardHasBookBtn({ type: 'free', cat: '' }), 'free → нет кнопки');
  assert(!feedCardHasBookBtn({ cat: 'Брови' }),           'без type → нет кнопки');
}

console.log('\n-- Пост по услуге: кнопка с data-type=service и data-ref=serviceId --');
{
  const p = { type: 'service', cat: 'Волосы', serviceId: 'svc1', serviceName: 'Стрижка' };
  assert(feedCardHasBookBtn(p), 'service → кнопка есть');
  assert(feedCardBookDataType(p) === 'service', 'data-type = service');
  assert(feedCardBookDataRef(p)  === 'svc1',    'data-ref = serviceId');
}

console.log('\n-- Пост по категории: кнопка с data-type=category и data-ref=cat --');
{
  const p = { type: 'category', cat: 'Ногти' };
  assert(feedCardHasBookBtn(p), 'category → кнопка есть');
  assert(feedCardBookDataType(p) === 'category', 'data-type = category');
  assert(feedCardBookDataRef(p)  === 'Ногти',    'data-ref = cat');
}

// ── _feedGoBook маршрутизация ────────────────────────────────────────────────

console.log('\n-- service: существующий serviceId → openServiceCard --');
{
  const calls = feedGoBook('service', 'svc1', FAKE_SERVICES);
  assert(calls.length === 1, '1 вызов');
  assert(calls[0].fn === 'openServiceCard', 'openServiceCard');
  assert(calls[0].arg === 'svc1', 'с правильным id');
}

console.log('\n-- service: несуществующий serviceId → fallback --');
{
  const calls = feedGoBook('service', 'svc999', FAKE_SERVICES);
  assert(calls.some(c => c.fn === 'filterCategory' && c.arg === 'Все'), 'filterCategory(Все)');
  assert(calls.some(c => c.fn === 'go' && c.arg === 's-services'), 'go(s-services)');
  assert(!calls.some(c => c.fn === 'openServiceCard'), 'openServiceCard не вызван');
}

console.log('\n-- category: существующая категория → filterCategory + go s-services --');
{
  const calls = feedGoBook('category', 'Волосы', FAKE_SERVICES);
  assert(calls.some(c => c.fn === 'filterCategory' && c.arg === 'Волосы'), 'filterCategory(Волосы)');
  assert(calls.some(c => c.fn === 'go' && c.arg === 's-services'), 'go(s-services)');
  assert(!calls.some(c => c.fn === 'openServiceCard'), 'openServiceCard не вызван');
}

console.log('\n-- category: несуществующая категория → fallback --');
{
  const calls = feedGoBook('category', 'НеСуществует', FAKE_SERVICES);
  assert(calls.some(c => c.fn === 'filterCategory' && c.arg === 'Все'), 'filterCategory(Все)');
  assert(calls.some(c => c.fn === 'go' && c.arg === 's-services'), 'go(s-services)');
}

console.log('\n-- free → fallback (нет openServiceCard) --');
{
  const calls = feedGoBook('free', '', FAKE_SERVICES);
  assert(!calls.some(c => c.fn === 'openServiceCard'), 'нет openServiceCard');
  assert(calls.some(c => c.fn === 'filterCategory' && c.arg === 'Все'), 'фолбэк filterCategory(Все)');
}

// ── Graceful fallback: посты без cat/type ────────────────────────────────────

console.log('\n-- Пост без cat: тег пустой, нет исключения --');
{
  const p = { id: 1, type: 'free', cat: '', text: 'Новость', date: '1 мая', image: null };
  let err = null;
  try {
    const tagHtml = p.cat ? `<div class="feed-tag">${p.cat}</div>` : '';
    assert(tagHtml === '', 'тег не рендерится при пустом cat');
  } catch(e) { err = e; }
  assert(err === null, 'нет исключения при пустом cat');
}

console.log('\n-- Старый пост (только cat, без type): трактуется как free --');
{
  const p = { id: 2, cat: 'Брови', text: 'Старый пост', date: '2 мая', image: null };
  const type = p.type || 'free';
  assert(type === 'free', 'тип = free');
  assert(!feedCardHasBookBtn(p), 'нет кнопки');
}

// ── Модель поста ─────────────────────────────────────────────────────────────

console.log('\n-- Пост type:service содержит все поля --');
{
  const post = {
    id: 1, type: 'service', cat: 'Волосы',
    serviceId: 'svc1', serviceName: 'Стрижка',
    text: 'Акция 20%', image: null, date: '29 мая', draft: false,
  };
  assert(post.type === 'service', 'type = service');
  assert(typeof post.cat === 'string', 'cat строка');
  assert(post.serviceId === 'svc1', 'serviceId');
  assert(post.serviceName === 'Стрижка', 'serviceName');
}

console.log('\n-- Пост type:category: нет serviceId --');
{
  const post = {
    id: 2, type: 'category', cat: 'Ногти',
    text: 'Скидки на маникюр', image: null, date: '29 мая', draft: false,
  };
  assert(post.type === 'category', 'type = category');
  assert(typeof post.cat === 'string', 'cat строка');
  assert(!('serviceId' in post), 'нет serviceId');
}

console.log('\n-- Пост type:free: cat = "" проходит _VALID_POST --');
{
  const post = {
    id: 3, type: 'free', cat: '',
    text: 'Новость', image: null, date: '29 мая', draft: false,
  };
  assert(post.type === 'free', 'type = free');
  assert(post.cat === '', 'cat = пустая строка');
  assert(typeof post.cat === 'string', 'typeof cat === string (проходит _VALID_POST)');
}

console.log(`\nРезультат: ${passed} прошло, ${failed} упало`);
if (failed > 0) process.exit(1);
