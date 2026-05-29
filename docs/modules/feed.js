import { go } from './navigation.js';
import { esc } from './utils.js';
import { state, SERVICES_DATA } from './state.js';

const _CAT_GRADS = {
  'Брови':    'linear-gradient(135deg,#F4C2A1,#C9956C)',
  'Ногти':    'linear-gradient(135deg,#E8C4F0,#C48FD8)',
  'Лицо':     'linear-gradient(135deg,#C8E6C9,#66BB6A)',
  'Волосы':   'linear-gradient(135deg,#F8BBD0,#E91E8C)',
  'Тело':     'linear-gradient(135deg,#B3E5FC,#039BE5)',
  'Акции':    'linear-gradient(135deg,#FFF8E1,#FFA000)',
  'Губы':     'linear-gradient(135deg,#FFCDD2,#E53935)',
  'Глаза':    'linear-gradient(135deg,#D1C4E9,#7E57C2)',
  'Эпиляция': 'linear-gradient(135deg,#F0F4C3,#AFB42B)',
};
const _CAT_ICONS2 = {
  'Брови':    '✨',
  'Ногти':    '💅',
  'Лицо':     '🌿',
  'Волосы':   '💆',
  'Тело':     '🧖',
  'Акции':    '🎁',
  'Губы':     '💋',
  'Глаза':    '👁️',
  'Эпиляция': '🌸',
};

let _ghReadFn = async () => null;
export function setGhReadFn(fn) { _ghReadFn = fn; }

let _feedActiveFilter = '';

export async function renderClientFeed() {
  const el = document.getElementById('feedList');
  if (!el) return;

  const cached = JSON.parse(localStorage.getItem('yc_feed_posts') || '[]').filter(p => !p.draft);
  if (cached.length) {
    _renderFeedCats();
    _paintFeed(el, cached);
  } else {
    el.innerHTML = [1,2,3].map(() => `
      <div class="skel-card">
        <div class="skel skel-img"></div>
        <div class="skel-body">
          <div class="skel skel-line skel-w80"></div>
          <div class="skel skel-line skel-w50"></div>
        </div>
      </div>`).join('');
  }

  const gh = await _ghReadFn();
  if (gh && gh.ok && gh.posts.length) {
    const published = gh.posts.filter(p => !p.draft);
    localStorage.setItem('yc_feed_posts', JSON.stringify(published));
    _renderFeedCats();
    _paintFeed(el, published);
  } else if (gh && gh.ok && !gh.posts.length) {
    localStorage.setItem('yc_feed_posts', '[]');
    _renderFeedCats();
    _paintFeed(el, []);
  } else if (!cached.length) {
    el.innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--text-2);font-size:14px;">Публикаций пока нет.<br>Следите за обновлениями!</div>';
  }
}

export function _feedCardHtml(p) {
  const type = p.type || 'free';
  const grad = _CAT_GRADS[p.cat] || 'linear-gradient(135deg,#eee,#ccc)';
  const icon = _CAT_ICONS2[p.cat] || '📝';
  const safeSrc = p.image && /^data:image\/|^https?:\/\//.test(p.image) ? p.image : null;
  const photoContent = safeSrc
    ? `<img src="${esc(safeSrc)}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:0;">`
    : `<div class="feed-photo-inner"><div class="feed-photo-icon">${icon}</div></div><div class="feed-photo-overlay"></div>`;
  const tagHtml = p.cat ? `<div class="feed-tag">${esc(p.cat)}</div>` : '';
  let bookBtn = '';
  if (type === 'service') {
    bookBtn = `<button class="feed-book" data-type="service" data-ref="${esc(p.serviceId || '')}" onclick="_feedGoBook(this.dataset.type,this.dataset.ref)">Записаться →</button>`;
  } else if (type === 'category') {
    bookBtn = `<button class="feed-book" data-type="category" data-ref="${esc(p.cat || '')}" onclick="_feedGoBook(this.dataset.type,this.dataset.ref)">Записаться →</button>`;
  }
  return `<div class="feed-card">
      <div class="feed-photo" style="${p.image ? 'overflow:hidden;' : 'background:' + grad + ';'}">
        ${photoContent}
      </div>
      <div class="feed-body">
        <div class="feed-body-top">
          ${tagHtml}
          ${bookBtn}
        </div>
        <div class="feed-caption">${esc(p.text)}</div>
        <div class="feed-meta">${esc(p.date)}</div>
      </div>
    </div>`;
}

