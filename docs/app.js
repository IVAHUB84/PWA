import { EMAILJS, YC, _fetchAndMergeServerRecords } from './modules/api.js';
import { getSession } from './modules/storage.js';
import { state, MASTERS_DATA, SERVICES_DATA, setMastersData, setServicesData, servicePriceRange, staffServicePrice, hydratePrices } from './modules/state.js';
import { readCatalogSnapshot, writeCatalogSnapshot, readPricesSnapshot, writePricesSnapshot } from './modules/dataCache.js';
import { _GRADS } from './modules/constants.js';
import { _fmtPrice, _fmtPriceRange, _makeShort } from './modules/utils.js';
import { registerOnEnter, navHistory } from './modules/navigation.js';
import { setAuthRenderFns } from './modules/auth.js';
import { setBookingRenderFns } from './modules/booking.js';
import { setGhReadFn, renderClientFeed, renderPostScreen } from './modules/feed.js';
import { renderServices } from './modules/services.js';
import { serviceImageUrls } from './modules/serviceImages.js';
import { renderMasters } from './modules/masters.js';
import { updateSlotsScreen, loadDates, updateConfirmScreen } from './modules/slots.js';
import { renderHistoryScreen, renderUpcomingScreen } from './modules/history.js';
import { renderHomeHero, renderProfileScreen, renderLoyaltyBlock, _renderHomeFeedPreview, _initOfferUrgency } from './modules/profile.js';
import { hasPinSet, openPinEnter, refreshPinScreen } from './modules/pin.js';
import { renderReviewScreen } from './modules/review.js';
import { renderAdminDashboard, renderAdminFeed, _clearPostImage, initPostForm, renderAdminClients, renderAdminPush, initPushNewScreen } from './modules/admin.js';
import { _ghRead } from './modules/github.js';
import { initPush } from './modules/push.js';
import { setCompanyData } from './modules/studio.js';

// side-effect-only imports (registers window.* bindings)
import './modules/consent.js';
import './modules/notifications.js';
import './modules/search.js';
import './modules/scenarios.js';
import { attachInstallListeners, maybeShowInstallOverlay } from './modules/install.js';
import { updateInboxBadge, enterInbox } from './modules/inbox.js';
import { routeToTarget, parseTargetParam, applyPendingTarget } from './modules/inboxTarget.js';

// ── CROSS-MODULE CALLBACKS ──
setAuthRenderFns({ renderHomeHero, renderProfileScreen, renderAdminDashboard });
setBookingRenderFns({ renderHomeHero });
setGhReadFn(_ghRead);

let _lastHomeRefresh = 0;
const HOME_REFRESH_THROTTLE_MS = 60 * 1000;

