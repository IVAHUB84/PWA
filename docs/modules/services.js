import { state, SERVICES_DATA, staffServicePrice } from './state.js';
import { go } from './navigation.js';
import { esc, _fmtPrice } from './utils.js';
import { YC } from './api.js';
import { resolveServiceImage } from './serviceImages.js';

function _updateCatFilterBtn() {
  const lbl = document.getElementById('catFilterLabel');
  if (lbl) lbl.textContent = (state.category && state.category !== 'Все') ? state.category : 'Все категории';
}

function _updateMasterBanner() {
  const banner = document.getElementById('masterBanner');
  if (!banner) return;
  if (state.masterPreSelected && state.masterId) {
    document.getElementById('masterBannerName').textContent = state.masterName || '';
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

export function _clearMasterFilter() {
  state.masterPreSelected = false;
  state.masterId = null;
  state.masterName = null;
  _updateMasterBanner();
  renderServices();
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

function _renderList(data) {
  const list = document.getElementById('serviceList');
  if (!list) return;
  _updateCatFilterBtn();
  _updateMasterBanner();
  if (data.length === 0) {
    list.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--text-2);">Ничего не найдено</div>';
    return;
  }
  const cards = data.map(s => {
    const img = resolveServiceImage(s);
    const coverHtml = img.type === 'photo'
      ? `<img class="svc-cover-img" src="${esc(img.src)}" alt="${esc(s.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="svc-cover-placeholder" style="background:${esc(img.grad)};display:none">${esc(img.emoji)}</div>`
      : `<div class="svc-cover-placeholder" style="background:${esc(img.grad)}">${esc(img.emoji)}</div>`;
    return `<div class="svc-catalog-card" data-sid="${esc(s.id)}" onclick="selectService(this.dataset.sid)">
      <div class="svc-cover">${coverHtml}</div>
      <div class="svc-info">
        <div class="svc-name">${esc(s.name)}</div>
        <div class="svc-meta">${esc(s.priceStr)} · ${s.dur} мин</div>
      </div>
    </div>`;
  }).join('');
  list.innerHTML = `<div class="svc-catalog">${cards}</div>`;
}

export async function renderServices() {
  const list = document.getElementById('serviceList');
  if (!list) return;

  if (state.masterPreSelected && state.masterId) {
    list.innerHTML = '<div style="padding:32px 20px;text-align:center;color:var(--text-2);font-size:14px;">Загрузка услуг мастера…</div>';
    _updateMasterBanner();
    let data = [];
    try {
      const r = await YC.get(`/book_services/${YC.company}`, { staff_id: state.masterId });
      const masterSvcs = r.data?.services || [];
      const masterSvcMap = {};
      masterSvcs.forEach(s => { masterSvcMap[String(s.id)] = s; });
      const masterSvcIds = new Set(Object.keys(masterSvcMap));
      data = SERVICES_DATA.filter(s => masterSvcIds.has(s.id)).map(s => {
        const ms = masterSvcMap[s.id];
        const price = staffServicePrice[state.masterId]?.[s.id] ?? ms?.price_min;
        return Object.assign({}, s, { priceStr: _fmtPrice(price, price) });
      });
      if (!data.length && masterSvcs.length) {
        data = masterSvcs.map(s => ({
          id: String(s.id), name: s.title, cat: '',
          dur: s.duration || 60,
          priceStr: _fmtPrice(s.price_min, s.price_min),
        }));
      }
    } catch {}
    if (state.category && state.category !== 'Все') data = data.filter(s => s.cat === state.category);
    if (state.searchQ) {
      const q = state.searchQ.toLowerCase();
      data = data.filter(s => s.name.toLowerCase().includes(q));
    }
    _renderList(data);
    return;
  }

  let data = SERVICES_DATA;
  if (state.category && state.category !== 'Все') data = data.filter(s => s.cat === state.category);
  if (state.searchQ) {
    const q = state.searchQ.toLowerCase();
    data = data.filter(s => s.name.toLowerCase().includes(q) || s.cat.toLowerCase().includes(q));
  }
  _renderList(data);
}

export function selectService(id) {
  if (state.masterPreSelected) {
    state.serviceId = id;
    go('s-slots');
  } else {
    openServiceCard(id);
  }
}

export function openServiceCard(id) {
  state.serviceId = id;
  const s = SERVICES_DATA.find(sv => sv.id === id);
  if (!s) return;

  const container = document.getElementById('serviceCardContent');
  if (!container) return;

  const img = resolveServiceImage(s);
  let galleryHtml;

  if (s.photos && s.photos.length >= 2) {
    const makeSlide = url =>
      `<div class="svc-carousel-slide"><img src="${esc(url)}" alt="${esc(s.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="svc-card-placeholder" style="background:${esc(img.grad)};display:none">${esc(img.emoji)}</div></div>`;
    const cloneFirst = makeSlide(s.photos[0]);
    const cloneLast = makeSlide(s.photos[s.photos.length - 1]);
    const realSlides = s.photos.map(makeSlide).join('');
    const dots = s.photos.map((_, i) =>
      `<div class="svc-carousel-dot${i === 0 ? ' active' : ''}" data-idx="${i}"></div>`
    ).join('');
    galleryHtml = `<div class="svc-card-gallery">
      <div class="svc-carousel" id="svcCarousel">
        <div class="svc-carousel-track" id="svcTrack">${cloneLast}${realSlides}${cloneFirst}</div>
      </div>
      <div class="svc-carousel-dots" id="svcDots">${dots}</div>
    </div>`;
  } else if (s.photos && s.photos.length === 1) {
    galleryHtml = `<div class="svc-card-gallery">
      <img class="svc-card-single-img" src="${esc(s.photos[0])}" alt="${esc(s.name)}" loading="lazy"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="svc-card-placeholder" style="background:${esc(img.grad)};display:none">${esc(img.emoji)}</div>
    </div>`;
  } else {
    galleryHtml = `<div class="svc-card-gallery">
      <div class="svc-card-placeholder" style="background:${esc(img.grad)}">${esc(img.emoji)}</div>
    </div>`;
  }

  const descHtml = s.comment
    ? `<div class="svc-card-desc">${esc(s.comment)}</div>`
    : '';

  container.innerHTML = `${galleryHtml}
    <div class="svc-card-body">
      <div class="svc-card-name">${esc(s.name)}</div>
      <div class="svc-card-meta">${esc(s.priceStr)} · ${s.dur} мин</div>
      ${descHtml}
    </div>
    <div class="svc-card-cta">
      <button class="btn-primary" onclick="chooseMasterFromCard()">Выбрать мастера</button>
    </div>`;

  if (s.photos && s.photos.length >= 2) {
    const track = container.querySelector('#svcTrack');
    const dots = container.querySelectorAll('#svcDots .svc-carousel-dot');

    if (track) {
      const SLIDE_GAP = 8; // must match gap of .svc-carousel-track in style.css
      const n = s.photos.length;
      let logIdx = 0;
      let transitioning = false;
      let transitionGuard = null;

      const carousel = container.querySelector('#svcCarousel');

      function slideWidth() {
        const slide = track.firstElementChild;
        return slide ? slide.offsetWidth : carousel.offsetWidth - 44; // 44 must match calc(100% - 44px) slide width in CSS
      }

      function translateForIdx(idx) {
        const sw = slideWidth();
        const peek = (carousel.offsetWidth - sw) / 2;
        return -((idx + 1) * (sw + SLIDE_GAP)) + peek;
      }

      function setPos(idx, animate) {
        if (!animate) track.style.transition = 'none';
        track.style.transform = `translateX(${translateForIdx(idx)}px)`;
        if (!animate) {
          track.getBoundingClientRect();
          track.style.transition = '';
        }
      }

      function updateDots() {
        const visual = ((logIdx % n) + n) % n;
        dots.forEach((d, i) => d.classList.toggle('active', i === visual));
      }

      function settle() {
        transitioning = false;
        if (logIdx < 0) {
          logIdx = n - 1;
          setPos(logIdx, false);
          updateDots();
        } else if (logIdx >= n) {
          logIdx = 0;
          setPos(logIdx, false);
          updateDots();
        }
      }

      setPos(logIdx, false);
      updateDots();

      track.addEventListener('transitionend', () => {
        if (!transitioning) return;
        clearTimeout(transitionGuard);
        settle();
      });

      function goTo(newIdx) {
        if (transitioning) return;
        transitioning = true;
        logIdx = newIdx;
        track.style.transition = '';
        track.style.transform = `translateX(${translateForIdx(logIdx)}px)`;
        updateDots();
        clearTimeout(transitionGuard);
        transitionGuard = setTimeout(() => { // 500ms > CSS transition duration (0.35s)
          if (!transitioning) return;
          settle();
        }, 500);
      }

      let touchStartX = 0;
      let touchStartY = 0;
      let touchMoved = false;

      track.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchMoved = false;
      }, { passive: true });

      track.addEventListener('touchmove', () => {
        touchMoved = true;
      }, { passive: true });

      track.addEventListener('touchend', e => {
        if (!touchMoved) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) < 30 || Math.abs(dx) < Math.abs(dy)) return;
        if (dx < 0) {
          goTo(logIdx + 1);
        } else {
          goTo(logIdx - 1);
        }
      }, { passive: true });
    }
  }

  go('s-service');
}

export function chooseMasterFromCard() {
  state.masterId = null;
  state.masterName = null;
  go('s-masters');
}

Object.assign(window, { filterCategory, filterSearch, renderServices, selectService, openServiceCard, chooseMasterFromCard, _openCatFilter, _pickCat, _clearMasterFilter });
