// Тесты для focusTargetSelector (navigation.js) и prefersReducedMotion (utils.js).
// Запускаются в Node без DOM — используем минимальный мок.

// ── Мок window/document/localStorage для navigation.js + utils.js ──
let _mqMatches = false;
globalThis.window = {
  matchMedia: (_q) => ({ matches: _mqMatches }),
};
globalThis.document = {
  addEventListener: () => {},
  getElementById: () => null,
  activeElement: null,
};

const { prefersReducedMotion } = await import('./utils.js');
const { focusTargetSelector } = await import('./navigation.js');

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

// ── prefersReducedMotion ──
console.log('\n-- prefersReducedMotion --');

{
  _mqMatches = false;
  assert(prefersReducedMotion() === false, 'false когда matchMedia.matches=false');
}

{
  _mqMatches = true;
  assert(prefersReducedMotion() === true, 'true когда matchMedia.matches=true');
}

{
  _mqMatches = false;
  const result = prefersReducedMotion();
  assert(typeof result === 'boolean', 'возвращает boolean');
}

// ── focusTargetSelector ──
// Мокаем минимальный DOM-узел
function makeEl(classes = [], children = []) {
  return {
    _cls: classes,
    querySelector(sel) {
      const selectors = sel.split(',').map(s => s.trim());
      for (const child of children) {
        for (const s of selectors) {
          const cls = s.replace('.', '');
          if (child._cls && child._cls.includes(cls)) return child;
        }
      }
      return null;
    },
    hasAttribute() { return false; },
    setAttribute() {},
    focus() { this._focused = true; },
    _focused: false,
  };
}

console.log('\n-- focusTargetSelector --');

{
  const title = { _cls: ['page-title'], focus() { this._focused = true; }, _focused: false };
  const screen = makeEl([], [title]);
  const result = focusTargetSelector(screen);
  assert(result === title, 'возвращает .page-title при его наличии');
  assert(!result._focused, 'не вызывает .focus()');
}

{
  const title = { _cls: ['section-title'], focus() { this._focused = true; }, _focused: false };
  const screen = makeEl([], [title]);
  const result = focusTargetSelector(screen);
  assert(result === title, 'возвращает .section-title при его наличии');
}

{
  const screen = makeEl([], []);
  const result = focusTargetSelector(screen);
  assert(result === screen, 'возвращает контейнер при отсутствии заголовка');
  assert(!result._focused, 'не вызывает .focus() на контейнере');
}

{
  const result = focusTargetSelector(null);
  assert(result === null, 'возвращает null при screenEl=null');
}

{
  const titlePage = { _cls: ['page-title'], focus() {}, _focused: false };
  const titleSection = { _cls: ['section-title'], focus() {}, _focused: false };
  const screen = makeEl([], [titlePage, titleSection]);
  const result = focusTargetSelector(screen);
  assert(result === titlePage, 'page-title имеет приоритет перед section-title');
}

console.log(`\nРезультат: ${passed} прошло, ${failed} упало`);
if (failed > 0) process.exit(1);
