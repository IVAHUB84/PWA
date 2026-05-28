const INSTALL_KEY    = 'yc_install_state';
const DISMISS_DAYS   = 30;
const MOBILE_MAX_WIDTH = 767;

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
  return !isStandalone() && shouldOffer() && window.innerWidth <= MOBILE_MAX_WIDTH && (deferredPrompt || isIOS());
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
  attachInstallListeners();
  maybeShowInstallOverlay();
}

Object.assign(window, { initInstall, attachInstallListeners, maybeShowInstallOverlay, isStandalone, isIOS, shouldOffer, readState, writeState, showOverlay, hideOverlay, refreshInstallBanner, triggerInstall, dismissInstall });
