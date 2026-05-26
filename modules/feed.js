import { go } from './navigation.js';
import { esc } from './utils.js';

const _CAT_GRADS = {
  'Брови': 'linear-gradient(135deg,#F4C2A1,#C9956C)',
  'Ногти': 'linear-gradient(135deg,#E8C4F0,#C48FD8)',
  'Лицо':  'linear-gradient(135deg,#C8E6C9,#66BB6A)',
  'Волосы': 'linear-gradient(135deg,#F8BBD0,#E91E8C)',
  'Тело':  'linear-gradient(135deg,#B3E5FC,#039BE5)',
  'Акции': 'linear-gradient(135deg,#FFF8E1,#FFA000)',
};
const _CAT_ICONS2 = { 'Брови': '✨', 'Ногти': '💅', 'Лицо': '🌿', 'Волосы': '💆', 'Тело': '🧖', 'Акции': '🎁' };

let _ghReadFn = async () => null;
export function setGhReadFn(fn) { _ghReadFn = fn; }

let _feedActiveCat = '';

export async function renderClientFeed() {
  const el = document.getElementById('feedList');
  if (!el) return;

  const cached = JSON.parse(localStorage.getItem('yc_feed_posts') || '[]').filter(p => !p.draft);
  if (cached.length) {
    _paintFeed(el, cached);
  } else {
    el.innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--text-2);font-size:14px;">Загрузка…</div>';
  }

  const gh = await _ghReadFn();
  if (gh && gh.sha !== null && gh.posts.length) {
    const published = gh.posts.filter(p => !p.draft);
    localStorage.setItem('yc_feed_posts', JSON.stringify(gh.posts.filter(p => !p.draft)));
    _paintFeed(el, published);
  } else if (gh && gh.sha !== null && !gh.posts.length) {
    localStorage.setItem('yc_feed_posts', '[]');
    _paintFeed(el, []);
  } else if (!cached.length) {
    el.innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--text-2);font-size:14px;">Публикаций пока нет.<br>Следите за обновлениями!</div>';
  }
}

export function _paintFeed(el, posts) {
  if (!posts.length) {
    el.innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--text-2);font-size:14px;">Публикаций пока нет.<br>Следите за обновлениями!</div>';
    return;
  }
  el.innerHTML = posts.map((p, i) => {
    const grad = _CAT_GRADS[p.cat] || 'linear-gradient(135deg,#eee,#ccc)';
    const icon = _CAT_ICONS2[p.cat] || '📝';
    const mb = i === posts.length - 1 ? ' style="margin-bottom:24px;"' : '';
    const photoContent = p.image
      ? `<img src="${esc(p.image)}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:0;">`
      : `<div class="feed-photo-inner"><div class="feed-photo-icon">${icon}</div></div><div class="feed-photo-overlay"></div>`;
    return `<div class="feed-card"${mb}>
      <div class="feed-photo" style="${p.image ? 'overflow:hidden;' : 'background:' + grad + ';'}">
        ${photoContent}
      </div>
      <div class="feed-body">
        <div class="feed-tag">${esc(p.cat)}</div>
        <div class="feed-caption">${esc(p.text)}</div>
        <div class="feed-meta">${esc(p.date)}</div>
      </div>
      <div class="feed-actions">
        <button class="feed-like" onclick="likeFeed(this)">❤ 0</button>
        <button class="feed-book" onclick="go('s-services')">Записаться →</button>
      </div>
    </div>`;
  }).join('');
}

export function _toggleFeedFilter() {
  const drop = document.getElementById('feedFilterDrop');
  if (!drop) return;
  const visible = drop.style.display !== 'none';
  drop.style.display = visible ? 'none' : 'block';
  if (!visible) {
    const posts = JSON.parse(localStorage.getItem('yc_feed_posts') || '[]').filter(p => !p.draft);
    const cats = ['Все', ...new Set(posts.map(p => p.cat).filter(Boolean))];
    const list = document.getElementById('feedFilterList');
    if (list) list.innerHTML = cats.map(c => {
      const val = c === 'Все' ? '' : c;
      return `<div style="padding:11px 16px;font-size:14px;cursor:pointer;${_feedActiveCat === val ? 'font-weight:700;color:var(--accent);' : ''}" data-cat="${esc(val)}" onclick="_feedFilterCat(this.dataset.cat)">${esc(c)}</div>`;
    }).join('');
    setTimeout(() => document.addEventListener('click', _closeFeedFilter, { once: true }), 10);
  }
}

export function _closeFeedFilter(e) {
  const drop = document.getElementById('feedFilterDrop');
  if (drop && !drop.contains(e.target)) drop.style.display = 'none';
}

export function _feedFilterCat(cat) {
  _feedActiveCat = cat;
  const drop = document.getElementById('feedFilterDrop');
  if (drop) drop.style.display = 'none';
  const btn = document.querySelector('#s-feed .btn-ghost');
  if (btn) btn.textContent = cat ? cat + ' ▾' : 'Фильтр ▾';
  const el = document.getElementById('feedList');
  if (!el) return;
  const posts = JSON.parse(localStorage.getItem('yc_feed_posts') || '[]').filter(p => !p.draft);
  const filtered = cat ? posts.filter(p => p.cat === cat) : posts;
  _paintFeed(el, filtered);
}

export function likeFeed(btn) {
  const raw = parseInt(btn.textContent.replace(/\D/g, ''));
  const n = isNaN(raw) ? 0 : raw;
  const liked = btn.classList.contains('liked');
  btn.textContent = liked ? `❤ ${Math.max(0, n - 1)}` : `❤ ${n + 1}`;
  btn.classList.toggle('liked');
  btn.style.color = btn.classList.contains('liked') ? 'var(--accent)' : 'var(--text-2)';
}

Object.assign(window, { renderClientFeed, _paintFeed, _toggleFeedFilter, _closeFeedFilter, _feedFilterCat, likeFeed, go });