// ── ON-ENTER HANDLERS ──
registerOnEnter('s-services', () => {
  if (!state._masterJustSelected) {
    state.masterPreSelected = false;
    state.masterId = null;
    state.masterName = null;
    state.searchQ = '';
    state.category = 'Все';
    const si = document.getElementById('serviceSearch');
    if (si) si.value = '';
  }
  state._masterJustSelected = false;
  const backBtn = document.getElementById('servicesBackBtn');
  if (backBtn) backBtn.style.visibility = navHistory.length >= 2 ? 'visible' : 'hidden';
  renderServices();
});
registerOnEnter('s-masters',  () => renderMasters());
registerOnEnter('s-slots',    () => { updateSlotsScreen(); loadDates(); });
registerOnEnter('s-confirm',  () => updateConfirmScreen());
registerOnEnter('s-history',  () => renderHistoryScreen());
registerOnEnter('s-upcoming', () => renderUpcomingScreen());
registerOnEnter('s-home', () => {
  renderHomeHero();
  updateInboxBadge();
  const now = Date.now();
  if (now - _lastHomeRefresh < HOME_REFRESH_THROTTLE_MS) return; // рендер из локального состояния выше уже выполнен; пропускается только сеть
  _lastHomeRefresh = now;
  const sess = getSession();
  if (sess && sess.client_id) {
    _fetchAndMergeServerRecords(sess.client_id).then(() => renderHomeHero());
  }
  _ghRead().then(gh => {
    if (gh && gh.sha !== null && gh.posts.length) {
      try { localStorage.setItem('yc_feed_posts', JSON.stringify(gh.posts.filter(p => !p.draft))); } catch {}
      _renderHomeFeedPreview();
    }
  });
});
registerOnEnter('s-inbox', () => enterInbox());
registerOnEnter('s-profile',  () => { renderProfileScreen(); renderLoyaltyBlock(); });
registerOnEnter('s-feed',           () => renderClientFeed());
registerOnEnter('s-post',           () => renderPostScreen());
registerOnEnter('s-review',         () => renderReviewScreen());
registerOnEnter('s-pin',            () => refreshPinScreen());
registerOnEnter('s-offer',          () => _initOfferUrgency());
registerOnEnter('s-crosssell', () => {
  const el = document.getElementById('csSub');
  if (!el) return;
  try {
    const records = JSON.parse(localStorage.getItem('yc_records') || '[]');
    const now = new Date();
    const next = records
      .filter(r => r.status !== 'cancelled' && new Date((r.datetime || '').replace(' ', 'T')) > now)
      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))[0];
    if (next) el.textContent = `К записи: ${next.svcName}`;
  } catch {}
});
registerOnEnter('s-admin',          () => renderAdminDashboard());
registerOnEnter('s-admin-feed',     () => renderAdminFeed());
registerOnEnter('s-admin-post',     () => { _clearPostImage(); initPostForm(); });
registerOnEnter('s-admin-push-new', () => initPushNewScreen());
registerOnEnter('s-admin-clients',  () => renderAdminClients());
registerOnEnter('s-admin-push', () => {
  renderAdminPush();
  const wu = document.getElementById('workerUrlInput');
  const ps = document.getElementById('pushSecretInput');
  if (wu) wu.value = localStorage.getItem('yc_worker_url') || '';
  if (ps) ps.value = localStorage.getItem('yc_push_secret') || '';
});
registerOnEnter('s-register', () => {
  const phone = localStorage.getItem('yc_reg_phone') || '';
  const el = document.getElementById('regPhone');
  if (el && phone) el.value = '+' + phone;
  const emailEl = document.getElementById('regEmail');
  const storedEmail = localStorage.getItem('yc_reg_email') || '';
  if (emailEl && storedEmail) emailEl.value = storedEmail;
});
registerOnEnter('s-login', () => {
  const fb = document.getElementById('loginEmailFallback');
  if (fb) fb.remove();
});
registerOnEnter('s-otp', () => {
  ['otp1', 'otp2', 'otp3', 'otp4'].forEach(i => {
    const el = document.getElementById(i);
    if (el) { el.value = ''; el.classList.remove('filled'); }
  });
  setTimeout(() => { const el = document.getElementById('otp1'); if (el) el.focus(); }, 300);
});

// ── OTP AUTO-ADVANCE ──
(function() {
  const ids = ['otp1', 'otp2', 'otp3', 'otp4'];
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      el.value = el.value.replace(/\D/g, '').slice(-1);
      if (el.value) {
        el.classList.add('filled');
        el.classList.remove('cursor');
        if (i < ids.length - 1) {
          const next = document.getElementById(ids[i + 1]);
          if (next) next.focus();
        } else {
          el.blur();
          setTimeout(() => window.verifyOtp(), 600);
        }
      }
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !el.value && i > 0) {
        const prev = document.getElementById(ids[i - 1]);
        prev.value = '';
        prev.classList.remove('filled');
        prev.classList.add('cursor');
        prev.focus();
      }
    });
    el.addEventListener('focus', () => el.select());
  });
})();

