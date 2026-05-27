import { EMAILJS, YC, _fetchAndMergeServerRecords } from './modules/api.js';
import { getSession } from './modules/storage.js';
import { state, MASTERS_DATA, setMastersData, setServicesData } from './modules/state.js';
import { _GRADS } from './modules/constants.js';
import { _fmtPrice, _makeShort } from './modules/utils.js';
import { registerOnEnter } from './modules/navigation.js';
import { setAuthRenderFns } from './modules/auth.js';
import { setBookingRenderFns } from './modules/booking.js';
import { setGhReadFn, renderClientFeed } from './modules/feed.js';
import { renderServices } from './modules/services.js';
import { renderMasters } from './modules/masters.js';
import { updateSlotsScreen, loadDates, updateConfirmScreen } from './modules/slots.js';
import { renderHistoryScreen } from './modules/history.js';
import { renderHomeHero, renderProfileScreen, renderLoyaltyBlock, _renderHomeFeedPreview, _initOfferUrgency } from './modules/profile.js';
import { hasPinSet, openPinEnter, refreshPinScreen } from './modules/pin.js';
import { renderReviewScreen } from './modules/review.js';
import { renderAdminDashboard, renderAdminFeed, _clearPostImage, renderAdminClients, renderAdminPush, updatePushAudience } from './modules/admin.js';
import { _ghRead } from './modules/github.js';

// side-effect-only imports (registers window.* bindings)
import './modules/consent.js';
import './modules/notifications.js';
import './modules/search.js';
import './modules/scenarios.js';

// ── CROSS-MODULE CALLBACKS ──
setAuthRenderFns({ renderHomeHero, renderProfileScreen, renderAdminDashboard });
setBookingRenderFns({ renderHomeHero });
setGhReadFn(_ghRead);

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
  renderServices();
});
registerOnEnter('s-masters',  () => renderMasters());
registerOnEnter('s-slots',    () => { updateSlotsScreen(); loadDates(); });
registerOnEnter('s-confirm',  () => updateConfirmScreen());
registerOnEnter('s-history',  () => renderHistoryScreen());
registerOnEnter('s-home', () => {
  renderHomeHero();
  const sess = getSession();
  if (sess && sess.client_id) {
    _fetchAndMergeServerRecords(sess.client_id).then(() => renderHomeHero());
  }
  _ghRead().then(gh => {
    if (gh && gh.sha !== null && gh.posts.length) {
      localStorage.setItem('yc_feed_posts', JSON.stringify(gh.posts.filter(p => !p.draft)));
      _renderHomeFeedPreview();
    }
  });
});
registerOnEnter('s-profile',  () => { renderProfileScreen(); renderLoyaltyBlock(); });
registerOnEnter('s-feed',           () => renderClientFeed());
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
registerOnEnter('s-admin-post',     () => _clearPostImage());
registerOnEnter('s-admin-clients',  () => renderAdminClients());
registerOnEnter('s-admin-push',     () => renderAdminPush());
registerOnEnter('s-admin-push-new', () => updatePushAudience());
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
    const [catsRes, svcRes, staffRes] = await Promise.all([
      YC.get(`/service_categories/${YC.company}`),
      YC.get(`/services/${YC.company}`),
      YC.get(`/book_staff/${YC.company}`),
    ]);
    const catMap = {};
    if (catsRes.success && catsRes.data) catsRes.data.forEach(c => { catMap[c.id] = c.title; });
    if (svcRes.success && svcRes.data && svcRes.data.length) {
      setServicesData(svcRes.data.map(s => ({
        id: String(s.id), name: s.title,
        cat: catMap[s.category_id] || 'Другое',
        dur: s.duration || 60,
        priceStr: _fmtPrice(s.price_min, s.price_max),
      })));
      renderServices();
    }
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
    renderHomeHero();
    renderServices();
  } catch(e) { console.error('initApp failed', e); }
}

// ── BOOT ──
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
    _ghRead().then(gh => {
      if (gh && gh.sha !== null && gh.posts.length) {
        localStorage.setItem('yc_feed_posts', JSON.stringify(gh.posts.filter(p => !p.draft)));
        _renderHomeFeedPreview();
      }
    });
  }
})();
initApp();

// ── SIMPLE UI HELPERS ──
window.selectTip = function(btn) {
  btn.closest('.tips-row').querySelectorAll('.tip-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
};
window.adminCat = function(el) {
  el.closest('.hscroll').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
};

// ── SERVICE WORKER ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            _showUpdateBanner();
          }
        });
      });
    }).catch(() => {});
  });
}

function _showUpdateBanner() {
  if (document.getElementById('sw-update-banner')) return;
  const el = document.createElement('div');
  el.id = 'sw-update-banner';
  el.innerHTML = '<span>Доступно обновление</span><button onclick="window.location.reload()">Обновить</button>';
  document.body.appendChild(el);
}

// ── ONESIGNAL ──
window.OneSignalDeferred = window.OneSignalDeferred || [];
window.OneSignalDeferred.push(async function(OneSignal) {
  await OneSignal.init({
    appId: '88345dbd-e9db-4866-80ce-bf28b3c7af94',
    serviceWorkerPath: 'sw.js',
    serviceWorkerParam: { scope: './' },
    notifyButton: { enable: false },
  });
});
