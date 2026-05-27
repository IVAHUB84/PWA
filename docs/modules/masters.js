import { state, MASTERS_DATA, getService } from './state.js';
import { go } from './navigation.js';
import { YC } from './api.js';
import { _GRADS } from './constants.js';
import { _makeShort, _hasRealAvatar, getInitials, esc } from './utils.js';

function _avgRating(masterId) {
  let reviews;
  try { reviews = JSON.parse(localStorage.getItem('yc_reviews') || '[]'); } catch { reviews = []; }
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
  const click = m.avail ? ` data-mid="${esc(m.id)}" onclick="openMasterCard(this.dataset.mid)"` : '';
  const rating = _avgRating(m.id);
  const initStr = getInitials(m.name);
  const avatarInner = _hasRealAvatar(m)
    ? `<img src="${esc(m.avatar_big || m.avatar)}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<div class=&quot;av-initials&quot;>${initStr}</div>')">`
    : `<div class="av-initials">${initStr}</div>`;
  return `<div class="master-card${m.fav ? ' fav' : ''}"${styleAttr}${click}>
    <div class="master-av" style="background:${m.grad};">${avatarInner}${favBadge}</div>
    <div class="master-info">
      <div class="master-name">${esc(m.name)}${favChip}</div>
      <div class="master-role">${esc(m.role)}${m.exp ? ' · стаж ' + esc(m.exp) : ''}${rating}</div>
      <div class="master-avail ${availCls}">${esc(m.availText)}</div>
    </div>
    <button data-mid="${esc(m.id)}" onclick="event.stopPropagation();toggleFav(this.dataset.mid)" style="background:none;border:none;cursor:pointer;font-size:20px;padding:4px 6px;flex-shrink:0;" title="В избранное">${m.fav ? '❤️' : '🤍'}</button>
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
      const favs = JSON.parse(localStorage.getItem('yc_favs') || '[]');
      const staticById = Object.fromEntries(MASTERS_DATA.map(m => [m.id, m]));
      masters = r.data.map((m, i) => {
        const sm = staticById[String(m.id)];
        return sm
          ? { ...sm, fav: favs.includes(String(m.id)) }
          : {
              id: String(m.id), name: m.name, short: _makeShort(m.name),
              role: m.specialization || 'Мастер', exp: '',
              avatar: m.avatar_big || m.avatar || '',
              grad: _GRADS[i % _GRADS.length],
              fav: favs.includes(String(m.id)),
              avail: true, availText: '● Есть окна сегодня',
            };
      });
    }
  } catch {}
  if (!masters.length) {
    masters = MASTERS_DATA;
    const svcCat = svc.cat;
    if (svcCat) {
      const bycat = masters.filter(m => m.cats && m.cats.includes(svcCat));
      if (bycat.length) masters = bycat;
    }
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

export async function openMasterCard(id) {
  go('s-master');
  const content = document.getElementById('masterCardContent');
  content.innerHTML = '<div style="padding:48px 20px;text-align:center;color:var(--text-2);font-size:14px;">Загрузка…</div>';

  const localMaster = MASTERS_DATA.find(m => m.id === id);
  const ycId = localMaster?.ycId || id;

  if (!ycId) {
    const lm = localMaster || {};
    const avHtml = `<div style="width:100px;height:100px;border-radius:50%;background:${lm.grad||'var(--accent)'};display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:800;color:#fff;">${getInitials(lm.name||'')}</div>`;
    content.innerHTML = `<div style="padding:24px 20px 16px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;">${avHtml}<div><div style="font-size:22px;font-weight:800;">${esc(lm.name||'')}</div><div style="font-size:14px;color:var(--text-2);margin-top:4px;">${esc(lm.role||'')}</div></div></div><div style="padding:0 20px 20px;"><button class="btn-primary" data-mid="${esc(String(id))}" onclick="bookFromMaster(this.dataset.mid)">Записаться к этому мастеру</button></div>`;
    return;
  }

  const [profileRes, servicesRes, commentsRes] = await Promise.all([
    YC.get(`/staff/${YC.company}/${ycId}`),
    YC.get(`/book_services/${YC.company}`, { staff_id: ycId }),
    YC.get(`/comments/${YC.company}`, { staff_id: ycId }),
  ]);

  const m = profileRes.data || {};
  const services = servicesRes.data?.services || [];
  const comments = (commentsRes.data || []).slice(0, 5);

  const avatarSrc = m.image_group?.images?.norm?.path || m.avatar_big || m.avatar || '';
  const avatarHtml = avatarSrc
    ? `<img src="${esc(avatarSrc)}" style="width:100px;height:100px;border-radius:50%;object-fit:cover;">`
    : `<div style="width:100px;height:100px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:800;color:#fff;">${getInitials(m.name || '')}</div>`;

  const ratingStars = m.rating
    ? `<span style="color:var(--gold);font-size:16px;">${'★'.repeat(Math.round(m.rating))}${'☆'.repeat(5 - Math.round(m.rating))}</span> <span style="font-size:13px;color:var(--text-2);">${Number(m.rating).toFixed(1)} · ${m.comments_count || 0} отз.</span>`
    : '';

  const svcsHtml = services.length
    ? services.map(s => `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:14px;font-weight:600;">${esc(s.title)}</span>
        <span style="font-size:13px;color:var(--text-2);">${s.price_min ? s.price_min + ' ₽' : ''}</span>
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
    </div>
<div class="section-header"><span class="section-title">Услуги</span></div>
    <div style="padding:0 20px;">${svcsHtml}</div>
    ${commentsHtml ? `
      <div class="section-header" style="margin-top:8px;"><span class="section-title">Отзывы</span></div>
      <div style="padding:0 20px 40px;">${commentsHtml}</div>` : '<div style="height:32px;"></div>'}
  `;
}

export function bookFromMaster(id) {
  state.masterId = id;
  go('s-slots');
}

export function selectAnyMaster() {
  state.masterId = null;
  go('s-slots');
}

Object.assign(window, { renderMasters, toggleFav, selectMaster, selectAnyMaster, openMasterCard, bookFromMaster });
