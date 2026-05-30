import { YC } from './api.js';
import { go } from './navigation.js';
import { esc, hapticTap } from './utils.js';
import { PUSH_TEMPLATES } from './constants.js';
import { sendAdminPush, subscribePush, initPush } from './push.js';
import { _ghPullToLocal, _ghSyncPosts } from './github.js';
import { SERVICES_DATA } from './state.js';
import { _telHref } from './studio.js';

function _ls(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function _pluralVisits(n) {
  return n + ' визит' + (n === 1 ? '' : n < 5 ? 'а' : 'ов');
}

let _postImageBase64 = null;
let _adminAllClients = [];
let _adminLastRecs = [];
let _adminLastFilteredClients = [];
let _publishInProgress = false;
let _pushSentCollapsed = false;

function _openSheet(bodyHtml) {
  const existing = document.querySelector('[data-admin-sheet="1"]');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;display:flex;align-items:flex-end;';
  overlay.dataset.adminSheet = '1';
  overlay.innerHTML = `<div style="background:var(--bg);width:100%;border-radius:24px 24px 0 0;padding:20px 20px 32px;max-width:393px;margin:0 auto;">
    <div style="width:36px;height:4px;background:var(--border);border-radius:4px;margin:0 auto 20px;"></div>
    ${bodyHtml}
    <button onclick="this.closest('[data-admin-sheet]').remove()" style="width:100%;margin-top:16px;background:var(--surface);border:none;border-radius:14px;padding:14px;font-size:15px;font-weight:600;color:var(--text);cursor:pointer;">Закрыть</button>
  </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

export function _openBookingSheet(index) {
  const rec = _adminLastRecs[index];
  if (!rec) return;
  const client = rec.client || {};
  const svc = rec.services && rec.services[0];
  const staff = rec.staff || {};
  const phone = client.phone || '';
  const dt = (rec.date || '').slice(11, 16) || '—';
  const price = svc && svc.cost ? svc.cost.toLocaleString('ru-RU') + ' ₽' : '—';
  const callBlock = phone
    ? `<a href="${esc(_telHref(phone))}" class="sheet-phone" style="display:block;margin-top:16px;text-align:center;background:var(--primary);color:#fff;border-radius:14px;padding:14px;font-size:15px;font-weight:700;text-decoration:none;">Позвонить ${esc(phone)}</a>`
    : '';
  const body = `
    <div style="font-size:17px;font-weight:800;margin-bottom:16px;">Запись</div>
    <div style="display:flex;flex-direction:column;gap:10px;font-size:14px;">
      <div><span style="color:var(--text-2);">Клиент</span><div style="color:var(--text);margin-top:2px;">${esc(client.name || '—')}</div></div>
      <div><span style="color:var(--text-2);">Услуга</span><div style="color:var(--text);margin-top:2px;">${esc(svc ? svc.title : '—')}</div></div>
      <div><span style="color:var(--text-2);">Мастер</span><div style="color:var(--text);margin-top:2px;">${esc(staff.name || '—')}</div></div>
      <div><span style="color:var(--text-2);">Время</span><div style="color:var(--text);margin-top:2px;">${esc(dt)}</div></div>
      <div><span style="color:var(--text-2);">Стоимость</span><div style="color:var(--text);margin-top:2px;">${esc(price)}</div></div>
    </div>
    ${callBlock}`;
  _openSheet(body);
}

export function _openClientSheet(index) {
  const c = _adminLastFilteredClients[index];
  if (!c) return;
  const phone = c.phone || '';
  const visits = _pluralVisits(c.visits);
  const callBlock = phone
    ? `<a href="${esc(_telHref(phone))}" class="sheet-phone" style="display:block;margin-top:16px;text-align:center;background:var(--primary);color:#fff;border-radius:14px;padding:14px;font-size:15px;font-weight:700;text-decoration:none;">Позвонить ${esc(phone)}</a>`
    : '';
  const body = `
    <div style="font-size:17px;font-weight:800;margin-bottom:16px;">Клиент</div>
    <div style="display:flex;flex-direction:column;gap:10px;font-size:14px;">
      <div><span style="color:var(--text-2);">Имя</span><div style="color:var(--text);margin-top:2px;">${esc(c.name)}</div></div>
      <div><span style="color:var(--text-2);">Телефон</span><div class="sheet-phone" style="color:var(--text);margin-top:2px;">${esc(phone || '—')}</div></div>
      <div><span style="color:var(--text-2);">Визиты</span><div style="color:var(--text);margin-top:2px;">${esc(visits)}</div></div>
    </div>
    ${callBlock}`;
  _openSheet(body);
}

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
  const avgEl = document.getElementById('adminStatAvg');
  if (avgEl) avgEl.textContent = recs.length > 0 ? Math.round(rev / recs.length).toLocaleString('ru-RU') + ' ₽' : '—';
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
    _adminLastRecs = recs;
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
      return `<div class="booking-row" data-idx="${i}" onclick="_openBookingSheet(+this.dataset.idx)" style="${borderStyle}"><div class="booking-time">${esc(dt)}</div><div class="booking-av" style="background:${grad};">${esc(initials)}</div><div class="booking-info"><div class="booking-name">${esc(name)}</div><div class="booking-svc">${esc(svc ? svc.title : '—')} · ${esc(staff.name || '—')}</div></div><div class="booking-price">${esc(price)}</div></div>`;
    }).join('');
  }
}

export async function publishPost(draft) {
  if (_publishInProgress) return;
  const ta   = document.querySelector('#s-admin-post .admin-textarea');
  const text = ta ? ta.value.trim() : '';
  if (!text) { alert('Добавьте текст публикации'); return; }

  const typeEl = document.querySelector('#s-admin-post .post-type-chip.active');
  const postType = typeEl ? typeEl.dataset.postType : 'free';

  let cat = '';
  let serviceId;
  let serviceName;

  if (postType === 'category') {
    const catEl = document.getElementById('postCatSelect');
    cat = catEl ? catEl.value : '';
    if (!cat) { alert('Выберите категорию'); return; }
  } else if (postType === 'service') {
    const svcEl = document.getElementById('postServiceHidden');
    serviceId   = svcEl ? svcEl.dataset.serviceId : '';
    serviceName = svcEl ? svcEl.dataset.serviceName : '';
    cat         = svcEl ? (svcEl.dataset.serviceCat || '') : '';
    if (!serviceId) { alert('Выберите услугу'); return; }
  }

  if (!draft) hapticTap('submit');
  _publishInProgress = true;
  const post = {
    id: Date.now(), type: postType, cat, text,
    image: _postImageBase64 || null,
    date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
    draft: !!draft,
  };
  if (postType === 'service') {
    post.serviceId   = serviceId;
    post.serviceName = serviceName;
  }

  try {
    await _ghPullToLocal();
    const posts = _ls('yc_feed_posts');
    posts.unshift(post);
    localStorage.setItem('yc_feed_posts', JSON.stringify(posts));
    if (ta) ta.value = '';
    _clearPostImage();
    _resetPostForm();
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

export function initPostForm() {
  _fillPostCatSelect();
  _resetPostForm();
}

function _fillPostCatSelect() {
  const sel = document.getElementById('postCatSelect');
  if (!sel) return;
  const cats = [...new Set(SERVICES_DATA.map(s => s.cat).filter(Boolean))].sort();
  sel.innerHTML = `<option value="">Выберите категорию…</option>` +
    cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

export function selectPostType(el) {
  const wrap = document.getElementById('s-admin-post');
  if (!wrap) return;
  wrap.querySelectorAll('.post-type-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const type = el.dataset.postType;
  const catRow  = document.getElementById('postCatRow');
  const svcRow  = document.getElementById('postSvcRow');
  if (catRow) catRow.style.display = type === 'category' ? '' : 'none';
  if (svcRow) svcRow.style.display = type === 'service'  ? '' : 'none';
}

export function filterPostServices(q) {
  const list = document.getElementById('postSvcList');
  if (!list) return;
  const lq = (q || '').toLowerCase();
  const matched = lq
    ? SERVICES_DATA.filter(s => s.name.toLowerCase().includes(lq))
    : SERVICES_DATA;
  const limit = 30;
  const items = lq ? matched : matched.slice(0, limit);
  const truncated = !lq && matched.length > limit;
  const rowHtml = item =>
    `<div class="post-svc-item" data-sid="${esc(item.id)}" data-sname="${esc(item.name)}" data-scat="${esc(item.cat || '')}" onclick="pickPostService(this.dataset.sid,this.dataset.sname,this.dataset.scat)">${esc(item.name)} <span style="color:var(--text-2);font-size:12px;">${esc(item.cat || '')}</span></div>`;
  const hint = truncated
    ? `<div style="padding:6px 10px;font-size:12px;color:var(--text-2);">Показаны первые 30 — уточните поиск</div>`
    : '';
  list.innerHTML = items.map(rowHtml).join('') + hint;
}

export function pickPostService(id, name, cat) {
  const hidden = document.getElementById('postServiceHidden');
  const label  = document.getElementById('postServiceLabel');
  if (hidden) { hidden.dataset.serviceId = id; hidden.dataset.serviceName = name; hidden.dataset.serviceCat = cat; }
  if (label)  label.textContent = name;
  const list = document.getElementById('postSvcList');
  if (list) list.innerHTML = '';
  const search = document.getElementById('postSvcSearch');
  if (search) search.value = '';
}

function _resetPostForm() {
  const wrap = document.getElementById('s-admin-post');
  if (!wrap) return;
  wrap.querySelectorAll('.post-type-chip').forEach((c, i) => c.classList.toggle('active', i === 0));
  const catRow  = document.getElementById('postCatRow');
  const svcRow  = document.getElementById('postSvcRow');
  if (catRow) catRow.style.display = 'none';
  if (svcRow) svcRow.style.display = 'none';
  const catSel  = document.getElementById('postCatSelect');
  if (catSel) catSel.value = '';
  const hidden  = document.getElementById('postServiceHidden');
  if (hidden) { hidden.dataset.serviceId = ''; hidden.dataset.serviceName = ''; hidden.dataset.serviceCat = ''; }
  const label   = document.getElementById('postServiceLabel');
  if (label) label.textContent = 'Услуга не выбрана';
  const svcList = document.getElementById('postSvcList');
  if (svcList) svcList.innerHTML = '';
  const svcSrch = document.getElementById('postSvcSearch');
  if (svcSrch) svcSrch.value = '';
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
  const _CAT_ICONS = {
    'Брови': '✨', 'Ногти': '💅', 'Лицо': '🌿', 'Волосы': '💆', 'Тело': '🧖', 'Акции': '🎁',
    'Губы': '💋', 'Глаза': '👁️', 'Эпиляция': '🌸',
  };
  const _TYPE_LABELS = { 'free': 'Свободный', 'category': 'Категория', 'service': 'Услуга' };
  listEl.innerHTML = posts.map((p, i) => {
    const icon = _CAT_ICONS[p.cat || ''] || '📝';
    const last = i === posts.length - 1 ? 'border-bottom:none;' : '';
    const safeImg = p.image && /^data:image\//.test(p.image) ? p.image : null;
    const thumb = safeImg
      ? `<img src="${esc(safeImg)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`
      : icon;
    const typeLabel = _TYPE_LABELS[p.type || 'free'] || 'Свободный';
    const subtitle = p.serviceName || p.cat || typeLabel;
    return `<div class="post-row" style="${last}">
      <div class="post-thumb" style="background:var(--surface);font-size:22px;overflow:hidden;">${thumb}</div>
      <div class="post-info"><div class="post-cap">${esc(p.text.slice(0, 60))}</div><div class="post-date">${esc(p.date)} · ${esc(subtitle)}</div></div>
      <span class="post-status ${p.draft ? 'draft' : 'pub'}">${p.draft ? 'Черновик' : 'Опубл.'}</span>
      <button data-pid="${p.id}" onclick="deletePost(+this.dataset.pid)" style="background:none;border:none;color:var(--text-2);font-size:16px;cursor:pointer;padding:4px;flex-shrink:0;">✕</button>
    </div>`;
  }).join('') + '<div style="height:20px;"></div>';
}

