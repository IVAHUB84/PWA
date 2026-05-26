import { DUR, EASE } from './constants.js';
import { state } from './state.js';

export let navHistory = ['s-home'];

// Render-функции регистрируются каждым модулем через registerOnEnter
const _onEnterHandlers = {};
export function registerOnEnter(screenId, fn) {
  _onEnterHandlers[screenId] = fn;
}

// Callbacks для зависимостей, которые будут зарегистрированы позже
let _updateDotsFn = () => {};
export function setUpdateDotsFn(fn) { _updateDotsFn = fn; }

let _onLeaveOtpFn = null;
export function setOnLeaveOtpFn(fn) { _onLeaveOtpFn = fn; }

export function setTx(el, x, animated) {
  const t = animated ? `transform ${DUR}ms ${EASE}` : 'none';
  const v = x === 0 ? '' : `translateX(${x}%)`;
  el.style.webkitTransition = t;
  el.style.transition = t;
  el.style.webkitTransform = v;
  el.style.transform = v;
}

function onEnterScreen(id) {
  const handler = _onEnterHandlers[id];
  if (handler) handler();
}

export function go(id, mode) {
  const current = navHistory[navHistory.length - 1];
  if (current === id) { onEnterScreen(id); return; }

  if (current === 's-otp' && id !== 's-otp' && _onLeaveOtpFn) {
    _onLeaveOtpFn();
  }

  const fromEl = document.getElementById(current);
  const toEl = document.getElementById(id);
  if (!toEl) return;

  if (mode === 'tab') {
    if (id !== 's-slots') state._rescheduleId = null;
    setTx(fromEl, 100, false);
    fromEl.classList.remove('active');
    setTx(toEl, 0, false);
    toEl.classList.add('active');
    void toEl.offsetWidth;
    toEl.style.transition = '';
    navHistory = [id];
  } else {
    setTx(toEl, 100, false);
    toEl.classList.add('active');
    void toEl.offsetWidth;
    setTx(toEl, 0, true);
    setTx(fromEl, -28, true);

    setTimeout(() => {
      fromEl.classList.remove('active');
      fromEl.style.transform = '';
      fromEl.style.transition = '';
      toEl.style.transition = '';
    }, DUR + 20);
    navHistory.push(id);
  }

  onEnterScreen(id);
  _updateDotsFn();
}

export function back() {
  if (navHistory.length < 2) return;
  const current = navHistory.pop();
  const prev = navHistory[navHistory.length - 1];
  const fromEl = document.getElementById(current);
  const toEl = document.getElementById(prev);

  setTx(toEl, -28, false);
  toEl.classList.add('active');
  void toEl.offsetWidth;
  setTx(toEl, 0, true);
  setTx(fromEl, 100, true);

  setTimeout(() => {
    fromEl.classList.remove('active');
    fromEl.style.transform = '';
    fromEl.style.transition = '';
    toEl.style.transition = '';
    onEnterScreen(prev);
  }, DUR + 20);

  _updateDotsFn();
}

Object.assign(window, { go, back });
