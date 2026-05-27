import { YC } from './api.js';
import { go } from './navigation.js';
import { esc } from './utils.js';
import { PUSH_TEMPLATES } from './constants.js';
import { _ghPullToLocal, _ghSyncPosts } from './github.js';
import { _sendNotification } from './notifications.js';

function _ls(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

let _postImageBase64 = null;
let _adminAllClients = [];
let _pushAudienceData = [];
let _publishInProgress = false;
let _pushSentCollapsed = false;

export function _onPostImagePicked(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const tmpImg = new Image();
    tmpImg.onload = function() {
      const MAX = 800;
      let w = tmpImg.width, h = tmpImg.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(tmpImg, 0, 0, w, h);
      _postImageBase64 = canvas.toDataURL('image/jpeg', 0.75);
      const img = document.getElementById('postUploadImg');
      const ph  = document.getElementById('postUploadPlaceholder');
      const clr = document.getElementById('postUploadClear');
      if (img) { img.src = _postImageBase64; img.style.display = 'block'; }
      if (ph)  ph.style.display = 'none';
      if (clr) clr.style.display = 'block';
    };
    tmpImg.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

export function _clearPostImage() {
  _postImageBase64 = null;
  const input = document.getElementById('postImageInput');
  const img   = document.getElementById('postUploadImg');
  const ph    = document.getElementById('postUploadPlaceholder');
  const clr   = document.getElementById('postUploadClear');
  if (input) input.value = '';
  if (img)  { img.src = ''; img.style.display = 'none'; }
  if (ph)   ph.style.display = 'flex';
  if (clr)  clr.style.display = 'none';
}

export async function renderAdminDashboard() {
  const bookingList = document.getElementById('adminBookingList');
  const statCount   = document.getElementById('adminStatCount');
  const statRevenue = document.getElementById('adminStatRevenue');
  const dateEl      = document.getElementById('adminTodayDate');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  if (bookingList) bookingList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-2);">Загрузка…</div>';
  const today = new Date().toISOString().slice(0, 10);
  const r = await YC.get(`/records/${YC.company}`, { start_date: today, end_date: today, count: 50 });
  if (!r.success || !r.data) {
    if (bookingList) bookingList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-2);">Нет данных</div>';
    return;
  }
  const recs = r.data.filter(x => !x.deleted);
  if (statCount) statCount.textContent = recs.length;
  const rev = recs.reduce((s, x) => s + (x.services || []).reduce((a, sv) => a + (sv.cost || 0), 0), 0);
  if (statRevenue) statRevenue.textContent = rev ? rev.toLocaleString('ru-RU') + ' ₽' : '—';
  const clientStatEl = document.getElementById('adminStatClients');
  if (clientStatEl) {
    const uniqueClients = new Set(recs.map(x => x.client && x.client.id).filter(Boolean));
    clientStatEl.textContent = uniqueClients.size || '—';
  }
  const _GRADS2 = ['linear-gradient(135deg,#F4C2A1,#E8956C)', 'linear-gradient(135deg,#A8D8EA,#7EC8E3)', 'linear-gradient(135deg,#C8E6C9,#81C784)', 'linear-gradient(135deg,#F8BBD0,#F48FB1)'];
  if (bookingList) {
    if (!recs.length) {
      bookingList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-2);">Записей на сегодня нет</div>';
      return;
    }
    bookingList.innerHTML = recs.map((rec, i) => {
      const svc = rec.services && rec.services[0];
      const dt = (rec.date || '').slice(11, 16);
      const client = rec.client || {};
      const staff = rec.staff || {};
      const name = client.name || 'Клиент';
      const initials = name.trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
      const price = svc && svc.cost ? svc.cost.toLocaleString('ru-RU') + ' ₽' : '—';
      const grad = _GRADS2[i % _GRADS2.length];
      const borderStyle = i === recs.length - 1 ? 'border-bottom:none;' : '';
      return `<div class="booking-row" style="${borderStyle}"><div class="booking-time">${esc(dt)}</div><div class="booking-av" style="background:${grad};">${esc(initials)}</div><div class="booking-info"><div class="booking-name">${esc(name)}</div><div class="booking-svc">${esc(svc ? svc.title : '—')} · ${esc(staff.name || '—')}</div></div><div class="booking-price">${esc(price)}</div></div>`;
    }).join('');
  }
}

