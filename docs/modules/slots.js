import { YC } from './api.js';
import { state, getService, getMaster, getStaffPrice } from './state.js';
import { esc, _fmtDatetime, hapticTap, _localISODate } from './utils.js';
import { _loadStoredRecords } from './storage.js';
import { renderStudioContacts } from './studio.js';

// ── CALENDAR STATE ──
const _calCache = new Map(); // YYYY-MM → Set<iso>
let _calYear = 0;
let _calMonth = 0; // 0-based
let _calCollapsed = false;
let _swipeListenersAttached = false;

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

function _getWeekStart(iso) {
  const d = new Date(iso + 'T00:00:00');
  const dow = d.getDay();
  const monOffset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + monOffset);
  return d;
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

  const prevBtn = document.getElementById('calPrev');
  const nextBtn = document.getElementById('calNext');
  const isCurrentMonth = _calYear === todayY && _calMonth === todayM;
  if (prevBtn) {
    prevBtn.disabled = isCurrentMonth;
    prevBtn.classList.toggle('cal-nav-disabled', isCurrentMonth);
  }

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

  // Update collapsed class on cal-card for animation
  const calCard = document.querySelector('#s-slots .cal-card');
  if (calCard) calCard.classList.toggle('cal-collapsed', _calCollapsed);

  if (_calCollapsed) {
    _renderWeekRow(grid, availSet, today, todayY, todayM, todayD);
  } else {
    _renderMonthGrid(grid, availSet, today, todayY, todayM, todayD);
  }

  if (!_calCollapsed && (availSetOrError === _FETCH_ERROR || availSet.size === 0)) {
    const noSlots = document.createElement('div');
    noSlots.className = 'cal-no-dates';
    noSlots.textContent = availSetOrError === _FETCH_ERROR
      ? 'Не удалось загрузить даты. Проверьте соединение.'
      : 'Нет свободных дат в этом месяце';
    grid.appendChild(noSlots);
  }
}

function _renderMonthGrid(grid, availSet, today, todayY, todayM, todayD) {
  const firstDay = new Date(_calYear, _calMonth, 1);
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;
  const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

  const selISO = state.dateISO || '';
  let html = '';
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startDow + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      html += '<div class="cal-cell cal-cell-empty"></div>';
      continue;
    }
    html += _buildCell(_calYear, _calMonth, dayNum, availSet, today, todayY, todayM, todayD, selISO);
  }
  grid.innerHTML = html;
}

function _renderWeekRow(grid, availSet, today, todayY, todayM, todayD) {
  const anchorISO = state.dateISO || today;
  const weekStart = _getWeekStart(anchorISO);

  const selISO = state.dateISO || '';
  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = d.getMonth();
    const dayNum = d.getDate();

    // Gather availSet for the day's month (may differ from _calMonth)
    const dayKey = _calKey(y, m);
    let dayAvailSet = availSet;
    if (dayKey !== _calKey(_calYear, _calMonth)) {
      if (!_calCache.has(dayKey)) {
        const snapY = _calYear, snapM = _calMonth;
        _fetchDatesForMonth(y, m).then(() => {
          if (_calYear === snapY && _calMonth === snapM && _calCollapsed) {
            const cur = _calCache.get(_calKey(snapY, snapM));
            _renderCalGrid(cur !== undefined ? cur : new Set());
          }
        });
      }
      const cached = _calCache.get(dayKey);
      dayAvailSet = cached && cached !== _FETCH_ERROR ? cached : new Set();
    }

    html += _buildCell(y, m, dayNum, dayAvailSet, today, todayY, todayM, todayD, selISO);
  }
  grid.innerHTML = html;
}

function _buildCell(y, m, dayNum, availSet, today, todayY, todayM, todayD, selISO) {
  const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
  const isToday = y === todayY && m === todayM && dayNum === todayD;
  const isPast = iso < today;
  const isAvail = availSet.has(iso);
  const isSel = iso === selISO;

  let cls = 'cal-cell';
  if (isSel) cls += ' sel';
  else if (isToday) cls += ' today';
  if (!isAvail || isPast) cls += ' unavail';

  if (isAvail && !isPast) {
    const monthNames = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    const label = `${dayNum} ${monthNames[m]}`;
    return `<div class="${cls}" role="button" tabindex="0" aria-label="${label}" onclick="calSelectDate('${iso}')">${dayNum}</div>`;
  }
  return `<div class="${cls}" aria-hidden="true">${dayNum}</div>`;
}

