import { SCREENS } from './constants.js';
import { go } from './navigation.js';
import { navHistory, setUpdateDotsFn } from './navigation.js';
import { showPushNotification, hidePushNotification } from './notifications.js';

export const scenarios = {
  booking: {
    steps: [
      { screen: 's-home',     delay: 2400 },
      { screen: 's-services', delay: 2600, tapTarget: '.tab-bar .tab:nth-child(2)' },
      { screen: 's-masters',  delay: 2600, tapTarget: '.svc-card' },
      { screen: 's-slots',    delay: 2800, tapTarget: '.master-card.fav' },
      { screen: 's-confirm',  delay: 2600, tapTarget: '.sticky-bottom .btn-primary' },
      { screen: 's-home',     delay: 2200, tab: true, tapTarget: '.tab-bar .tab:first-child' },
    ],
  },
  rebook: {
    steps: [
      { screen: 's-home',    delay: 2400 },
      { screen: 's-masters', delay: 2600, tapTarget: '.hscroll .chip.accent' },
      { screen: 's-slots',   delay: 2800, tapTarget: '.master-card.fav' },
      { screen: 's-confirm', delay: 2600, tapTarget: '.sticky-bottom .btn-primary' },
      { screen: 's-home',    delay: 2200, tab: true, tapTarget: '.tab-bar .tab:first-child' },
    ],
  },
  reschedule: {
    steps: [
      { screen: 's-home',    delay: 2400 },
      { screen: 's-slots',   delay: 2600, tapTarget: '.hero-btn:first-child' },
      { screen: 's-confirm', delay: 2800, tapTarget: '.sticky-bottom .btn-primary' },
      { screen: 's-home',    delay: 2200, tab: true, tapTarget: '.tab-bar .tab:first-child' },
    ],
  },
  cancel: {
    steps: [
      { screen: 's-home',   delay: 2400 },
      { screen: 's-cancel', delay: 2600, tapTarget: '.hero-btn:last-child' },
      { screen: 's-home',   delay: 2800, tab: true, tapTarget: '.btn-danger' },
    ],
  },
  crosssell: {
    steps: [
      { screen: 's-home',      delay: 2000 },
      { screen: 's-services',  delay: 2400, tapTarget: '.tab-bar .tab:nth-child(2)' },
      { screen: 's-masters',   delay: 2600, tapTarget: '.svc-card' },
      { screen: 's-slots',     delay: 2600, tapTarget: '.master-card.fav' },
      { screen: 's-confirm',   delay: 2800, tapTarget: '.sticky-bottom .btn-primary' },
      { screen: 's-crosssell', delay: 2400, tapTarget: '.btn-ghost' },
      { screen: 's-home',      delay: 2800, tab: true, tapTarget: '.btn-primary' },
    ],
  },
  push: {
    steps: [
      { screen: 's-home',    delay: 2000 },
      { action: 'push',      delay: 2400 },
      { screen: 's-history', delay: 3200, tab: true, tapTarget: '#pushNotif', hidePush: true },
    ],
  },
  offer: {
    steps: [
      { screen: 's-home',    delay: 2400 },
      { screen: 's-offer',   delay: 2600, tapTarget: '.offer-home-banner' },
      { screen: 's-masters', delay: 2800, tapTarget: '.offer-btns .btn-primary' },
      { screen: 's-slots',   delay: 2600, tapTarget: '.master-card.fav' },
      { screen: 's-confirm', delay: 2600, tapTarget: '.sticky-bottom .btn-primary' },
      { screen: 's-home',    delay: 2200, tab: true, tapTarget: '.tab-bar .tab:first-child' },
    ],
  },
  history: {
    steps: [
      { screen: 's-home',    delay: 2400 },
      { screen: 's-history', delay: 2600, tab: true, tapTarget: '.tab-bar .tab:nth-child(3)' },
      { screen: 's-slots',   delay: 2800, tapTarget: '.hist-upcoming' },
      { screen: 's-confirm', delay: 2600, tapTarget: '.sticky-bottom .btn-primary' },
    ],
  },
  review: {
    steps: [
      { screen: 's-home',    delay: 2000 },
      { screen: 's-history', delay: 2400, tab: true, tapTarget: '.tab-bar .tab:nth-child(3)' },
      { screen: 's-review',  delay: 2800, tapTarget: '.hist-visit .btn-ghost' },
      { screen: 's-home',    delay: 2800, tab: true, tapTarget: '.btn-primary' },
    ],
  },
  install: {
    steps: [
      { screen: 's-home',    delay: 2400 },
      { screen: 's-install', delay: 2600, tapTarget: '.install-banner' },
      { screen: 's-home',    delay: 3200, tab: true, tapTarget: '.install-btns .btn-primary' },
    ],
  },
  auth: {
    startScreen: 's-login',
    steps: [
      { screen: 's-login',   delay: 2400 },
      { screen: 's-otp',     delay: 2600, tapTarget: '.btn-primary' },
      { screen: 's-consent', delay: 3200, tapTarget: '.otp-box.cursor' },
      { screen: 's-home',    delay: 3000, tab: true, tapTarget: '.btn-primary' },
    ],
  },
  postreview: {
    steps: [
      { screen: 's-home',    delay: 2000 },
      { action: 'push',      delay: 2400 },
      { screen: 's-review',  delay: 3200, tab: true, tapTarget: '#pushNotif', hidePush: true },
      { screen: 's-home',    delay: 4000, tab: true, tapTarget: '.btn-primary' },
    ],
  },
  consent: {
    startScreen: 's-consent',
    steps: [
      { screen: 's-consent', delay: 2400 },
      { screen: 's-home',    delay: 3000, tab: true, tapTarget: '.btn-primary' },
    ],
  },
  feed: {
    steps: [
      { screen: 's-home',    delay: 2000 },
      { screen: 's-feed',    delay: 2400, tapTarget: '.section-header .btn-ghost' },
      { screen: 's-masters', delay: 3200, tapTarget: '.feed-book' },
      { screen: 's-slots',   delay: 2600, tapTarget: '.master-card.fav' },
      { screen: 's-confirm', delay: 2600, tapTarget: '.sticky-bottom .btn-primary' },
      { screen: 's-home',    delay: 2200, tab: true },
    ],
  },
  admin: {
    startScreen: 's-admin',
    steps: [{ screen: 's-admin', delay: 500 }],
  },
  'admin-feed': {
    startScreen: 's-admin-feed',
    steps: [
      { screen: 's-admin-feed', delay: 500 },
      { screen: 's-admin-post', delay: 2400, tapTarget: '.admin-header button' },
      { screen: 's-admin-feed', delay: 3000, tapTarget: '.btn-primary' },
    ],
  },
  'admin-post': {
    startScreen: 's-admin-post',
    steps: [{ screen: 's-admin-post', delay: 500 }],
  },
  'admin-clients': {
    startScreen: 's-admin-clients',
    steps: [{ screen: 's-admin-clients', delay: 500 }],
  },
  'admin-push': {
    startScreen: 's-admin-push',
    steps: [{ screen: 's-admin-push', delay: 500 }],
  },
};

