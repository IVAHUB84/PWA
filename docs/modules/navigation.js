import { DUR, EASE } from './constants.js';
import { state } from './state.js';
import { prefersReducedMotion } from './utils.js';

export let navHistory = ['s-home'];

const _onEnterHandlers = {};
export function registerOnEnter(screenId, fn) {
  _onEnterHandlers[screenId] = fn;
}

let _updateDotsFn = () => {};
export function setUpdateDotsFn(fn) { _updateDotsFn = fn; }

let _onLeaveOtpFn = null;
export function setOnLeaveOtpFn(fn) { _onLeaveOtpFn = fn; }

// Pending animation timers — cancelled on any new navigation to avoid race conditions
let _animTimers = [];
function _clearAnimTimers() {
  _animTimers.forEach(clearTimeout);
  _animTimers = [];
}

export function setTx(el, x, animated) {
  if (!el) return;
  const shouldAnimate = animated && !prefersReducedMotion();
  const t = shouldAnimate ? `transform ${DUR}ms ${EASE}` : 'none';
  const v = x === 0 ? '' : `translateX(${x}%)`;
  el.style.webkitTransition = t;
  el.style.transition = t;
  el.style.webkitTransform = v;
  el.style.transform = v;
}

function _cleanEl(el) {
  if (!el) return;
  el.style.transform = '';
  el.style.transition = '';
  el.style.webkitTransform = '';
  el.style.webkitTransition = '';
}

function onEnterScreen(id) {
  const handler = _onEnterHandlers[id];
  if (handler) handler();
}

export function focusTargetSelector(screenEl) {
  if (!screenEl) return null;
  const heading = screenEl.querySelector('.page-title, .section-title');
  if (heading) return heading;
  return screenEl;
}

function _transferFocus(toEl) {
  const target = focusTargetSelector(toEl);
  if (!target) return;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  if (toEl.contains(document.activeElement)) return;
  target.focus({ preventScroll: true });
}

export function go(id, mode) {
  const current = navHistory[navHistory.length - 1];

  // Re-entering the same screen: just call onEnter (clear OTP timer first to avoid duplicates)
  if (current === id) {
    if (id === 's-otp' && _onLeaveOtpFn) _onLeaveOtpFn();
    onEnterScreen(id);
    return;
  }

  if (current === 's-otp' && id !== 's-otp' && _onLeaveOtpFn) {
    _onLeaveOtpFn();
  }

  const fromEl = document.getElementById(current);
  const toEl = document.getElementById(id);
  if (!toEl) return;

  _clearAnimTimers();

  if (mode === 'tab') {
    if (id !== 's-slots') state._rescheduleId = null;
    setTx(fromEl, 100, false);
    if (fromEl) fromEl.classList.remove('active');
    setTx(toEl, 0, false);
    toEl.classList.add('active');
    void toEl.offsetWidth;
    _cleanEl(toEl);
    navHistory = [id];
    onEnterScreen(id);
    _transferFocus(toEl);
  } else {
    setTx(toEl, 100, false);
    toEl.classList.add('active');
    void toEl.offsetWidth;
    setTx(toEl, 0, true);
    setTx(fromEl, -28, true);

    if (mode === 'replace') {
      navHistory[navHistory.length - 1] = id;
    } else {
      navHistory.push(id);
    }

    const targetId = id;
    const delay = prefersReducedMotion() ? 0 : DUR + 20;
    _animTimers.push(setTimeout(() => {
      if (navHistory[navHistory.length - 1] !== targetId) return;
      if (fromEl) fromEl.classList.remove('active');
      _cleanEl(fromEl);
      _cleanEl(toEl);
      onEnterScreen(targetId);
      _transferFocus(toEl);
    }, delay));
  }

  _updateDotsFn();
}

export function back() {
  if (navHistory.length < 2) return;
  const current = navHistory.pop();
  const prev = navHistory[navHistory.length - 1];
  const fromEl = document.getElementById(current);
  const toEl = document.getElementById(prev);

  if (!fromEl || !toEl) return;

  _clearAnimTimers();

  setTx(toEl, -28, false);
  toEl.classList.add('active');
  void toEl.offsetWidth;
  setTx(toEl, 0, true);
  setTx(fromEl, 100, true);

  const targetPrev = prev;
  const delay = prefersReducedMotion() ? 0 : DUR + 20;
  _animTimers.push(setTimeout(() => {
    if (navHistory[navHistory.length - 1] !== targetPrev) return;
    fromEl.classList.remove('active');
    _cleanEl(fromEl);
    _cleanEl(toEl);
    onEnterScreen(targetPrev);
    _transferFocus(toEl);
  }, delay));

  _updateDotsFn();
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('phone');
    if (!root) return;
    root.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const target = e.target.closest('[role="button"]');
      if (!target) return;
      if (e.key === ' ') e.preventDefault();
      target.click();
    });
  });
}

Object.assign(window, { go, back });
