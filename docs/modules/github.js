import { _GH_API, _GH_RAW } from './constants.js';
import { _b64enc } from './utils.js';

const _VALID_POST = p =>
  p && typeof p.id === 'number' &&
  typeof p.text === 'string' && typeof p.cat === 'string' && typeof p.date === 'string' &&
  (!p.image || /^https:\/\/\S+$/.test(p.image) || /^data:image\//.test(p.image));

export async function _ghRead() {
  try {
    const r = await fetch(_GH_RAW);
    if (r.status === 404) return { posts: [], ok: true };
    if (!r.ok) return null;
    const parsed = await r.json();
    if (!Array.isArray(parsed)) return { posts: [], ok: true };
    return { posts: parsed.filter(_VALID_POST), ok: true };
  } catch { return null; }
}

async function _ghGetSha(token) {
  try {
    const r = await fetch(_GH_API, {
      headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' },
    });
    if (!r.ok) return null;
    return (await r.json()).sha || null;
  } catch { return null; }
}

async function _ghWrite(posts, token) {
  const sha = await _ghGetSha(token);
  const body = { message: 'Update feed posts', content: _b64enc(JSON.stringify(posts)) };
  if (sha) body.sha = sha;
  try {
    const r = await fetch(_GH_API, {
      method: 'PUT',
      headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
      body: JSON.stringify(body),
    });
    if (r.status === 401) { localStorage.removeItem('yc_gh_token'); return false; }
    return r.ok;
  } catch { return false; }
}

export async function _ghPullToLocal() {
  const gh = await _ghRead();
  if (!gh || !gh.posts || !gh.posts.length) return false;
  const local = JSON.parse(localStorage.getItem('yc_feed_posts') || '[]');
  const localIds = new Set(local.map(p => p.id));
  const ghOnly = gh.posts.filter(p => !localIds.has(p.id));
  if (!ghOnly.length) return false;
  const merged = [...local, ...ghOnly].sort((a, b) => b.id - a.id);
  try { localStorage.setItem('yc_feed_posts', JSON.stringify(merged)); } catch { return false; }
  return true;
}

export async function _ghSyncPosts(postsToWrite) {
  if (!Array.isArray(postsToWrite)) return;
  let token = localStorage.getItem('yc_gh_token');
  if (!token) {
    token = prompt('Введите GitHub Personal Access Token.\n\nПолучить: GitHub → Settings → Developer settings → Personal access tokens → Generate new token → scope: public_repo\n\nТокен сохранится навсегда.');
    if (!token) return;
    localStorage.setItem('yc_gh_token', token.trim());
    token = token.trim();
  }
  const ok = await _ghWrite(postsToWrite, token);
  if (!ok) {
    localStorage.removeItem('yc_gh_token');
    alert('Ошибка записи на GitHub. Токен сброшен — попробуйте опубликовать снова.');
  }
}

export function _adminResetToken() {
  const cur = localStorage.getItem('yc_gh_token');
  const msg = cur ? 'Токен задан. Введите новый или оставьте пустым для сброса:' : 'Введите GitHub Personal Access Token:';
  const t = prompt(msg + '\n\nПолучить: GitHub → Settings → Developer settings → Personal access tokens → scope: public_repo');
  if (t === null) return;
  if (t.trim()) { localStorage.setItem('yc_gh_token', t.trim()); alert('Токен сохранён.'); }
  else { localStorage.removeItem('yc_gh_token'); alert('Токен сброшен.'); }
}

Object.assign(window, { _adminResetToken });
