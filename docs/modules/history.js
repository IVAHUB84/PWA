import { getSession } from './storage.js';
import { _loadStoredRecords } from './storage.js';
import { _fetchAndMergeServerRecords } from './api.js';
import { esc, _fmtDatetime } from './utils.js';

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
  const past = records.filter(r => new Date(r.datetime.replace(' ', 'T')) <= now);

  const paEl = document.getElementById('histPast');
  if (!paEl) return;

  if (past.length === 0) {
    paEl.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;padding:48px 20px 32px;text-align:center;">
      <div style="font-size:56px;margin-bottom:16px;">📅</div>
      <div style="font-size:17px;font-weight:800;margin-bottom:8px;">Записей пока нет</div>
      <div style="font-size:14px;color:var(--text-2);line-height:1.5;margin-bottom:24px;">Ваш первый визит появится здесь после записи</div>
      <button class="btn-primary" style="width:100%;max-width:280px;" onclick="go('s-services','tab')">Записаться →</button>
    </div>`;
    return;
  }

  paEl.innerHTML = `
    <div style="padding:8px 20px 6px;"><div class="label">Прошлые визиты</div></div>
    <div class="settings-group" style="margin-bottom:24px;">
      ${past.map(r => `
        <div class="s-row" style="align-items:flex-start;">
          <div class="s-ico" style="padding-top:2px;">✨</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:15px;font-weight:600;">${esc(r.svcName)}</div>
            <div style="font-size:12px;color:var(--text-2);margin-top:2px;">${esc(r.masterName)} · ${_fmtDatetime(r.datetime)}</div>
            ${r.price ? `<div style="font-size:13px;font-weight:700;margin-top:3px;color:var(--accent);">${esc(String(r.price))}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;padding-top:2px;">
            <button class="btn-ghost" style="font-size:12px;" data-sid="${esc(String(r.svcId))}" onclick="event.stopPropagation();rebook(this.dataset.sid)">Повторить</button>
            <button class="btn-ghost" style="font-size:12px;color:var(--accent);" data-rid="${esc(String(r.id))}" data-mid="${esc(String(r.masterId))}" data-mname="${esc(r.masterName)}" data-sname="${esc(r.svcName)}" data-dt="${esc(r.datetime)}" onclick="event.stopPropagation();openRateVisit(this.dataset.rid,this.dataset.mid,this.dataset.mname,this.dataset.sname,this.dataset.dt)">Оценить</button>
          </div>
        </div>`).join('')}
    </div>`;
}

Object.assign(window, { renderHistoryScreen });
