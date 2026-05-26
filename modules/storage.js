export let _authContext = 'login';
export function setAuthContext(val) { _authContext = val; }

export function getSession() {
  try { return JSON.parse(localStorage.getItem('yc_session') || 'null'); } catch { return null; }
}

export function saveSession(data) {
  localStorage.setItem('yc_session', JSON.stringify(data));
}

export function clearSession() {
  ['yc_session', 'yc_records', 'yc_phone', 'yc_client_name', 'yc_otp', 'yc_auth_pending',
    'yc_reg_email', 'yc_reg_phone', 'yc_reg_client_id'].forEach(k => localStorage.removeItem(k));
}

export function _loadStoredRecords() {
  try { return JSON.parse(localStorage.getItem('yc_records') || '[]'); } catch { return []; }
}
