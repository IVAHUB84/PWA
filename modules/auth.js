import { go } from './navigation.js';
import { setOnLeaveOtpFn } from './navigation.js';
import { _sha256, _normalizePhone, _maskEmail } from './utils.js';
import { EMAILJS, YC, _findClientByPhone, _findClientByEmail } from './api.js';
import { getSession, saveSession, clearSession, setAuthContext } from './storage.js';
import { state } from './state.js';

// Render callbacks — registered by app.js once profile/admin modules are loaded
let _renderHomeHeroFn = () => {};
let _renderProfileScreenFn = () => {};
let _renderAdminDashboardFn = () => {};
export function setAuthRenderFns({ renderHomeHero, renderProfileScreen, renderAdminDashboard }) {
  if (renderHomeHero) _renderHomeHeroFn = renderHomeHero;
  if (renderProfileScreen) _renderProfileScreenFn = renderProfileScreen;
  if (renderAdminDashboard) _renderAdminDashboardFn = renderAdminDashboard;
}

// ── OTP COUNTDOWN ──
let _otpCountdownTimer = null;

setOnLeaveOtpFn(() => {
  if (_otpCountdownTimer) { clearInterval(_otpCountdownTimer); _otpCountdownTimer = null; }
});

function _startOtpCountdown(seconds = 180) {
  if (_otpCountdownTimer) clearInterval(_otpCountdownTimer);
  const hint = document.getElementById('otpRetryHint');
  const timerEl = document.getElementById('otpTimer');
  const countdown = document.getElementById('otpCountdown');
  if (hint) hint.style.display = 'none';
  if (timerEl) timerEl.style.display = 'block';
  let remaining = seconds;
  const update = () => {
    if (!countdown) return;
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    countdown.textContent = `${m}:${String(s).padStart(2, '0')}`;
  };
  update();
  _otpCountdownTimer = setInterval(() => {
    remaining--;
    update();
    if (remaining <= 0) {
      clearInterval(_otpCountdownTimer);
      _otpCountdownTimer = null;
      if (timerEl) timerEl.style.display = 'none';
      if (hint) hint.style.display = 'block';
    }
  }, 1000);
}

export function _otpClear() {
  ['otp1', 'otp2', 'otp3', 'otp4'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('filled', 'cursor'); }
  });
}

export function _setOtpError(msg) {
  const hint = document.querySelector('#s-otp .otp-hint');
  if (hint) hint.innerHTML = `<span style="color:var(--red)">${msg}</span>`;
}

let _sendingCode = false;

