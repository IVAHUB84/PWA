globalThis.window = globalThis.window || {};
const _listeners = {};
globalThis.window.addEventListener = (ev, fn) => {
  if (!_listeners[ev]) _listeners[ev] = [];
  _listeners[ev].push(fn);
};
globalThis.window.go = () => {};
globalThis.window.innerWidth = 375;

globalThis.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
};
const _storage = {};
globalThis.localStorage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(_storage, k) ? _storage[k] : null; },
  setItem(k, v) { _storage[k] = String(v); },
  removeItem(k) { delete _storage[k]; },
  clear() { Object.keys(_storage).forEach(k => delete _storage[k]); },
};

let _navigatorStandalone = undefined;
Object.defineProperty(globalThis, 'navigator', {
  value: {
    get userAgent() { return ''; },
    get standalone() { return _navigatorStandalone; },
  },
  writable: true,
  configurable: true,
});

globalThis.window.matchMedia = () => ({ matches: false });

const { isStandalone, isIOS, isIosStandalone, shouldOffer, dismissInstall, readState, triggerInstall, attachInstallListeners } = await import('./install.js');

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

console.log('\n-- isIosStandalone --');
{
  assert(isIosStandalone({ standalone: true,  iosPlatform: true  }) === true,  '{standalone:true,  iosPlatform:true}  → true');
  assert(isIosStandalone({ standalone: true,  iosPlatform: false }) === false, '{standalone:true,  iosPlatform:false} → false');
  assert(isIosStandalone({ standalone: false, iosPlatform: true  }) === false, '{standalone:false, iosPlatform:true}  → false');
  assert(isIosStandalone({ standalone: false, iosPlatform: false }) === false, '{standalone:false, iosPlatform:false} → false');
}

console.log('\n-- isStandalone --');
{
  globalThis.window.matchMedia = () => ({ matches: true });
  _navigatorStandalone = undefined;
  assert(isStandalone(), 'true при display-mode: standalone');

  globalThis.window.matchMedia = () => ({ matches: false });
  _navigatorStandalone = true;
  assert(isStandalone(), 'true при navigator.standalone === true');

  globalThis.window.matchMedia = () => ({ matches: false });
  _navigatorStandalone = false;
  assert(!isStandalone(), 'false когда оба признака отсутствуют');

  globalThis.window.matchMedia = () => ({ matches: false });
  _navigatorStandalone = undefined;
  assert(!isStandalone(), 'false при standalone=undefined и matchMedia=false');
}

console.log('\n-- isIOS --');
{
  assert(isIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'), 'iPhone UA → true');
  assert(isIOS('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15'), 'iPad UA → true');
  assert(isIOS('Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)'), 'iPod UA → true');
  assert(!isIOS('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/114'), 'Android UA → false');
  assert(!isIOS('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114'), 'Windows Chrome → false');
  assert(!isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36'), 'macOS Safari → false');
  assert(!isIOS('Mozilla/5.0 (Linux; Android 9; iPad) AppleWebKit/537.36'), 'Android с "iPad" в UA → false (содержит android)');
}

console.log('\n-- shouldOffer --');
{
  const now = Date.now();
  const THIRTY_DAYS = 30 * 86400000;

  assertEqual(shouldOffer(now, { installed: true }), false, 'installed=true → false');
  assertEqual(shouldOffer(now, { installed: false, dismissedAt: now - 1000 }), false, 'отказ < 30 дней → false');
  assertEqual(shouldOffer(now, { dismissedAt: now - THIRTY_DAYS - 1 }), true, 'отказ > 30 дней → true');
  assertEqual(shouldOffer(now, {}), true, 'пустое состояние → true');
  assertEqual(shouldOffer(now, { dismissedAt: now - THIRTY_DAYS + 1 }), false, 'отказ ровно 30 дней без 1 мс → false');
  assertEqual(shouldOffer(now, { installed: false }), true, 'installed=false без dismissedAt → true');
}

console.log('\n-- dismissInstall --');
{
  localStorage.clear();
  const before = Date.now();
  dismissInstall();
  const state = readState();
  assert(typeof state.dismissedAt === 'number' && state.dismissedAt >= before, 'записывает dismissedAt в localStorage');
  assert(shouldOffer(Date.now(), state) === false, 'после dismissInstall shouldOffer возвращает false');
}

function makeOverlayEl() {
  const style = {};
  let hidden = false;
  Object.defineProperty(style, 'display', {
    get() { return hidden ? 'none' : 'flex'; },
    set(v) { if (v === 'none') hidden = true; },
    configurable: true,
  });
  return { style, _isHidden: () => hidden };
}

console.log('\n-- triggerInstall: outcome dismissed --');
{
  localStorage.clear();

  const overlayEl = makeOverlayEl();
  const origGetById = globalThis.document.getElementById;
  globalThis.document.getElementById = (id) => {
    if (id === 'installOverlay') return overlayEl;
    if (id === 'installBanner') return { style: {} };
    return null;
  };

  let resolveChoice;
  const fakePrompt = {
    preventDefault() {},
    prompt() {},
    userChoice: new Promise(resolve => { resolveChoice = resolve; }),
  };

  attachInstallListeners();
  (_listeners['beforeinstallprompt'] || []).forEach(fn => fn(fakePrompt));

  triggerInstall();
  resolveChoice({ outcome: 'dismissed' });

  await fakePrompt.userChoice;
  await new Promise(r => setTimeout(r, 0));

  const state = readState();
  assert(typeof state.dismissedAt === 'number', 'outcome dismissed → записывает dismissedAt');
  assert(!state.installed, 'outcome dismissed → installed не выставляется');
  assert(overlayEl._isHidden(), 'outcome dismissed → оверлей скрывается');

  globalThis.document.getElementById = origGetById;
}

console.log('\n-- triggerInstall: outcome accepted --');
{
  localStorage.clear();

  const overlayEl = makeOverlayEl();
  const origGetById = globalThis.document.getElementById;
  globalThis.document.getElementById = (id) => {
    if (id === 'installOverlay') return overlayEl;
    if (id === 'installBanner') return { style: {} };
    return null;
  };

  let resolveChoice;
  const fakePrompt = {
    preventDefault() {},
    prompt() {},
    userChoice: new Promise(resolve => { resolveChoice = resolve; }),
  };

  (_listeners['beforeinstallprompt'] || []).forEach(fn => fn(fakePrompt));

  triggerInstall();
  resolveChoice({ outcome: 'accepted' });

  await fakePrompt.userChoice;
  await new Promise(r => setTimeout(r, 0));

  const state = readState();
  assert(state.installed === true, 'outcome accepted → записывает installed=true');
  assert(!state.dismissedAt, 'outcome accepted → dismissedAt не выставляется');
  assert(overlayEl._isHidden(), 'outcome accepted → оверлей скрывается');

  globalThis.document.getElementById = origGetById;
}

console.log(`\nРезультат: ${passed} прошло, ${failed} упало`);
if (failed > 0) process.exit(1);
