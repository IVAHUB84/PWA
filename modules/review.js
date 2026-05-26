import { state, MASTERS_DATA } from './state.js';
import { go } from './navigation.js';
import { REVIEW_URLS } from './constants.js';
import { getInitials, _hasRealAvatar } from './utils.js';

export function setStar(n) {
  document.querySelectorAll('#starsRow .star').forEach((s, i) => s.classList.toggle('on', i < n));
}

export function renderReviewScreen() {
  const sub = document.getElementById('reviewPageSub');
  const nameEl = document.getElementById('reviewMasterName');
  const roleEl = document.getElementById('reviewMasterRole');
  const avatarEl = document.getElementById('reviewMasterAvatar');
  const ta = document.getElementById('reviewTextarea');
  if (sub) sub.textContent = (state._reviewRecordDate || '') + (state._reviewSvcName ? ' · ' + state._reviewSvcName : '');
  if (nameEl) nameEl.textContent = state._reviewMasterName || 'Мастер';
  if (roleEl) {
    const m = MASTERS_DATA.find(x => x.id === state._reviewMasterId);
    roleEl.textContent = m ? m.role : 'Мастер';
  }
  if (avatarEl) {
    const m = MASTERS_DATA.find(x => x.id === state._reviewMasterId);
    avatarEl.innerHTML = '';
    if (m && _hasRealAvatar(m)) {
      const img = document.createElement('img');
      img.src = m.avatar_big || m.avatar;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
      img.onerror = () => { avatarEl.removeChild(img); avatarEl.textContent = getInitials(state._reviewMasterName || '?'); };
      avatarEl.appendChild(img);
    } else {
      avatarEl.textContent = getInitials(state._reviewMasterName || '?');
    }
  }
  if (ta) ta.value = '';
  setStar(4);
}

export function openRateVisit(recordId, masterId, masterName, svcName, datetime) {
  state._reviewMasterId = masterId;
  state._reviewMasterName = masterName;
  state._reviewSvcName = svcName;
  const d = new Date(datetime.replace(' ', 'T'));
  state._reviewRecordDate = isNaN(d) ? datetime : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  go('s-review');
}

export function submitReview() {
  const stars = document.querySelectorAll('#starsRow .star.on').length;
  const text = (document.getElementById('reviewTextarea')?.value || '').trim();
  const reviews = JSON.parse(localStorage.getItem('yc_reviews') || '[]');
  reviews.push({
    masterId: state._reviewMasterId,
    masterName: state._reviewMasterName,
    svcName: state._reviewSvcName,
    date: state._reviewRecordDate,
    stars,
    text,
    saved: new Date().toISOString(),
  });
  localStorage.setItem('yc_reviews', JSON.stringify(reviews));
  go('s-home', 'tab');
}

export function openReview(platform) {
  if (!Object.prototype.hasOwnProperty.call(REVIEW_URLS, platform)) return;
  window.open(REVIEW_URLS[platform], '_blank');
  const doneEl = document.getElementById(platform === '2gis' ? 'done2gis' : 'doneYandex');
  if (doneEl) doneEl.style.display = 'block';
}

Object.assign(window, { setStar, renderReviewScreen, openRateVisit, submitReview, openReview });
