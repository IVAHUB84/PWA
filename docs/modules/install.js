const INSTALL_KEY    = 'yc_install_state';
const DISMISS_DAYS   = 30;
const MOBILE_MAX_WIDTH = 767;

export function isIosStandalone({ standalone, iosPlatform }) {
  return standalone === true && iosPlatform === true;
}

export function detectIosStandalone() {
  const standalone = isStandalone();
  const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
  const platform = typeof navigator !== 'undefined' ? (navigator.platform || '') : '';
  const maxTouch = typeof navigator !== 'undefined' ? (navigator.maxTouchPoints || 0) : 0;
  const iosPlatform = /iphone|ipad|ipod/i.test(platform)
    || (/mac/i.test(platform) && maxTouch > 1)
    || isIOS(ua);
  return isIosStandalone({ standalone, iosPlatform });
}

export function isStandalone() {
  const media = typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)').matches
    : false;
  return media || navigator.standalone === true;
}

export function isIOS(ua = navigator.userAgent) {
  return /iphone|ipad|ipod/i.test(ua) && !/android/i.test(ua);
}

export function shouldOffer(now = Date.now(), state = readState()) {
  if (state.installed) return false;
  if (state.dismissedAt && (now - state.dismissedAt) < DISMISS_DAYS * 86400000) return false;
  return true;
}

export function readState() {
  try {
    return JSON.parse(localStorage.getItem(INSTALL_KEY) || '{}');
  } catch {
    return {};
  }
}

export function writeState(patch) {
  const current = readState();
  localStorage.setItem(INSTALL_KEY, JSON.stringify(Object.assign({}, current, patch)));
}

let deferredPrompt = null;
let _listenersAttached = false;

export function showOverlay() {
  const el = document.getElementById('installOverlay');
  if (el) el.style.display = 'flex';
}

export function hideOverlay() {
  const el = document.getElementById('installOverlay');
  if (el) el.style.display = 'none';
}

function _eligible() {
  if (isStandalone() || !shouldOffer()) return false;
  if (deferredPrompt) return true;
  return window.innerWidth <= MOBILE_MAX_WIDTH && isIOS();
}

export function refreshInstallBanner() {
  const el = document.getElementById('installBanner');
  if (!el) return;
  el.style.display = _eligible() ? 'flex' : 'none';
}

export function triggerInstall() {
  if (isIOS()) {
    hideOverlay();
    window.go('s-install', 'tab');
    return;
  }
  if (!deferredPrompt) {
    hideOverlay();
    return;
  }
  const prompt = deferredPrompt;
  deferredPrompt = null;
  prompt.prompt();
  prompt.userChoice.then(choice => {
    if (choice.outcome === 'accepted') {
      writeState({ installed: true });
    } else {
      writeState({ dismissedAt: Date.now() });
    }
    hideOverlay();
    refreshInstallBanner();
  });
}

export function dismissInstall() {
  writeState({ dismissedAt: Date.now() });
  hideOverlay();
  refreshInstallBanner();
}

export function attachInstallListeners() {
  if (_listenersAttached) return;
  _listenersAttached = true;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    if (_eligible()) showOverlay();
  });

  window.addEventListener('appinstalled', () => {
    writeState({ installed: true });
    hideOverlay();
    refreshInstallBanner();
  });
}

export function maybeShowInstallOverlay() {
  if (_eligible()) showOverlay();
}

export function initInstall() {
  if (detectIosStandalone()) {
    document.documentElement.classList.add('ios-standalone');
  }
  attachInstallListeners();
  maybeShowInstallOverlay();
}

Object.assign(window, { initInstall, attachInstallListeners, maybeShowInstallOverlay, isStandalone, isIOS, isIosStandalone, detectIosStandalone, shouldOffer, readState, writeState, showOverlay, hideOverlay, refreshInstallBanner, triggerInstall, dismissInstall });
