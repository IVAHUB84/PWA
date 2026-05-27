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
  document.querySelectorAll('#s-review .tip-btn').forEach(b => b.classList.remove('sel'));
  document.getElementById('_customTipInput')?.remove();
  document.getElementById('_starsHint')?.remove();
  setStar(0);
}

export function openRateVisit(recordId, masterId, masterName, svcName, datetime) {
  state._reviewMasterId = masterId;
  state._reviewRecordId = recordId;
  state._reviewMasterName = masterName;
  state._reviewSvcName = svcName;
  const d = new Date(datetime.replace(' ', 'T'));
  state._reviewRecordDate = isNaN(d) ? datetime : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  go('s-review');
}

export function _selectCustomTip(btn) {
  btn.closest('.tips-row').querySelectorAll('.tip-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  const section = btn.closest('.tips-section');
  if (!section) return;
  let inp = document.getElementById('_customTipInput');
  if (!inp) {
    inp = document.createElement('input');
    inp.id = '_customTipInput';
    inp.type = 'number';
    inp.inputMode = 'numeric';
    inp.min = '1';
    inp.placeholder = 'Введите сумму ₽';
    inp.style.cssText = 'width:100%;box-sizing:border-box;height:44px;border:1.5px solid var(--border);border-radius:12px;padding:0 14px;font-size:15px;font-family:inherit;background:var(--surface);color:var(--text);margin-top:8px;display:block;';
    section.appendChild(inp);
    setTimeout(() => inp.focus(), 50);
  }
}

export function submitReview() {
  const stars = document.querySelectorAll('#starsRow .star.on').length;
  if (!stars) {
    const row = document.getElementById('starsRow');
    if (row) {
      row.style.outline = '2px solid var(--red)';
      row.style.borderRadius = '8px';
      setTimeout(() => { row.style.outline = ''; }, 1500);
    }
    let hint = document.getElementById('_starsHint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = '_starsHint';
      hint.style.cssText = 'text-align:center;color:var(--red);font-size:13px;margin:4px 0;';
      hint.textContent = 'Выберите оценку';
      row?.insertAdjacentElement('afterend', hint);
    }
    return;
  }
  document.getElementById('_starsHint')?.remove();
  const text = (document.getElementById('reviewTextarea')?.value || '').trim();
  const tipBtn = document.querySelector('#s-review .tip-btn.sel');
  const customInp = document.getElementById('_customTipInput');
  const tips = tipBtn
    ? (tipBtn.textContent.trim() === 'Своя сумма' && customInp?.value ? customInp.value + ' ₽' : tipBtn.textContent.trim())
    : '';
  const reviews = JSON.parse(localStorage.getItem('yc_reviews') || '[]');
  reviews.push({
    recordId: state._reviewRecordId || null,
    masterId: state._reviewMasterId,
    masterName: state._reviewMasterName,
    svcName: state._reviewSvcName,
    date: state._reviewRecordDate,
    stars,
    text,
    tips,
    saved: new Date().toISOString(),
  });
  try {
    const trimmed = reviews.slice(-100);
    localStorage.setItem('yc_reviews', JSON.stringify(trimmed));
  } catch { }
  go('s-home', 'tab');
}

export function openReview(platform) {
  if (!Object.prototype.hasOwnProperty.call(REVIEW_URLS, platform)) return;
  window.open(REVIEW_URLS[platform], '_blank');
  const doneEl = document.getElementById(platform === '2gis' ? 'done2gis' : 'doneYandex');
  if (doneEl) doneEl.style.display = 'block';
}

Object.assign(window, { setStar, renderReviewScreen, openRateVisit, submitReview, openReview, _selectCustomTip });
