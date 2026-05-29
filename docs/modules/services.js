import { state, SERVICES_DATA, staffServicePrice } from './state.js';
import { go, registerOnEnter } from './navigation.js';
import { esc, _fmtPrice, hapticTap } from './utils.js';
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
  hapticTap('select');
  if (state.masterPreSelected) {
    state.serviceId = id;
    go('s-slots');
  } else {
    openServiceCard(id);
  }
}

let _carouselResizeHandler = null;

function _carouselCleanup() {
  if (_carouselResizeHandler) {
    window.removeEventListener('resize', _carouselResizeHandler);
    _carouselResizeHandler = null;
  }
}

function _initCarousel(container, s) {
  _carouselCleanup();

  const track = container.querySelector('#svcTrack');
  const dotEls = container.querySelectorAll('#svcDots .svc-carousel-dot');
  const carousel = container.querySelector('#svcCarousel');

  if (!track || !carousel) return;

  const SLIDE_GAP = 8; // sync with .svc-carousel-track gap in style.css
  const n = s.photos.length;
  let logIdx = 0;
  let transitioning = false;
  let settled = true;
  let transitionGuard = null;

  function slideWidth() {
    const slide = track.firstElementChild;
    return slide ? slide.offsetWidth : 0;
  }

  function translateForIdx(idx) {
    const sw = slideWidth();
    if (!sw) return 0;
    const peek = (carousel.offsetWidth - sw) / 2;
    return -((idx + 1) * (sw + SLIDE_GAP)) + peek;
  }

  function setPos(idx, animate) {
    if (!animate) {
      track.style.transition = 'none';
      track.style.transform = `translateX(${translateForIdx(idx)}px)`;
      track.getBoundingClientRect();
      track.style.transition = '';
    } else {
      track.style.transform = `translateX(${translateForIdx(idx)}px)`;
    }
  }

  function updateDots() {
    const visual = ((logIdx % n) + n) % n;
    dotEls.forEach((d, i) => d.classList.toggle('active', i === visual));
  }

  function settle() {
    if (settled) return;
    settled = true;
    transitioning = false;
    clearTimeout(transitionGuard);
    transitionGuard = null;
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
    settle();
  });

  function goTo(newIdx) {
    if (transitioning) {
      settle();
    }
    transitioning = true;
    settled = false;
    logIdx = newIdx;
    updateDots();
    setPos(logIdx, true);
    clearTimeout(transitionGuard);
    transitionGuard = setTimeout(() => {
      settle();
    }, 500);
  }

  _carouselResizeHandler = () => setPos(logIdx, false);
  window.addEventListener('resize', _carouselResizeHandler);

  // Pointer-based swipe: works for touch, mouse and pen.
  // Live drag-follow + snap on release. Vertical-dominant moves are released
  // to the parent .scroll (touch-action: pan-y on the track in CSS).
  let dragStartX = 0;
  let dragStartY = 0;
  let dragBaseTx = 0;
  let dragActive = false;
  let dragMoved = false;
  let dragAxis = null; // 'x' | 'y' | null
  let activePointerId = null;
  const DRAG_AXIS_LOCK = 8;
  const SWIPE_TRIGGER_PX = 40;

  function endDrag(commit, dxFinal) {
    if (!dragActive) return;
    dragActive = false;
    try { track.releasePointerCapture(activePointerId); } catch {}
    activePointerId = null;
    track.style.transition = '';
    if (commit && dragAxis === 'x' && Math.abs(dxFinal) >= SWIPE_TRIGGER_PX) {
      goTo(logIdx + (dxFinal < 0 ? 1 : -1));
    } else {
      setPos(logIdx, true);
    }
    dragAxis = null;
  }

  track.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (transitioning) settle();
    dragActive = true;
    dragMoved = false;
    dragAxis = null;
    activePointerId = e.pointerId;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragBaseTx = translateForIdx(logIdx);
    track.style.transition = 'none';
    try { track.setPointerCapture(e.pointerId); } catch {}
  });

  track.addEventListener('pointermove', e => {
    if (!dragActive || e.pointerId !== activePointerId) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (!dragAxis) {
      if (Math.abs(dx) > DRAG_AXIS_LOCK || Math.abs(dy) > DRAG_AXIS_LOCK) {
        dragAxis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      }
    }
    if (dragAxis === 'x') {
      dragMoved = true;
      e.preventDefault?.();
      track.style.transform = `translateX(${dragBaseTx + dx}px)`;
    } else if (dragAxis === 'y') {
      endDrag(false, 0);
    }
  });

  track.addEventListener('pointerup', e => {
    if (!dragActive || e.pointerId !== activePointerId) return;
    const dx = e.clientX - dragStartX;
    endDrag(dragMoved, dx);
  });

  track.addEventListener('pointercancel', e => {
    if (!dragActive || e.pointerId !== activePointerId) return;
    endDrag(false, 0);
  });

  // Suppress click-through from a drag (e.g. on the slide image).
  track.addEventListener('click', e => {
    if (dragMoved) {
      e.preventDefault();
      e.stopPropagation();
      dragMoved = false;
    }
  }, true);

  // Dots are interactive: tap to navigate directly to the target slide.
  dotEls.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      const visual = ((logIdx % n) + n) % n;
      if (i === visual) return;
      goTo(logIdx + (i - visual));
    });
  });

  // Run once per card open: deregister so returning to s-service (e.g. back from
  // masters) doesn't re-bind listeners on the same track. openServiceCard re-registers.
  registerOnEnter('s-service', null);
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

  _carouselCleanup();

  if (s.photos && s.photos.length >= 2) {
    registerOnEnter('s-service', _initCarousel.bind(null, container, s));
  } else {
    registerOnEnter('s-service', null);
  }

  go('s-service');
}

export function chooseMasterFromCard() {
  state.masterId = null;
  state.masterName = null;
  go('s-masters');
}

Object.assign(window, { filterCategory, filterSearch, renderServices, selectService, openServiceCard, chooseMasterFromCard, _openCatFilter, _pickCat, _clearMasterFilter });
