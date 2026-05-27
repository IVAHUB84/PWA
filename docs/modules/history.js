import { getSession } from './storage.js';
import { _loadStoredRecords } from './storage.js';
import { _fetchAndMergeServerRecords } from './api.js';
import { getInitials, esc, _fmtDatetime } from './utils.js';

export function renderHistoryScreen() {
  _renderHistoryFromCache();
  const session = getSession();
  if (session && session.client_id) {
    _fetchAndMergeServerRecords(session.client_id).then(() => _renderHistoryFromCache());
  }
}

export function _renderHistoryFromCache() {
  const records = _loadStoredRecords().filter(r => r.status !== 'cancelled');
  const now = new Date();
  const upcoming = records.filter(r => new Date(r.datetime.replace(' ', 'T')) > now);
  const past = records.filter(r => new Date(r.datetime.replace(' ', 'T')) <= now);

  const upEl = document.getElementById('histUpcoming');
  const paEl = document.getElementById('histPast');
  const upSec = document.getElementById('histUpcomingSection');
  const paSec = document.getElementById('histPastSection');

  if (upEl) {
    if (upcoming.length === 0) {
      if (upSec) upSec.style.display = 'none';
      upEl.innerHTML = '';
    } else {
      if (upSec) upSec.style.display = '';
      upEl.innerHTML = upcoming.map(r => `
        <div class="hist-upcoming">
          <div class="hist-row">
            <div class="hist-av" style="background:var(--accent-light);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:var(--accent);">${getInitials(r.masterName)}</div>
            <div style="flex:1;"><div style="font-size:14px;font-weight:700;">${esc(r.masterName)}</div></div>
            <div style="text-align:right;font-size:13px;font-weight:700;color:var(--accent);">${_fmtDatetime(r.datetime)}</div>
          </div>
          <div style="font-size:16px;font-weight:800;margin-bottom:${r.forName ? '4px' : '12px'};">${esc(r.svcName)}</div>
          ${r.forName ? `<div style="font-size:12px;color:var(--text-2);margin-bottom:12px;">для ${esc(r.forName)}</div>` : ''}
          <div style="display:flex;gap:8px;">
            <button class="hero-btn" style="font-size:13px;" data-rid="${esc(String(r.id))}" onclick="rescheduleRecord(this.dataset.rid)">Перенести</button>
            <button class="hero-btn" style="font-size:13px;" data-cid="${r.id}" data-chash="${r.hash || ''}" onclick="cancelRecord(this.dataset.cid,this.dataset.chash)">Отменить</button>
          </div>
        </div>`).join('');
    }
  }

  if (paEl) {
    if (past.length === 0) {
      if (upcoming.length === 0) {
        if (upSec) upSec.style.display = 'none';
        if (paSec) paSec.style.display = 'none';
        paEl.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;padding:48px 20px 32px;text-align:center;">
          <div style="font-size:56px;margin-bottom:16px;">📅</div>
          <div style="font-size:17px;font-weight:800;margin-bottom:8px;">Записей пока нет</div>
          <div style="font-size:14px;color:var(--text-2);line-height:1.5;margin-bottom:24px;">Ваш первый визит появится здесь после записи</div>
          <button class="btn-primary" style="width:100%;max-width:280px;" onclick="go('s-services','tab')">Записаться →</button>
        </div>`;
      } else {
        if (paSec) paSec.style.display = 'none';
        paEl.innerHTML = '';
      }
    } else {
      if (paSec) paSec.style.display = '';
      paEl.innerHTML = past.map((r, i) => `
        <div class="hist-visit"${i === past.length - 1 ? ' style="margin-bottom:24px;"' : ''}>
          <div class="hist-emoji" style="background:var(--accent-light);">✨</div>
          <div style="flex:1;"><div style="font-size:14px;font-weight:700;margin-bottom:2px;">${esc(r.svcName)}</div><div style="font-size:12px;color:var(--text-2);">${esc(r.masterName)} · ${_fmtDatetime(r.datetime)}</div></div>
          <div style="text-align:right;"><div style="font-size:14px;font-weight:700;margin-bottom:2px;">${esc(String(r.price || ''))}</div><button class="btn-ghost" style="font-size:12px;display:block;margin-bottom:4px;" data-sid="${esc(String(r.svcId))}" onclick="rebook(this.dataset.sid)">Повторить</button><button class="btn-ghost" style="font-size:12px;color:var(--accent);" data-rid="${esc(String(r.id))}" data-mid="${esc(String(r.masterId))}" data-mname="${esc(r.masterName)}" data-sname="${esc(r.svcName)}" data-dt="${esc(r.datetime)}" onclick="openRateVisit(this.dataset.rid,this.dataset.mid,this.dataset.mname,this.dataset.sname,this.dataset.dt)">Оценить</button></div>
        </div>`).join('');
    }
  }
}

Object.assign(window, { renderHistoryScreen });