export async function loadDates() {
  _calCache.clear();
  _calCollapsed = false;
  state.dateISO = '';
  state.slot = '';
  state.dateFull = '';

  const today = new Date();
  _calYear = today.getFullYear();
  _calMonth = today.getMonth();

  const grid = document.getElementById('calGrid');
  if (grid) {
    grid.innerHTML = Array.from({ length: 35 }).map(() => '<div class="cal-cell skel skel-cal-cell"></div>').join('');
  }

  const availSet = await _fetchDatesForMonth(_calYear, _calMonth);

  if (availSet !== _FETCH_ERROR && availSet.size === 0) {
    const ny = _calMonth === 11 ? _calYear + 1 : _calYear;
    const nm = _calMonth === 11 ? 0 : _calMonth + 1;
    const nextSet = await _fetchDatesForMonth(ny, nm);
    if (nextSet !== _FETCH_ERROR && nextSet.size > 0) {
      _calYear = ny;
      _calMonth = nm;
      _renderCalGrid(nextSet);
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

export function toggleCalCollapsed() {
  hapticTap('select');
  _calCollapsed = !_calCollapsed;
  const key = _calKey(_calYear, _calMonth);
  const cached = _calCache.get(key);
  const availSet = cached && cached !== _FETCH_ERROR ? cached : new Set();
  _renderCalGrid(availSet);
}

function _initCalSwipe() {
  if (_swipeListenersAttached) return;
  const zone = document.querySelector('#s-slots .slots-cal-zone');
  if (!zone) return;
  let startX = 0;
  let startY = 0;
  let startTime = 0;

  zone.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
  }, { passive: true });

  zone.addEventListener('touchend', e => {
    if (e.target.closest('.cal-cell')) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    const dt = Date.now() - startTime;
    const absDy = Math.abs(dy);
    const absDx = Math.abs(dx);
    // Require predominantly vertical gesture that isn't a tap
    if (absDy < 30 || dt > 400 || absDy <= absDx * 1.5) return;
    if (dy < 0 && !_calCollapsed) {
      _calCollapsed = true;
    } else if (dy > 0 && _calCollapsed) {
      _calCollapsed = false;
    } else {
      return;
    }
    const key = _calKey(_calYear, _calMonth);
    const cached = _calCache.get(key);
    const availSet = cached && cached !== _FETCH_ERROR ? cached : new Set();
    _renderCalGrid(availSet);
  }, { passive: true });

  _swipeListenersAttached = true;
}

function _initHandleKeyboard() {
  const handle = document.getElementById('calDragHandle');
  if (!handle || handle.dataset.keyBound) return;
  handle.dataset.keyBound = '1';
  handle.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleCalCollapsed();
    }
  });
}

// ── SLOTS SCREEN ──
export function updateSlotsScreen() {
  const calZone = document.querySelector('#s-slots .slots-cal-zone');

  let reschBanner = document.getElementById('rescheduleBanner');
  if (state._rescheduleId && calZone) {
    const records = _loadStoredRecords();
    const rec = records.find(r => String(r.id) === String(state._rescheduleId));
    if (rec) {
      if (!reschBanner) {
        reschBanner = document.createElement('div');
        reschBanner.id = 'rescheduleBanner';
        reschBanner.style.cssText = 'margin:8px 20px 0;padding:10px 14px;background:var(--accent-light);border-radius:12px;border-left:3px solid var(--accent);';
        calZone.insertAdjacentElement('beforebegin', reschBanner);
      }
      reschBanner.innerHTML = `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-2);margin-bottom:3px;">Перенос записи</div>
        <div style="font-size:14px;font-weight:600;">${esc(rec.svcName)}</div>
        <div style="font-size:12px;color:var(--text-2);margin-top:2px;">Текущее время: ${esc(_fmtDatetime(rec.datetime))}</div>`;
    }
  } else if (reschBanner) {
    reschBanner.remove();
  }

  _initCalSwipe();
  _initHandleKeyboard();
  updateStickyBottom();
}

export function updateStickyBottom() {
  const bottom = document.getElementById('slotsStickyBottom');
  if (!bottom) return;

  if (state.dateISO && state.slot) {
    const svc = getService();
    const el = document.getElementById('stickyInfo');
    if (el) el.innerHTML = `<b>${esc(state.dateFull)} · ${esc(state.slot)}</b> · ${esc(svc.name)}`;
    const btn = bottom.querySelector('.btn-primary');
    if (btn) btn.textContent = state._rescheduleId ? 'Перенести запись' : 'Записаться';
    bottom.classList.remove('hidden');
  } else {
    bottom.classList.add('hidden');
  }
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
  state.slot = '';
  const d = new Date(iso + 'T00:00:00');
  const dateStr = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  state.dateFull = dateStr;
  if (lbl) lbl.textContent = 'Доступное время — ' + dateStr;
  el.innerHTML = Array.from({ length: 9 }).map(() => '<div class="skel skel-slot"></div>').join('');
  updateStickyBottom();
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

  let html = '';
  _PERIODS.forEach(period => {
    const times = buckets[period.key];
    if (!times.length) return;
    html += `<div class="slot-period">
      <div class="slot-period-hdr" role="button" tabindex="0" aria-label="${esc(period.label)}" onclick="toggleSlotPeriod(this)">
        <span>${esc(period.label)}</span>
        <svg class="slot-period-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
      </div>
      <div class="slot-period-body">
        <div class="slots-grid">`;
    times.forEach(time => {
      html += `<button class="slot" onclick="selectSlot(this,'${time}')">${esc(time)}</button>`;
    });
    html += `</div></div></div>`;
  });

  if (!html) {
    el.innerHTML = '<div style="padding:12px;color:var(--text-2);font-size:13px;">Нет свободных окон на этот день</div>';
    return;
  }

  el.innerHTML = html;
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

Object.assign(window, { loadDates, loadTimes, calNavMonth, calSelectDate, toggleSlotPeriod, selectSlot, updateSlotsScreen, updateStickyBottom, updateConfirmScreen, toggleCalCollapsed });
