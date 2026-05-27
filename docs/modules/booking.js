import { go } from './navigation.js';
import { state, getService, getMaster, SERVICES_DATA, MASTERS_DATA } from './state.js';
import { getSession } from './storage.js';
import { setAuthContext } from './storage.js';
import { YC, _findClientByPhone } from './api.js';
import { _loadStoredRecords } from './storage.js';
import { getInitials, esc, _fmtDatetime, _normalizePhone } from './utils.js';

// Callback for renderHomeHero — registered by app.js once profile.js is loaded
let _renderHomeHeroFn = () => {};
export function setBookingRenderFns({ renderHomeHero }) {
  if (renderHomeHero) _renderHomeHeroFn = renderHomeHero;
}

// ── SAVE BOOKED RECORD ──
function _saveBookedRecord(rec) {
  if (!rec) return;
  const svc = getService();
  const m = getMaster();
  const datetime = `${state.dateISO || new Date().toISOString().slice(0, 10)} ${state.slot || '10:00'}:00`;
  const records = _loadStoredRecords();
  const ycStaffId = rec.staff_id || (rec.appointments && rec.appointments[0] && rec.appointments[0].staff_id) || null;
  const ycSvcId = (rec.services && rec.services[0] && rec.services[0].id) ||
    (rec.appointments && rec.appointments[0] && rec.appointments[0].services && rec.appointments[0].services[0]) || null;
  records.unshift({
    id: rec.record_id || rec.id, hash: rec.record_hash || '',
    svcName: svc.name, svcId: svc.id,
    masterName: m ? m.name : 'Любой мастер', masterId: m ? m.id : 0,
    ycStaffId, ycSvcId,
    datetime, price: svc.priceStr, dur: svc.dur, status: 'upcoming',
  });
  localStorage.setItem('yc_records', JSON.stringify(records));
}

// ── BOOK ──
let _bookInProgress = false;
async function _bookWithSession(session) {
  if (_bookInProgress) return;
  _bookInProgress = true;
  const confirmBtn = document.querySelector('#s-confirm-pre .btn-primary, #s-slots .btn-primary');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Записываем…'; }
  try {
    const svc = getService();
    const m = getMaster();
    const datetime = `${state.dateISO || new Date().toISOString().slice(0, 10)} ${state.slot || '10:00'}:00`;
    const isForOther = !!(state._bookOtherName);
    let bookPhone = isForOther ? _normalizePhone(state._bookOtherPhone || '') : (session.phone || '');
    let bookName  = isForOther ? state._bookOtherName : (session.name || '');
    let bookEmail = isForOther ? '' : (session.email || '');
    if (isForOther) {
      try {
        const other = bookPhone.length === 11 ? await _findClientByPhone(bookPhone) : null;
        if (other) {
          bookEmail = other.email || '';
        } else if (bookPhone.length === 11) {
          await YC.post(`/clients/${YC.company}`, { name: bookName, phone: bookPhone });
        }
      } catch { /* proceed with booking even if client lookup/create fails */ }
    }
    const body = {
      phone: bookPhone,
      fullname: bookName,
      email: bookEmail,
      appointments: [{ id: 1, services: [parseInt(svc.id) || 0], staff_id: m ? parseInt(m.id) : 0, datetime }],
      notify_by_sms: 1,
    };
    const r = await YC.post(`/book_record/${YC.company}`, body);
    if (r.success) {
      _saveBookedRecord(r.data && r.data[0]);
      if (isForOther) { state._bookOtherName = ''; state._bookOtherPhone = ''; }
      go('s-confirm');
    } else {
      alert((r.meta?.message || 'Не удалось создать запись. Попробуйте снова.').slice(0, 200));
    }
  } finally {
    _bookInProgress = false;
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Подтвердить запись'; }
  }
}

// ── RESCHEDULE ──
let _rescheduleInProgress = false;
async function _rescheduleWithSession(session) {
  if (_rescheduleInProgress) return;
  _rescheduleInProgress = true;
  const id = state._rescheduleId;
  const datetime = `${state.dateISO || new Date().toISOString().slice(0, 10)} ${state.slot || '10:00'}:00`;

  let ycStaffId = null, ycSvcId = null, seanceLength = 3600;
  try {
    const fr = await YC.get(`/record/${YC.company}/${id}`);
    if (fr.success && fr.data) {
      ycStaffId = fr.data.staff_id;
      ycSvcId = fr.data.services && fr.data.services[0] && fr.data.services[0].id;
      seanceLength = fr.data.seance_length || 3600;
    }
  } catch(e) { console.error('reschedule: failed to fetch record from API', e); }

  if (!ycStaffId || !ycSvcId) {
    const records = _loadStoredRecords();
    const rec = records.find(x => String(x.id) === String(id));
    ycStaffId = ycStaffId || rec?.ycStaffId || null;
    ycSvcId = ycSvcId || rec?.ycSvcId || null;
  }

  const body = { datetime, seance_length: seanceLength };
  if (session.client_id) body.client = { id: parseInt(session.client_id), phone: session.phone || '' };
  if (ycStaffId) body.staff_id = parseInt(ycStaffId);
  if (ycSvcId) body.services = [{ id: parseInt(ycSvcId), amount: 1 }];

  try {
    const r = await YC.post(`/record/${YC.company}/${id}`, body, 'PUT');
    if (!r.success) {
      alert(`Не удалось перенести запись: ${(r.meta?.message || 'ошибка сервера').slice(0, 200)}. Позвоните в студию.`);
      return;
    }
    const records = _loadStoredRecords();
    const idx = records.findIndex(x => String(x.id) === String(id));
    if (idx !== -1) { records[idx].datetime = datetime; localStorage.setItem('yc_records', JSON.stringify(records)); }
    state._rescheduleId = null;
    _renderHomeHeroFn();
    go('s-confirm');
    const title = document.querySelector('#s-confirm .confirm-title');
    const sub = document.querySelector('#s-confirm .confirm-sub');
    if (title) title.textContent = 'Запись перенесена!';
    if (sub) sub.textContent = 'Время успешно изменено';
  } finally {
    _rescheduleInProgress = false;
  }
}

