import { go } from './navigation.js';

const CONSENT_INFO = {
  notify:  { icon: '🔔', title: 'Отключить уведомления о записях?',       text: 'Вы перестанете получать напоминания о предстоящих визитах, уведомления об отмене и переносе записей. Важную информацию придётся проверять вручную.' },
  promo:   { icon: '🎁', title: 'Отключить акции и предложения?',          text: 'Вы не будете получать персональные скидки, новости студии и спецпредложения. Их можно будет посмотреть только в разделе «Лента».' },
  photo:   { icon: '📸', title: 'Отозвать согласие на фото и видео?',      text: 'Студия прекратит использовать новые материалы с вашим участием. Уже опубликованные фото и видео могут остаться — используйте кнопку «Запросить удаление» для их удаления.' },
  reviews: { icon: '💬', title: 'Отозвать согласие на публикацию отзывов?', text: 'Студия не сможет публиковать ваши новые отзывы. Ранее опубликованные отзывы останутся на сайте и в соцсетях.' },
};

let _pendingToggle = null;
let _pendingType = null;

export function acceptConsent() {
  if ('Notification' in window) {
    Notification.requestPermission().catch(() => {});
  }
  go('s-home', 'tab');
}

export function consentToggle(el, type) {
  if (!el.classList.contains('on')) {
    el.classList.add('on');
    if (type === 'photo') {
      const btn = document.getElementById('photoDeleteBtn');
      if (btn) btn.style.display = 'none';
    }
    return;
  }
  // Prevent overwrite if modal is already open for another toggle
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

function closeConsentModal() {
  const modal = document.getElementById('consentModal');
  if (modal) modal.style.display = 'none';
  _pendingToggle = null;
  _pendingType = null;
}

export function confirmConsentOff() {
  if (_pendingToggle) {
    _pendingToggle.classList.remove('on');
    if (_pendingType === 'photo') {
      const btn = document.getElementById('photoDeleteBtn');
      if (btn) btn.style.display = 'block';
    }
  }
  closeConsentModal();
}

export function showDeleteRequest() {
  const modal = document.getElementById('deleteModal');
  if (modal) modal.style.display = 'flex';
}

function closeDeleteModal() {
  const modal = document.getElementById('deleteModal');
  if (modal) modal.style.display = 'none';
}

export function confirmDeleteRequest() {
  closeDeleteModal();
  const btn = document.getElementById('photoDeleteBtn');
  if (btn) btn.innerHTML = '<span style="font-size:13px;color:var(--text-2);padding:0;">Запрос на удаление отправлен ✓</span>';
  const toast = document.getElementById('deleteToast');
  if (toast) {
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
  }
}

export function toggleConsent(row) {
  const check = row.querySelector('.consent-check');
  if (!check) return;
  check.classList.toggle('on');
  check.textContent = check.classList.contains('on') ? '✓' : '';
}

Object.assign(window, {
  acceptConsent, consentToggle, confirmConsentOff, showDeleteRequest, confirmDeleteRequest, toggleConsent,
  closeConsentModal, closeDeleteModal,
});