export async function publishPost(draft) {
  if (_publishInProgress) return;
  const cat = document.querySelector('#s-admin-post .hscroll .chip.active');
  const ta  = document.querySelector('#s-admin-post .admin-textarea');
  const text = ta ? ta.value.trim() : '';
  if (!text) { alert('Добавьте текст публикации'); return; }
  _publishInProgress = true;
  const catName = cat ? cat.textContent.trim() : 'Другое';
  const post = {
    id: Date.now(), cat: catName, text,
    image: _postImageBase64 || null,
    date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
    draft: !!draft,
  };
  try {
    await _ghPullToLocal();
    const posts = _ls('yc_feed_posts');
    posts.unshift(post);
    localStorage.setItem('yc_feed_posts', JSON.stringify(posts));
    if (ta) ta.value = '';
    _clearPostImage();
    go('s-admin-feed', 'tab');
    if (!draft) {
      const published = posts.filter(p => !p.draft);
      _ghSyncPosts(published);
    }
  } catch(e) {
    console.error('publishPost failed', e);
    alert('Не удалось опубликовать. Попробуйте снова.');
  } finally {
    _publishInProgress = false;
  }
}

export async function deletePost(id) {
  await _ghPullToLocal();
  const posts = _ls('yc_feed_posts').filter(p => String(p.id) !== String(id));
  localStorage.setItem('yc_feed_posts', JSON.stringify(posts));
  renderAdminFeed();
  _ghSyncPosts(posts.filter(p => !p.draft));
}

export function renderAdminFeed() {
  _renderAdminFeedFromCache();
  _ghPullToLocal().then(updated => { if (updated) _renderAdminFeedFromCache(); });
}

function _renderAdminFeedFromCache() {
  const posts = _ls('yc_feed_posts');
  const countEl = document.getElementById('adminFeedCount');
  const listEl  = document.getElementById('adminFeedList');
  const pub = posts.filter(p => !p.draft).length;
  if (countEl) countEl.textContent = pub + ' публикаци' + (pub === 1 ? 'я' : pub < 5 ? 'и' : 'й');
  if (!listEl) return;
  if (!posts.length) {
    listEl.innerHTML = '<div style="padding:40px 20px;text-align:center;color:rgba(255,255,255,0.4);font-size:14px;">Публикаций пока нет.<br>Нажмите «+ Новый» чтобы создать.</div>';
    return;
  }
  const _CAT_ICONS = { 'Брови': '✨', 'Ногти': '💅', 'Лицо': '🌿', 'Волосы': '💆', 'Тело': '🧖', 'Акции': '🎁' };
  listEl.innerHTML = posts.map((p, i) => {
    const icon = _CAT_ICONS[p.cat] || '📝';
    const last = i === posts.length - 1 ? 'border-bottom:none;' : '';
    const safeImg = p.image && /^data:image\//.test(p.image) ? p.image : null;
    const thumb = safeImg
      ? `<img src="${esc(safeImg)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`
      : icon;
    return `<div class="post-row" style="${last}">
      <div class="post-thumb" style="background:var(--surface);font-size:22px;overflow:hidden;">${thumb}</div>
      <div class="post-info"><div class="post-cap">${esc(p.text.slice(0, 60))}</div><div class="post-date">${esc(p.date)} · ${esc(p.cat)}</div></div>
      <span class="post-status ${p.draft ? 'draft' : 'pub'}">${p.draft ? 'Черновик' : 'Опубл.'}</span>
      <button data-pid="${p.id}" onclick="deletePost(+this.dataset.pid)" style="background:none;border:none;color:var(--text-2);font-size:16px;cursor:pointer;padding:4px;flex-shrink:0;">✕</button>
    </div>`;
  }).join('') + '<div style="height:20px;"></div>';
}

