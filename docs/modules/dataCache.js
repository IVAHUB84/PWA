const SCHEMA_VERSION = 'v1';
const CATALOG_KEY = `yc_catalog_cache_${SCHEMA_VERSION}`;
const PRICES_KEY  = `yc_prices_cache_${SCHEMA_VERSION}`;

const SAFE_CATALOG_FIELDS = ['id', 'name', 'cat', 'dur', 'price_min', 'priceStr', 'comment', 'photos'];

function _pickCatalogService(s) {
  const out = {};
  SAFE_CATALOG_FIELDS.forEach(f => { if (f in s) out[f] = s[f]; });
  return out;
}

export function readCatalogSnapshot() {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.services) || !Array.isArray(parsed.masters)) return null;
    return { services: parsed.services, masters: parsed.masters };
  } catch { return null; }
}

export function writeCatalogSnapshot(services, masters) {
  try {
    const payload = {
      services: services.map(_pickCatalogService),
      masters,
    };
    localStorage.setItem(CATALOG_KEY, JSON.stringify(payload));
  } catch { /* деградация: продолжаем без кэша */ }
}

export function readPricesSnapshot() {
  try {
    const raw = localStorage.getItem(PRICES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.servicePriceRange === null || typeof parsed.servicePriceRange !== 'object' || parsed.staffServicePrice === null || typeof parsed.staffServicePrice !== 'object') return null;
    return { servicePriceRange: parsed.servicePriceRange, staffServicePrice: parsed.staffServicePrice };
  } catch { return null; }
}

export function writePricesSnapshot(servicePriceRange, staffServicePrice) {
  try {
    localStorage.setItem(PRICES_KEY, JSON.stringify({ servicePriceRange, staffServicePrice }));
  } catch { /* деградация: продолжаем без кэша */ }
}
