function normalizeTitle(s) {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[—–]/g, '-')
    .replace(/[«»""]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const SERVICE_PHOTO_MAP = {};

const CATEGORY_MAP = {
  'Брови':    { emoji: '🪄', grad: 'linear-gradient(135deg,#F4B8CF,#E8729A)' },
  'Губы':     { emoji: '💋', grad: 'linear-gradient(135deg,#FBBDBD,#E05C7A)' },
  'Глаза':    { emoji: '✨', grad: 'linear-gradient(135deg,#C5C9F7,#7B83E0)' },
  'Эпиляция': { emoji: '🌿', grad: 'linear-gradient(135deg,#B8EFE0,#6DC9AF)' },
  _default:   { emoji: '💆', grad: 'linear-gradient(135deg,#E0D8F0,#A78FCC)' },
};

function resolveServiceImage(service) {
  const cat = CATEGORY_MAP[service.cat] || CATEGORY_MAP._default;
  const key = normalizeTitle(service.name || '');
  if (SERVICE_PHOTO_MAP[key]) {
    return { type: 'photo', src: SERVICE_PHOTO_MAP[key], emoji: cat.emoji, grad: cat.grad };
  }
  if (cat.src) {
    return { type: 'photo', src: cat.src, emoji: cat.emoji, grad: cat.grad };
  }
  return { type: 'placeholder', emoji: cat.emoji, grad: cat.grad };
}

export { normalizeTitle, SERVICE_PHOTO_MAP, CATEGORY_MAP, resolveServiceImage };
