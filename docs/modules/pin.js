import { _sha256 } from './utils.js';
import { go } from './navigation.js';
import { clearSession } from './storage.js';

const _PIN_KEY = 'yc_pin_hash';
const _ATTEMPTS_KEY = 'yc_pin_attempts';
const _MAX_ATTEMPTS = 5;

let _digits = [];
let _mode = 'enter'; // 'enter' | 'setup1' | 'setup2'
let _setup1Pin = '';

export function hasPinSet() {
  return !!localStorage.getItem(_PIN_KEY);
}

export function openPinEnter() {
  _mode = 'enter';
  _digits = [];
  go('s-pin');
}

export function openPinSetup() {
  _mode = 'setup1';
  _digits = [];
  _setup1Pin = '';
  go('s-pin');
}

export function refreshPinScreen() {
  _digits = [];
  _refreshScreen();
}

function _refreshScreen() {
  const titleEl = document.getElementById('pinTitle');
  const subEl = document.getElementById('pinSub');
  const errEl = document.getElementById('pinError');
  const skipBtn = document.getElementById('pinSkipBtn');
  const altBtn = document.getElementById('pinAltBtn');
  if (!titleEl) return;
  if (errEl) errEl.style.display = 'none';

  if (_mode === 'enter') {
    titleEl.textContent = 'Введите PIN';
    subEl.textContent = 'Быстрый вход в приложение';
    if (skipBtn) skipBtn.style.visibility = 'hidden';
    if (altBtn) { altBtn.style.display = ''; altBtn.textContent = 'Войти по коду'; }
  } else if (_mode === 'setup1') {
    titleEl.textContent = 'Придумайте PIN';
    subEl.textContent = 'Вы будете использовать его вместо кода из письма';
    if (skipBtn) { skipBtn.style.visibility = 'visible'; skipBtn.textContent = 'Пропустить'; }
    if (altBtn) altBtn.style.display = 'none';
  } else if (_mode === 'setup2') {
    titleEl.textContent = 'Повторите PIN';
    subEl.textContent = 'Введите тот же PIN ещё раз';
    if (skipBtn) { skipBtn.style.visibility = 'visible'; skipBtn.textContent = 'Назад'; }
    if (altBtn) altBtn.style.display = 'none';
  }
  _refreshDots();
}

function _refreshDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('pinDot' + i);
    if (dot) dot.classList.toggle('filled', i < _digits.length);
  }
}

export function _pinKey(n) {
  if (_digits.length >= 4) return;
  _digits.push(n);
  _refreshDots();
  if (_digits.length === 4) setTimeout(_pinSubmit, 150);
}

export function _pinBackspace() {
  if (_digits.length > 0) {
    _digits.pop();
    _refreshDots();
  }
}

async function _pinSubmit() {
  const pin = _digits.join('');
  _digits = [];
  _refreshDots();
  const errEl = document.getElementById('pinError');

  if (_mode === 'enter') {
    const stored = localStorage.getItem(_PIN_KEY);
    if (!stored) { go('s-home', 'tab'); return; }
    const attempts = parseInt(localStorage.getItem(_ATTEMPTS_KEY) || '0');
    const hash = await _sha256(pin);
    if (hash === stored) {
      localStorage.removeItem(_ATTEMPTS_KEY);
      go('s-home', 'tab');
    } else {
      const newAttempts = attempts + 1;
      localStorage.setItem(_ATTEMPTS_KEY, String(newAttempts));
      const left = _MAX_ATTEMPTS - newAttempts;
      if (left <= 0) {
        localStorage.removeItem(_PIN_KEY);
        localStorage.removeItem(_ATTEMPTS_KEY);
        clearSession();
        go('s-login', 'tab');
      } else {
        if (errEl) { errEl.textContent = `Неверный PIN. Осталось попыток: ${left}`; errEl.style.display = 'block'; }
      }
    }
  } else if (_mode === 'setup1') {
    _setup1Pin = pin;
    _mode = 'setup2';
    _refreshScreen();
  } else if (_mode === 'setup2') {
    if (pin !== _setup1Pin) {
      if (errEl) { errEl.textContent = 'PIN не совпадает. Попробуйте снова.'; errEl.style.display = 'block'; }
      _mode = 'setup1';
      _setup1Pin = '';
      setTimeout(_refreshScreen, 800);
      return;
    }
    const hash = await _sha256(pin);
    localStorage.setItem(_PIN_KEY, hash);
    localStorage.removeItem(_ATTEMPTS_KEY);
    go('s-home', 'tab');
  }
}

export function _pinSkip() {
  if (_mode === 'setup2') {
    _mode = 'setup1';
    _setup1Pin = '';
    _refreshScreen();
  } else {
    go('s-home', 'tab');
  }
}

export function _pinAlt() {
  localStorage.removeItem(_PIN_KEY);
  localStorage.removeItem(_ATTEMPTS_KEY);
  clearSession();
  go('s-login', 'tab');
}

Object.assign(window, { _pinKey, _pinBackspace, openPinEnter, openPinSetup, _pinSkip, _pinAlt });