// ── PUBLIC API ──
export function startBooking() {
  const session = getSession();
  if (!session) {
    state._bookAfterLogin = true;
    setAuthContext('login');
    go('s-login');
    return;
  }
  if (state._rescheduleId) {
    _rescheduleWithSession(session);
  } else {
    _bookWithSession(session);
  }
}

export function rescheduleRecord(id) {
  const records = _loadStoredRecords();
  const rec = records.find(r => String(r.id) === String(id));
  if (!rec) return;
  state._rescheduleId = id;
  if (rec.svcId) {
    const svc = SERVICES_DATA.find(s => s.id === rec.svcId || String(s.id) === String(rec.svcId));
    if (svc) state.serviceId = svc.id;
  }
  if (rec.masterId) {
    const m = MASTERS_DATA.find(x => x.id === rec.masterId || String(x.id) === String(rec.masterId));
    state.masterId = m ? m.id : null;
  }
  go('s-slots');
}

export function cancelRecord(id, hash) {
  state._cancelId = id;
  state._cancelHash = hash || '';
  const records = _loadStoredRecords();
  const rec = records.find(r => String(r.id) === String(id));
  const cancelCard = document.querySelector('#s-cancel .cancel-card');
  if (cancelCard) {
    if (rec) {
      cancelCard.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <div style="width:44px;height:44px;border-radius:50%;background:var(--accent-light);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:var(--accent);flex-shrink:0;">${esc(getInitials(rec.masterName))}</div>
          <div><div style="font-size:15px;font-weight:700;">${esc(rec.masterName)}</div><div style="font-size:12px;color:var(--text-2);">Мастер</div></div>
        </div>
        <div style="font-size:17px;font-weight:800;margin-bottom:6px;">${esc(rec.svcName)}</div>
        <div style="font-size:14px;color:var(--text-2);">${esc(_fmtDatetime(rec.datetime))} · ${esc(String(rec.dur))} мин${rec.price ? ' · ' + esc(String(rec.price)) : ''}</div>`;
    } else {
      cancelCard.innerHTML = `<div style="font-size:15px;font-weight:700;">Запись #${esc(String(id))}</div>`;
    }
  }
  go('s-cancel');
}

let _cancelInProgress = false;
export async function confirmCancel() {
  if (_cancelInProgress) return;
  const id = state._cancelId;
  if (!id) return;
  _cancelInProgress = true;
  const btn = document.querySelector('#s-cancel .btn-danger');
  if (btn) { btn.disabled = true; btn.textContent = 'Отменяем…'; }

  const ctrl = new AbortController();
  const cancelTid = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${YC.base}/record/${YC.company}/${id}`, {
      method: 'DELETE',
      headers: YC._h(),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data = {};
    try { if (text && text.trim()) data = JSON.parse(text); } catch {}

    if (res.status >= 400) {
      clearTimeout(cancelTid);
      if (btn) { btn.disabled = false; btn.textContent = 'Да, отменить запись'; }
      const msg = (data?.meta?.message || `Ошибка ${res.status}`).slice(0, 200);
      alert(`Не удалось отменить: ${msg}. Позвоните в студию.`);
      _cancelInProgress = false;
      return;
    }
    clearTimeout(cancelTid);
  } catch {
    clearTimeout(cancelTid);
    if (btn) { btn.disabled = false; btn.textContent = 'Да, отменить запись'; }
    alert('Нет соединения с сервером. Попробуйте позже.');
    _cancelInProgress = false;
    return;
  }

  const records = _loadStoredRecords();
  const idx = records.findIndex(x => String(x.id) === String(id));
  if (idx !== -1) { records[idx].status = 'cancelled'; localStorage.setItem('yc_records', JSON.stringify(records)); }
  state._cancelId = null;
  state._cancelHash = null;
  go('s-home', 'tab');
  _renderHomeHeroFn();
  _cancelInProgress = false;
}

export function quickBook(svcId) {
  state.serviceId = svcId;
  state.masterId = null;
  go('s-masters');
}

export function rebook(svcId) {
  state.serviceId = svcId;
  state.masterId = null;
  go('s-masters');
}

export function bookWithMaster(masterId) {
  const m = MASTERS_DATA.find(x => x.id === masterId);
  if (!m) return;
  state.masterId = masterId;
  state.masterName = m.name;
  state.masterAvatar = m.avatar_big || m.avatar || '';
  state.masterGrad = m.grad;
  if (m.cats && m.cats.length) {
    const svc = SERVICES_DATA.find(s => s.cat === m.cats[0]);
    if (svc) { state.serviceId = svc.id; go('s-slots'); return; }
  }
  go('s-services');
}

Object.assign(window, {
  startBooking, rescheduleRecord, cancelRecord, confirmCancel,
  quickBook, rebook, bookWithMaster,
});
