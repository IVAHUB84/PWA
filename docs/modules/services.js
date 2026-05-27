import { state, SERVICES_DATA } from './state.js';
import { go } from './navigation.js';
import { esc } from './utils.js';

export function _updateCatChips() {
  const cats = [...new Set(SERVICES_DATA.map(s => s.cat))].filter(Boolean);
  const el = document.getElementById('catChips');
  if (!el) return;
  el.innerHTML = `<span class="chip active" onclick="filterCategory('Все')">Все</span>`
    + cats.map(c => `<span class="chip" onclick="filterCategory(${JSON.stringify(c)})">${esc(c)}</span>`).join('');
}

export function filterCategory(cat) {
  state.category = cat;
  state.searchQ = '';
  const si = document.getElementById('serviceSearch');
  if (si) si.value = '';
  document.querySelectorAll('#catChips .chip').forEach(c => {
    c.classList.toggle('active', c.textContent.trim() === cat);
  });
  renderServices();
}

export function filterSearch(q) {
  state.searchQ = q;
  state.category = 'Все';
  document.querySelectorAll('#catChips .chip').forEach(c => {
    c.classList.toggle('active', c.textContent.trim() === 'Все');
  });
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
    _updateCatChips();
    return;
  }
  list.innerHTML = data.map((s, i) => {
    const last = i === data.length - 1 ? ' style="margin-bottom:24px;"' : '';
    return `<div class="svc-card"${last} onclick="selectService(${JSON.stringify(s.id)})">
      <div class="svc-line"></div>
      <div class="svc-body"><div class="svc-name">${esc(s.name)}</div><div class="svc-meta">${s.dur} мин · ${esc(s.cat)}</div></div>
      <div class="svc-right"><div class="svc-price">${esc(s.priceStr)}</div><div class="svc-cta">Записаться →</div></div>
    </div>`;
  }).join('');
  _updateCatChips();
}

export function selectService(id) {
  state.serviceId = id;
  state.masterId = null;
  go('s-masters');
}

Object.assign(window, { filterCategory, filterSearch, renderServices, selectService });
