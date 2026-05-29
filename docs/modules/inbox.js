import { getAllNotifications, getUnreadCount, markAllRead, clearAll } from './inboxStore.js';
import { esc } from './utils.js';

function _fmtTs(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) +
    ' · ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export async function updateInboxBadge() {
  const badge = document.getElementById('inboxBadge');
  if (!badge) return;
  try {
    const count = await getUnreadCount();
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : String(count);
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  } catch {
    badge.style.display = 'none';
  }
}

export async function renderInbox() {
  const container = document.getElementById('inboxList');
  const empty     = document.getElementById('inboxEmpty');
  if (!container) return;

  try {
    const items = await getAllNotifications();
    if (!items.length) {
      container.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    container.innerHTML = items.map(n => `
      <div class="inbox-item">
        <div class="inbox-item-title">${esc(n.title)}</div>
        <div class="inbox-item-body">${esc(n.body)}</div>
        <div class="inbox-item-time">${esc(_fmtTs(n.ts))}</div>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '';
    if (empty) empty.style.display = 'block';
  }
}

export async function enterInbox() {
  await renderInbox();
  await markAllRead();
  await updateInboxBadge();
}

export async function clearInboxHistory() {
  if (!confirm('Очистить всю историю уведомлений?')) return;
  await clearAll();
  await renderInbox();
  await updateInboxBadge();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'PUSH_RECEIVED') {
      updateInboxBadge();
      const inboxScreen = document.getElementById('s-inbox');
      if (inboxScreen && inboxScreen.classList.contains('active')) {
        renderInbox().then(() => markAllRead()).then(() => updateInboxBadge());
      }
    }
  });
}

Object.assign(window, { updateInboxBadge, renderInbox, enterInbox, clearInboxHistory });
