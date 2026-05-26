import { state, MASTERS_DATA, getService } from './state.js';
import { go } from './navigation.js';
import { YC } from './api.js';
import { _GRADS } from './constants.js';
import { _makeShort, _hasRealAvatar, getInitials, esc } from './utils.js';

function _avgRating(masterId) {
  const reviews = JSON.parse(localStorage.getItem('yc_reviews') || '[]');
  const rel = reviews.filter(r => r.masterId === masterId && r.stars > 0);
  if (!rel.length) return '';
  const avg = rel.reduce((s, r) => s + r.stars, 0) / rel.length;
  return ` · ⭐ ${avg.toFixed(1)}`;
}

function _masterCardHtml(m, i, total) {
  const last = i === total - 1;
  const favBadge = m.fav ? '<div class="fav-badge">❤️</div>' : '';
  const favChip = m.fav ? ' <span class="fav-chip">Избранная</span>' : '';
  const availCls = m.avail ? 'avail-yes' : 'avail-no';
  const styles = [...(m.avail ? [] : ['opacity:0.55']), ...(last ? ['margin-bottom:24px'] : [])];
  const styleAttr = styles.length ? ` style="${styles.join(';')}"` : '';
  const click = m.avail ? ` onclick="selectMaster(${JSON.stringify(m.id)})"` : '';
  const rating = _avgRating(m.id);
  const avatarInner = _hasRealAvatar(m)
    ? `<img src="${m.avatar_big || m.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'">`
    : `<div class="av-initials">${getInitials(m.name)}</div>`;
  return `<div class="master-card${m.fav ? ' fav' : ''}"${styleAttr}${click}>
    <div class="master-av" style="background:${m.grad};">${avatarInner}${favBadge}</div>
    <div class="master-info">
      <div class="master-name">${esc(m.name)}${favChip}</div>
      <div class="master-role">${esc(m.role)}${m.exp ? ' · стаж ' + esc(m.exp) : ''}${rating}</div>
      <div class="master-avail ${availCls}">${esc(m.availText)}</div>
    </div>
    <button onclick="event.stopPropagation();toggleFav(${JSON.stringify(m.id)})" style="background:none;border:none;cursor:pointer;font-size:20px;padding:4px 6px;flex-shrink:0;" title="В избранное">${m.fav ? '❤️' : '🤍'}</button>
    <div class="chevron">›</div>
  </div>`;
}

export async function renderMasters() {
  const svc = getService();
  const sub = document.getElementById('mastersSub');
  if (sub) sub.textContent = `${svc.name} · ${svc.dur} мин`;
  const list = document.getElementById('mastersList');
  if (!list) return;
  list.innerHTML = '<div style="padding:32px 20px;text-align:center;color:var(--text-2);font-size:14px;">Загрузка мастеров…</div>';
  let masters = [];
  try {
    const r = await YC.get(`/book_staff/${YC.company}`, { service_ids: svc.id });
    if (r.success && r.data && r.data.length) {
      const ids = new Set(r.data.map(s => String(s.id)));
      const filtered = MASTERS_DATA.filter(m => ids.has(m.id));
      if (filtered.length) {
        masters = filtered;
      } else {
        const favs = JSON.parse(localStorage.getItem('yc_favs') || '[]');
        masters = r.data.map((m, i) => ({
          id: String(m.id),
          name: m.name,
          short: _makeShort(m.name),
          role: m.specialization || 'Мастер',
          exp: '',
          avatar: m.avatar_big || m.avatar || '',
          grad: _GRADS[i % _GRADS.length],
          fav: favs.includes(String(m.id)),
          avail: true,
          availText: '● Есть окна сегодня',
        }));
      }
    }
  } catch {}
  if (!masters.length) masters = MASTERS_DATA;
  const svcCat = svc.cat;
  if (svcCat) {
    const bycat = masters.filter(m => m.cats && m.cats.includes(svcCat));
    if (bycat.length) masters = bycat;
  }
  masters.sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0));
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

export function selectAnyMaster() {
  state.masterId = null;
  go('s-slots');
}

Object.assign(window, { renderMasters, toggleFav, selectMaster, selectAnyMaster });