let scenarioTimers = [];
let currentScenarioBtn = null;
let _sheetRunTimer = null;

export function showTap(selector) {
  const phone = document.getElementById('phone');
  const activeScreen = document.querySelector('.screen.active');
  const el = selector ? (activeScreen && activeScreen.querySelector(selector)) || phone.querySelector(selector) : null;
  const ripple = document.createElement('div');
  ripple.className = 'tap-ripple';
  if (el) {
    const pr = phone.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    ripple.style.left = (er.left + er.width  / 2 - pr.left) + 'px';
    ripple.style.top  = (er.top  + er.height / 2 - pr.top)  + 'px';
  } else {
    ripple.style.left = '50%';
    ripple.style.top  = '70%';
  }
  phone.appendChild(ripple);
  setTimeout(() => { if (ripple.parentNode) ripple.remove(); }, 900);
}

export function updateDots(total, current) {
  const ind = document.getElementById('stepIndicator');
  if (!ind) return;
  ind.innerHTML = '';
  if (!total) return;
  for (let i = 0; i < total; i++) {
    const d = document.createElement('div');
    d.className = 'step-dot' + (i === (current || 0) ? ' active' : '');
    ind.appendChild(d);
  }
}

export function runScenario(key) {
  stopScenario();
  const s = scenarios[key];
  if (!s) return;

  const btns = document.querySelectorAll('.scenario-btn');
  btns.forEach(b => b.classList.remove('playing'));
  const btn = [...btns].find(b => b.getAttribute('onclick') === `runScenario('${key}')`);
  if (btn) { btn.classList.add('playing'); currentScenarioBtn = btn; }

  SCREENS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('active');
    el.style.webkitTransition = 'none';
    el.style.transition       = 'none';
    el.style.webkitTransform  = '';
    el.style.transform        = '';
  });
  const startScreen = s.startScreen || 's-home';
  const startEl = document.getElementById(startScreen);
  if (startEl) startEl.classList.add('active');
  navHistory.length = 0;
  navHistory.push(startScreen);

  const navSteps = s.steps.filter(st => st.screen);
  updateDots(navSteps.length, 0);

  let t = 0;
  let navIdx = 0;
  s.steps.forEach(step => {
    t += step.delay;

    if (step.action === 'push') {
      scenarioTimers.push(setTimeout(() => showPushNotification(), t));
      return;
    }

    if (navIdx > 0 && step.tapTarget) {
      scenarioTimers.push(setTimeout(() => showTap(step.tapTarget), Math.max(0, t - 650)));
    }

    const ni = navIdx++;
    const hidePush = step.hidePush;
    scenarioTimers.push(setTimeout(() => {
      if (hidePush) hidePushNotification();
      go(step.screen, step.tab ? 'tab' : undefined);
      updateDots(navSteps.length, ni);
    }, t));
  });

  scenarioTimers.push(setTimeout(stopScenario, t + 1800));

  document.querySelectorAll('.sheet-btn').forEach(b => {
    b.classList.toggle('playing', b.getAttribute('onclick') === `sheetRun('${key}')`);
  });
}

export function stopScenario() {
  if (_sheetRunTimer) { clearTimeout(_sheetRunTimer); _sheetRunTimer = null; }
  scenarioTimers.forEach(clearTimeout);
  scenarioTimers = [];
  if (currentScenarioBtn) { currentScenarioBtn.classList.remove('playing'); currentScenarioBtn = null; }
  document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('playing'));
  document.querySelectorAll('.sheet-btn').forEach(b => b.classList.remove('playing'));
  hidePushNotification();
  updateDots(0);
}

export function openSheet() {
  document.getElementById('sheetOverlay').classList.add('open');
  document.getElementById('sheet').classList.add('open');
}

export function closeSheet() {
  document.getElementById('sheetOverlay').classList.remove('open');
  document.getElementById('sheet').classList.remove('open');
}

export function sheetRun(key) {
  closeSheet();
  if (_sheetRunTimer) clearTimeout(_sheetRunTimer);
  _sheetRunTimer = setTimeout(() => { _sheetRunTimer = null; runScenario(key); }, 350);
}

setUpdateDotsFn(updateDots);

Object.assign(window, { scenarios, runScenario, stopScenario, showTap, updateDots, openSheet, closeSheet, sheetRun });
