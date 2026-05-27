import { getSession } from './storage.js';
import { _loadStoredRecords } from './storage.js';
import { _fetchAndMergeServerRecords } from './api.js';
import { esc, _fmtDatetime } from './utils.js';

let _histFrom = null;
let _histTo = null;

function _fmtDate(d) {
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function _updatePeriodBtn() {
  const lbl = document.getElementById('histPeriodLabel');
  if (!lbl) return;
  if (_histFrom || _histTo) {
    const from = _histFrom ? _fmtDate(_histFrom) : '…';
    const to   = _histTo   ? _fmtDate(_histTo)   : '…';
    lbl.textContent = `${from} — ${to}`;
    const btn = document.getElementById('histPeriodBtn');
    if (btn) btn.style.borderColor = 'var(--accent)';
  } else {
    lbl.textContent = 'Всё время';
    const btn = document.getElementById('histPeriodBtn');
    if (btn) btn.style.borderColor = '';
  }
}

export function _openHistPeriod() {
  const toIso = d => d ? d.toISOString().slice(0, 10) : '';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;display:flex;align-items:flex-end;';
  overlay.dataset.histOverlay = '1';
  overlay.innerHTML = `<div style="background:var(--bg);width:100%;border-radius:24px 24px 0 0;padding:20px 20px 32px;max-width:393px;margin:0 auto;">
    <div style="width:36px;height:4px;background:var(--border);border-radius:4px;margin:0 auto 20px;"></div>
    <div style="font-size:17px;font-weight:800;margin-bottom:16px;">Период</div>
    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
      <button class="chip" onclick="_histPreset(7)">Неделя</button>
      <button class="chip" onclick="_histPreset(30)">Месяц</button>
      <button class="chip" onclick="_histPreset(90)">3 месяца</button>
      <button class="chip" onclick="_histPreset(0)">Всё время</button>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:20px;">
      <div style="flex:1;">
        <div class="label" style="margin-bottom:6px;">С</div>
        <input id="_hFrom" type="date" value="${toIso(_histFrom)}" style="width:100%;height:44px;border:1.5px solid var(--border);border-radius:12px;padding:0 12px;font-size:16px;font-family:inherit;background:var(--surface);color:var(--text);box-sizing:border-box;">
      </div>
      <div style="flex:1;">
        <div class="label" style="margin-bottom:6px;">По</div>
        <input id="_hTo" type="date" value="${toIso(_histTo)}" style="width:100%;height:44px;border:1.5px solid var(--border);border-radius:12px;padding:0 12px;font-size:16px;font-family:inherit;background:var(--surface);color:var(--text);box-sizing:border-box;">
      </div>
    </div>
    <button class="btn-primary" onclick="_applyHistPeriod()">Применить</button>
    <button class="btn-dim" style="width:100%;margin-top:8px;" onclick="_applyHistPeriod(true)">Сбросить</button>
  </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

export function _histPreset(days) {
  const fEl = document.getElementById('_hFrom');
  const tEl = document.getElementById('_hTo');
  if (!fEl || !tEl) return;
  const today = new Date();
  today.setHours(23, 59, 59, 0);
  tEl.value = today.toISOString().slice(0, 10);
  if (days === 0) {
    fEl.value = '';
    tEl.value = '';
  } else {
    const from = new Date(today);
    from.setDate(from.getDate() - days);
    fEl.value = from.toISOString().slice(0, 10);
  }
}

export function _applyHistPeriod(reset) {
  if (reset) {
    _histFrom = null;
    _histTo = null;
  } else {
    const fVal = document.getElementById('_hFrom')?.value;
    const tVal = document.getElementById('_hTo')?.value;
    _histFrom = fVal ? new Date(fVal) : null;
    if (tVal) { _histTo = new Date(tVal); _histTo.setHours(23, 59, 59, 0); }
    else _histTo = null;
  }
  document.querySelector('[data-hist-overlay]')?.remove();
  _updatePeriodBtn();
  _renderHistoryFromCache();
}

export function renderHistoryScreen() {
  _histFrom = null;
  _histTo = null;
  _updatePeriodBtn();
  _renderHistoryFromCache();
  const session = getSession();
  if (session && session.client_id) {
    _fetchAndMergeServerRecords(session.client_id).then(() => _renderHistoryFromCache());
  }
}

export function _renderHistoryFromCache() {
  const records = _loadStoredRecords().filter(r => r.status !== 'cancelled');
  const reviews = JSON.parse(localStorage.getItem('yc_reviews') || '[]');
  const reviewedIds = new Set(reviews.map(r => r.recordId).filter(Boolean));
  const now = new Date();
  const upcoming = records
    .filter(r => new Date(r.datetime.replace(' ', 'T')) > now)
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  let past = records.filter(r => new Date(r.datetime.replace(' ', 'T')) <= now);

  if (_histFrom) past = past.filter(r => new Date(r.datetime.replace(' ', 'T')) >= _histFrom);
  if (_histTo)   past = past.filter(r => new Date(r.datetime.replace(' ', 'T')) <= _histTo);

  const upEl = document.getElementById('histUpcoming');
  const paEl = document.getElementById('histPast');
  if (!paEl) return;

  if (upEl) {
    if (!upcoming.length) {
      upEl.innerHTML = '';
    } else {
      upEl.innerHTML = `
        <div style="padding:8px 20px 6px;"><div class="label">Предстоящие · ${upcoming.length}</div></div>
        <div class="settings-group" style="margin-bottom:16px;">
          ${upcoming.map(r => `
            <div class="s-row" style="align-items:flex-start;">
              <div class="s-ico" style="padding-top:2px;">📅</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:15px;font-weight:600;">${esc(r.svcName)}</div>
                <div style="font-size:12px;color:var(--text-2);margin-top:2px;">${esc(r.masterName)} · ${_fmtDatetime(r.datetime)}</div>
                ${r.price ? `<div style="font-size:13px;font-weight:700;margin-top:3px;color:var(--accent);">${esc(String(r.price))}</div>` : ''}
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;padding-top:2px;">
                <button class="btn-ghost" style="font-size:12px;" data-rid="${esc(String(r.id))}" onclick="event.stopPropagation();rescheduleRecord(this.dataset.rid)">Перенести</button>
                <button class="btn-ghost" style="font-size:12px;color:var(--red);" data-cid="${esc(String(r.id))}" data-chash="${esc(r.hash||'')}" onclick="event.stopPropagation();cancelRecord(this.dataset.cid,this.dataset.chash)">Отменить</button>
              </div>
            </div>`).join('')}
        </div>`;
    }
  }

  if (past.length === 0) {
    if (upcoming.length > 0 && !_histFrom && !_histTo) {
      paEl.innerHTML = '';
    } else {
      paEl.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;padding:48px 20px 32px;text-align:center;">
        <div style="font-size:56px;margin-bottom:16px;">📅</div>
        <div style="font-size:17px;font-weight:800;margin-bottom:8px;">${_histFrom || _histTo ? 'Нет визитов за этот период' : 'Записей пока нет'}</div>
        <div style="font-size:14px;color:var(--text-2);line-height:1.5;margin-bottom:24px;">${_histFrom || _histTo ? 'Попробуйте изменить период' : 'Ваш первый визит появится здесь после записи'}</div>
        ${!(_histFrom || _histTo) ? '<button class="btn-primary" style="width:100%;max-width:280px;" onclick="go(\'s-services\',\'tab\')">Записаться →</button>' : ''}
      </div>`;
    }
    return;
  }

  paEl.innerHTML = `
    <div style="padding:8px 20px 6px;"><div class="label">Прошлые визиты · ${past.length}</div></div>
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
            <button class="btn-ghost" style="font-size:12px;" data-sid="${esc(String(r.svcId))}" data-mid="${esc(String(r.masterId || ''))}" onclick="event.stopPropagation();rebook(this.dataset.sid,this.dataset.mid)">Повторить</button>
            ${reviewedIds.has(String(r.id)) ? '' : `<button class="btn-ghost" style="font-size:12px;color:var(--accent);" data-rid="${esc(String(r.id))}" data-mid="${esc(String(r.masterId))}" data-mname="${esc(r.masterName)}" data-sname="${esc(r.svcName)}" data-dt="${esc(r.datetime)}" onclick="event.stopPropagation();openRateVisit(this.dataset.rid,this.dataset.mid,this.dataset.mname,this.dataset.sname,this.dataset.dt)">Оценить</button>`}
          </div>
        </div>`).join('')}
    </div>`;
}

Object.assign(window, { renderHistoryScreen, _openHistPeriod, _histPreset, _applyHistPeriod });
