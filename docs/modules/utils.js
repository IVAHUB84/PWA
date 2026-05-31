import { _GRADS, _NO_AVATAR } from './constants.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Локальная дата YYYY-MM-DD без UTC-сдвига (toISOString даёт UTC → ночью off-by-one).
export function _localISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Безопасный разбор JSON из localStorage: битый/отсутствующий ключ не роняет рендер.
export function _safeParse(str, fallback) {
  try {
    const v = JSON.parse(str);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || '?';
}

export async function _sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function _fmtPrice(min, max) {
  if (!min) return 'По запросу';
  const f = n => Math.round(n).toLocaleString('ru-RU') + ' ₽';
  return min === max || !max ? f(min) : 'от ' + f(min);
}

export function _fmtPriceRange(min, max) {
  if (!min) return 'По запросу';
  const f = n => Math.round(n).toLocaleString('ru-RU') + ' ₽';
  if (min === max || !max) return f(min);
  return 'от ' + f(min) + ' до ' + f(max);
}

export function _fmtDatetime(datetime) {
  const d = new Date(datetime.replace(' ', 'T'));
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + ' · ' + datetime.slice(11, 16);
}

export function _makeShort(name) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? p[0] + ' ' + p[1][0] + '.' : p[0];
}

export function _normalizePhone(raw) {
  let d = raw.replace(/\D/g, '');
  if (d.length === 10) d = '7' + d;
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  return d.slice(-11);
}

export function _formatPhoneInput(input) {
  let d = input.value.replace(/\D/g, '');
  if (d.length === 0) { input.value = ''; return; }
  if (d[0] === '8') d = '7' + d.slice(1);
  if (d[0] !== '7') d = '7' + d;
  d = d.slice(0, 11);
  let v = '+7';
  if (d.length > 1) v += ' (' + d.slice(1, 4);
  if (d.length >= 4) v += ') ' + d.slice(4, 7);
  if (d.length >= 7) v += '-' + d.slice(7, 9);
  if (d.length >= 9) v += '-' + d.slice(9, 11);
  input.value = v;
}

export function _maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const masked = local[0] + '*'.repeat(Math.max(1, local.length - 2)) + (local.length > 1 ? local[local.length - 1] : '');
  return `${masked}@${domain}`;
}

export function _hasRealAvatar(m) {
  const url = m.avatar_big || m.avatar || '';
  return url && !_NO_AVATAR.some(s => url.includes(s));
}

export function _avatarHtml(m, size = 48, grad = null) {
  const bg = grad || m.grad || _GRADS[0];
  if (_hasRealAvatar(m)) {
    const initials = esc(getInitials(m.name));
    const safeBg = esc(bg);
    return `<img src="${esc(m.avatar_big || m.avatar)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.outerHTML='<div style=\\"width:${size}px;height:${size}px;border-radius:50%;background:${safeBg};display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.35)}px;font-weight:800;color:#fff;\\">${initials}</div>'">`;
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.35)}px;font-weight:800;color:#fff;flex-shrink:0;">${getInitials(m.name)}</div>`;
}

export function _b64enc(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function _b64dec(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function _importanceLabel(importance) {
  switch (Number(importance)) {
    case 1: return { label: 'Важный',       color: '#8B3558' };
    case 2: return { label: 'Очень важный', color: '#8B3558' };
    case 3: return { label: 'VIP',          color: '#FFD700' };
    default: return { label: 'Обычный',     color: 'var(--text-2)' };
  }
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ── HAPTIC ── */
const _HAPTIC_PATTERNS = { select: 10, submit: 12, fab: 12, tap: 10 };
let _reducedMotionMql = null;
export function hapticTap(kind = 'tap') {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  if (!_reducedMotionMql && typeof window !== 'undefined' && window.matchMedia) {
    _reducedMotionMql = window.matchMedia('(prefers-reduced-motion: reduce)');
  }
  if (_reducedMotionMql && _reducedMotionMql.matches) return;
  try { navigator.vibrate(_HAPTIC_PATTERNS[kind] || _HAPTIC_PATTERNS.tap); } catch {}
}
if (typeof window !== 'undefined') window.hapticTap = hapticTap;