// ── SEND CODE BY PHONE ──
export async function sendCodeByPhone() {
  if (_sendingCode) return;
  _sendingCode = true;
  setAuthContext('login');
  const input = document.getElementById('loginPhone');
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  if (!input) { _sendingCode = false; return; }
  const phone = _normalizePhone(input.value);
  if (phone.length !== 11) {
    if (errEl) { errEl.textContent = 'Введите корректный номер телефона'; errEl.style.display = 'block'; }
    _sendingCode = false;
    return;
  }
  if (errEl) errEl.style.display = 'none';
  if (btn) {
    btn.disabled = true;
    const t = document.getElementById('loginBtnText');
    const s = document.getElementById('loginBtnSpinner');
    if (t) t.textContent = 'Ищем…';
    if (s) s.style.display = 'inline-block';
  }

  let client;
  try {
    client = await _findClientByPhone(phone);
  } finally {
    if (btn) {
      btn.disabled = false;
      const t = document.getElementById('loginBtnText');
      const s = document.getElementById('loginBtnSpinner');
      if (t) t.textContent = 'Получить код →';
      if (s) s.style.display = 'none';
    }
  }

  if (!client) {
    localStorage.setItem('yc_reg_phone', phone);
    go('s-register');
    _sendingCode = false;
    return;
  }

  const email = client.email || '';
  if (!email) {
    localStorage.setItem('yc_reg_phone', phone);
    localStorage.setItem('yc_reg_client_id', String(client.id));
    if (errEl) { errEl.textContent = 'Email не найден. Введите email для получения кода.'; errEl.style.display = 'block'; }
    _showPhoneEmailInput(phone, client);
    _sendingCode = false;
    return;
  }

  if (btn) {
    btn.disabled = true;
    const t = document.getElementById('loginBtnText');
    const s = document.getElementById('loginBtnSpinner');
    if (t) t.textContent = 'Отправляем…';
    if (s) s.style.display = 'inline-block';
  }
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const codeHash = await _sha256(code);
  try {
    await emailjs.send(EMAILJS.serviceId, EMAILJS.templateId, {
      to_email: email, name: client.name || 'Клиент', phone: '', topic: 'Код подтверждения', message: code, agreement: 'да',
    });
    // Write OTP to storage only after successful send
    localStorage.setItem('yc_otp', JSON.stringify({ codeHash, email, expiry: Date.now() + 10 * 60 * 1000, attempts: 0 }));
    localStorage.setItem('yc_auth_pending', JSON.stringify({ email, phone, client_id: client.id, client_name: client.name || '' }));
    go('s-otp');
    const sub = document.getElementById('otpSub');
    if (sub) sub.innerHTML = `Отправили код на <b>${_maskEmail(email)}</b><br><span style="font-size:12px;color:var(--text-2);">Проверьте папку «Спам»</span>`;
    _startOtpCountdown();
  } catch (e) {
    const msg = e?.text || e?.message || JSON.stringify(e) || 'неизвестная ошибка';
    if (errEl) { errEl.textContent = 'Ошибка: ' + msg; errEl.style.display = 'block'; }
  } finally {
    if (btn) {
      btn.disabled = false;
      const t = document.getElementById('loginBtnText');
      const s = document.getElementById('loginBtnSpinner');
      if (t) t.textContent = 'Получить код →';
      if (s) s.style.display = 'none';
    }
    _sendingCode = false;
  }
}

function _showPhoneEmailInput(phone, client) {
  const wrap = document.querySelector('#s-login .login-wrap');
  if (!wrap) return;
  if (document.getElementById('loginEmailFallback')) return;
  const div = document.createElement('div');
  div.id = 'loginEmailFallback';
  div.innerHTML = `
    <div class="login-lbl" style="margin-top:12px;">Email для кода</div>
    <div class="login-field">
      <input type="email" inputmode="email" id="loginEmailFb" placeholder="your@email.com"
        style="background:none;border:none;outline:none;font-size:17px;font-weight:500;font-family:inherit;flex:1;color:var(--text);">
    </div>
    <button class="btn-primary" style="margin-top:8px;" id="sendCodeFbBtn">Отправить код →</button>`;
  const btn = document.getElementById('loginBtn');
  if (btn) btn.parentNode.insertBefore(div, btn.nextSibling);
  const fbBtn = document.getElementById('sendCodeFbBtn');
  if (fbBtn) fbBtn.addEventListener('click', () => _sendCodeToFallbackEmail(phone, client.id, client.name || ''));
}