export async function renderAdminClients() {
  const listEl  = document.getElementById('adminClientsList');
  const countEl = document.getElementById('adminClientsCount');
  if (listEl) listEl.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--text-2);font-size:14px;">Загрузка…</div>';
  const r = await YC.get(`/records/${YC.company}`, { count: 200 });
  if (!r.success || !r.data) {
    if (listEl) listEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-2);">Не удалось загрузить</div>';
    return;
  }
  const seen = new Map();
  r.data.forEach(rec => {
    const c = rec.client;
    if (!c || !c.id) return;
    if (!seen.has(c.id)) seen.set(c.id, { id: c.id, name: c.name || '—', phone: c.phone || '', visits: 0 });
    seen.get(c.id).visits++;
  });
  _adminAllClients = [...seen.values()].sort((a, b) => b.visits - a.visits);
  if (countEl) countEl.textContent = _adminAllClients.length + ' клиентов';
  _renderClientRows(_adminAllClients);
}

function _renderClientRows(clients) {
  const listEl = document.getElementById('adminClientsList');
  if (!listEl) return;
  if (!clients.length) {
    listEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-2);">Ничего не найдено</div>';
    return;
  }
  const _GRADS = ['linear-gradient(135deg,#F4C2A1,#E8956C)', 'linear-gradient(135deg,#A8D8EA,#7EC8E3)', 'linear-gradient(135deg,#C8E6C9,#81C784)', 'linear-gradient(135deg,#F8BBD0,#F48FB1)', 'linear-gradient(135deg,#D1C4E9,#9575CD)'];
  listEl.innerHTML = clients.map((c, i) => {
    const initials = c.name.trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || '?';
    const grad = _GRADS[i % _GRADS.length];
    const visits = c.visits + ' визит' + (c.visits === 1 ? '' : c.visits < 5 ? 'а' : 'ов');
    const border = i === clients.length - 1 ? 'border-bottom:none;' : '';
    return `<div class="client-row" style="${border}">
      <div class="client-av" style="background:${grad};">${esc(initials)}</div>
      <div class="client-info">
        <div class="client-name">${esc(c.name)}</div>
        <div class="client-phone">${esc(c.phone)}</div>
      </div>
      <div style="font-size:12px;color:var(--text-2);white-space:nowrap;">${esc(visits)}</div>
    </div>`;
  }).join('');
}

export function filterAdminClients(q) {
  if (!_adminAllClients.length) return;
  const lq = q.toLowerCase();
  const filtered = q ? _adminAllClients.filter(c =>
    (c.name || '').toLowerCase().includes(lq) || (c.phone || '').includes(lq)
  ) : _adminAllClients;
  _renderClientRows(filtered);
}

export function renderAdminPush() {
  const listEl = document.getElementById('adminPushList');
  if (!listEl) return;
  const campaigns = _ls('yc_push_campaigns');
  if (!campaigns.length) {
    listEl.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--text-2);font-size:14px;">Рассылок пока нет.<br>Нажмите «+ Новая» чтобы создать.</div>';
    return;
  }
  const sched = campaigns.filter(c => c.scheduled);
  const sent  = campaigns.filter(c => !c.scheduled).sort((a, b) => b.id - a.id);
  let html = '';
  if (sched.length) {
    html += `<div class="section-header" style="padding-top:14px;"><span class="section-title">Запланированные</span><span style="font-size:12px;color:var(--green);font-weight:700;">${sched.length} активных</span></div>`;
    html += sched.map(c => `<div class="push-hist-row">
      <div class="push-hist-icon sched">⏰</div>
      <div class="push-hist-info"><div class="push-hist-name">${esc(c.title)}</div><div class="push-hist-meta">${esc(c.date)} · ${esc(c.audience)}</div></div>
      <button data-cid="${c.id}" onclick="deletePushCampaign(+this.dataset.cid)" style="background:var(--surface);border:none;border-radius:8px;font-size:12px;font-weight:700;padding:6px 10px;cursor:pointer;color:var(--red);font-family:inherit;flex-shrink:0;">Удал.</button>
    </div>`).join('');
  }
  if (sent.length) {
    const arrow = _pushSentCollapsed ? '›' : '⌄';
    html += `<div class="section-header" style="padding-top:20px;">
      <span class="section-title" style="cursor:pointer;user-select:none;" onclick="_togglePushSentCollapsed()">Отправлено ${sent.length} ${arrow}</span>
      <button onclick="clearAllSentPush()" style="background:none;border:none;color:var(--red);font-size:12px;font-weight:700;cursor:pointer;padding:0;">Очистить всё</button>
    </div>`;
    if (!_pushSentCollapsed) {
      html += sent.map((c, i) => {
        const timeStr = c.time ? ` · ${esc(c.time)}` : '';
        return `<div class="push-hist-row" style="${i === sent.length - 1 ? 'border-bottom:none;' : ''}">
          <div class="push-hist-icon">${esc(c.icon)}</div>
          <div class="push-hist-info"><div class="push-hist-name">${esc(c.title)}</div><div class="push-hist-meta">${esc(c.date)}${timeStr} · ${esc(c.audience)}</div></div>
          <button data-cid="${c.id}" onclick="deletePushCampaign(+this.dataset.cid)" style="background:none;border:none;color:var(--text-2);font-size:13px;cursor:pointer;padding:4px 6px;flex-shrink:0;">✕</button>
        </div>`;
      }).join('');
    }
  }
  listEl.innerHTML = html;
}