// ── EMAILJS INIT ──
if (typeof emailjs !== 'undefined') {
  emailjs.init(EMAILJS.publicKey);
}

// ── LOAD API DATA ──
async function initApp() {
  if (new URLSearchParams(window.location.search).has('admin')) {
    const btn = document.getElementById('adminLoginBtn');
    if (btn) btn.style.display = 'flex';
  }
  try {
    const [catsRes, svcRes, staffRes, galleryRes, companyRes] = await Promise.all([
      YC.get(`/service_categories/${YC.company}`),
      YC.get(`/services/${YC.company}`),
      YC.get(`/book_staff/${YC.company}`),
      YC.get(`/book_services/${YC.company}`).catch(() => ({})),
      YC.get(`/companies?id=${YC.company}`).catch(() => ({})),
    ]);
    setCompanyData(companyRes);
    const gallery = {};
    try {
      const galleryList = galleryRes && galleryRes.success !== false && galleryRes.data
        ? galleryRes.data.services
        : null;
      if (Array.isArray(galleryList)) {
        galleryList.forEach(svc => {
          const urls = Array.isArray(svc.images)
            ? svc.images.filter(u => typeof u === 'string' && u)
            : [];
          if (urls.length) gallery[String(svc.id)] = urls;
        });
      }
    } catch {}
    const catMap = {};
    if (catsRes.success && catsRes.data) catsRes.data.forEach(c => { catMap[c.id] = c.title; });
    if (svcRes.success && svcRes.data && svcRes.data.length) {
      setServicesData(svcRes.data.map(s => ({
        id: String(s.id), name: s.title,
        cat: catMap[s.category_id] || 'Другое',
        dur: s.duration || 60,
        price_min: s.price_min || 0,
        priceStr: _fmtPrice(s.price_min, s.price_max),
        comment: s.comment || '',
        photos: serviceImageUrls(s.image_group),
      })));
      SERVICES_DATA.forEach(s => {
        if (gallery[s.id] && gallery[s.id].length) s.photos = gallery[s.id];
      });
    }
    applyPendingTarget();
    if (staffRes.success && staffRes.data && staffRes.data.length) {
      const storedFavs = new Set(JSON.parse(localStorage.getItem('yc_favs') || '[]'));
      const staticByName = {};
      MASTERS_DATA.forEach(m => { staticByName[m.name.trim().toLowerCase()] = m; });
      setMastersData(staffRes.data.map((m, i) => {
        const sm = staticByName[m.name.trim().toLowerCase()];
        return {
          id: String(m.id), name: m.name, short: _makeShort(m.name),
          role: m.specialization || sm?.role || 'Мастер', exp: sm?.exp || '',
          avatar: m.avatar_big || m.avatar || '',
          emoji: '👩', grad: sm?.grad || _GRADS[i % _GRADS.length],
          cats: sm?.cats || [],
          fav: storedFavs.has(String(m.id)), avail: true, availText: '● Есть окна сегодня',
        };
      }));
    } else {
      console.warn('book_staff API failed or empty:', staffRes);
    }
    if (svcRes.success && svcRes.data && svcRes.data.length) {
      writeCatalogSnapshot(SERVICES_DATA, MASTERS_DATA);
    }
    renderHomeHero();
    renderServices();
    _collectStaffPrices();
  } catch(e) { console.error('initApp failed', e); }
  initPush();
}

