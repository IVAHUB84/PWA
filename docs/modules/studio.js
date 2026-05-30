import { esc } from './utils.js';

const LS_KEY = 'yc_company';

let _apiData = null;

function _extractCompany(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw.data || raw;
  if (Array.isArray(d)) return d[0] || null;
  if (d && typeof d === 'object' && !Array.isArray(d)) return d;
  return null;
}

export function setCompanyData(raw) {
  const data = _extractCompany(raw);
  if (!data) return;

  const phones = Array.isArray(data.phones) ? data.phones : [];
  const phone = phones.find(p => typeof p === 'string' && p.trim())
    || (typeof data.phone === 'string' ? data.phone.trim() : '');

  const social = (data.social && typeof data.social === 'object') ? data.social : {};
  let telegram = typeof social.telegram === 'string' ? social.telegram.trim() : '';
  if (telegram.startsWith('@')) telegram = telegram.slice(1);

  const normalized = {
    title:       typeof data.title        === 'string' ? data.title.trim()        : '',
    publicTitle: typeof data.public_title === 'string' ? data.public_title.trim() : '',
    address:     typeof data.address      === 'string' ? data.address.trim()      : '',
    city:        typeof data.city         === 'string' ? data.city.trim()         : '',
    phone:       phone,
    schedule:    typeof data.schedule     === 'string' ? data.schedule.trim()     : '',
    site:        typeof data.site         === 'string' ? data.site.trim()         : '',
    telegram,
    lat:         Number(data.coordinate_lat) || 0,
    lon:         Number(data.coordinate_lon) || 0,
  };

  const hasAny = normalized.title || normalized.publicTitle || normalized.address
    || normalized.city || normalized.phone || normalized.schedule
    || normalized.site || normalized.telegram;
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
          let tg = typeof parsed.telegram === 'string' ? parsed.telegram.trim() : '';
          if (tg.startsWith('@')) tg = tg.slice(1);
          cached = {
            title:       typeof parsed.title       === 'string' ? parsed.title.trim()       : '',
            publicTitle: typeof parsed.publicTitle === 'string' ? parsed.publicTitle.trim() : '',
            address:     typeof parsed.address     === 'string' ? parsed.address.trim()     : '',
            city:        typeof parsed.city        === 'string' ? parsed.city.trim()        : '',
            phone:       typeof parsed.phone       === 'string' ? parsed.phone.trim()       : '',
            schedule:    typeof parsed.schedule    === 'string' ? parsed.schedule.trim()    : '',
            site:        typeof parsed.site        === 'string' ? parsed.site.trim()        : '',
            telegram:    tg,
            lat:         Number(parsed.lat) || 0,
            lon:         Number(parsed.lon) || 0,
          };
        }
      }
    } catch {}
  }
  const src = api || cached || {};

  return {
    title:       src.title       || '',
    publicTitle: src.publicTitle || '',
    address:     src.address     || '',
    city:        src.city        || '',
    phone:       src.phone       || '',
    schedule:    src.schedule    || '',
    site:        src.site        || '',
    telegram:    src.telegram    || '',
    lat:         Number(src.lat) || 0,
    lon:         Number(src.lon) || 0,
  };
}

export function _telHref(phone) {
  return 'tel:' + String(phone || '').replace(/[^+\d]/g, '');
}

function _hasValidCoords(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0 && lon !== 0;
}

export function _buildMapUrls(lat, lon, city, address, title) {
  const hasCoords = _hasValidCoords(lat, lon);
  const addrText = [city, address].filter(Boolean).join(', ');
  const text = encodeURIComponent(addrText);
  const titleEnc = encodeURIComponent(title || '');

  if (hasCoords) {
    return {
      apple:     `https://maps.apple.com/?ll=${lat},${lon}&q=${titleEnc}`,
      google:    `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
      yandexMap: `https://yandex.ru/maps/?pt=${lon},${lat}&z=17&l=map`,
      yandexNav: `yandexnavi://build_route_on_map?lat_to=${lat}&lon_to=${lon}`,
    };
  }
  return {
    apple:     `https://maps.apple.com/?q=${text}`,
    google:    `https://www.google.com/maps/search/?api=1&query=${text}`,
    yandexMap: `https://yandex.ru/maps/?text=${text}`,
    yandexNav: `yandexnavi://map_search?text=${text}`,
  };
}

