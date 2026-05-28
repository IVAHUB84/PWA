import { getSession } from './storage.js';
import { _loadStoredRecords } from './storage.js';
import { _loadClientLoyalty } from './api.js';
import { MASTERS_DATA } from './state.js';
import { getInitials, esc, _fmtDatetime, _hasRealAvatar } from './utils.js';
import { _loadReviewedIds } from './review.js';

export function renderProfileScreen() {
  const s = getSession();
  const nameEl = document.getElementById('profName');
  const phoneEl = document.getElementById('profPhone');
  if (!s) return;
  const initials = getInitials(s.name || s.email || '?');
  if (nameEl) nameEl.textContent = s.name || '—';
  if (phoneEl) phoneEl.textContent = s.phone ? '+' + s.phone : '';
  const emailEl = document.getElementById('profEmail');
  if (emailEl) emailEl.textContent = s.email || '';
  const inner = document.getElementById('profAvInner');
  if (inner) inner.textContent = initials;

  const fav = MASTERS_DATA.find(m => m.fav);
  const favNameEl = document.getElementById('profFavName');
  const favRoleEl = document.getElementById('profFavRole');
  const favAvEl = document.getElementById('profFavAv');
  const favBookBtn = favAvEl?.parentElement?.querySelector('button.btn-ghost');
  if (fav) {
    if (favNameEl) favNameEl.textContent = fav.name;
    if (favRoleEl) favRoleEl.textContent = fav.role;
    if (favBookBtn) {
      favBookBtn.setAttribute('data-mid', fav.id);
      favBookBtn.setAttribute('onclick', `bookWithMaster(this.dataset.mid)`);
    }
    if (favAvEl) {
      favAvEl.textContent = '';
      favAvEl.style.backgroundImage = '';
      const favAvatarSrc = fav.avatar_big || fav.avatar;
      if (_hasRealAvatar(fav) && /^https?:\/\//.test(favAvatarSrc)) {
        favAvEl.style.backgroundImage = `url('${favAvatarSrc.replace(/'/g, '%27')}')`;
        favAvEl.style.backgroundSize = 'cover';
        favAvEl.style.backgroundPosition = 'center';
      } else {
        favAvEl.textContent = getInitials(fav.name);
        favAvEl.style.fontSize = '14px';
        favAvEl.style.fontWeight = '800';
        favAvEl.style.color = '#fff';
      }
    }
  } else {
    if (favNameEl) favNameEl.textContent = 'Не выбран';
    if (favRoleEl) favRoleEl.textContent = 'Выберите на экране мастеров';
    if (favAvEl) {
      favAvEl.textContent = '?';
      favAvEl.style.backgroundImage = '';
      favAvEl.style.fontSize = '18px';
    }
  }

  _initThemeUI();
}

