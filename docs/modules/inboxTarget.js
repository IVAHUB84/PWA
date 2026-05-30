import { openServiceCard, filterCategory } from './services.js';
import { go } from './navigation.js';
import { SERVICES_DATA } from './state.js';

const VALID_TYPES = new Set(['service', 'records', 'category']);

export function normalizeTarget(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { type, id } = raw;
  if (!VALID_TYPES.has(type)) return null;
  if (type === 'service') {
    if (id === null || id === undefined || id === '') return null;
    const sid = String(id);
    if (sid === '') return null;
    return { type, id: sid };
  }
  if (type === 'category') {
    if (typeof id !== 'string' || id === '') return null;
    return { type, id };
  }
  if (type === 'records') {
    return { type };
  }
  return null;
}

export function routeToTarget(target) {
  const t = normalizeTarget(target);
  if (!t) return;
  if (t.type === 'records') {
    go('s-history', 'tab');
    return;
  }
  if (t.type === 'service') {
    const exists = SERVICES_DATA.find(s => String(s.id) === String(t.id));
    if (!exists) return;
    openServiceCard(t.id);
    return;
  }
  if (t.type === 'category') {
    const cats = new Set(SERVICES_DATA.map(s => s.cat));
    if (!cats.has(t.id)) return;
    filterCategory(t.id);
    go('s-services', 'tab');
  }
}

let _pendingTarget = null;

export function parseTargetParam() {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('n');
    const url = new URL(window.location.href);
    url.searchParams.delete('n');
    window.history.replaceState(null, '', url.pathname + (url.search || '') + (url.hash || ''));
    if (!raw) return;
    let parsed;
    try { parsed = JSON.parse(decodeURIComponent(raw)); } catch { return; }
    const target = normalizeTarget(parsed);
    if (!target) return;
    if (target.type === 'records') {
      routeToTarget(target);
    } else {
      _pendingTarget = target;
    }
  } catch {}
}

export function applyPendingTarget() {
  if (!_pendingTarget) return;
  const t = _pendingTarget;
  _pendingTarget = null;
  routeToTarget(t);
}
