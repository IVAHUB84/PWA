import { state, SERVICES_DATA } from './state.js';
import { go } from './navigation.js';
import { esc } from './utils.js';

function _updateCatFilterBtn() {
  const lbl = document.getElementById('catFilterLabel');
  if (lbl) lbl.textContent = (state.category && state.category !== 'Все') ? state.category : 'Все категории';
}

export function _openCatFilter() {
  const cats = [...new Set(SERVICES_DATA.map(s => s.cat))].filter(Boolean);
  const current = state.category || 'Все';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;display:flex;align-items:flex-end;';
  overlay.dataset.catOverlay = '1';
  overlay.innerHTML = `<div style="background:var(--bg);width:100%;border-radius:24px 24px 0 0;padding:20px 0 32px;max-width:393px;margin:0 auto;">
    <div style="width:36px;height:4px;background:var(--border);border-radius:4px;margin:0 auto 20px;"></div>
    <div style="font-size:17px;font-weight:800;padding:0 20px 12px;">Категория</div>
    <div class="settings-group" style="margin:0 20px 0;">
      <div class="s-row" data-cat="Все" onclick="_pickCat(this.dataset.cat)" style="justify-content:space-between;">
        <span class="s-lbl">Все категории</span>
        ${current === 'Все' ? '<span style="color:var(--accent);font-size:18px;">✓</span>' : ''}
      </div>
      ${cats.map(c => `
      <div class="s-row" data-cat="${esc(c)}" onclick="_pickCat(this.dataset.cat)" style="justify-content:space-between;">
        <span class="s-lbl">${esc(c)}</span>
        ${current === c ? '<span style="color:var(--accent);font-size:18px;">✓</span>' : ''}
      </div>`).join('')}
    </div>
  </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

export function _pickCat(cat) {
  document.querySelector('[data-cat-overlay]')?.remove();
  filterCategory(cat);
}

export function filterCategory(cat) {
  state.category = cat;
  state.searchQ = '';
  const si = document.getElementById('serviceSearch');
  if (si) si.value = '';
  _updateCatFilterBtn();
  renderServices();
}

export function filterSearch(q) {
  state.searchQ = q;
  state.category = 'Все';
  _updateCatFilterBtn();
  renderServices();
}

export function renderServices() {
  const list = document.getElementById('serviceList');
  if (!list) return;
  let data = SERVICES_DATA;
  if (state.category && state.category !== 'Все') {
    data = data.filter(s => s.cat === state.category);
  }
  if (state.searchQ) {
    const q = state.searchQ.toLowerCase();
    data = data.filter(s => s.name.toLowerCase().includes(q) || s.cat.toLowerCase().includes(q));
  }
  if (data.length === 0) {
    list.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--text-2);">Ничего не найдено</div>';
    return;
  }
  list.innerHTML = data.map((s, i) => {
    const last = i === data.length - 1 ? ' style="margin-bottom:24px;"' : '';
    return `<div class="svc-card"${last} data-sid="${esc(s.id)}" onclick="selectService(this.dataset.sid)">
      <div class="svc-line"></div>
      <div class="svc-body"><div class="svc-name">${esc(s.name)}</div><div class="svc-meta">${s.dur} мин · ${esc(s.cat)}</div></div>
      <div class="svc-right"><div class="svc-price">${esc(s.priceStr)}</div><div class="svc-cta">Записаться →</div></div>
    </div>`;
  }).join('');
  _updateCatFilterBtn();
}

export function selectService(id) {
  state.serviceId = id;
  state.masterId = null;
  go('s-masters');
}

Object.assign(window, { filterCategory, filterSearch, renderServices, selectService, _openCatFilter, _pickCat });