export function renderHomeHero() {
  const el = document.getElementById('homeHero');
  if (!el) return;

  const installBanner = document.getElementById('installBanner');
  if (installBanner) installBanner.style.display = localStorage.getItem('yc_install_seen') ? 'none' : 'flex';

  const ml = document.getElementById('homeMastersList');
  if (ml && MASTERS_DATA.length) {
    const fp = MASTERS_DATA.slice(0, 4).map(m => `${m.id}|${m.avatar_big || m.avatar || ''}`).join(',');
    if (ml.dataset.fp !== fp) {
      ml.dataset.fp = fp;
      ml.innerHTML = MASTERS_DATA.slice(0, 4).map(m => `
        <div class="master-card-sm" data-mid="${esc(m.id)}" onclick="openMasterCard(this.dataset.mid)">
          <div class="master-av-sm" style="background:${m.grad};overflow:hidden;">${_hasRealAvatar(m) ? `<img src="${esc(m.avatar_big || m.avatar)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">` : `<div class="av-initials">${getInitials(m.name)}</div>`}</div>
          <div class="master-name-sm">${esc(m.short || m.name)}</div>
          <div class="master-role-sm">${esc(m.role)}</div>
        </div>`).join('');
    }
  }

  const records = _loadStoredRecords();
  const now = new Date();
  const upcoming = records
    .filter(r => r.status !== 'cancelled' && new Date(r.datetime.replace(' ', 'T')) > now)
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  const next = upcoming[0] || null;

  _renderHomeFeedPreview();

  if (!next) {
    const reviewedIds = new Set(_loadReviewedIds());
    const sevenDaysAgo = new Date(now - 7 * 86400000);
    const lastUnreviewed = records
      .filter(r => r.status !== 'cancelled')
      .filter(r => { const dt = new Date(r.datetime.replace(' ', 'T')); return dt <= now && dt >= sevenDaysAgo; })
      .filter(r => !reviewedIds.has(String(r.id)))
      .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))[0] || null;
    if (lastUnreviewed) {
      el.innerHTML = `<div style="margin:0 20px 16px;padding:16px;background:var(--surface);border-radius:18px;box-shadow:0 2px 12px rgba(0,0,0,0.09);border:1px solid var(--border);">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-2);margin-bottom:10px;">Оцените прошлый визит</div>
        <div style="font-size:14px;font-weight:700;margin-bottom:2px;">${esc(lastUnreviewed.svcName)}</div>
        <div style="font-size:12px;color:var(--text-2);margin-bottom:12px;">${esc(lastUnreviewed.masterName)} · ${_fmtDatetime(lastUnreviewed.datetime)}</div>
        <button class="btn-ghost" style="width:100%;font-size:14px;" data-rid="${esc(String(lastUnreviewed.id))}" data-mid="${esc(String(lastUnreviewed.ycStaffId || lastUnreviewed.masterId))}" data-mname="${esc(lastUnreviewed.masterName)}" data-sname="${esc(lastUnreviewed.svcName)}" data-dt="${esc(lastUnreviewed.datetime)}" onclick="openRateVisit(this.dataset.rid,this.dataset.mid,this.dataset.mname,this.dataset.sname,this.dataset.dt)">Оставить отзыв →</button>
      </div>`;
      return;
    }
    el.innerHTML = `<div style="margin:0 20px 16px;padding:20px;background:var(--surface);border-radius:18px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.09);border:1px solid var(--border);">
      <div style="font-size:28px;margin-bottom:8px;">📅</div>
      <div style="font-size:15px;font-weight:700;">Нет предстоящих записей</div>
    </div>`;
    return;
  }

  el.innerHTML = `<div class="hero-card" onclick="go('s-history')" style="padding:14px 16px;margin-bottom:14px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.5);">Ближайший визит</span>
      <div style="display:flex;gap:6px;">
        <button class="hero-btn" style="flex:none;padding:0 10px;height:26px;font-size:12px;" data-rid="${esc(String(next.id))}" onclick="event.stopPropagation();rescheduleRecord(this.dataset.rid)">Перенести</button>
        <button class="hero-btn" style="flex:none;padding:0 10px;height:26px;font-size:12px;" data-cid="${next.id}" data-chash="${next.hash || ''}" onclick="event.stopPropagation();cancelRecord(this.dataset.cid,this.dataset.chash)">Отменить</button>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0;color:#fff;">${getInitials(next.masterName)}</div>
      <div>
        <div style="font-size:15px;font-weight:800;margin-bottom:2px;">${esc(next.svcName)}${next.forName ? ` <span style="font-weight:500;opacity:0.7;">· для ${esc(next.forName)}</span>` : ''}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.6);">${esc(next.masterName)} · ${_fmtDatetime(next.datetime)}</div>
      </div>
    </div>
  </div>`;
}

export function _renderHomeFeedPreview() {
  const el = document.getElementById('homeFeedPreview');
  const sec = document.getElementById('homeFeedSection');
  if (!el) return;
  const posts = JSON.parse(localStorage.getItem('yc_feed_posts') || '[]').filter(p => !p.draft);
  if (!posts.length) {
    el.style.display = 'none';
    if (sec) sec.style.display = 'none';
    return;
  }
  el.style.display = '';
  if (sec) sec.style.display = '';
  const _ICONS = { 'Брови': '✨', 'Ногти': '💅', 'Лицо': '🌿', 'Волосы': '💆', 'Тело': '🧖', 'Акции': '🎁' };
  const inner = el.querySelector('.hscroll');
  if (!inner) return;
  inner.innerHTML = posts.slice(0, 6).map(p => {
    const icon = _ICONS[p.cat] || '📝';
    const safeSrc = p.image && /^data:image\/|^https?:\/\//.test(p.image) ? p.image : null;
    const top = safeSrc
      ? `<img src="${esc(safeSrc)}" style="width:100%;height:90px;object-fit:cover;border-radius:10px;display:block;">`
      : `<div style="width:100%;height:90px;border-radius:10px;background:var(--accent-light);display:flex;align-items:center;justify-content:center;font-size:36px;">${icon}</div>`;
    const preview = p.text.length > 45 ? p.text.slice(0, 45) + '…' : p.text;
    return `<div style="width:140px;flex-shrink:0;background:var(--surface);border-radius:16px;padding:10px;box-shadow:var(--shadow);cursor:pointer;border:1px solid var(--border);display:flex;flex-direction:column;gap:6px;" onclick="go('s-feed')">
      ${top}
      <div style="font-size:12px;font-weight:700;line-height:1.3;flex:1;">${esc(preview)}</div>
      <div style="font-size:11px;color:var(--text-2);">${esc(p.cat)}</div>
    </div>`;
  }).join('');
}

