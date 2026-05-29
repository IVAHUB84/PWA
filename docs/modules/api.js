import { _normalizePhone } from './utils.js';
import { getSession } from './storage.js';
import { WORKER_URL } from './constants.js';

export const EMAILJS = {
  serviceId:  'service_m2fr45h',
  templateId: 'template_0wps847',
  publicKey:  'B16bxReUihFyj_-OI',
};

export const YC = {
  token:     'Pe1mZ3x1V99eA6eUWqV5',
  userToken: '0c328eecdfc15d40b2a9fe4fec08f741',
  company:   1940850,
  base:      'https://api.yclients.com/api/v1',
  _h() {
    return {
      Authorization: `Bearer ${this.token}, User ${this.userToken}`,
      Accept: 'application/vnd.yclients.v2+json',
      'Content-Type': 'application/json',
    };
  },
  async get(path, params = {}, opts = {}) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 15000);
    try {
      const url = new URL(this.base + path);
      Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
      const r = await fetch(url.toString(), { headers: this._h(), signal: ctrl.signal });
      if (!r.ok) return { success: false, _status: r.status };
      return r.json();
    } catch(e) { if (!opts.silent) console.error('YC.get', path, e); return { success: false }; }
    finally { clearTimeout(tid); }
  },
  async post(path, body, method = 'POST') {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch(this.base + path, {
        method, headers: this._h(), body: JSON.stringify(body), signal: ctrl.signal,
      });
      if (!r.ok) return { success: false, _status: r.status };
      return r.json();
    } catch(e) { console.error('YC.post', path, e); return { success: false }; }
    finally { clearTimeout(tid); }
  },
};

export async function _findClientByPhone(phone) {
  try {
    const r = await YC.get(`/clients/${YC.company}`, { phone });
    if (r.success && Array.isArray(r.data) && r.data.length) {
      return r.data.find(c => _normalizePhone(c.phone || '') === phone) || r.data[0];
    }
  } catch {}
  return null;
}

export async function _findClientByEmail(email) {
  try {
    const r = await YC.get(`/clients/${YC.company}`, { email });
    if (r.success && Array.isArray(r.data) && r.data.length) {
      return r.data.find(c => (c.email || '').toLowerCase() === email.toLowerCase()) || null;
    }
  } catch {}
  return null;
}

export async function _fetchAndMergeServerRecords(clientId) {
  try {
    const r = await YC.get(`/records/${YC.company}`, { client_id: clientId, count: 50 });
    if (!r.success || !Array.isArray(r.data)) return;
    const now = new Date();
    const serverRecords = r.data.map(rec => {
      const svc = rec.services && rec.services[0];
      const staff = rec.staff || {};
      const dt = (rec.date || '').replace('T', ' ').slice(0, 16) + ':00';
      return {
        id: rec.id,
        hash: rec.record_hash || '',
        svcName: svc ? svc.title : 'Услуга',
        svcId: svc ? String(svc.id) : '',
        masterName: staff.name || 'Мастер',
        masterId: staff.id ? String(staff.id) : '',
        ycStaffId: rec.staff_id || (staff.id || null),
        ycSvcId: svc ? svc.id : null,
        seanceLength: rec.seance_length || 3600,
        datetime: dt,
        price: svc ? (svc.cost ? svc.cost + ' ₽' : '') : '',
        dur: Math.round((rec.seance_length || 3600) / 60),
        status: rec.deleted ? 'cancelled' : (new Date(dt.replace(' ', 'T')) > now ? 'upcoming' : 'past'),
      };
    });
    const local = JSON.parse(localStorage.getItem('yc_records') || '[]');
    const localCancelledIds = new Set(local.filter(r => r.status === 'cancelled').map(r => String(r.id)));
    const filteredServer = serverRecords.filter(r => !localCancelledIds.has(String(r.id)));
    const serverIds = new Set(filteredServer.map(r => String(r.id)));
    const localOnly = local.filter(r => !serverIds.has(String(r.id))).map(r => {
      if (r.status === 'upcoming' && r.id && !isNaN(Number(r.id))) return { ...r, status: 'cancelled' };
      return r;
    });
    const merged = [...filteredServer, ...localOnly];
    merged.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    try { localStorage.setItem('yc_records', JSON.stringify(merged)); } catch {}
    return merged;
  } catch {}
}

export async function postComment({ rating, text, staffId, recordId, clientId }, _fetch = fetch) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await _fetch(`${WORKER_URL}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, text, staff_id: staffId, record_id: recordId, client_id: clientId }),
      signal: ctrl.signal,
    });
    if (!r.ok) return { ok: false };
    const data = await r.json();
    if (data && data.ok === true) return { ok: true };
    return { ok: false };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(tid);
  }
}

export async function fetchStaffByService(serviceId, _ycGet = YC.get.bind(YC)) {
  try {
    const r = await _ycGet('/book_staff/' + YC.company, { 'service_ids[]': serviceId });
    if (!r || r.success === false) return null;
    if (!Array.isArray(r.data)) return null;
    return r.data;
  } catch {
    return null;
  }
}

export async function _loadClientLoyalty() {
  const sess = getSession();
  if (!sess) return null;
  try {
    if (sess.phone) {
      const r = await YC.get(`/clients/${YC.company}`, { phone: sess.phone });
      if (r.success && Array.isArray(r.data) && r.data.length) return r.data[0];
    }
    if (sess.email) {
      const r = await YC.get(`/clients/${YC.company}`, { email: sess.email });
      if (r.success && Array.isArray(r.data) && r.data.length) return r.data[0];
    }
  } catch {}
  return null;
}
