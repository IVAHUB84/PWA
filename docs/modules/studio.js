import { STUDIO } from './constants.js';
import { esc } from './utils.js';

const LS_KEY = 'yc_company';

let _apiData = null;

export function setCompanyData(raw) {
  if (!raw || typeof raw !== 'object') return;
  const data = raw.data || raw;
  if (!data || typeof data !== 'object') return;

  const phones = Array.isArray(data.phones) ? data.phones : [];
  const phone = phones.find(p => typeof p === 'string' && p.trim()) || (typeof data.phone === 'string' ? data.phone.trim() : '');

  const normalized = {
    title:    typeof data.title    === 'string' ? data.title.trim()    : '',
    address:  typeof data.address  === 'string' ? data.address.trim()  : '',
    phone:    phone,
    schedule: typeof data.schedule === 'string' ? data.schedule.trim() : '',
    lat:      Number(data.coordinate_lat) || 0,
    lon:      Number(data.coordinate_lon) || 0,
  };

  const hasAny = normalized.title || normalized.address || normalized.phone || normalized.schedule;
  const hasCoords = normalized.lat !== 0 && normalized.lon !== 0;

  if (!hasAny && !hasCoords) return;

  _apiData = normalized;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(normalized));
  } catch {}
}

export function getCompanyContacts() {
  const api = _apiData;
  let cached = null;
  if (!api) {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          cached = {
            title:    typeof parsed.title    === 'string' ? parsed.title.trim()    : '',
            address:  typeof parsed.address  === 'string' ? parsed.address.trim()  : '',
            phone:    typeof parsed.phone    === 'string' ? parsed.phone.trim()    : '',
            schedule: typeof parsed.schedule === 'string' ? parsed.schedule.trim() : '',
            lat:      Number(parsed.lat)  || 0,
            lon:      Number(parsed.lon)  || 0,
          };
        }
      }
    } catch {}
  }
  const src = api || cached || {};

  const title    = (src.title    && src.title.trim())    || STUDIO.title;
  const address  = (src.address  && src.address.trim())  || STUDIO.address;
  const phone    = (src.phone    && src.phone.trim())     || STUDIO.phone;
  const schedule = (src.schedule && src.schedule.trim()) || STUDIO.schedule;

  const hasApiCoords = Number.isFinite(src.lat) && Number.isFinite(src.lon) && src.lat !== 0 && src.lon !== 0;
  const lat      = hasApiCoords ? src.lat : STUDIO.lat;
  const lon      = hasApiCoords ? src.lon : STUDIO.lon;
  const mapYandex = hasApiCoords
    ? `https://yandex.ru/maps/?pt=${lon},${lat}&z=17&l=map`
    : STUDIO.mapYandex;
  const map2gis = STUDIO.map2gis;

  return { title, address, phone, schedule, lat, lon, mapYandex, map2gis };
}

function _telHref(phone) {
  return 'tel:' + String(phone || '').replace(/[^+\d]/g, '');
}

export function renderStudioContacts({ variant } = {}) {
  const c = getCompanyContacts();

  const rows = `
    <div class="studio-contacts__row">
      <span class="studio-contacts__label">Адрес</span>
      <span class="studio-contacts__val">${esc(c.address)}</span>
    </div>
    <div class="studio-contacts__row">
      <span class="studio-contacts__label">Телефон</span>
      <a class="studio-contacts__phone" href="${esc(_telHref(c.phone))}">${esc(c.phone)}</a>
    </div>
    <div class="studio-contacts__row">
      <span class="studio-contacts__label">Часы</span>
      <span class="studio-contacts__val">${esc(c.schedule)}</span>
    </div>
    <div class="studio-contacts__actions">
      <a class="btn-primary studio-contacts__map-btn" href="${esc(c.mapYandex)}" target="_blank" rel="noopener">Маршрут</a>
      ${c.map2gis ? `<a class="studio-contacts__2gis" href="${esc(c.map2gis)}" target="_blank" rel="noopener">2ГИС</a>` : ''}
    </div>`;

  if (variant === 'profile') {
    return `
      <div style="padding:16px 20px 6px;"><div class="label">О студии</div></div>
      <div class="settings-group">
        <div class="studio-contacts">
          <div class="studio-contacts__title">${esc(c.title)}</div>
          ${rows}
        </div>
      </div>`;
  }

  return `
    <div class="studio-contacts studio-contacts--confirm">
      <div class="studio-contacts__title">${esc(c.title)}</div>
      ${rows}
    </div>`;
}