export function deletePushCampaign(id) {
  const campaigns = _ls('yc_push_campaigns').filter(c => c.id !== id);
  localStorage.setItem('yc_push_campaigns', JSON.stringify(campaigns));
  renderAdminPush();
}

export function clearAllSentPush() {
  const campaigns = _ls('yc_push_campaigns').filter(c => c.scheduled);
  localStorage.setItem('yc_push_campaigns', JSON.stringify(campaigns));
  renderAdminPush();
}

export function selectAudience(id) {
  ['aud1', 'aud2', 'aud3'].forEach(aid => {
    const row = document.getElementById(aid);
    const chk = document.getElementById(aid + '-chk');
    if (!row || !chk) return;
    const sel = aid === id;
    row.classList.toggle('sel', sel);
    chk.classList.toggle('on', sel);
    chk.textContent = sel ? '✓' : '';
  });
}

export function selectNewAudience(id) {
  ['naud1', 'naud2', 'naud3'].forEach(aid => {
    const row = document.getElementById(aid);
    const chk = document.getElementById(aid + '-chk');
    if (!row || !chk) return;
    const sel = aid === id;
    row.classList.toggle('sel', sel);
    chk.classList.toggle('on', sel);
    chk.textContent = sel ? '✓' : '';
  });
}

function _togglePushSentCollapsed() {
  _pushSentCollapsed = !_pushSentCollapsed;
  renderAdminPush();
}

export function pushTplChip(el, key) {
  el.closest('.hscroll').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const tpl = PUSH_TEMPLATES[key];
  if (!tpl) return;
  const ta = document.getElementById('pushNewText');
  if (ta) { ta.value = tpl.text; ta.placeholder = key === 'custom' ? 'Введите свой текст…' : ''; }
  const icon = document.getElementById('pushNewIcon');
  const ttl  = document.getElementById('pushNewTitle');
  const prev = document.getElementById('pushNewPreview');
  if (icon) icon.textContent = tpl.icon;
  if (ttl)  ttl.textContent  = tpl.title;
  if (prev) prev.textContent  = tpl.text || '…';
}

export function pushPreviewUpdate(val) {
  const prev = document.getElementById('pushNewPreview');
  if (prev) prev.textContent = val || '…';
}

export function pushSchedToggle(mode) {
  document.getElementById('segNow').classList.toggle('active', mode === 'now');
  document.getElementById('segLater').classList.toggle('active', mode === 'later');
  const row = document.getElementById('schedTimeRow');
  if (row) row.style.display = mode === 'later' ? 'block' : 'none';
  const btn = document.getElementById('pushNewSendBtn');
  if (btn) btn.textContent = mode === 'later' ? 'Запланировать' : 'Отправить сейчас';
}

