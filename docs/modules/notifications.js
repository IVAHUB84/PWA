import { go } from './navigation.js';

export function showPushNotification() {
  document.getElementById('pushNotif').classList.add('show');
}

export function hidePushNotification() {
  document.getElementById('pushNotif').classList.remove('show');
}

export function handlePushTap() {
  hidePushNotification();
  go('s-history', 'tab');
}

export async function _sendNotification(title, body) {
  if (!('Notification' in window)) return false;
  let perm = Notification.permission;
  if (perm === 'default') {
    perm = await Notification.requestPermission();
  }
  if (perm !== 'granted') return false;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, { body, icon: './icon-192.png', badge: './icon-192.png' });
    } else {
      new Notification(title, { body, icon: './icon-192.png' });
    }
    return true;
  } catch {
    try { new Notification(title, { body }); return true; } catch {}
    return false;
  }
}

Object.assign(window, { showPushNotification, hidePushNotification, handlePushTap });
