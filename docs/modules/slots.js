import { YC } from './api.js';
import { state, getService, getMaster, getStaffPrice } from './state.js';
import { esc, _fmtDatetime, hapticTap, _localISODate } from './utils.js';
import { _loadStoredRecords } from './storage.js';
import { renderStudioContacts } from './studio.js';

function _setConfirmBtnEnabled(enabled) {
  const btn = document.querySelector('#s-slots .sticky-bottom .btn-primary');
  if (!btn) return;
  btn.disabled = !enabled;
  btn.style.opacity = enabled ? '' : '0.45';
}

// ── CALENDAR STATE ──
const _calCache = new Map(); // YYYY-MM → Set<iso>
let _calYear = 0;
let _calMonth = 0; // 0-based

function _calKey(y, m) { return `${y}-${String(m + 1).padStart(2, '0')}`; }

const _FETCH_ERROR = Symbol('fetch_error');

// ── TIME PERIODS ──
const _PERIODS = [
  { key: 'morning', label: 'Утро', test: h => h < 12 },
  { key: 'afternoon', label: 'День', test: h => h >= 12 && h < 17 },
  { key: 'evening', label: 'Вечер', test: h => h >= 17 },
];

async function _fetchDatesForMonth(y, m) {
  const key = _calKey(y, m);
  if (_calCache.has(key)) return _calCache.get(key);
  const svc = getService();
  const master = getMaster();
  const params = {
    service_ids: svc.id,
    date: `${y}-${String(m + 1).padStart(2, '0')}-01`,
  };
  if (master) params.staff_id = master.id;
  try {
    const r = await YC.get(`/book_dates/${YC.company}`, params);
    if (r.success) {
      const dates = r.data && r.data.booking_dates ? r.data.booking_dates : [];
      const set = new Set(dates.filter(iso => iso.slice(0, 7) === key));
      _calCache.set(key, set);
      return set;
    }
  } catch { /* fall through */ }
  _calCache.set(key, _FETCH_ERROR);
  return _FETCH_ERROR;
}

