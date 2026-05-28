import { go } from './navigation.js';
import { getSession } from './storage.js';
import { savePreferences } from './push.js';

const CONSENT_INFO = {
  notify:  { icon: '🔔', title: 'Отключить напоминания о визитах?',    text: 'Вы перестанете получать напоминания о предстоящих визитах, уведомления об отмене и переносе записей. Важную информацию придётся проверять вручную.' },
  promo:   { icon: '🔕', title: 'Отключить push-уведомления?',          text: 'Вы не будете получать уведомления от студии: новости, акции и спецпредложения. Их можно будет посмотреть только в разделе «Лента».' },
};

let _pendingToggle = null;
let _pendingType = null;

export function acceptConsent() {
  localStorage.setItem('yc_consent_accepted', '1');
  if ('Notification' in window) {
    Notification.requestPermission().catch(() => {});
  }
  go('s-home', 'tab');
}

export function consentToggle(el, type) {
  // Push-тумблеры профиля: promo и notify/remind
  if (type === 'promo' || type === 'notify') {
    _handlePushToggle(el, type);
    return;
  }
  // Остальные типы (onboarding и будущие)
  if (!el.classList.contains('on')) {
    el.classList.add('on');
    return;
  }
  if (_pendingToggle) return;
  const info = CONSENT_INFO[type];
  if (!info) return;
  const modal = document.getElementById('consentModal');
  if (!modal) return;
  _pendingToggle = el;
  _pendingType = type;
  const iconEl = document.getElementById('consentModalIcon');
  const titleEl = document.getElementById('consentModalTitle');
  const textEl = document.getElementById('consentModalText');
  if (iconEl) iconEl.textContent = info.icon;
  if (titleEl) titleEl.textContent = info.title;
  if (textEl) textEl.textContent = info.text;
  modal.style.display = 'flex';
  requestAnimationFrame(() => { modal.style.opacity = '1'; });
}

function _handlePushToggle(el, type) {
  if (el.classList.contains('disabled')) return;
  const isOn = el.classList.contains('on');
  const newValue = !isOn;

  if (!newValue) {
    // Выключение — показать подтверждающую модалку
    if (_pendingToggle) return;
    const info = CONSENT_INFO[type];
    if (!info) { _applyPushToggle(el, type, newValue); return; }
    const modal = document.getElementById('consentModal');
    if (!modal) { _applyPushToggle(el, type, newValue); return; }
    _pendingToggle = el;
    _pendingType = type;
    const iconEl = document.getElementById('consentModalIcon');
    const titleEl = document.getElementById('consentModalTitle');
    const textEl = document.getElementById('consentModalText');
    if (iconEl) iconEl.textContent = info.icon;
    if (titleEl) titleEl.textContent = info.title;
    if (textEl) textEl.textContent = info.text;
    modal.style.display = 'flex';
    requestAnimationFrame(() => { modal.style.opacity = '1'; });
  } else {
    // Включение — сразу применить без модалки
    _applyPushToggle(el, type, newValue);
  }
}

function _getNotifGroup() {
  return document.getElementById('notifSettingsGroup');
}

function _readBothToggleValues() {
  const group = _getNotifGroup();
  const promoEl  = group?.querySelector('.toggle[data-push-type="promo"]');
  const notifyEl = group?.querySelector('.toggle[data-push-type="notify"]');
  return {
    promo:  promoEl  ? promoEl.classList.contains('on')  : true,
    remind: notifyEl ? notifyEl.classList.contains('on') : true,
  };
}

async function _applyPushToggle(el, type, newValue) {
  if (newValue) {
    el.classList.add('on');
  } else {
    el.classList.remove('on');
  }

  const sess = getSession();
  if (!sess?.client_id) return;

  const { promo, remind } = _readBothToggleValues();
  const ok = await savePreferences(sess.client_id, { promo, remind });
  if (!ok) {
    // Откат визуального состояния при ошибке
    if (newValue) {
      el.classList.remove('on');
    } else {
      el.classList.add('on');
    }
  }
}

function closeConsentModal() {
  const modal = document.getElementById('consentModal');
  if (modal) modal.style.display = 'none';
  _pendingToggle = null;
  _pendingType = null;
}

export function confirmConsentOff() {
  if (_pendingToggle) {
    const el = _pendingToggle;
    const type = _pendingType;
    closeConsentModal();
    if (type === 'promo' || type === 'notify') {
      _applyPushToggle(el, type, false);
    } else {
      el.classList.remove('on');
    }
    return;
  }
  closeConsentModal();
}

export function toggleConsent(row) {
  const check = row.querySelector('.consent-check');
  if (!check) return;
  check.classList.toggle('on');
  check.textContent = check.classList.contains('on') ? '✓' : '';
}

Object.assign(window, {
  acceptConsent, consentToggle, confirmConsentOff, toggleConsent,
  closeConsentModal,
});