export async function renderAdminClients() {
  const listEl  = document.getElementById('adminClientsList');
  const countEl = document.getElementById('adminClientsCount');
  if (listEl) listEl.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--text-2);font-size:14px;">Загрузка…</div>';
  const r = await YC.get(`/clients/${YC.company}`, { count: 200 });
  if (!r.success || !r.data) {
    if (listEl) listEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-2);">Не удалось загрузить</div>';
    return;
  }
  _adminAllClients = r.data
    .filter(c => c && c.id)
    .map(c => ({ id: c.id, name: c.name || '—', phone: c.phone || '', visits: c.visits_count || 0 }))
    .sort((a, b) => b.visits - a.visits);
  if (countEl) countEl.textContent = _adminAllClients.length + ' клиентов';
  _renderClientRows(_adminAllClients);
}

function _renderClientRows(clients) {
  _adminLastFilteredClients = clients;
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
    const visits = _pluralVisits(c.visits);
    const border = i === clients.length - 1 ? 'border-bottom:none;' : '';
    return `<div class="client-row" data-idx="${i}" onclick="_openClientSheet(+this.dataset.idx)" style="${border}">
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
  const sent  = campaigns.filter(c => !c.scheduled).sort((a, b) => b.id - a.id);
  let html = '';
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
  localStorage.setItem('yc_push_campaigns', JSON.stringify([]));
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

function _togglePushSentCollapsed() {
  _pushSentCollapsed = !_pushSentCollapsed;
  renderAdminPush();
}

export function pushTargetTypeChange(val) {
  const svcRow = document.getElementById('pushTargetServiceRow');
  const catRow = document.getElementById('pushTargetCategoryRow');
  if (svcRow) svcRow.style.display = val === 'service'  ? '' : 'none';
  if (catRow) catRow.style.display = val === 'category' ? '' : 'none';
}

function _fillPushTargetSelects() {
  const svcSel = document.getElementById('pushTargetService');
  const catSel = document.getElementById('pushTargetCategory');
  if (svcSel) {
    svcSel.innerHTML = SERVICES_DATA.map(s =>
      `<option value="${esc(s.id)}">${esc(s.name)} — ${esc(s.cat || '')}</option>`
    ).join('');
  }
  if (catSel) {
    const cats = [...new Set(SERVICES_DATA.map(s => s.cat).filter(Boolean))].sort();
    catSel.innerHTML = cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  }
}

function _resetPushTarget() {
  const typeSel = document.getElementById('pushTargetType');
  if (typeSel) typeSel.value = 'none';
  pushTargetTypeChange('none');
}

export function initPushNewScreen() {
  _fillPushTargetSelects();
  _resetPushTarget();
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

export function sendNewPush() {
  const text  = document.getElementById('pushNewText')?.value.trim() || '';
  const icon  = document.getElementById('pushNewIcon')?.textContent || '📅';
  if (!text) { alert('Введите текст уведомления'); return; }
  hapticTap('submit');

  const targetType = document.getElementById('pushTargetType')?.value || 'none';
  let target = null;
  if (targetType === 'service') {
    const svcId = document.getElementById('pushTargetService')?.value;
    if (svcId && String(svcId).trim() !== '') target = { type: 'service', id: String(svcId) };
  } else if (targetType === 'category') {
    const cat = document.getElementById('pushTargetCategory')?.value;
    if (cat) target = { type: 'category', id: cat };
  }

  const campaigns = _ls('yc_push_campaigns');
  campaigns.unshift({
    id: Date.now(), icon, title: text.slice(0, 50),
    date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
    time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    audience: 'Все клиенты',
  });
  localStorage.setItem('yc_push_campaigns', JSON.stringify(campaigns));

  const screen = document.getElementById('s-admin-push-new');
  const title = document.getElementById('pushNewTitle')?.textContent || 'Реснички';
  sendAdminPush(title, text, null, target).then(res => {
    let msg;
    if (!res.ok) msg = 'Ошибка: укажите Worker URL и Admin Secret';
    else if (res.sent === 0) msg = `Отправлено: 0 — нет подписчиков`;
    else msg = `Отправлено ${res.sent} уведомл. ✓`;
    _showAdminToast(screen, msg);
    setTimeout(() => go('s-admin-push', 'tab'), 2500);
  });
}

export function sendPush() {
  hapticTap('submit');
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

async function adminSubscribeSelf() {
  const statusEl = document.getElementById('pushSubStatus');
  if (statusEl) statusEl.textContent = 'Подключаемся…';
  await initPush();
  const { getSession } = await import('./storage.js');
  const sess = getSession();
  const clientId = sess?.client_id || 'admin';
  const phone = sess?.phone || '';
  await subscribePush(clientId, phone);
  const sub = localStorage.getItem('yc_push_subscribed');
  if (statusEl) statusEl.textContent = sub ? `Подписан ✓ (id: ${clientId})` : 'Ошибка — проверьте консоль (F12)';
}

export function _adminLogout() {
  if (confirm('Выйти из режима студии?')) go('s-login');
}

Object.assign(window, {
  renderAdminDashboard, renderAdminFeed, publishPost, deletePost,
  renderAdminClients, filterAdminClients,
  renderAdminPush, deletePushCampaign, clearAllSentPush,
  selectAudience,
  pushTplChip, pushPreviewUpdate, pushTargetTypeChange,
  sendNewPush, sendPush,
  _onPostImagePicked, _clearPostImage, _togglePushSentCollapsed,
  adminSubscribeSelf,
  initPostForm, selectPostType, filterPostServices, pickPostService,
  _openBookingSheet, _openClientSheet,
  _adminLogout,
});
