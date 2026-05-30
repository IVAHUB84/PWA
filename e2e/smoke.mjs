// E2E smoke против ЖИВОГО YCLIENTS API. СТРОГО read-only:
//   - любой не-GET к api.yclients.com аборчится на уровне перехвата (страховка от мутаций);
//   - EmailJS и push-worker writes тоже блокируются;
//   - до кнопки «Подтвердить запись» тест не доходит.
// Гоняет реальный путь: boot → услуги (live) → карточка услуги → мастера (live) → слоты (live даты/время).
// Запуск: node e2e/smoke.mjs   (нужен установленный chromium для playwright)
import { chromium } from 'playwright';
import { startServer } from './static-server.mjs';

const PORT = 5050;
const BASE = `http://localhost:${PORT}`;
const results = [];
let mutationSeen = null; // {method,url} если кто-то попытался писать

function rec(name, status, info = '') { results.push({ name, status, info }); }

async function softStep(name, fn) {
  try { const info = await fn(); rec(name, 'PASS', info || ''); return true; }
  catch (e) { rec(name, 'FAIL', e.message.split('\n')[0]); return false; }
}

async function main() {
  const server = await startServer(PORT);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 393, height: 850 },
    serviceWorkers: 'block',
  });

  // ── Страховка: блок любых мутаций ──────────────────────────────────────────
  await context.route('https://api.yclients.com/**', route => {
    const req = route.request();
    if (req.method() === 'GET') return route.continue();
    mutationSeen = { method: req.method(), url: req.url() };
    return route.abort();
  });
  await context.route('https://api.emailjs.com/**', route => route.abort());
  await context.route('https://*.workers.dev/**', route => {
    const req = route.request();
    if (req.method() === 'GET') return route.continue();
    return route.abort();
  });

  // ── Сессия без client_id → грузимся на «Главную», без логина и без запроса записей ──
  await context.addInitScript(() => {
    localStorage.setItem('yc_session', JSON.stringify({ email: '', user_token: '', name: 'E2E', phone: '', client_id: null }));
    localStorage.setItem('yc_consent_accepted', '1');
  });

  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  await page.goto(`${BASE}/prototype.html`, { waitUntil: 'load' });

  // A. Boot + услуги с живого API отрисовались
  await softStep('Загрузка услуг с YCLIENTS (categories+services)', async () => {
    await page.waitForSelector('#serviceList .svc-catalog-card', { timeout: 30_000 });
    const n = await page.locator('#serviceList .svc-catalog-card').count();
    if (!n) throw new Error('нет карточек услуг');
    return `${n} услуг`;
  });

  // B. Переход на экран услуг через FAB
  await softStep('Навигация на экран «Запись» (FAB)', async () => {
    const fab = page.locator('#s-home .tab-center');
    if (await fab.count()) await fab.click();
    else await page.evaluate(() => window.go('s-services', 'tab'));
    await page.waitForSelector('#s-services.active', { timeout: 10_000 });
  });

  // C. Открыть карточку первой услуги
  const cardOpened = await softStep('Открытие карточки услуги', async () => {
    await page.locator('#serviceList .svc-catalog-card').first().click();
    await page.waitForSelector('#s-service.active', { timeout: 10_000 });
    await page.waitForSelector('#serviceCardContent button', { timeout: 10_000 });
    const hasBtn = await page.locator('#serviceCardContent button:has-text("Выбрать мастера")').count();
    if (!hasBtn) throw new Error('нет кнопки «Выбрать мастера»');
  });

  // D. Перейти к мастерам
  let mastersOk = false;
  if (cardOpened) {
    mastersOk = await softStep('Экран мастеров (live book_staff)', async () => {
      await page.locator('#serviceCardContent button:has-text("Выбрать мастера")').click();
      await page.waitForSelector('#s-masters.active', { timeout: 10_000 });
      await page.waitForFunction(() => {
        const l = document.querySelector('#mastersList');
        if (!l) return false;
        if (l.querySelector('.skel-master-card')) return false;
        return !!l.querySelector('.master-card') || /нет доступных мастеров/i.test(l.textContent || '');
      }, { timeout: 30_000 });
      const n = await page.locator('#mastersList .master-card').count();
      return n ? `${n} мастеров` : 'мастеров нет (пустое состояние)';
    });
  } else {
    rec('Экран мастеров (live book_staff)', 'SKIP', 'карточка услуги не открылась');
  }

  // E. «Любой свободный» → слоты
  let slotsScreen = false;
  if (mastersOk) {
    slotsScreen = await softStep('Переход к слотам («Любой свободный»)', async () => {
      const any = page.locator('#s-masters .any-master');
      if (await any.count() && await any.isVisible()) await any.click();
      else { await page.locator('#mastersList .master-card').first().click(); }
      await page.waitForSelector('#s-slots.active', { timeout: 10_000 });
    });
  } else {
    rec('Переход к слотам («Любой свободный»)', 'SKIP', '');
  }

  // F. Даты (live book_dates) не зависли на скелетоне
  let datesHaveItems = false;
  if (slotsScreen) {
    await softStep('Загрузка дат (live book_dates)', async () => {
      await page.waitForFunction(() => {
        const d = document.querySelector('#datesRow');
        if (!d) return false;
        if (d.querySelector('.skel-date')) return false;
        return !!d.querySelector('.date-item') || (d.textContent || '').trim().length > 0;
      }, { timeout: 30_000 });
      const n = await page.locator('#datesRow .date-item').count();
      datesHaveItems = n > 0;
      return n ? `${n} доступных дат` : 'дат нет (валидное состояние)';
    });
  } else {
    rec('Загрузка дат (live book_dates)', 'SKIP', '');
  }

  // G. Время (live book_times)
  if (datesHaveItems) {
    await softStep('Загрузка времени (live book_times)', async () => {
      await page.waitForFunction(() => {
        const g = document.querySelector('#slotsGrid');
        if (!g) return false;
        if (g.querySelector('.skel-slot')) return false;
        return !!g.querySelector('.slot') || (g.textContent || '').trim().length > 0;
      }, { timeout: 30_000 });
      const n = await page.locator('#slotsGrid .slot').count();
      return n ? `${n} окон` : 'окон нет на день (валидно)';
    });
  } else {
    rec('Загрузка времени (live book_times)', 'SKIP', '');
  }

  // H. Безопасность/стабильность
  rec('Нет необработанных JS-исключений', pageErrors.length ? 'FAIL' : 'PASS', pageErrors.slice(0, 3).join(' | '));
  rec('Не было мутирующих запросов к API', mutationSeen ? 'FAIL' : 'PASS', mutationSeen ? `${mutationSeen.method} ${mutationSeen.url}` : 'только GET');

  await browser.close();
  server.close();

  // ── Вывод ──
  const pad = s => s + ' '.repeat(Math.max(0, 48 - s.length));
  console.log('\n=== E2E SMOKE (live YCLIENTS, read-only) ===');
  for (const r of results) {
    const mark = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '∅';
    console.log(`  ${mark} ${pad(r.name)} ${r.status}${r.info ? '  — ' + r.info : ''}`);
  }
  if (consoleErrors.length) {
    console.log('\n  console.error (информативно, не влияет на результат):');
    [...new Set(consoleErrors)].slice(0, 8).forEach(e => console.log('    · ' + e.slice(0, 140)));
  }
  const failed = results.filter(r => r.status === 'FAIL').length;
  const passed = results.filter(r => r.status === 'PASS').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  console.log(`\nИтог: ${passed} прошло, ${failed} упало, ${skipped} пропущено\n`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('E2E runner crashed:', e); process.exit(2); });