export function openMapSheet() {
  const modal = document.getElementById('mapPickerModal');
  if (!modal) return;
  modal.style.display = 'flex';
}

export function closeMapSheet() {
  const modal = document.getElementById('mapPickerModal');
  if (!modal) return;
  modal.style.display = 'none';
}

function _fillMapSheet(c) {
  const urls = _buildMapUrls(c.lat, c.lon, c.city, c.address, c.publicTitle || c.title);

  const apple  = document.getElementById('mapPickerApple');
  const google = document.getElementById('mapPickerGoogle');
  const ynav   = document.getElementById('mapPickerYNav');
  const ymap   = document.getElementById('mapPickerYMap');

  if (apple)  { apple.href  = urls.apple;     apple.setAttribute('target', '_blank');  apple.setAttribute('rel', 'noopener'); }
  if (google) { google.href = urls.google;    google.setAttribute('target', '_blank'); google.setAttribute('rel', 'noopener'); }
  if (ymap)   { ymap.href   = urls.yandexMap; ymap.setAttribute('target', '_blank');   ymap.setAttribute('rel', 'noopener'); }
  if (ynav)   { ynav.href   = urls.yandexNav; ynav.removeAttribute('target'); ynav.removeAttribute('rel'); }
}

Object.assign(window, { openMapSheet, closeMapSheet });

export function renderStudioContacts({ variant } = {}) {
  const c = getCompanyContacts();

  const heading = c.publicTitle || c.title || '—';
  const addrParts = [c.city, c.address].filter(Boolean);
  const addrText = addrParts.length ? addrParts.join(', ') : '—';
  const phoneText = c.phone || '—';
  const scheduleText = c.schedule || '—';

  const phoneHtml = c.phone
    ? `<a class="studio-contacts__link" href="${esc(_telHref(c.phone))}">${esc(phoneText)}</a>`
    : `<span class="studio-contacts__val studio-contacts__dash">${esc(phoneText)}</span>`;

  const siteDisplay = c.site ? c.site.replace(/^https?:\/\//, '').replace(/\/$/, '') : '';
  const siteHref = c.site && /^https?:\/\//i.test(c.site) ? c.site : 'https://' + c.site;
  const siteRow = c.site ? `
    <div class="studio-contacts__row">
      <span class="studio-contacts__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
      </span>
      <a class="studio-contacts__link" href="${esc(siteHref)}" target="_blank" rel="noopener">${esc(siteDisplay)}</a>
    </div>` : '';

  const tgRow = c.telegram ? `
    <div class="studio-contacts__row">
      <span class="studio-contacts__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg>
      </span>
      <a class="studio-contacts__link" href="https://t.me/${esc(c.telegram)}" target="_blank" rel="noopener">@${esc(c.telegram)}</a>
    </div>` : '';

  const hasCoords = _hasValidCoords(c.lat, c.lon);
  const hasAddr = addrParts.length > 0;
  const showMapBtn = hasCoords || hasAddr;

  const mapBtnHtml = showMapBtn ? `
    <div class="studio-contacts__actions">
      <button class="btn-primary studio-contacts__map-btn" onclick="openMapSheet()">Показать на карте</button>
    </div>` : '';

  const rows = `
    <div class="studio-contacts__row">
      <span class="studio-contacts__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </span>
      <span class="studio-contacts__val">${esc(addrText)}</span>
    </div>
    <div class="studio-contacts__row">
      <span class="studio-contacts__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.07 1.18 2 2 0 012.07 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
      </span>
      ${phoneHtml}
    </div>
    <div class="studio-contacts__row">
      <span class="studio-contacts__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </span>
      <span class="studio-contacts__val">${esc(scheduleText)}</span>
    </div>
    ${siteRow}
    ${tgRow}
    ${mapBtnHtml}`;

  _fillMapSheet(c);

  if (variant === 'profile') {
    return `
      <div style="padding:16px 20px 6px;"><div class="label">О студии</div></div>
      <div class="settings-group">
        <div class="studio-contacts">
          <div class="studio-contacts__title">${esc(heading)}</div>
          ${rows}
        </div>
      </div>`;
  }

  return `
    <div class="studio-contacts studio-contacts--confirm">
      <div class="studio-contacts__title">${esc(heading)}</div>
      ${rows}
    </div>`;
}
