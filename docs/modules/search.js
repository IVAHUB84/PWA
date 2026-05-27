import { state, MASTERS_DATA, SERVICES_DATA } from './state.js';
import { go } from './navigation.js';
import { getInitials, esc, _normalizePhone } from './utils.js';

export function _homeSearch(q) {
  const res = document.getElementById('homeSearchResults');
  if (!res) return;
  q = q.trim().toLowerCase();
  if (!q) { res.style.display = 'none'; return; }
  const masters = MASTERS_DATA.filter(m => m.name.toLowerCase().includes(q) || (m.role || '').toLowerCase().includes(q));
  const svcs = SERVICES_DATA.filter(s => s.name.toLowerCase().includes(q) || (s.cat || '').toLowerCase().includes(q));
  if (!masters.length && !svcs.length) {
    res.innerHTML = '<div style="padding:12px 16px;font-size:13px;color:var(--text-2);">Ничего не найдено</div>';
    res.style.display = 'block';
    return;
  }
  let html = '';
  masters.slice(0, 3).forEach(m => {
    html += `<div style="padding:10px 16px;display:flex;align-items:center;gap:10px;cursor:pointer;border-bottom:1px solid var(--border);" data-mid="${esc(m.id)}" onclick="bookWithMaster(this.dataset.mid);document.getElementById('homeSearch').value='';document.getElementById('homeSearchResults').style.display='none'">
      <div style="width:32px;height:32px;border-radius:50%;background:${m.grad};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;flex-shrink:0;">${getInitials(m.name)}</div>
      <div><div style="font-size:13px;font-weight:700;">${esc(m.name)}</div><div style="font-size:11px;color:var(--text-2);">${esc(m.role)}</div></div>
    </div>`;
  });
  svcs.slice(0, 4).forEach(s => {
    html += `<div style="padding:10px 16px;display:flex;align-items:center;gap:10px;cursor:pointer;border-bottom:1px solid var(--border);" data-sid="${esc(s.id)}" onclick="quickBook(this.dataset.sid);document.getElementById('homeSearch').value='';document.getElementById('homeSearchResults').style.display='none'">
      <div style="width:32px;height:32px;border-radius:50%;background:var(--accent-light);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">✂️</div>
      <div><div style="font-size:13px;font-weight:700;">${esc(s.name)}</div><div style="font-size:11px;color:var(--text-2);">${esc(s.cat)} · ${esc(s.priceStr)}</div></div>
    </div>`;
  });
  res.innerHTML = html;
  res.style.display = 'block';
}

export function showBookForOtherModal() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-end;';
  overlay.innerHTML = `<div style="background:var(--bg);width:100%;border-radius:24px;padding:24px 20px 32px;max-width:393px;margin:auto 0 16px;">
    <div style="font-size:17px;font-weight:800;margin-bottom:16px;">Кого записываем?</div>
    <div style="margin-bottom:12px;"><div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:6px;">ИМЯ</div>
      <input id="_oName" placeholder="Имя" style="width:100%;box-sizing:border-box;height:48px;border:1.5px solid var(--border);border-radius:12px;padding:0 14px;font-size:15px;font-family:inherit;background:var(--surface);"></div>
    <div style="margin-bottom:20px;"><div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:6px;">ТЕЛЕФОН</div>
      <input id="_oPhone" placeholder="+7 (___) ___-__-__" type="tel" inputmode="numeric" maxlength="18" oninput="_formatPhoneInput(this)" style="width:100%;box-sizing:border-box;height:48px;border:1.5px solid var(--border);border-radius:12px;padding:0 14px;font-size:15px;font-family:inherit;background:var(--surface);"></div>
    <button style="width:100%;height:52px;background:var(--accent);color:#fff;border:none;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;" onclick="_confirmBookOther()">Записать →</button>
    <button style="width:100%;margin-top:10px;height:44px;background:none;border:none;color:var(--text-2);font-size:15px;cursor:pointer;font-family:inherit;" onclick="this.closest('[data-overlay]').remove()">Отмена</button>
  </div>`;
  overlay.dataset.overlay = '1';
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

export function _confirmBookOther() {
  const name = (document.getElementById('_oName') || {}).value || '';
  const phone = (document.getElementById('_oPhone') || {}).value || '';
  if (!name.trim()) { alert('Введите имя'); return; }
  const normPhone = _normalizePhone(phone);
  if (normPhone.length !== 11) { alert('Введите корректный номер телефона'); return; }
  document.querySelector('[data-overlay]')?.remove();
  state._bookOtherName = name.trim();
  state._bookOtherPhone = normPhone;
  go('s-services', 'tab');
}

Object.assign(window, { _homeSearch, showBookForOtherModal, _confirmBookOther });