function _renderCalGrid(availSetOrError) {
  const availSet = availSetOrError === _FETCH_ERROR ? new Set() : availSetOrError;
  const grid = document.getElementById('calGrid');
  if (!grid) return;
  const lbl = document.getElementById('calMonthLbl');
  if (lbl) {
    const d = new Date(_calYear, _calMonth, 1);
    lbl.textContent = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  }

  const today = _localISODate();
  const todayY = parseInt(today.slice(0, 4), 10);
  const todayM = parseInt(today.slice(5, 7), 10) - 1;
  const todayD = parseInt(today.slice(8, 10), 10);

  // Navigation button states
  const prevBtn = document.getElementById('calPrev');
  const nextBtn = document.getElementById('calNext');
  const isCurrentMonth = _calYear === todayY && _calMonth === todayM;
  if (prevBtn) {
    prevBtn.disabled = isCurrentMonth;
    prevBtn.classList.toggle('cal-nav-disabled', isCurrentMonth);
  }

  // Determine forward limit: check if any date in next month exists in cache
  const nextY = _calMonth === 11 ? _calYear + 1 : _calYear;
  const nextM = _calMonth === 11 ? 0 : _calMonth + 1;
  const nextKey = _calKey(nextY, nextM);
  const nextCached = _calCache.get(nextKey);
  const hasNext = nextCached
    ? (nextCached !== _FETCH_ERROR && nextCached.size > 0)
    : true;
  if (nextBtn) {
    nextBtn.disabled = !hasNext;
    nextBtn.classList.toggle('cal-nav-disabled', !hasNext);
  }

  // Build grid: Monday-based weeks
  const firstDay = new Date(_calYear, _calMonth, 1);
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // convert to Mon-based (0=Mon)
  const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

  let html = '';
  const selISO = state.dateISO || '';
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startDow + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      html += '<div class="cal-cell cal-cell-empty"></div>';
      continue;
    }
    const iso = `${_calYear}-${String(_calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const isToday = _calYear === todayY && _calMonth === todayM && dayNum === todayD;
    const isPast = iso < today;
    const isAvail = availSet.has(iso);
    const isSel = iso === selISO;

    let cls = 'cal-cell';
    if (isSel) cls += ' sel';
    else if (isToday) cls += ' today';
    if (!isAvail || isPast) cls += ' unavail';

    if (isAvail && !isPast) {
      html += `<div class="${cls}" onclick="calSelectDate('${iso}')">${dayNum}</div>`;
    } else {
      html += `<div class="${cls}">${dayNum}</div>`;
    }
  }
  grid.innerHTML = html;

  if (availSetOrError === _FETCH_ERROR || availSet.size === 0) {
    const noSlots = document.createElement('div');
    noSlots.className = 'cal-no-dates';
    noSlots.textContent = availSetOrError === _FETCH_ERROR
      ? 'Не удалось загрузить даты. Проверьте соединение.'
      : 'Нет свободных дат в этом месяце';
    grid.appendChild(noSlots);
  }
}

export async function loadDates() {
  _calCache.clear();
  const today = new Date();
  _calYear = today.getFullYear();
  _calMonth = today.getMonth();

  const grid = document.getElementById('calGrid');
  if (grid) {
    grid.innerHTML = Array.from({ length: 35 }).map(() => '<div class="cal-cell skel skel-cal-cell"></div>').join('');
  }

  const availSet = await _fetchDatesForMonth(_calYear, _calMonth);

  // If current month has no dates, try next month
  if (availSet !== _FETCH_ERROR && availSet.size === 0) {
    const ny = _calMonth === 11 ? _calYear + 1 : _calYear;
    const nm = _calMonth === 11 ? 0 : _calMonth + 1;
    const nextSet = await _fetchDatesForMonth(ny, nm);
    if (nextSet !== _FETCH_ERROR && nextSet.size > 0) {
      _calYear = ny;
      _calMonth = nm;
      _renderCalGrid(nextSet);
      _autoSelectFirstDate(nextSet);
      // prefetch the month after to know forward nav limit
      const ny2 = nm === 11 ? ny + 1 : ny;
      const nm2 = nm === 11 ? 0 : nm + 1;
      if (!_calCache.has(_calKey(ny2, nm2))) {
        const snapY2 = _calYear, snapM2 = _calMonth;
        _fetchDatesForMonth(ny2, nm2).then(() => {
          if (_calYear === snapY2 && _calMonth === snapM2) {
            const cur2 = _calCache.get(_calKey(snapY2, snapM2));
            _renderCalGrid(cur2 !== undefined ? cur2 : new Set());
          }
        });
      }
      return;
    }
  }

  _renderCalGrid(availSet);
  _autoSelectFirstDate(availSet !== _FETCH_ERROR ? availSet : new Set());

  // Background prefetch of next month to correctly disable/enable forward nav
  const ny = _calMonth === 11 ? _calYear + 1 : _calYear;
  const nm = _calMonth === 11 ? 0 : _calMonth + 1;
  const nextKey = _calKey(ny, nm);
  if (!_calCache.has(nextKey)) {
    const snapY = _calYear, snapM = _calMonth;
    _fetchDatesForMonth(ny, nm).then(() => {
      if (_calYear === snapY && _calMonth === snapM) {
        const cur = _calCache.get(_calKey(snapY, snapM));
        _renderCalGrid(cur !== undefined ? cur : new Set());
      }
    });
  }
}

function _autoSelectFirstDate(availSet) {
  const today = _localISODate();
  const sorted = Array.from(availSet).filter(d => d >= today).sort();
  if (sorted.length) {
    calSelectDate(sorted[0]);
  }
}

export async function calNavMonth(delta) {
  hapticTap('select');
  let m = _calMonth + delta;
  let y = _calYear;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }

  const today = new Date();
  const minY = today.getFullYear(), minM = today.getMonth();
  if (y < minY || (y === minY && m < minM)) return;

  _calYear = y;
  _calMonth = m;

  const grid = document.getElementById('calGrid');
  if (grid) {
    grid.innerHTML = Array.from({ length: 35 }).map(() => '<div class="cal-cell skel skel-cal-cell"></div>').join('');
  }

  const snapY = y, snapM = m;
  const availSet = await _fetchDatesForMonth(y, m);

  // Pre-fetch next month to know if forward nav is available
  const ny = m === 11 ? y + 1 : y;
  const nm = m === 11 ? 0 : m + 1;
  if (!_calCache.has(_calKey(ny, nm))) {
    _fetchDatesForMonth(ny, nm);
  }

  if (_calYear === snapY && _calMonth === snapM) {
    _renderCalGrid(availSet);
  }
}

export function calSelectDate(iso) {
  hapticTap('select');
  state.dateISO = iso;
  const y = parseInt(iso.slice(0, 4), 10);
  const m = parseInt(iso.slice(5, 7), 10) - 1;
  const key = _calKey(y, m);
  const cached = _calCache.get(key);
  const availSet = cached && cached !== _FETCH_ERROR ? cached : new Set();
  _renderCalGrid(availSet);
  loadTimes(iso);
}

// ── SLOTS SCREEN ──
export function updateSlotsScreen() {
  const pageTitle = document.querySelector('#s-slots .page-title');

  let reschBanner = document.getElementById('rescheduleBanner');
  if (state._rescheduleId && pageTitle) {
    const records = _loadStoredRecords();
    const rec = records.find(r => String(r.id) === String(state._rescheduleId));
    if (rec) {
      if (!reschBanner) {
        reschBanner = document.createElement('div');
        reschBanner.id = 'rescheduleBanner';
        reschBanner.style.cssText = 'margin:8px 20px 0;padding:10px 14px;background:var(--accent-light);border-radius:12px;border-left:3px solid var(--accent);';
        pageTitle.insertAdjacentElement('afterend', reschBanner);
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
  if (btn) btn.textContent = state._rescheduleId ? 'Перенести запись' : 'Записаться';
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

  const contacts = document.getElementById('confirmContacts');
  if (contacts) contacts.innerHTML = renderStudioContacts({ variant: 'confirm' });
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
  el.innerHTML = Array.from({ length: 9 }).map(() => '<div class="skel skel-slot"></div>').join('');
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

  const buckets = { morning: [], afternoon: [], evening: [] };
  r.data.forEach(t => {
    const time = (t.time || String(t.datetime || '').slice(11, 16)).replace(/[^0-9:]/g, '');
    if (!time) return;
    const h = parseInt(time.slice(0, 2), 10);
    const p = _PERIODS.find(p => p.test(h));
    if (p) buckets[p.key].push(time);
  });

  let firstTime = '';
  let html = '';
  _PERIODS.forEach(period => {
    const times = buckets[period.key];
    if (!times.length) return;
    html += `<div class="slot-period">
      <div class="slot-period-hdr" onclick="toggleSlotPeriod(this)">
        <span>${esc(period.label)}</span>
        <svg class="slot-period-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
      </div>
      <div class="slot-period-body">
        <div class="slots-grid">`;
    times.forEach(time => {
      if (!firstTime) firstTime = time;
      html += `<button class="slot${time === firstTime ? ' sel' : ''}" onclick="selectSlot(this,'${time}')">${esc(time)}</button>`;
    });
    html += `</div></div></div>`;
  });

  if (!html) {
    el.innerHTML = '<div style="padding:12px;color:var(--text-2);font-size:13px;">Нет свободных окон на этот день</div>';
    return;
  }

  el.innerHTML = html;
  if (firstTime) { state.slot = firstTime; updateStickyBottom(); _setConfirmBtnEnabled(true); }
}

export function toggleSlotPeriod(hdr) {
  const period = hdr.closest('.slot-period');
  if (!period) return;
  period.classList.toggle('collapsed');
}

export function selectSlot(el, time) {
  hapticTap('select');
  document.querySelectorAll('#s-slots .slot').forEach(s => s.classList.remove('sel'));
  el.classList.add('sel');
  state.slot = time || el.textContent.trim();
  updateStickyBottom();
}

Object.assign(window, { loadDates, loadTimes, calNavMonth, calSelectDate, toggleSlotPeriod, selectSlot, updateSlotsScreen, updateStickyBottom, updateConfirmScreen });
