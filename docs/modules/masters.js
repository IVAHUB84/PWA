import { state, MASTERS_DATA, getService } from './state.js';
import { go } from './navigation.js';
import { YC, fetchStaffByService } from './api.js';
import { _hasRealAvatar, getInitials, esc } from './utils.js';
import { bookWithMaster } from './booking.js';

const _staffByServiceCache = new Map();
let _masterTapMode = 'browse'; // 'browse' — безопасный дефолт: тап ведёт в профиль, а не на прямой переход к брони

function _masterCardHtml(m, i, total) {
  const last = i === total - 1;
  const favBadge = m.fav ? '<div class="fav-badge">❤️</div>' : '';
  const favChip = m.fav ? ' <span class="fav-chip">Избранная</span>' : '';
  const availCls = m.avail ? 'avail-yes' : 'avail-no';
  const styles = [...(m.avail ? [] : ['opacity:0.55']), ...(last ? ['margin-bottom:24px'] : [])];
  const styleAttr = styles.length ? ` style="${styles.join(';')}"` : '';
  const click = m.avail ? ` data-mid="${esc(m.id)}" onclick="tapMaster(this.dataset.mid)"` : '';
  const initStr = getInitials(m.name);
  const avatarInner = _hasRealAvatar(m)
    ? `<img src="${esc(m.avatar_big || m.avatar)}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<div class=&quot;av-initials&quot;>${initStr}</div>')">`
    : `<div class="av-initials">${initStr}</div>`;
  return `<div class="master-card${m.fav ? ' fav' : ''}"${styleAttr}${click}>
    <div class="master-av" style="background:${m.grad};">${avatarInner}${favBadge}</div>
    <div class="master-info">
      <div class="master-name">${esc(m.name)}${favChip}</div>
      <div class="master-role">${esc(m.role)}${m.exp ? ' · стаж ' + esc(m.exp) : ''}</div>
      <div class="master-avail ${availCls}">${esc(m.availText)}</div>
    </div>
    <button data-mid="${esc(m.id)}" onclick="event.stopPropagation();toggleFav(this.dataset.mid)" style="background:none;border:none;cursor:pointer;font-size:20px;padding:4px 6px;flex-shrink:0;" title="В избранное">${m.fav ? '❤️' : '🤍'}</button>
    <div class="chevron">›</div>
  </div>`;
}

export function _intersectWithMasters(staffResult, mastersData) {
  if (staffResult === null) return { masters: mastersData, empty: false, error: true };
  if (staffResult.length === 0) return { masters: [], empty: true, error: false };
  const ycIds = new Set(staffResult.map(s => String(s.id)));
  const matched = mastersData.filter(m => ycIds.has(String(m.id)));
  return { masters: matched, empty: matched.length === 0, error: false };
}

export function _browseAllMasters() {
  state._mastersAll = true;
  go('s-masters');
}

export async function renderMasters() {
  const browseAll = state._mastersAll;
  state._mastersAll = false;
  const sub = document.getElementById('mastersSub');
  const list = document.getElementById('mastersList');
  if (!list) return;
  const anyMasterEl = document.querySelector('#s-masters .any-master');
  const masterLabelEl = document.querySelector('#s-masters .label');
  if (browseAll) {
    _masterTapMode = 'browse';
    if (sub) sub.textContent = 'Все мастера студии';
    if (anyMasterEl) anyMasterEl.style.display = 'none';
    if (masterLabelEl) masterLabelEl.style.display = 'none';
    const masters = [...MASTERS_DATA].sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0));
    const fp = masters.map(m => `${m.id}|${m.fav ? 1 : 0}|${m.avatar_big || m.avatar || ''}`).join(',');
    if (list.dataset.fp !== fp) { list.dataset.fp = fp; list.innerHTML = masters.map((m, i) => _masterCardHtml(m, i, masters.length)).join(''); }
    return;
  }

  if (anyMasterEl) anyMasterEl.style.display = '';
  if (masterLabelEl) masterLabelEl.style.display = '';
  const svc = getService();
  if (sub) sub.textContent = `${svc.name} · ${svc.dur} мин`;

  const serviceId = state.serviceId;
  const favs = JSON.parse(localStorage.getItem('yc_favs') || '[]');

  let staffResult;
  if (_staffByServiceCache.has(serviceId)) {
    staffResult = _staffByServiceCache.get(serviceId);
  } else {
    list.innerHTML = '<div style="padding:48px 20px;text-align:center;color:var(--text-2);font-size:14px;">Загрузка мастеров…</div>';
    staffResult = await fetchStaffByService(serviceId);
    if (state.serviceId !== serviceId) return;
    if (staffResult !== null) {
      _staffByServiceCache.set(serviceId, staffResult);
    }
  }

  if (state.serviceId !== serviceId) return;

  const allMasters = MASTERS_DATA.map(m => ({ ...m, fav: favs.includes(String(m.id)) }));
  const { masters, empty } = _intersectWithMasters(staffResult, allMasters);

  if (empty) {
    if (anyMasterEl) anyMasterEl.style.display = 'none';
    list.dataset.fp = '';
    list.innerHTML = '<div style="padding:48px 20px;text-align:center;color:var(--text-2);font-size:14px;">На эту услугу сейчас нет доступных мастеров</div>';
    return;
  }

  masters.sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0));
  const fp = masters.map(m => `${m.id}|${m.fav ? 1 : 0}|${m.avatar_big || m.avatar || ''}`).join(',');
  if (list.dataset.fp === fp) return;
  list.dataset.fp = fp;
  _masterTapMode = 'book';
  list.innerHTML = masters.map((m, i) => _masterCardHtml(m, i, masters.length)).join('');
}