export function _paintFeed(el, posts) {
  if (!posts.length) {
    el.innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--text-2);font-size:14px;">Публикаций пока нет.<br>Следите за обновлениями!</div>';
    return;
  }
  el.innerHTML = posts.map((p, i) => {
    const mb = i === posts.length - 1 ? ' style="margin-bottom:24px;"' : '';
    return _feedCardHtml(p).replace('<div class="feed-card">', `<div class="feed-card"${mb}>`);
  }).join('');
}

const _FEED_FILTERS = [
  { label: 'Все', value: '' },
  { label: 'Акции и услуги', value: 'promo' },
  { label: 'Новости', value: 'news' },
];

export function _renderFeedCats() {
  const bar = document.getElementById('feedCatBar');
  if (!bar) return;
  bar.innerHTML = _FEED_FILTERS.map(f => {
    const active = _feedActiveFilter === f.value ? ' active' : '';
    return `<button class="feed-cat-chip${active}" data-filter="${esc(f.value)}" onclick="_feedFilterCat(this.dataset.filter)">${esc(f.label)}</button>`;
  }).join('');
}

export function _feedFilterCat(filter) {
  _feedActiveFilter = filter;
  const bar = document.getElementById('feedCatBar');
  if (bar) bar.querySelectorAll('.feed-cat-chip').forEach(ch => {
    ch.classList.toggle('active', ch.dataset.filter === filter);
  });
  const el = document.getElementById('feedList');
  if (!el) return;
  const posts = JSON.parse(localStorage.getItem('yc_feed_posts') || '[]').filter(p => !p.draft);
  const filtered = _applyFeedFilter(posts, filter);
  _paintFeed(el, filtered);
}

function _applyFeedFilter(posts, filter) {
  if (!filter) return posts;
  if (filter === 'promo') return posts.filter(p => p.type === 'service' || p.type === 'category');
  if (filter === 'news') return posts.filter(p => !p.type || p.type === 'free');
  return posts;
}

export function _feedGoBook(type, ref) {
  if (type === 'service') {
    const exists = SERVICES_DATA.find(s => s.id === ref);
    if (exists && typeof window.openServiceCard === 'function') {
      window.openServiceCard(ref);
      return;
    }
  } else if (type === 'category') {
    const cats = new Set(SERVICES_DATA.map(s => s.cat));
    if (ref && cats.has(ref) && typeof window.filterCategory === 'function') {
      window.filterCategory(ref);
      go('s-services');
      return;
    }
  }
  if (typeof window.filterCategory === 'function') window.filterCategory('Все');
  go('s-services');
}

export function _openFeedPost(id) {
  const posts = JSON.parse(localStorage.getItem('yc_feed_posts') || '[]').filter(p => !p.draft);
  const post = posts.find(p => String(p.id) === String(id));
  if (post) {
    state._openPostId = post.id;
    go('s-post');
  } else {
    go('s-feed');
  }
}

export function renderPostScreen() {
  const el = document.getElementById('postCard');
  if (!el) return;
  const posts = JSON.parse(localStorage.getItem('yc_feed_posts') || '[]').filter(p => !p.draft);
  const post = posts.find(p => String(p.id) === String(state._openPostId));
  if (!post) {
    go('s-feed', 'replace');
    return;
  }
  el.innerHTML = _feedCardHtml(post);
}

Object.assign(window, { renderClientFeed, _paintFeed, _renderFeedCats, _feedFilterCat, _feedGoBook, _openFeedPost, go });