export async function renderLoyaltyBlock() {
  const el = document.getElementById('loyaltyBlock');
  if (!el) return;
  const sess = getSession();
  if (!sess) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.innerHTML = `<div style="font-size:13px;color:var(--text-2);">Загрузка данных…</div>`;
  const data = await _loadClientLoyalty();

  if (!data) { el.style.display = 'none'; return; }

  const impLabel = data.importance || 'Начальный';
  const impId    = Number(data.importance_id ?? -1);
  const _IMP = {
    4: { grad: 'linear-gradient(135deg,#D4E2F0,#B0C8E8)', color: '#1A3A5C' },
    3: { grad: 'linear-gradient(135deg,#F5C518,#FFE066)', color: '#7A5800' },
    2: { grad: 'linear-gradient(135deg,#9BA3AF,#CFD4DC)', color: '#1F2937' },
    1: { grad: 'linear-gradient(135deg,#B87333,#D4956A)', color: '#fff'   },
  };
  const { grad: impGrad, color: impTextColor } = _IMP[impId] || { grad: 'linear-gradient(135deg,#4A7EC7,#6FA3E0)', color: '#fff' };

  const discount = data.discount != null ? Number(data.discount) : 0;

  el.innerHTML = `
    <div style="display:flex;gap:8px;">
      <div style="flex:1;background:${impGrad};border-radius:10px;padding:10px 12px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:${impId >= 3 ? 'rgba(100,70,0,0.55)' : 'rgba(255,255,255,0.65)'};margin-bottom:4px;">Уровень</div>
        <div style="font-size:15px;font-weight:800;color:${impTextColor};">${esc(impLabel)}</div>
      </div>
      <div style="flex:1;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;padding:10px 12px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-2);margin-bottom:4px;">Скидка</div>
        <div style="font-size:20px;font-weight:800;color:${discount > 0 ? 'var(--accent)' : 'var(--text-2)'};">${discount}%</div>
      </div>
    </div>`;

  if (data.name) {
    const nameEl = document.getElementById('profName');
    if (nameEl) nameEl.textContent = data.name;
  }
}

export function _csToggle(btn, price) {
  if (!btn.dataset.price) btn.dataset.price = price;
  btn.classList.toggle('active');
  const total = Array.from(document.querySelectorAll('.cs-add.active'))
    .reduce((acc, b) => acc + Number(b.dataset.price || 0), 0);
  const totalEl = document.getElementById('csTotalAmt');
  const wrapEl  = document.getElementById('csTotal');
  if (totalEl) totalEl.textContent = total.toLocaleString('ru-RU') + ' ₽';
  if (wrapEl)  wrapEl.style.display = total > 0 ? '' : 'none';
}

export function _reviewCount(textarea) {
  const el = document.getElementById('reviewCharCount');
  if (el) el.textContent = `${textarea.value.length} / ${textarea.maxLength || 300}`;
}

export function _initOfferUrgency() {
  const el = document.getElementById('offerUrgency');
  if (!el) return;
  const expireText = document.querySelector('.offer-expire')?.textContent || '';
  const match = expireText.match(/(\d{1,2})\s+(\S+)\s+(\d{4})/);
  if (!match) { el.style.display = 'none'; return; }
  const months = { 'января':0,'февраля':1,'марта':2,'апреля':3,'мая':4,'июня':5,'июля':6,'августа':7,'сентября':8,'октября':9,'ноября':10,'декабря':11 };
  const d = new Date(Number(match[3]), months[match[2]] ?? 0, Number(match[1]));
  const diff = Math.ceil((d - Date.now()) / 86400000);
  if (diff <= 0) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.textContent = diff <= 3 ? `Осталось ${diff} дн.` : `До конца акции ${diff} дней`;
}

export function _setTheme(theme) {
  localStorage.setItem('yc_theme', theme);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (theme === 'dark' || (theme === 'system' && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  _initThemeUI();
}

export function _initThemeUI() {
  const t = localStorage.getItem('yc_theme') || 'system';
  document.querySelectorAll('#themeSegment button').forEach(btn => {
    const active = btn.dataset.themeVal === t;
    btn.style.background = active ? 'var(--accent)' : 'var(--surface)';
    btn.style.color = active ? '#fff' : 'var(--text-2)';
  });
}

export function _toggleThemeSettings() {
  const g  = document.getElementById('themeSettingsGroup');
  const ch = document.getElementById('themeSettingsChevron');
  if (!g) return;
  const open = g.style.display !== 'none';
  g.style.display = open ? 'none' : '';
  if (ch) ch.style.transform = open ? '' : 'rotate(90deg)';
}

export function _toggleNotifSettings() {
  const g  = document.getElementById('notifSettingsGroup');
  const ch = document.getElementById('notifSettingsChevron');
  if (!g) return;
  const open = g.style.display !== 'none';
  g.style.display = open ? 'none' : '';
  if (ch) ch.style.transform = open ? '' : 'rotate(90deg)';
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if ((localStorage.getItem('yc_theme') || 'system') === 'system') _setTheme('system');
});

Object.assign(window, { renderProfileScreen, renderHomeHero, _renderHomeFeedPreview, renderLoyaltyBlock, _toggleNotifSettings, _toggleThemeSettings, _setTheme, _initThemeUI, _csToggle, _reviewCount, _initOfferUrgency });