export function toggleFav(masterId) {
  const m = MASTERS_DATA.find(x => x.id === masterId);
  if (!m) return;
  m.fav = !m.fav;
  const favs = MASTERS_DATA.filter(x => x.fav).map(x => x.id);
  localStorage.setItem('yc_favs', JSON.stringify(favs));
  renderMasters();
}

export function selectMaster(id) {
  state.masterId = id;
  go('s-slots');
}

export async function openMasterCard(id) {
  go('s-master');
  const content = document.getElementById('masterCardContent');
  content.innerHTML = '<div style="padding:48px 20px;text-align:center;color:var(--text-2);font-size:14px;">Загрузка…</div>';

  const localMaster = MASTERS_DATA.find(m => m.id === id);
  const ycId = (localMaster?.ycId != null ? String(localMaster.ycId) : null) || (String(id).match(/^\d+$/) ? id : null);

  const _favBtnHtml = (mid) => {
    const isFav = MASTERS_DATA.find(x => x.id === mid)?.fav;
    return `<button id="masterFavBtn" data-mid="${esc(String(mid))}" onclick="toggleFavFromCard(this.dataset.mid)" style="width:100%;height:48px;background:none;border:1.5px solid var(--border);border-radius:14px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--text);margin-top:8px;">${isFav ? '❤️ В избранном' : '🤍 В избранное'}</button>`;
  };

  const _renderLocalFallback = (lm) => {
    lm = lm || {};
    const avHtml = `<div style="width:100px;height:100px;border-radius:50%;background:${lm.grad||'var(--accent)'};display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:800;color:#fff;">${getInitials(lm.name||'')}</div>`;
    content.innerHTML = `<div style="padding:24px 20px 16px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;">${avHtml}<div><div style="font-size:22px;font-weight:800;">${esc(lm.name||'')}</div><div style="font-size:14px;color:var(--text-2);margin-top:4px;">${esc(lm.role||'')}</div></div></div><div style="padding:0 20px 20px;"><button class="btn-primary" data-mid="${esc(String(id))}" onclick="bookFromMaster(this.dataset.mid)">Записаться к этому мастеру</button>${_favBtnHtml(id)}</div>`;
  };

  if (!ycId) {
    _renderLocalFallback(localMaster);
    return;
  }

  const [profileRes, servicesRes, commentsRes] = await Promise.all([
    YC.get(`/staff/${YC.company}/${ycId}`),
    YC.get(`/book_services/${YC.company}`, { staff_id: ycId }),
    YC.get(`/comments/${YC.company}`, { staff_id: ycId }),
  ]);

  if (!profileRes.success && !profileRes.data) {
    console.warn('staff profile API failed', ycId, profileRes);
    _renderLocalFallback(localMaster);
    return;
  }
  const m = profileRes.data || {};
  if (!m.name && localMaster) { m.name = localMaster.name; m.specialization = m.specialization || localMaster.role; }
  const services = servicesRes.data?.services || [];
  const comments = (Array.isArray(commentsRes.data) ? commentsRes.data : []).slice(0, 5);

  const avatarSrc = m.image_group?.images?.norm?.path || m.avatar_big || m.avatar || '';
  const avatarHtml = avatarSrc
    ? `<img src="${esc(avatarSrc)}" style="width:100px;height:100px;border-radius:50%;object-fit:cover;">`
    : `<div style="width:100px;height:100px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:800;color:#fff;">${getInitials(m.name || '')}</div>`;

  const ratingStars = m.rating
    ? `<span style="color:var(--gold);font-size:16px;">${'★'.repeat(Math.round(m.rating))}${'☆'.repeat(5 - Math.round(m.rating))}</span> <span style="font-size:13px;color:var(--text-2);">${Number(m.rating).toFixed(1)} · ${m.comments_count || 0} отз.</span>`
    : '';

  const svcsHtml = services.length
    ? services.map(s => `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border);cursor:pointer;" data-sid="${esc(String(s.id))}" data-mid="${esc(String(id))}" onclick="bookServiceFromMaster(this.dataset.mid,this.dataset.sid)">
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;">${esc(s.title)}</div>
          ${s.duration ? `<div style="font-size:12px;color:var(--text-2);margin-top:2px;">${s.duration} мин</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <span style="font-size:13px;color:var(--text-2);">${s.price_min ? s.price_min + ' ₽' : ''}</span>
          <span style="font-size:13px;font-weight:600;color:var(--accent);">Записать →</span>
        </div>
      </div>`).join('')
    : '<div style="font-size:13px;color:var(--text-2);padding:12px 0;">Нет данных</div>';

  const commentsHtml = comments.length
    ? comments.map(c => `<div style="padding:12px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="color:var(--gold);font-size:14px;">${'★'.repeat(c.rating || 0)}</span>
          <span style="font-size:13px;font-weight:600;">${esc(c.user_name || '')}</span>
          <span style="font-size:12px;color:var(--text-2);margin-left:auto;">${(c.date || '').slice(0, 10)}</span>
        </div>
        ${c.text ? `<div style="font-size:13px;color:var(--text-2);line-height:1.5;">${esc(c.text)}</div>` : ''}
      </div>`).join('')
    : '';


  content.innerHTML = `
    <div style="padding:24px 20px 16px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;">
      ${avatarHtml}
      <div>
        <div style="font-size:22px;font-weight:800;">${esc(m.name || '')}</div>
        <div style="font-size:14px;color:var(--text-2);margin-top:4px;">${esc(m.specialization || '')}</div>
        ${ratingStars ? `<div style="margin-top:8px;">${ratingStars}</div>` : ''}
        ${m.information ? `<div style="font-size:13px;color:var(--text-2);margin-top:10px;line-height:1.5;text-align:left;">${esc(m.information)}</div>` : ''}
      </div>
    </div>
    <div style="padding:0 20px 20px;">
      <button class="btn-primary" data-mid="${esc(String(id))}" onclick="bookFromMaster(this.dataset.mid)">Записаться к этому мастеру</button>
      ${_favBtnHtml(id)}
    </div>
<div class="section-header"><span class="section-title">Услуги</span></div>
    <div style="padding:0 20px;">${svcsHtml}</div>
    ${commentsHtml ? `
      <div class="section-header" style="margin-top:8px;"><span class="section-title">Отзывы</span></div>
      <div style="padding:0 20px 40px;">${commentsHtml}</div>` : '<div style="height:32px;"></div>'}
  `;
}

export function toggleFavFromCard(masterId) {
  toggleFav(masterId);
  const btn = document.getElementById('masterFavBtn');
  if (!btn) return;
  const isFav = MASTERS_DATA.find(x => x.id === masterId)?.fav;
  btn.textContent = isFav ? '❤️ В избранном' : '🤍 В избранное';
}

export function bookFromMaster(id) {
  bookWithMaster(id);
}

export function bookServiceFromMaster(masterId, serviceId) {
  const m = MASTERS_DATA.find(x => x.id === masterId);
  state.masterId = masterId;
  state.masterName = m?.name || '';
  state.masterAvatar = m?.avatar_big || m?.avatar || '';
  state.masterGrad = m?.grad || '';
  state.masterPreSelected = true;
  state.serviceId = serviceId;
  go('s-slots');
}

export function selectAnyMaster() {
  state.masterId = null;
  go('s-slots');
}

export function tapMaster(id) {
  if (_masterTapMode === 'book') {
    selectMaster(id);
  } else {
    openMasterCard(id);
  }
}

Object.assign(window, { renderMasters, toggleFav, toggleFavFromCard, selectMaster, selectAnyMaster, openMasterCard, bookFromMaster, bookServiceFromMaster, _browseAllMasters, tapMaster });
