import { YC } from './api.js';
import { state, getService, getMaster, getStaffPrice } from './state.js';
import { _hasRealAvatar, getInitials, esc, _fmtDatetime } from './utils.js';
import { _loadStoredRecords } from './storage.js';

function _setConfirmBtnEnabled(enabled) {
  const btn = document.querySelector('#s-slots .sticky-bottom .btn-primary');
  if (!btn) return;
  btn.disabled = !enabled;
  btn.style.opacity = enabled ? '' : '0.45';
}

// ── SLOTS SCREEN ──
export function updateSlotsScreen() {
  const m = getMaster();
  const strip = document.getElementById('masterStrip');
  if (strip) {
    if (m) {
      const avatarHtml = _hasRealAvatar(m)
        ? `<img src="${esc(m.avatar_big || m.avatar)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">`
        : `<div class="av-initials" style="font-size:17px;">${getInitials(m.name)}</div>`;
      strip.innerHTML = `
        <div style="width:48px;height:48px;border-radius:50%;background:${m.grad};overflow:hidden;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.12);display:flex;align-items:center;justify-content:center;">${avatarHtml}</div>
        <div><div style="font-size:15px;font-weight:700;">${esc(m.name)}</div><div style="font-size:13px;color:var(--text-2);">${esc(m.role)}</div></div>
        ${m.fav ? '<div class="heart">❤️</div>' : ''}`;
    } else {
      strip.innerHTML = `
        <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#C9956C,#E8C4A0);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.12);font-size:22px;">🎲</div>
        <div><div style="font-size:15px;font-weight:700;">Любой свободный</div><div style="font-size:13px;color:var(--text-2);">Больше доступных окон</div></div>`;
    }
  }

  // Reschedule context banner
  let reschBanner = document.getElementById('rescheduleBanner');
  if (state._rescheduleId && strip) {
    const records = _loadStoredRecords();
    const rec = records.find(r => String(r.id) === String(state._rescheduleId));
    if (rec) {
      if (!reschBanner) {
        reschBanner = document.createElement('div');
        reschBanner.id = 'rescheduleBanner';
        reschBanner.style.cssText = 'margin:8px 20px 0;padding:10px 14px;background:var(--accent-light);border-radius:12px;border-left:3px solid var(--accent);';
        strip.insertAdjacentElement('afterend', reschBanner);
      }
      reschBanner.innerHTML = `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-2);margin-bottom:3px;">Перенос записи</div>
        <div style="font-size:14px;font-weight:600;">${esc(rec.svcName)}</div>
        <div style="font-size:12px;color:var(--text-2);margin-top:2px;">Текущее время: ${esc(_fmtDatetime(rec.datetime))}</div>`;
    }
  } else if (reschBanner) {
    reschBanner.remove();
  }

  updateStickyBottom();
}

export function updateStickyBottom() {
  const svc = getService();
  const el = document.getElementById('stickyInfo');
  if (el) el.innerHTML = `<b>${esc(state.dateFull)} · ${esc(state.slot)}</b> · ${esc(svc.name)}`;
  const btn = document.querySelector('#s-slots .sticky-bottom .btn-primary');
  if (btn) btn.textContent = state._rescheduleId ? 'Перенести запись' : 'Подтвердить запись';
}

function _getPriceForConfirm(svc, m) {
  return getStaffPrice(svc, m);
}

// ── CONFIRM SCREEN ──
export function updateConfirmScreen() {
  const svc = getService();
  const m = getMaster();
  const rows = document.getElementById('confirmRows');
  if (!rows) return;
  rows.innerHTML = `
    <div class="confirm-row">
      <div class="confirm-row-icon">💆</div>
      <div><div class="confirm-row-val">${esc(svc.name)}</div><div class="confirm-row-lbl">Услуга · ${svc.dur} мин</div></div>
    </div>
    <div class="confirm-row">
      <div class="confirm-row-icon">👩</div>
      <div><div class="confirm-row-val">${m ? esc(m.name) : 'Любой свободный мастер'}</div><div class="confirm-row-lbl">${m ? esc(m.role) : 'Ближайшее доступное окно'}</div></div>
    </div>
    <div class="confirm-row">
      <div class="confirm-row-icon">📅</div>
      <div><div class="confirm-row-val">${esc(state.dateFull)} · ${esc(state.slot)}</div><div class="confirm-row-lbl">Дата и время</div></div>
    </div>
    <div class="confirm-row">
      <div class="confirm-row-icon">💰</div>
      <div><div class="confirm-row-val">${esc(_getPriceForConfirm(svc, m))}</div><div class="confirm-row-lbl">Стоимость</div></div>
    </div>
    ${state._bookOtherName ? `<div class="confirm-row">
      <div class="confirm-row-icon">👤</div>
      <div><div class="confirm-row-val">${esc(state._bookOtherName)}</div><div class="confirm-row-lbl">Запись для</div></div>
    </div>` : ''}`;
}

