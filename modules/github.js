import { _GH_API } from './constants.js';
import { _b64enc, _b64dec } from './utils.js';

export async function _ghRead() {
  try {
    const r = await fetch(_GH_API + '?_=' + Date.now(), { headers: { 'Accept': 'application/vnd.github.v3+json' } });
    if (r.status === 404) return { posts: [], sha: null };
    if (!r.ok) return null;
    const d = await r.json();
    const parsed = JSON.parse(_b64dec(d.content));
    if (!Array.isArray(parsed)) return { posts: [], sha: d.sha };
    return { posts: parsed, sha: d.sha };
  } catch { return null; }
}

export async function _ghWrite(posts, sha, token) {
  const body = { message: 'Update feed posts', content: _b64enc(JSON.stringify(posts)) };
  if (sha) body.sha = sha;
  try {
    const r = await fetch(_GH_API, {
      method: 'PUT',
      headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
      body: JSON.stringify(body),
    });
    if (r.status === 401) { sessionStorage.removeItem('yc_gh_token'); return false; }
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
  localStorage.setItem('yc_feed_posts', JSON.stringify(merged));
  return true;
}

export async function _ghSyncPosts(postsToWrite) {
  let token = sessionStorage.getItem('yc_gh_token');
  if (!token) {
    token = prompt('Введите GitHub Personal Access Token (нужен для синхронизации постов с клиентами).\n\nПолучить: GitHub → Settings → Developer settings → Personal access tokens → Generate new token → выбрать scope "public_repo"');
    if (!token) return;
    sessionStorage.setItem('yc_gh_token', token.trim());
    token = token.trim();
  }
  const gh = await _ghRead();
  if (!gh) { alert('Не удалось прочитать данные с GitHub'); return; }
  const ok = await _ghWrite(postsToWrite, gh.sha, token);
  if (!ok) { alert('Ошибка записи на GitHub. Токен сброшен — попробуйте снова.'); }
}

export function _adminResetToken() {
  const cur = sessionStorage.getItem('yc_gh_token');
  const msg = cur ? 'Токен задан. Введите новый или оставьте пустым для сброса:' : 'Введите GitHub Personal Access Token:';
  const t = prompt(msg + '\n\nПолучить: GitHub → Settings → Developer settings → Personal access tokens → Generate new token → scope: public_repo');
  if (t === null) return;
  if (t.trim()) { sessionStorage.setItem('yc_gh_token', t.trim()); alert('Токен сохранён.'); }
  else { sessionStorage.removeItem('yc_gh_token'); alert('Токен сброшен.'); }
}

Object.assign(window, { _ghRead, _ghWrite, _ghPullToLocal, _ghSyncPosts, _adminResetToken });
