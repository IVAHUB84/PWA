import { getDuration, DURATIONS, selectActive, scheduleHide } from './uiQueue.js';

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

// ── getDuration: длительность по типу ──
console.log('\n-- getDuration: длительность по типу --');
assertEqual(getDuration('success'), DURATIONS.success, 'success → 3000');
assertEqual(getDuration('info'),    DURATIONS.info,    'info → 3000');
assertEqual(getDuration('error'),   DURATIONS.error,   'error → 5000');

console.log('\n-- getDuration: opts.duration переопределяет дефолт --');
assertEqual(getDuration('success', 1000), 1000, 'success с override 1000 → 1000');
assertEqual(getDuration('error',   2500), 2500, 'error с override 2500 → 2500');

console.log('\n-- getDuration: некорректный override игнорируется --');
assertEqual(getDuration('info', 0),    DURATIONS.info, 'override 0 игнорируется');
assertEqual(getDuration('info', -100), DURATIONS.info, 'override отрицательный игнорируется');
assertEqual(getDuration('info', null), DURATIONS.info, 'override null игнорируется');
assertEqual(getDuration('info', NaN),  DURATIONS.info, 'override NaN игнорируется');

console.log('\n-- getDuration: неизвестный тип → дефолт info --');
assertEqual(getDuration('unknown'), DURATIONS.info, 'неизвестный тип → DURATIONS.info');

// ── selectActive: всегда возвращает incoming ──
console.log('\n-- selectActive: всегда возвращает incoming --');
{
  const b = { type: 'error', duration: undefined };
  const result = selectActive(b);
  assert(result === b, 'возвращает переданный объект');
}

{
  const result = selectActive({ type: 'info' });
  assert(result !== null, 'результат не null');
  assertEqual(result.type, 'info', 'тип сохранён');
}

{
  const incoming = { type: 'success', duration: 1500 };
  const result = selectActive(incoming);
  assertEqual(result.duration, 1500, 'duration сохранён');
}

// ── scheduleHide: таймер инжектируется ──
console.log('\n-- scheduleHide: вызывает setTimeout с правильной длительностью --');
{
  let calledWith = null;
  const fakeSetTimeout = (fn, ms) => { calledWith = ms; return 42; };
  const tid = scheduleHide({ type: 'success' }, fakeSetTimeout, () => {});
  assertEqual(calledWith, DURATIONS.success, 'success: setTimeout с 3000');
  assertEqual(tid, 42, 'возвращает id таймера от setTimeout');
}

{
  let calledWith = null;
  const fakeSetTimeout = (fn, ms) => { calledWith = ms; return 1; };
  scheduleHide({ type: 'error' }, fakeSetTimeout, () => {});
  assertEqual(calledWith, DURATIONS.error, 'error: setTimeout с 5000');
}

{
  let calledWith = null;
  const fakeSetTimeout = (fn, ms) => { calledWith = ms; return 2; };
  scheduleHide({ type: 'info', duration: 1200 }, fakeSetTimeout, () => {});
  assertEqual(calledWith, 1200, 'override duration передаётся в setTimeout');
}

console.log('\n-- scheduleHide: onHide вызывается при срабатывании таймера --');
{
  let hideCalled = false;
  const fakeSetTimeout = (fn, _ms) => { fn(); return 0; };
  scheduleHide({ type: 'info' }, fakeSetTimeout, () => { hideCalled = true; });
  assert(hideCalled, 'onHide вызван при срабатывании');
}

// ── Экранирование: esc не интерпретирует HTML ──
console.log('\n-- Экранирование: esc корректно экранирует HTML-спецсимволы --');
{
  const { esc } = await import('./utils.js');
  const dangerous = '<script>alert("xss")</script>';
  const escaped = esc(dangerous);
  assert(!escaped.includes('<script>'), 'тег <script> экранирован');
  assert(!escaped.includes('</script>'), 'закрывающий тег экранирован');
  assert(escaped.includes('&lt;'), 'угловые скобки → &lt;');
  assert(escaped.includes('&gt;'), 'угловые скобки → &gt;');
  assert(escaped.includes('&quot;') || escaped.includes('&#39;'), 'кавычки экранированы');
}

{
  const { esc } = await import('./utils.js');
  const msg = 'Ошибка: "запись" & <детали>';
  const escaped = esc(msg);
  assert(!escaped.includes('<'), 'нет неэкранированных < в выводе');
  assert(!escaped.includes('>'), 'нет неэкранированных > в выводе');
  assert(!escaped.includes('"'), 'нет неэкранированных " в выводе');
  assert(!escaped.includes('&d'), 'амперсанд не проходит как есть');
}

console.log(`\nРезультат: ${passed} прошло, ${failed} упало`);
if (failed > 0) process.exit(1);