// ── DATE SELECTION ──
export async function loadDates() {
  const svc = getService();
  const m = getMaster();
  const el = document.getElementById('datesRow');
  if (!el) return;
  el.innerHTML = '<div style="padding:12px;color:var(--text-2);font-size:13px;">Загрузка…</div>';
  const params = { service_ids: svc.id };
  if (m) params.staff_id = m.id;
  try {
    const r = await YC.get(`/book_dates/${YC.company}`, params);
    if (r.success) {
      const dates = r.data && r.data.booking_dates ? r.data.booking_dates : [];
      if (dates.length) {
        _renderDates(el, dates);
      } else {
        el.innerHTML = '<div style="padding:12px;color:var(--text-2);font-size:13px;">Нет доступных дат на ближайший месяц</div>';
      }
    } else {
      _renderDatesFallback(el);
    }
  } catch {
    el.innerHTML = '<div style="padding:12px;color:var(--text-2);font-size:13px;">Не удалось загрузить даты. Проверьте соединение.</div>';
  }
}

function _updateMonthLabel(isoDate) {
  const lbl = document.querySelector('#s-slots .date-picker-lbl');
  if (!lbl) return;
  const d = new Date(isoDate + 'T00:00:00');
  if (!isNaN(d)) lbl.textContent = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

function _renderDates(container, availDates) {
  if (availDates.length) _updateMonthLabel(availDates[0]);
  const set = new Set(availDates);
  const today = new Date();
  const RU_DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  let html = '';
  for (let i = 0; i < 21; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    if (!set.has(iso)) continue;
    const day = RU_DAYS[d.getDay()];
    const num = d.getDate();
    html += `<div class="date-item" onclick="selectDate(this,'${iso}')"><div class="date-day">${day}</div><div class="date-num">${num}</div></div>`;
  }
  container.innerHTML = html || '<div style="padding:12px;color:var(--text-2);font-size:13px;">Нет доступных дат</div>';
  const first = container.querySelector('.date-item');
  if (first) { first.classList.add('sel'); first.click(); }
}

function _renderDatesFallback(container) {
  _updateMonthLabel(new Date().toISOString().slice(0, 10));
  const RU_DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const today = new Date();
  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    html += `<div class="date-item${i === 0 ? ' sel' : ''}" onclick="selectDate(this,'${iso}')"><div class="date-day">${RU_DAYS[d.getDay()]}</div><div class="date-num">${d.getDate()}</div></div>`;
  }
  container.innerHTML = html;
  loadTimes(new Date().toISOString().slice(0, 10));
}

// ── TIME SELECTION ──
export async function loadTimes(iso) {
  const svc = getService();
  const m = getMaster();
  const el = document.getElementById('slotsGrid');
  const lbl = document.getElementById('slotsDateLbl');
  if (!el) return;
  state.dateISO = iso;
  const d = new Date(iso + 'T00:00:00');
  const dateStr = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  state.dateFull = dateStr;
  if (lbl) lbl.textContent = 'Доступное время — ' + dateStr;
  el.innerHTML = '<div style="padding:12px;color:var(--text-2);font-size:13px;">Загрузка…</div>';
  _setConfirmBtnEnabled(false);
  const staffId = m ? m.id : 0;
  const params = {};
  if (svc) params.service_ids = svc.id;
  let r;
  try {
    r = await YC.get(`/book_times/${YC.company}/${staffId}/${iso}`, params);
  } catch {
    el.innerHTML = '<div style="padding:12px;color:var(--text-2);font-size:13px;">Не удалось загрузить время. Проверьте соединение.</div>';
    return;
  }
  if (!r.success || !r.data || !r.data.length) {
    el.innerHTML = '<div style="padding:12px;color:var(--text-2);font-size:13px;">Нет свободных окон на этот день</div>';
    return;
  }
  let firstTime = '';
  el.innerHTML = r.data.map(t => {
    // Sanitize: allow only HH:MM chars to prevent onclick injection
    const time = (t.time || String(t.datetime || '').slice(11, 16)).replace(/[^0-9:]/g, '');
    if (!time) return '';
    if (!firstTime) firstTime = time;
    return `<button class="slot${time === firstTime ? ' sel' : ''}" onclick="selectSlot(this,'${time}')">${time}</button>`;
  }).join('');
  if (firstTime) { state.slot = firstTime; updateStickyBottom(); _setConfirmBtnEnabled(true); }
}

export function selectDate(el, iso) {
  document.querySelectorAll('#s-slots .date-item').forEach(d => d.classList.remove('sel'));
  el.classList.add('sel');
  if (!iso) return;
  loadTimes(iso);
}

export function selectSlot(el, time) {
  document.querySelectorAll('#s-slots .slot').forEach(s => s.classList.remove('sel'));
  el.classList.add('sel');
  state.slot = time || el.textContent.trim();
  updateStickyBottom();
}

Object.assign(window, { loadDates, loadTimes, selectDate, selectSlot, updateSlotsScreen, updateStickyBottom, updateConfirmScreen });