export async function updatePushAudience() {
  const n1 = document.getElementById('naud1-count');
  const n2 = document.getElementById('naud2-count');
  const n3 = document.getElementById('naud3-count');
  if (!n1) return;
  if (_pushAudienceData.length) {
    _setPushCounts(n1, n2, n3);
    return;
  }
  const r = await YC.get(`/records/${YC.company}`, { count: 200 });
  if (r.success && r.data) {
    const seen = new Map();
    r.data.forEach(rec => {
      const c = rec.client; if (!c || !c.id) return;
      if (!seen.has(c.id)) seen.set(c.id, { visits: 0, lastDate: null });
      const entry = seen.get(c.id);
      entry.visits++;
      const d = new Date(rec.date || '');
      if (!entry.lastDate || d > entry.lastDate) entry.lastDate = d;
    });
    _pushAudienceData = [...seen.entries()].map(([id, v]) => ({ id, ...v }));
  }
  _setPushCounts(n1, n2, n3);
}

function _setPushCounts(n1, n2, n3) {
  const total = _pushAudienceData.length;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
  const active = _pushAudienceData.filter(c => c.lastDate && new Date(c.lastDate) >= cutoff).length;
  if (n1) n1.textContent = total ? total + ' получателей' : 'Нет данных';
  if (n2) n2.textContent = active ? active + ' получателей' : 'Нет данных';
  if (n3) {
    const booked = _ls('yc_records')
      .filter(r => r.status !== 'cancelled' && r.datetime && new Date(r.datetime.replace(' ', 'T')) > new Date()).length;
    n3.textContent = booked ? booked + ' клиентов' : 'Нет предстоящих записей';
  }
}

export function sendNewPush() {
  const isScheduled = document.getElementById('segLater')?.classList.contains('active');
  const text  = document.getElementById('pushNewText')?.value.trim() || '';
  const icon  = document.getElementById('pushNewIcon')?.textContent || '📅';
  if (!text) { alert('Введите текст уведомления'); return; }
  const audEl = document.querySelector('#s-admin-push-new .audience-row.sel [style*="font-weight:700"]');
  const audience = audEl?.textContent || 'Все клиенты';
  const campaigns = _ls('yc_push_campaigns');
  campaigns.unshift({
    id: Date.now(), icon, title: text.slice(0, 50),
    date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
    time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    audience, scheduled: isScheduled,
  });
  localStorage.setItem('yc_push_campaigns', JSON.stringify(campaigns));

  const screen = document.getElementById('s-admin-push-new');
  if (isScheduled) {
    _showAdminToast(screen, 'Рассылка запланирована ✓');
    setTimeout(() => go('s-admin-push', 'tab'), 1800);
  } else {
    _sendNotification('Реснички, сестрички', text).then(ok => {
      _showAdminToast(screen, ok ? 'Уведомление отправлено ✓' : 'Сохранено (уведомления отключены)');
      setTimeout(() => go('s-admin-push', 'tab'), 2000);
    });
  }
}

export function sendPush() {
  const toast = document.createElement('div');
  toast.textContent = 'Рассылка отправлена ✓';
  toast.style.cssText = 'position:absolute;bottom:calc(83px + 16px);left:20px;right:20px;background:var(--primary);color:#fff;border-radius:12px;padding:14px 18px;font-size:14px;font-weight:700;text-align:center;z-index:300;';
  document.getElementById('s-admin-push').appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function _showAdminToast(screen, msg) {
  if (!screen) return;
  const existing = screen.querySelector('._admin-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = '_admin-toast';
  toast.textContent = msg;
  toast.style.cssText = 'position:absolute;bottom:80px;left:20px;right:20px;background:var(--primary);color:#fff;border-radius:12px;padding:14px 18px;font-size:14px;font-weight:700;text-align:center;z-index:300;';
  screen.appendChild(toast);
}

Object.assign(window, {
  renderAdminDashboard, renderAdminFeed, publishPost, deletePost,
  renderAdminClients, filterAdminClients,
  renderAdminPush, deletePushCampaign, clearAllSentPush,
  selectAudience, selectNewAudience,
  pushTplChip, pushPreviewUpdate, pushSchedToggle,
  updatePushAudience, sendNewPush, sendPush,
  _onPostImagePicked, _clearPostImage, _togglePushSentCollapsed,
});