async function _sendCodeToFallbackEmail(phone, clientId, clientName) {
  const errEl = document.getElementById('loginError');
  const emailEl = document.getElementById('loginEmailFb');
  if (!emailEl) return;
  const email = emailEl.value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (errEl) { errEl.textContent = 'Введите корректный email'; errEl.style.display = 'block'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const codeHash = await _sha256(code);
  try {
    await emailjs.send(EMAILJS.serviceId, EMAILJS.templateId, {
      to_email: email, name: clientName || 'Клиент', phone: '', topic: 'Код подтверждения', message: code, agreement: 'да',
    });
    localStorage.setItem('yc_otp', JSON.stringify({ codeHash, email, expiry: Date.now() + 10 * 60 * 1000, attempts: 0 }));
    localStorage.setItem('yc_auth_pending', JSON.stringify({ email, phone: String(phone), client_id: clientId, client_name: clientName }));
    go('s-otp');
  } catch (e) {
    const msg = e?.text || e?.message || JSON.stringify(e) || 'ошибка';
    if (errEl) { errEl.textContent = 'Ошибка: ' + msg; errEl.style.display = 'block'; }
  }
}

// ── SEND CODE BY EMAIL ──
export async function sendEmailCode() {
  setAuthContext('login');
  const input = document.getElementById('loginEmail');
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  if (!input) return;
  const email = input.value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (errEl) { errEl.textContent = 'Введите корректный email'; errEl.style.display = 'block'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Отправляем…'; }
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const codeHash = await _sha256(code);
  try {
    await emailjs.send(EMAILJS.serviceId, EMAILJS.templateId, {
      to_email: email, name: 'Клиент', phone: '', topic: 'Код подтверждения', message: code, agreement: 'да',
    });
    localStorage.setItem('yc_otp', JSON.stringify({ codeHash, email, expiry: Date.now() + 10 * 60 * 1000, attempts: 0 }));
    localStorage.setItem('yc_auth_pending', JSON.stringify({ email, phone: '', client_id: null, client_name: '' }));
    go('s-otp');
  } catch (e) {
    const msg = e?.text || e?.message || JSON.stringify(e) || 'неизвестная ошибка';
    if (errEl) { errEl.textContent = 'Ошибка: ' + msg; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Получить код →'; }
  }
}

// ── RETRY EMAIL OTP ──
export async function retryEmail() {
  const stored = JSON.parse(localStorage.getItem('yc_otp') || 'null');
  if (!stored) return;
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const codeHash = await _sha256(code);
  try {
    await emailjs.send(EMAILJS.serviceId, EMAILJS.templateId, {
      to_email: stored.email, name: 'Клиент', phone: '', topic: 'Код подтверждения', message: code, agreement: 'да',
    });
    // Update only after successful send
    localStorage.setItem('yc_otp', JSON.stringify({ ...stored, codeHash, attempts: 0, expiry: Date.now() + 10 * 60 * 1000 }));
    _startOtpCountdown();
  } catch {
    const hint = document.querySelector('#s-otp .otp-hint');
    if (hint) hint.innerHTML = '<span style="color:var(--red)">Ошибка отправки. Попробуйте ещё раз.</span>';
  }
}

let _verifyingOtp = false;

// ── VERIFY OTP ──
export async function verifyOtp() {
  if (_verifyingOtp) return;
  const entered = ['otp1', 'otp2', 'otp3', 'otp4'].map(id => {
    const el = document.getElementById(id); return el ? el.value : '';
  }).join('');
  if (entered.length < 4) return;

  // Re-read from storage atomically; double-submit protection via in-flight flag
  _verifyingOtp = true;
  try {
    const stored = JSON.parse(localStorage.getItem('yc_otp') || 'null');
    if (!stored) { _setOtpError('Сессия истекла, войдите снова'); return; }
    if (Date.now() > stored.expiry) { _setOtpError('Код истёк, запросите новый'); return; }
    if ((stored.attempts || 0) >= 5) { _setOtpError('Слишком много попыток. Запросите новый код.'); return; }

    stored.attempts = (stored.attempts || 0) + 1;
    localStorage.setItem('yc_otp', JSON.stringify(stored));

    const enteredHash = await _sha256(entered);
    if (stored.codeHash !== enteredHash) { _setOtpError('Неверный код'); return; }

    const pending = JSON.parse(localStorage.getItem('yc_auth_pending') || 'null');
    if (!pending || !pending.email) { _setOtpError('Сессия истекла, войдите снова'); return; }
    const { email, phone, client_id, client_name } = pending;
    localStorage.removeItem('yc_otp');
    localStorage.removeItem('yc_auth_pending');

    if (client_id) {
      saveSession({ email: email || '', user_token: '', name: client_name || '', phone: phone || '', client_id });
      _otpClear();
      _renderHomeHeroFn();
      _renderProfileScreenFn();
      if (state._bookAfterLogin) { state._bookAfterLogin = false; go('s-services', 'tab'); }
      else { go('s-home', 'tab'); }
      return;
    }

    const existing = getSession();
    if (existing && existing.email === email) {
      _otpClear();
      _renderHomeHeroFn();
      _renderProfileScreenFn();
      if (state._bookAfterLogin) { state._bookAfterLogin = false; go('s-services', 'tab'); }
      else { go('s-home', 'tab'); }
      return;
    }

    const client = await _findClientByEmail(email);
    if (client) {
      saveSession({ email, user_token: '', name: client.name || '', phone: client.phone || '', client_id: client.id });
      _otpClear();
      _renderHomeHeroFn();
      _renderProfileScreenFn();
      if (state._bookAfterLogin) { state._bookAfterLogin = false; go('s-services', 'tab'); }
      else { go('s-home', 'tab'); }
    } else {
      localStorage.setItem('yc_reg_email', email);
      _otpClear();
      go('s-register');
    }
  } finally {
    _verifyingOtp = false;
  }
}

// ── REGISTER CLIENT ──
export async function registerClient() {
  const nameEl = document.getElementById('regName');
  const phoneEl = document.getElementById('regPhone');
  const emailEl = document.getElementById('regEmail');
  const errEl = document.getElementById('regError');
  const btn = document.getElementById('regBtn');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) {
    if (errEl) { errEl.textContent = 'Введите имя'; errEl.style.display = 'block'; }
    return;
  }
  const email = (emailEl ? emailEl.value.trim().toLowerCase() : '') || localStorage.getItem('yc_reg_email') || '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (errEl) { errEl.textContent = 'Введите корректный email'; errEl.style.display = 'block'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Создаём…'; }
  const phone = (phoneEl ? _normalizePhone(phoneEl.value) : '') || localStorage.getItem('yc_reg_phone') || '';
  const body = { name, email };
  if (phone.length === 11) body.phone = phone;
  const r = await YC.post(`/clients/${YC.company}`, body);
  if (btn) { btn.disabled = false; btn.textContent = 'Создать профиль →'; }
  if (!r.success) {
    if (errEl) { errEl.textContent = r.meta?.message || 'Ошибка при создании профиля'; errEl.style.display = 'block'; }
    return;
  }
  const clientId = r.data?.id || r.data?.client_id || null;
  saveSession({ email, user_token: '', name, phone: phone.length === 11 ? phone : '', client_id: clientId });
  localStorage.removeItem('yc_reg_email');
  localStorage.removeItem('yc_reg_phone');
  if (nameEl) nameEl.value = '';
  if (phoneEl) phoneEl.value = '';
  if (emailEl) emailEl.value = '';
  _renderHomeHeroFn();
  _renderProfileScreenFn();
  if (state._bookAfterLogin) { state._bookAfterLogin = false; go('s-services', 'tab'); }
  else { go('s-consent'); }
}

// ── LOGOUT ──
export function logout() {
  clearSession();
  go('s-login', 'tab');
}

// ── ENTER ADMIN ──
export async function enterAdmin() {
  const storedHash = localStorage.getItem('yc_admin_pin_hash');
  if (!storedHash) {
    const pin = prompt('Установите PIN-код администратора (минимум 6 символов):');
    if (!pin || pin.length < 6) { alert('PIN слишком короткий — минимум 6 символов'); return; }
    const pin2 = prompt('Повторите PIN:');
    if (pin !== pin2) { alert('PIN не совпадает'); return; }
    localStorage.setItem('yc_admin_pin_hash', await _sha256(pin));
    go('s-admin', 'tab');
    _renderAdminDashboardFn();
    return;
  }
  const pin = prompt('PIN-код администратора:');
  if (pin === null) return;
  if (await _sha256(pin) !== storedHash) { alert('Неверный PIN-код'); return; }
  go('s-admin', 'tab');
  _renderAdminDashboardFn();
}

Object.assign(window, {
  sendCodeByPhone, sendEmailCode, retryEmail, verifyOtp, registerClient, logout, enterAdmin,
});
