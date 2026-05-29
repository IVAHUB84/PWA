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

const IMAGE_SIZES = ['basic', 'norm', 'small', 'large', 'origin'];

const CATEGORY_MAP = {
  'Брови':    { emoji: '🪄', grad: 'linear-gradient(135deg,#F4B8CF,#E8729A)' },
  'Губы':     { emoji: '💋', grad: 'linear-gradient(135deg,#FBBDBD,#E05C7A)' },
  'Глаза':    { emoji: '✨', grad: 'linear-gradient(135deg,#C5C9F7,#7B83E0)' },
  'Эпиляция': { emoji: '🌿', grad: 'linear-gradient(135deg,#B8EFE0,#6DC9AF)' },
  _default:   { emoji: '💆', grad: 'linear-gradient(135deg,#E0D8F0,#A78FCC)' },
};

function serviceImageUrls(image_group) {
  try {
    if (!image_group || typeof image_group !== 'object') return [];
    const images = image_group.images;
    if (!images || typeof images !== 'object') return [];

    if (Array.isArray(images)) {
      return images
        .map(el => {
          if (!el || typeof el !== 'object') return null;
          if (typeof el.path === 'string' && el.path) return el.path;
          for (const size of IMAGE_SIZES) {
            if (el[size] && typeof el[size].path === 'string' && el[size].path) return el[size].path;
          }
          return null;
        })
        .filter(Boolean);
    }

    for (const size of IMAGE_SIZES) {
      if (images[size] && typeof images[size].path === 'string' && images[size].path) {
        return [images[size].path];
      }
    }
    return [];
  } catch {
    return [];
  }
}

function resolveServiceImage(service) {
  const cat = CATEGORY_MAP[service.cat] || CATEGORY_MAP._default;
  if (service.photos && service.photos.length) {
    return { type: 'photo', src: service.photos[0], emoji: cat.emoji, grad: cat.grad };
  }
  const key = normalizeTitle(service.name || '');
  if (SERVICE_PHOTO_MAP[key]) {
    return { type: 'photo', src: SERVICE_PHOTO_MAP[key], emoji: cat.emoji, grad: cat.grad };
  }
  if (cat.src) {
    return { type: 'photo', src: cat.src, emoji: cat.emoji, grad: cat.grad };
  }
  return { type: 'placeholder', emoji: cat.emoji, grad: cat.grad };
}

export { normalizeTitle, SERVICE_PHOTO_MAP, CATEGORY_MAP, resolveServiceImage, serviceImageUrls };