async function _collectStaffPrices() {
  const masters = MASTERS_DATA.filter(m => m.id);
  if (!masters.length) return;
  await Promise.all(masters.map(async m => {
    try {
      const staffId = m.ycId || m.id;
      if (!/^\d+$/.test(staffId)) return;
      const r = await YC.get(`/book_services/${YC.company}`, { staff_id: staffId }, { silent: true });
      const services = r?.data?.services;
      if (!Array.isArray(services)) return;
      services.forEach(s => {
        const price = s.price_min;
        if (!price || price <= 0) return;
        const sid = String(s.id);
        if (!staffServicePrice[m.id]) staffServicePrice[m.id] = {};
        staffServicePrice[m.id][sid] = price;
        const cur = servicePriceRange[sid];
        if (!cur) {
          servicePriceRange[sid] = { min: price, max: price };
        } else {
          if (price < cur.min) cur.min = price;
          if (price > cur.max) cur.max = price;
        }
      });
    } catch { /* graceful degradation */ }
  }));
  SERVICES_DATA.forEach(s => {
    const range = servicePriceRange[s.id];
    if (range) {
      s.priceStr = _fmtPriceRange(range.min, range.max);
    }
  });
  if (Object.keys(servicePriceRange).length > 0) {
    writePricesSnapshot(servicePriceRange, staffServicePrice);
  }
  renderServices();
}

async function _trySubscribeExistingSession() {
  if (localStorage.getItem('yc_push_subscribed')) return;
  const url = localStorage.getItem('yc_worker_url');
  if (!url) return;
  const sess = getSession();
  if (!sess?.client_id) return;
  await initPush();
  window.subscribePush?.(sess.client_id, sess.phone || '');
}

// ── iOS :active ENABLER ──
// iOS Safari применяет CSS :active к элементу только если на документе есть
// обработчик касания. Без этого весь press feedback (scale/brightness/opacity)
// на iPhone не срабатывает. Пустой passive-слушатель включает :active глобально.
document.addEventListener('touchstart', () => {}, { passive: true });

// ── BOOT ──
attachInstallListeners();
parseTargetParam();

// Синхронная гидрация из снимка — мгновенный первый кадр при повторном старте
(function _hydrateFromCache() {
  const catalogSnap = readCatalogSnapshot();
  if (catalogSnap) {
    setServicesData(catalogSnap.services);
    setMastersData(catalogSnap.masters);
  }
  const pricesSnap = readPricesSnapshot();
  if (pricesSnap) {
    hydratePrices(pricesSnap);
    SERVICES_DATA.forEach(s => {
      const range = servicePriceRange[s.id];
      if (range) s.priceStr = _fmtPriceRange(range.min, range.max);
    });
  }
})();

renderServices();
(function checkSession() {
  const sess = getSession();
  if (!sess) {
    window.go('s-login');
  } else if (hasPinSet()) {
    openPinEnter();
  } else {
    renderHomeHero();
    renderProfileScreen();
    renderLoyaltyBlock();
    updateInboxBadge();
    _ghRead().then(gh => {
      if (gh && gh.sha !== null && gh.posts.length) {
        try { localStorage.setItem('yc_feed_posts', JSON.stringify(gh.posts.filter(p => !p.draft))); } catch {}
        _renderHomeFeedPreview();
      }
    });
    setTimeout(_trySubscribeExistingSession, 3000);
  }
  maybeShowInstallOverlay();
})();
initApp();

// ── SIMPLE UI HELPERS ──
window.selectTip = function(btn) {
  btn.closest('.tips-row').querySelectorAll('.tip-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
};
// ── BUILD INFO ──
fetch('./version.json?_=' + Date.now())
  .then(r => r.ok ? r.json() : null)
  .then(v => {
    if (!v) return;
    const el = document.getElementById('buildInfo');
    if (el) el.textContent = (v.version || ('#' + v.build)) + ' · ' + v.date + (v.time ? ' ' + v.time : '');
  }).catch(() => {});

// ── SERVICE WORKER ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'NOTIFICATION_TARGET') {
      routeToTarget(event.data.target);
    }
  });

  let _swRefreshing = false;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      setInterval(() => reg.update(), 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update();
      });
    }).catch(() => {});

    // Новый SW активируется сразу (skipWaiting) и забирает управление —
    // здесь ловим смену контроллера и тихо перезагружаем на свежую версию.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (_swRefreshing) return;
      _swRefreshing = true;
      window.location.reload();
    });
  });
}

