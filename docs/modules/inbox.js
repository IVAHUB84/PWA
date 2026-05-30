import { getAllNotifications, getUnreadCount, markAllRead, clearAll, deleteNotification, setRead } from './inboxStore.js';
import { esc } from './utils.js';
import { routeToTarget } from './inboxTarget.js';

let _items = [];

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
      badge.classList.add('inbox-badge--pulse');
    } else {
      badge.classList.remove('inbox-badge--pulse');
      badge.style.display = 'none';
    }
  } catch {
    badge.classList.remove('inbox-badge--pulse');
    badge.style.display = 'none';
  }
}

export async function renderInbox() {
  const container = document.getElementById('inboxList');
  const empty     = document.getElementById('inboxEmpty');
  const markAllBtn = document.getElementById('inboxMarkAllBtn');
  if (!container) return;

  try {
    _items = await getAllNotifications();
    const hasUnread = _items.some(n => !n.read);
    if (markAllBtn) {
      markAllBtn.disabled = !_items.length || !hasUnread;
      markAllBtn.style.visibility = (!_items.length || !hasUnread) ? 'hidden' : 'visible';
    }
    if (!_items.length) {
      container.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    container.innerHTML = _items.map((n, i) => `
      <div class="inbox-item${n.read ? '' : ' inbox-item--unread'}" onclick="inboxItemClick(event, ${i})">
        <button class="inbox-dots" onclick="inboxToggleMenu(event, ${i})" aria-label="Действия">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
        </button>
        <div class="inbox-menu" id="inboxMenu-${i}" onclick="event.stopPropagation()">
          <button onclick="inboxMarkUnreadAt(${i})">Сделать непрочитанным</button>
          <button class="inbox-menu-danger" onclick="inboxDeleteAt(${i})">Удалить</button>
        </div>
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

function _closeMenus() {
  document.querySelectorAll('.inbox-item.menu-open').forEach(it => it.classList.remove('menu-open'));
}

export function inboxToggleMenu(event, idx) {
  event.stopPropagation();
  const menu = document.getElementById('inboxMenu-' + idx);
  if (!menu) return;
  const item = menu.closest('.inbox-item');
  const willOpen = !item.classList.contains('menu-open');
  _closeMenus();
  if (willOpen) item.classList.add('menu-open');
}

export async function inboxDeleteAt(idx) {
  const item = _items[idx];
  if (!item) return;
  await deleteNotification(item.id);
  await renderInbox();
  await updateInboxBadge();
}

export async function inboxMarkUnreadAt(idx) {
  const item = _items[idx];
  if (!item) return;
  await setRead(item.id, false);
  await renderInbox();
  await updateInboxBadge();
}

export async function inboxItemClick(event, idx) {
  const item = _items[idx];
  if (!item) return;
  await setRead(item.id, true);
  item.read = true;
  routeToTarget(item.target);
  await updateInboxBadge();
  const el = document.querySelectorAll('.inbox-item')[idx];
  if (el) el.classList.remove('inbox-item--unread');
  const markAllBtn = document.getElementById('inboxMarkAllBtn');
  if (markAllBtn) {
    const hasUnread = _items.some(n => !n.read);
    markAllBtn.disabled = !hasUnread;
    markAllBtn.style.visibility = hasUnread ? 'visible' : 'hidden';
  }
}

document.addEventListener('click', _closeMenus);

export async function enterInbox() {
  await renderInbox();
  await updateInboxBadge();
}

export async function inboxMarkAllRead() {
  await markAllRead();
  await renderInbox();
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
        enterInbox();
      }
    }
  });
}

Object.assign(window, { updateInboxBadge, renderInbox, enterInbox, clearInboxHistory, inboxToggleMenu, inboxDeleteAt, inboxMarkUnreadAt, inboxItemClick, inboxMarkAllRead });
