import { esc } from './utils.js';
import { getDuration, selectActive } from './uiQueue.js';
import { _telHref } from './studio.js';

const _HOST_ID = 'uiToastHost';
const _BANNER_ID = 'uiOfflineBanner';
const _SHEET_HOST_ID = 'uiSheetHost';

let _currentToastTimer = null;
let _offlineMode = null;

const _sheetStack = [];

function _focusableInSheet(sheet) {
  return Array.from(sheet.querySelectorAll(
    'button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
  )).filter(el => !el.disabled);
}

function _mountSheet(overlay, { onClose, returnFocusTo }) {
  const sheet = overlay.querySelector('.ui-sheet');

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'Tab' && sheet) {
      const focusable = _focusableInSheet(sheet);
      if (focusable.length === 0) { e.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
  }

  document.addEventListener('keydown', onKeyDown);
  _sheetStack.push({ overlay, onClose, returnFocusTo, onKeyDown });

  const focusable = sheet ? _focusableInSheet(sheet) : [];
  if (focusable.length > 0) focusable[0].focus();
}

function _dismissSheet(overlay) {
  const idx = _sheetStack.findIndex(s => s.overlay === overlay);
  if (idx === -1) return;
  const { onKeyDown, returnFocusTo } = _sheetStack[idx];
  _sheetStack.splice(idx, 1);
  document.removeEventListener('keydown', onKeyDown);
  try { returnFocusTo?.focus(); } catch {}
}

function _toastHost() {
  let el = document.getElementById(_HOST_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = _HOST_ID;
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    document.getElementById('phone')?.appendChild(el) ?? document.body.appendChild(el);
  }
  return el;
}

function _sheetHost() {
  let el = document.getElementById(_SHEET_HOST_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = _SHEET_HOST_ID;
    document.getElementById('phone')?.appendChild(el) ?? document.body.appendChild(el);
  }
  return el;
}

export function toast(message, type = 'info', opts = {}) {
  const incoming = { type, duration: opts.duration };
  const active = selectActive(incoming);
  const host = _toastHost();

  if (_currentToastTimer !== null) {
    clearTimeout(_currentToastTimer);
    _currentToastTimer = null;
  }

  host.innerHTML = `<div class="ui-toast ui-toast--${esc(active.type)}" role="status">${esc(message)}</div>`;

  const duration = getDuration(active.type, active.duration);
  _currentToastTimer = setTimeout(() => {
    host.innerHTML = '';
    _currentToastTimer = null;
  }, duration);
}

export function confirmSheet({ title, message, confirmText, cancelText = 'Отмена', danger = false }) {
  return new Promise(resolve => {
    const returnFocusTo = document.activeElement?.focus ? document.activeElement : null;
    const overlay = document.createElement('div');
    overlay.className = 'ui-sheet-overlay';

    const dangerClass = danger ? ' ui-sheet__confirm-btn--danger' : '';
    overlay.innerHTML = `
      <div class="ui-sheet" role="dialog" aria-modal="true">
        <div class="ui-sheet__handle"></div>
        <div class="ui-sheet__title">${esc(title)}</div>
        ${message ? `<div class="ui-sheet__message">${esc(message)}</div>` : ''}
        <div class="ui-sheet__actions">
          <button class="ui-sheet__confirm-btn${dangerClass}" id="_uiSheetConfirm">${esc(confirmText)}</button>
          <button class="ui-sheet__cancel-btn" id="_uiSheetCancel">${esc(cancelText)}</button>
        </div>
      </div>`;

    function close(result) {
      _dismissSheet(overlay);
      overlay.remove();
      resolve(result);
    }

    overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
    overlay.querySelector('#_uiSheetConfirm').addEventListener('click', () => close(true));
    overlay.querySelector('#_uiSheetCancel').addEventListener('click', () => close(false));

    _sheetHost().appendChild(overlay);
    _mountSheet(overlay, { onClose: () => close(false), returnFocusTo });
  });
}

export function errorSheet({ title, message, onRetry, phone }) {
  const returnFocusTo = document.activeElement?.focus ? document.activeElement : null;
  const overlay = document.createElement('div');
  overlay.className = 'ui-sheet-overlay';

  const phoneBtn = phone
    ? `<a class="ui-sheet__call-btn" href="${esc(_telHref(phone))}">Позвонить в студию</a>`
    : '';

  overlay.innerHTML = `
    <div class="ui-sheet" role="dialog" aria-modal="true">
      <div class="ui-sheet__handle"></div>
      <div class="ui-sheet__title">${esc(title)}</div>
      ${message ? `<div class="ui-sheet__message">${esc(message)}</div>` : ''}
      <div class="ui-sheet__actions">
        <button class="ui-sheet__confirm-btn" id="_uiSheetRetry">Повторить</button>
        ${phoneBtn}
        <button class="ui-sheet__cancel-btn" id="_uiSheetClose">Закрыть</button>
      </div>
    </div>`;

  function close() {
    _dismissSheet(overlay);
    overlay.remove();
  }

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#_uiSheetRetry').addEventListener('click', () => {
    close();
    onRetry();
  });
  overlay.querySelector('#_uiSheetClose').addEventListener('click', close);

  _sheetHost().appendChild(overlay);
  _mountSheet(overlay, { onClose: close, returnFocusTo });
}

export function setOfflineBanner(mode) {
  _offlineMode = mode;
  const banner = document.getElementById(_BANNER_ID);
  if (!banner) return;

  if (mode === 'offline') {
    banner.textContent = 'Нет соединения';
    banner.className = 'ui-offline-banner ui-offline-banner--offline';
    banner.style.display = 'block';
  } else if (mode === 'stale') {
    banner.textContent = 'Данные могли устареть';
    banner.className = 'ui-offline-banner ui-offline-banner--stale';
    banner.style.display = 'block';
  } else {
    banner.style.display = 'none';
    banner.className = 'ui-offline-banner';
  }
}

export function _getOfflineMode() {
  return _offlineMode;
}

Object.assign(window, { toast, confirmSheet, errorSheet, setOfflineBanner });
