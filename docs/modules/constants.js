export const WORKER_URL = 'https://studio-push.ivahub84.workers.dev';

export const SCREENS = [
  's-home', 's-services', 's-masters', 's-slots', 's-confirm', 's-history',
  's-install', 's-profile', 's-login', 's-otp', 's-register', 's-cancel',
  's-review', 's-offer', 's-crosssell', 's-consent', 's-feed', 's-admin',
  's-admin-feed', 's-admin-post', 's-admin-clients', 's-admin-push', 's-admin-push-new',
  's-master', 's-upcoming', 's-post',
];

export const DUR = 380;
export const EASE = 'cubic-bezier(0.4,0,0.2,1)';

export const _GRADS = [
  'linear-gradient(135deg,#F4B8CF,#E8729A)',
  'linear-gradient(135deg,#B8EFE0,#6DC9AF)',
  'linear-gradient(135deg,#EDACC3,#C8547F)',
  'linear-gradient(135deg,#C5F0E4,#72C8B0)',
];

export const _NO_AVATAR = ['no-master-sm.png', 'no-master.png'];

export const PUSH_TEMPLATES = {
  remind: { icon: '📅', title: 'Реснички · Напоминание о визите',    text: 'Напоминаем о вашей записи завтра. Ждём вас в студии!' },
  promo:  { icon: '🎁', title: 'Реснички · Специальное предложение', text: 'Только для вас: скидка 20% на следующую процедуру. Запишитесь сейчас!' },
  return: { icon: '🔔', title: 'Реснички · Ждём вас снова',         text: 'Скучаем! Давно не видели вас в студии. Записаться снова →' },
  custom: { icon: '💬', title: 'Реснички · Сообщение',              text: '' },
};

export const REVIEW_URLS = {
  '2gis':   'https://2gis.ru/moscow/firm/70000001042765322/tab/reviews/addreview',
  'yandex': 'https://yandex.ru/maps/org/byutiflaybar/121813740989/reviews/?add-review=true&ll=37.289422%2C55.466536&mode=search&sll=37.292712%2C55.466700&source=serp_navig&sspn=0.009790%2C0.009650&tab=reviews&text=%D0%91%D1%8C%D1%8E%D1%82%D0%B8%D0%A4%D0%BB%D0%B0%D0%B9%D0%91%D0%B0%D1%80%20%D0%A1%D1%82%D1%83%D0%B4%D0%B8%D1%8F%20%D1%8D%D0%BF%D0%B8%D0%BB%D1%8F%D1%86%D0%B8%D0%B8%20%D0%B8%20%D0%BF%D0%B5%D1%80%D0%BC%D0%B0%D0%BD%D0%B5%D0%BD%D1%82%D0%BD%D0%BE%D0%B3%D0%BE%20%D0%BC%D0%B0%D0%BA%D0%B8%D1%8F%D0%B6%D0%B0%20%D0%A2%D1%80%D0%BE%D0%B8%D1%86%D0%BA%D0%B8%D0%B9%20%D0%B1%D1%83%D0%BB%D1%8C%D0%B2%D0%B0%D1%80%2C%204%20%D0%A1%D0%BE%D0%BB%D0%BD%D0%B5%D1%87%D0%BD%D1%8B%D0%B9%20%D0%BC-%D0%BD%2C%20%D0%A2%D1%80%D0%BE%D0%B8%D1%86%D0%BA%20%D0%B3%D0%BE%D1%80.%20%D0%BE%D0%BA%D1%80%D1%83%D0%B3%2C%20%D0%A2%D1%80%D0%BE%D0%B8%D1%86%D0%BA%2C%20%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0&z=17.72',
};

export const _GH_API = 'https://api.github.com/repos/IVAHUB84/PWA/contents/docs/posts.json';
export const _GH_RAW = 'https://ivahub84.github.io/PWA/posts.json';

