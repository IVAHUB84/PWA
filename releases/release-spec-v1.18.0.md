# Спецификация релиза v1.18.0

- **Дата планирования:** 2026-05-29
- **Тип релиза:** minor (обратимо-совместимое добавление функциональности: единый press feedback, haptic-утилита, pulse бейджа уведомлений; публичные контракты не меняются).
- **Цели:** сделать интерфейс «живее» за счёт трёх дешёвых, не нарушающих визуальный стиль улучшений — единый CSS press feedback на всех интерактивных элементах, короткая `navigator.vibrate`-вибрация на ключевых действиях через единую утилиту-обёртку, мягкая CSS pulse-анимация бейджа непрочитанных уведомлений при `count > 0`; полное уважение `prefers-reduced-motion`.

## Источники

- BA-требования: `ba-req/ba-requirements-023.md` (ФТ-1…ФТ-11, НФТ-1…НФТ-7, КП-1…КП-10; ОВ-1/ОВ-2/ОВ-3/ОВ-4/ОВ-5 закрыты рекомендациями BA и подтверждены пользователем).
- ADR: `adrs/adr-020.md` (Q1.A — единый блок CSS press feedback с токенами; Q2.A — `hapticTap(kind)` в `docs/modules/utils.js`; Q3.A — `@keyframes inboxBadgePulse` + переключаемый класс `.inbox-badge--pulse`; Q4.A — единый media-блок `prefers-reduced-motion`; Q5.A — `CACHE_VERSION` `v66 → v67`).

## Объём релиза

Все задачи строго в пределах объёма BA-023 §2 и границ ADR-020 («Границы решения»). **Не трогаются:** логика `updateInboxBadge` (порог `count > 0`, формат `count > 9 ? '9+' : count`, `display:flex/none`), `getUnreadCount`, `inboxStore.js`, поведение `s-inbox` (`renderInbox`, `enterInbox`, `clearInboxHistory`, контекстное меню), YCLIENTS-токен в `prototype.html`, серверная сторона/`cf-worker`, `package.json`, `manifest.json`, модули `api.js`, `state.js`, `storage.js`, `navigation.js`, `auth.js`, `consent.js`, `serviceImages.js`, `history.js`, `profile.js`, `feed.js`, `github.js`, `notifications.js`, `scenarios.js`, `search.js`, `pin.js`, `push.js`, `install.js`, `inboxStore.js`, `constants.js`, `app.js`. Тапы по табам (кроме центральной FAB), `.inbox-bell-btn`, кнопки шапки, кнопке `.feed-book` в ленте — **не получают haptic** (минимальная подборка по ОВ-1); press feedback они получают. `selectMaster(id)` не получает `hapticTap` (двойное срабатывание с `tapMaster` нежелательно — см. ADR-020 «Границы решения»). Сохранение черновика поста (`publishPost(draft === true)`) — без haptic. `confirmCancel` — без haptic (ОВ-1). Новые рантайм-зависимости — **нет**. Ветка `backup` — запрещена.

### Изменяемые файлы (сводка)

- `docs/style.css` — новые токены press feedback в `:root`, новая секция `/* ── PRESS FEEDBACK ── */` (правила `:active` по группам + `@keyframes inboxBadgePulse` + `.inbox-badge--pulse` + media-блок `prefers-reduced-motion`); консолидация значений уже существующих `:active`-правил под токены (без визуального регресса) (Задача 1, Задача 3, Задача 5).
- `docs/modules/utils.js` — добавление `hapticTap(kind)` и `window.hapticTap` (Задача 2).
- `docs/modules/inbox.js` — переключение класса `inbox-badge--pulse` в `updateInboxBadge` (Задача 3).
- `docs/modules/services.js` — `hapticTap('select')` в `selectService` (Задача 4).
- `docs/modules/masters.js` — `hapticTap('select')` в `tapMaster`, `selectAnyMaster`; `hapticTap('submit')` в `bookFromMaster`, `bookServiceFromMaster` (Задача 4).
- `docs/modules/slots.js` — `hapticTap('select')` в `selectSlot` (Задача 4).
- `docs/modules/booking.js` — `hapticTap('submit')` в `startBooking` (Задача 4).
- `docs/modules/review.js` — `hapticTap('submit')` в `submitReview` (Задача 4).
- `docs/modules/admin.js` — `hapticTap('submit')` в `publishPost(!draft)`, `sendNewPush`, `sendPush` (Задача 4).
- `docs/prototype.html` — `onclick` центральной FAB-кнопки (строка 95) (Задача 4).
- `docs/sw.js` — `CACHE_VERSION` `'v66' → 'v67'` (Задача 6).
- `docs/version.json` — мейнтейнер на этапе `/release`/`/deploy`: `build` 33 → 34, `version` → `v1.18.0` (вне объёма реализации фичи).

### Задача 1: Единый CSS press feedback (токены + новая секция)

- **Что:**
  1. В `:root` (`docs/style.css:10-27`) **добавить** CSS-токены press feedback (новый блок в конце `:root`, перед закрывающей `}`):
     ```
     --press-scale-card: 0.97;
     --press-scale-button: 0.98;
     --press-scale-chip: 0.96;
     --press-scale-key: 0.91;
     --press-opacity-button: 0.85;
     --press-opacity-soft: 0.75;
     --press-duration: 120ms;
     ```
  2. **Добавить** новую секцию `/* ── PRESS FEEDBACK ── */` в `docs/style.css` после секции `/* ── TAP INDICATOR ── */` (после строки 461, перед `.install-banner`). Содержимое — четыре группы `:active`-правил по типу элемента:
     - **Группа «кнопки/действия» (opacity):**
       ```
       .btn-secondary, .btn-danger, .btn-ghost, .btn-yandex,
       .feed-book, .tip-btn, .review-ext-btn, .cs-add,
       .inbox-clear-btn { transition: opacity var(--press-duration); }
       .btn-secondary:active, .btn-danger:active, .btn-ghost:active, .btn-yandex:active,
       .feed-book:active, .tip-btn:active, .review-ext-btn:active, .cs-add:active
       { opacity: var(--press-opacity-button); }
       ```
     - **Группа «карточки/строки» (scale):**
       ```
       .hero-card, .feed-card, .audience-row, .push-template,
       .consent-item, .slot { transition: transform var(--press-duration); }
       .hero-card:active, .feed-card:active, .audience-row:active, .push-template:active,
       .consent-item:active, .slot:active { transform: scale(var(--press-scale-card)); }
       ```
     - **Группа «чипы/переключатели» (scale более выраженный):**
       ```
       .chip, .feed-cat-chip, .seg-btn, .consent-check { transition: transform var(--press-duration), background var(--press-duration), color var(--press-duration); }
       .chip:active, .feed-cat-chip:active, .seg-btn:active, .consent-check:active
       { transform: scale(var(--press-scale-chip)); }
       .tab:not(.tab-center) { transition: transform var(--press-duration); }
       .tab:not(.tab-center):active { transform: scale(var(--press-scale-button)); }
       ```
     - **Группа «клавиши» (уже есть `.pin-key`):** не добавляется новых правил — `.pin-key:active { transform:scale(.91); }` (`style.css:804`) сохраняется как есть.
  3. **Привести существующие `:active`-правила под токены** (без визуального регресса):
     - `.btn-primary:active { opacity: 0.85; }` (`style.css:186`) → `.btn-primary:active { opacity: var(--press-opacity-button); }`.
     - `.review-ext-platform:active { opacity:0.85; }` (`style.css:723`) → `.review-ext-platform:active { opacity: var(--press-opacity-button); }`.
     - `.inbox-bell-btn:active { opacity: 0.75; }` (`style.css:887`) → `.inbox-bell-btn:active { opacity: var(--press-opacity-soft); }`.
     - `.inbox-clear-btn:active { opacity: 0.6; }` (`style.css:912`) — **оставить как есть** (специфическое значение 0.6 — корзина в `s-inbox`, более выраженное; не подгонять под токен, чтобы не было регресса).
     - `.svc-catalog-card:active { transform: scale(0.97); }` (`style.css:282`) → `.svc-catalog-card:active { transform: scale(var(--press-scale-card)); }`.
     - `.master-card:active { transform: scale(0.99); }` (`style.css:317`) — **оставить как есть** (текущее `0.99` мягче токена `0.97`; не подгонять под токен, чтобы не было регресса). Альтернатива (по усмотрению разработчика) — подвести под `--press-scale-card`, согласовав значение `0.97` для обеих карточек; но решение по умолчанию — сохранить `0.99`.
     - `.tab-center-btn:active .tab-fab { transform: scale(0.92); ... }` (`style.css:156`) — **оставить как есть** (вложенный селектор, специфическая `box-shadow`-составляющая; не подгонять).
     - `.pin-key:active { transform:scale(.91); }` (`style.css:804`) — **оставить как есть**.
     - `.inbox-dots:active { background: var(--border); }` (`style.css:940`) — **оставить как есть** (специфический эффект «выделение фоном»).
     - `.inbox-menu button:active { background: var(--surface); }` (`style.css:960`) — **оставить как есть** (специфический эффект меню).
- **Где:** `docs/style.css` (только указанные блоки и строки).
- **Контракт:**
  - Все интерактивные элементы из перечня (см. ADR-020 Q1.A + Задача 1.2 выше) реагируют на тап единообразно по группе: длительность 120 мс, scale/opacity — из токенов.
  - Уже существующие `:active`-эффекты `.tab-center-btn`, `.btn-primary`, `.svc-catalog-card`, `.master-card`, `.pin-key`, `.review-ext-platform`, `.inbox-bell-btn` сохраняются без визуального регресса (значения 0.92/0.85/0.97/0.99/0.91/0.85/0.75 соответствуют ФТ-2).
  - Параметры по типу элемента унифицированы через CSS-токены (ФТ-3).
- **Критерии готовности:**
  - В DevTools (Toggle device toolbar → touch emulation) тап по каждому из новых селекторов даёт визуальный отклик в пределах ~80–120 мс. (BA-023 КП-1)
  - Уже работающие `:active`-эффекты выглядят так же, как до правки (ручная сверка). (BA-023 КП-2)
  - В консоли — ноль CSS-варнингов о невалидных свойствах. (BA-023 НФТ-3)
- **Связь с ADR:** ADR-020, Q1.A; Q4.A (media-блок — Задача 5).

### Задача 2: Утилита `hapticTap(kind)` в `docs/modules/utils.js`

- **Что:**
  1. **Добавить** в конец `docs/modules/utils.js` блок:
     ```
     /* ── HAPTIC ── */
     const _HAPTIC_PATTERNS = { select: 10, submit: 12, fab: 12, tap: 10 };
     let _reducedMotionMql = null;
     export function hapticTap(kind = 'tap') {
       if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
       if (!_reducedMotionMql && typeof window !== 'undefined' && window.matchMedia) {
         _reducedMotionMql = window.matchMedia('(prefers-reduced-motion: reduce)');
       }
       if (_reducedMotionMql && _reducedMotionMql.matches) return;
       try { navigator.vibrate(_HAPTIC_PATTERNS[kind] || _HAPTIC_PATTERNS.tap); } catch {}
     }
     if (typeof window !== 'undefined') window.hapticTap = hapticTap;
     ```
- **Где:** `docs/modules/utils.js` (новый блок в конце файла, после существующего `_importanceLabel`).
- **Контракт:**
  - `hapticTap(kind)` — единственная точка вызова `navigator.vibrate` в кодовой базе (ФТ-5/КП-4); прямых вызовов `navigator.vibrate(...)` вне этой функции — нет.
  - Возвращает `undefined`. Без побочных эффектов, кроме самого вызова `vibrate`.
  - На устройствах без `vibrate` (iOS Safari, десктоп) — graceful no-op: ничего не делает, ничего не пишет в консоль, не выбрасывает исключений (ФТ-6/КП-5).
  - При `matchMedia('(prefers-reduced-motion: reduce)').matches === true` — no-op (ОВ-4, ФТ-10/КП-8 для haptic).
  - `kind`: `'select'` → 10 мс, `'submit'` → 12 мс, `'fab'` → 12 мс, неизвестное значение → 10 мс (фолбэк через `'tap'`).
  - Доступна в `window.hapticTap` (для inline-`onclick` в `prototype.html`).
- **Критерии готовности:**
  - `grep -rn "navigator.vibrate" docs/` показывает совпадения **только** в `docs/modules/utils.js` (внутри `hapticTap`). (ФТ-5/КП-4)
  - На устройстве с поддержкой Vibration API (Android Chrome) при вызове `hapticTap('select')` срабатывает короткая вибрация ~10 мс. (ручная проверка)
  - В iOS Safari/десктопе — ноль ошибок в консоли при вызовах. (ФТ-6/КП-5)
- **Связь с ADR:** ADR-020, Q2.A.

### Задача 3: Pulse-анимация бейджа `inbox-badge`

- **Что:**
  1. В `docs/style.css` (внутри новой секции `/* ── PRESS FEEDBACK ── */` либо отдельной соседней секции `/* ── INBOX BADGE PULSE ── */` — на усмотрение разработчика, главное — рядом с press feedback и единым media-блоком `prefers-reduced-motion`) **добавить**:
     ```
     @keyframes inboxBadgePulse {
       0%, 100% { transform: scale(1); }
       50%      { transform: scale(1.10); }
     }
     .inbox-badge--pulse {
       animation: inboxBadgePulse 1.6s ease-in-out infinite;
       transform-origin: 50% 50%;
       will-change: transform;
     }
     ```
  2. В `docs/modules/inbox.js`, в функции `updateInboxBadge` (`inbox.js:12-26`):
     - В ветке `if (count > 0)` (строки 17-19) после `badge.style.display = 'flex';` добавить `badge.classList.add('inbox-badge--pulse');`.
     - В ветке `else` (строки 20-22) перед `badge.style.display = 'none';` добавить `badge.classList.remove('inbox-badge--pulse');`.
     - В ветке `catch` (строки 23-25) перед `badge.style.display = 'none';` добавить `badge.classList.remove('inbox-badge--pulse');`.
  3. Поведение `updateInboxBadge` в остальном — **без изменений**. Текст бейджа (`count > 9 ? '9+' : String(count)`), порог `count > 0`, `display:flex/none` — сохраняются (ФТ-11/КП-9).
- **Где:** `docs/style.css` (новая анимация и класс), `docs/modules/inbox.js` (две строки `classList.add` + две строки `classList.remove`).
- **Контракт:**
  - При `count > 0` бейдж имеет класс `inbox-badge--pulse` и проигрывает CSS-анимацию `inboxBadgePulse` (длительность 1.6s, бесконечно, scale 1 → 1.10 → 1, `ease-in-out`).
  - При `count === 0` (включая ветку `catch`) класс снят, анимация не идёт.
  - При `prefers-reduced-motion: reduce` (через media-блок в Задаче 5) анимация выключена — `animation: none`.
- **Критерии готовности:**
  - С `count > 0` бейдж мягко пульсирует (видно глазом); анимация не вызывает дёрганий. (BA-023 КП-6, ФТ-7/ФТ-9)
  - С `count === 0` бейдж скрыт; в DOM-инспекторе у `.inbox-badge` нет класса `inbox-badge--pulse`. (BA-023 КП-7, ФТ-8)
  - В DevTools → Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce` пульс **не идёт** (визуально бейдж статичен), DOM-класс при этом присутствует. (BA-023 КП-8, ФТ-10)
  - DevTools → Performance: при пульсе нет всплесков layout/paint — только composite (`transform`). (BA-023 ФТ-9/НФТ-2)
  - Логика и текст бейджа не изменились: `count = 0` → скрыт; `count = 5` → «5»; `count = 12` → «9+». (BA-023 КП-9, ФТ-11)
- **Связь с ADR:** ADR-020, Q3.A; Q4.A (media-блок — Задача 5).

### Задача 4: Точки вызова `hapticTap` в обработчиках ключевых действий

Во всех модулях ниже **импортируется** `hapticTap` из `./utils.js`. Если в файле уже есть строка `import { ... } from './utils.js';` — `hapticTap` добавляется в существующий импорт; иначе — добавляется новый импорт сверху, рядом с прочими.

- **Что:**
  - `docs/modules/services.js` — в `selectService(id)` (`:147`) первой строкой функции: `hapticTap('select');`.
  - `docs/modules/masters.js`:
    - В `tapMaster(id)` (`:251`) первой строкой функции: `hapticTap('select');`.
    - В `selectAnyMaster()` (`:246`) первой строкой функции: `hapticTap('select');`.
    - В `bookFromMaster(id)` (`:231`) первой строкой функции: `hapticTap('submit');`.
    - В `bookServiceFromMaster(masterId, serviceId)` (`:235`) первой строкой функции: `hapticTap('submit');`.
    - В `selectMaster(id)` (`:122`) — **не добавлять** (двойной haptic с `tapMaster`).
  - `docs/modules/slots.js` — в `selectSlot(el, time)` (`:211`) первой строкой функции: `hapticTap('select');`.
  - `docs/modules/booking.js` — в `startBooking()` (`:138`) первой строкой функции (до проверки сессии): `hapticTap('submit');`. Прочие функции (`rescheduleRecord`, `cancelRecord`, `confirmCancel`, `quickBook`, `rebook`, `bookWithMaster`, `_submitCrossSell`) — без haptic.
  - `docs/modules/review.js` — в `submitReview()` (`:105`) первой строкой функции: `hapticTap('submit');`.
  - `docs/modules/admin.js`:
    - В `publishPost(draft)` (`:103`) — после проверок-гвардов и **только при публикации** (`if (!draft) hapticTap('submit');`).
    - В `sendNewPush()` (`:480`) — `hapticTap('submit');` после проверок-гвардов, до сетевого вызова.
    - В `sendPush()` (`:513`) — `hapticTap('submit');` после проверок-гвардов, до сетевого вызова.
  - `docs/prototype.html` — строка `:95` (центральная FAB `<div class="tab tab-center" ...>`). Заменить `onclick="go('s-services','tab')"` на `onclick="hapticTap('fab');go('s-services','tab')"`. Прочие табы (`<div class="tab" onclick="go('s-...','tab')">` строки 93, 94, 96, 97) — **не трогать**.
- **Где:** перечислено по модулям выше.
- **Контракт:**
  - На каждом из перечисленных ключевых действий на устройстве с поддержкой Vibration API срабатывает короткая вибрация по `kind` (ФТ-4/КП-3).
  - На устройствах/браузерах без поддержки (iOS Safari, десктоп) — graceful no-op (ФТ-6/КП-5).
  - При `prefers-reduced-motion: reduce` — вибрация не срабатывает (ОВ-4, ФТ-10/КП-8).
  - Логика обработчиков, порядок выполнения, побочные эффекты — **без изменений** (haptic-вызов — effect-only, до основной логики).
- **Критерии готовности:**
  - На Android-устройстве с поддержкой `navigator.vibrate`: подтверждение записи, выбор слота, выбор мастера, выбор услуги, отправка отзыва, публикация поста, отправка push, тап по центральной FAB — каждое действие даёт короткую тактильную вибрацию. (BA-023 КП-3)
  - Прокрутка по `.feed-cat-chip`/`.seg-btn`/табам **не** вызывает вибрацию. (BA-023 §2/ФТ-4)
  - На iOS Safari/десктопе — ноль ошибок в консоли при тех же действиях. (BA-023 КП-5)
  - В DevTools → Rendering → Emulate `prefers-reduced-motion: reduce` — вибрация не происходит (визуально проверяется через консольный mock `navigator.vibrate = (...) => console.log('vibrate', ...)` — после эмуляции `reduce` в консоли пусто). (BA-023 КП-8)
- **Связь с ADR:** ADR-020, Q2.A («Точки вызова в коде»); Q4.A (haptic при `reduce`).

### Задача 5: Единый media-блок `prefers-reduced-motion`

- **Что:**
  - В `docs/style.css`, в конце новой секции `/* ── PRESS FEEDBACK ── */` (или в самостоятельной соседней секции `/* ── REDUCED MOTION ── */`) **добавить** media-блок:
    ```
    @media (prefers-reduced-motion: reduce) {
      .inbox-badge--pulse { animation: none; }
      /* Группа кнопок/действий: убираем переход opacity. */
      .btn-primary, .btn-secondary, .btn-danger, .btn-ghost, .btn-yandex,
      .feed-book, .tip-btn, .review-ext-btn, .review-ext-platform, .cs-add,
      .inbox-bell-btn, .inbox-clear-btn { transition: none; }
      .btn-primary:active, .btn-secondary:active, .btn-danger:active,
      .btn-ghost:active, .btn-yandex:active, .feed-book:active,
      .tip-btn:active, .review-ext-btn:active, .review-ext-platform:active,
      .cs-add:active, .inbox-bell-btn:active, .inbox-clear-btn:active { opacity: 1; }
      /* Группа карточек/чипов/клавиш/таба: убираем масштабирование. */
      .svc-catalog-card, .master-card, .hero-card, .feed-card,
      .audience-row, .push-template, .consent-item, .slot,
      .chip, .feed-cat-chip, .seg-btn, .consent-check,
      .tab:not(.tab-center), .pin-key { transition: none; }
      .svc-catalog-card:active, .master-card:active, .hero-card:active, .feed-card:active,
      .audience-row:active, .push-template:active, .consent-item:active, .slot:active,
      .chip:active, .feed-cat-chip:active, .seg-btn:active, .consent-check:active,
      .tab:not(.tab-center):active, .pin-key:active { transform: none; }
      .tab-center-btn:active .tab-fab { transform: none; }
    }
    ```
- **Где:** `docs/style.css`, конец секции press feedback (после Задачи 1 и Задачи 3, до `.install-banner`).
- **Контракт:** при активной системной настройке «уменьшать движение» все press-анимации (на масштабирование и opacity-переходы) и pulse бейджа сводятся к мгновенной смене состояния или полностью отключаются. Haptic при этом тоже не срабатывает (см. Задача 2: проверка `matchMedia` в `hapticTap`).
- **Критерии готовности:**
  - DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`: при тапах нет визуального масштабирования/изменения прозрачности; бейдж не пульсирует. (BA-023 КП-8, ФТ-10)
  - В обычном режиме (`prefers-reduced-motion: no-preference`) press feedback и pulse работают как в Задачах 1, 3. (BA-023 КП-1, КП-6)
- **Связь с ADR:** ADR-020, Q4.A.

### Задача 6: Поднятие `CACHE_VERSION`

- **Что:** в `docs/sw.js` строка 1 заменить `const CACHE_VERSION = 'v66';` на `const CACHE_VERSION = 'v67';`. Прочая логика `sw.js` (`APP_SHELL`-массив, `fetch`-стратегии, `NETWORK_ONLY_HOSTS`, runtime cache) — **без изменений**. Новых файлов в `APP_SHELL` не добавляется.
- **Где:** `docs/sw.js` (строка 1).
- **Контракт:** при следующем заходе клиента SW активирует новый кэш `studio-static-v67` / `studio-runtime-v67` и инвалидирует старые `studio-static-v66` / `studio-runtime-v66`. Пользователь получает обновлённые `style.css`, `utils.js`, `inbox.js`, `services.js`, `masters.js`, `slots.js`, `booking.js`, `review.js`, `admin.js`, `prototype.html`, `sw.js`.
- **Критерии готовности:**
  - `CACHE_VERSION` в `docs/sw.js` = `'v67'`. (BA-023 НФТ-6/КП-10)
  - DevTools → Application → Service Workers: после деплоя — статус activated, версия `v67`. (ручная проверка)
- **Связь с ADR:** ADR-020, Q5.A; правило проекта (CLAUDE.md, BA-023 НФТ-6).

## Изменения публичного контракта

- **JS-интерфейс модулей (`utils.js`):** добавляется новый экспорт `hapticTap(kind?: 'select' | 'submit' | 'fab' | 'tap')`. Обратная совместимость — сохраняется (новый экспорт, ничего не удаляется).
- **`window.hapticTap`:** новая глобальная функция (для inline-`onclick` в `prototype.html`). Обратная совместимость — сохраняется.
- **CSS-классы (`style.css`):** добавляется класс `.inbox-badge--pulse` и анимация `@keyframes inboxBadgePulse`. Существующие классы сохраняются (значения существующих `:active`-правил приводятся к CSS-токенам без визуального регресса либо оставляются как есть — см. Задача 1.3).
- **CSS-токены (`style.css :root`):** добавляются `--press-scale-card`, `--press-scale-button`, `--press-scale-chip`, `--press-scale-key`, `--press-opacity-button`, `--press-opacity-soft`, `--press-duration`. Существующие токены (`--bg`, `--accent`, …) — без изменений.
- **`navigator.vibrate`:** новые вызовы (через `hapticTap`). Без побочных эффектов на API/UI/данные. Соответствует ОВ-1/ОВ-5.
- **Миграция данных / схемы:** не требуется.

## Тесты

Автотестов в проекте нет; ниже — обязательный набор ручных проверок (для тестировщика):

### Press feedback (Задача 1)

- В DevTools → Toggle device toolbar → включить touch emulation.
- Пройти по экранам: главная (`s-home`), услуги (`s-services`), мастера (`s-masters`), слоты (`s-slots`), подтверждение (`s-confirm-pre`), лента (`s-feed`), пост (`s-post`), профиль (`s-profile`), отзыв (`s-review`), inbox (`s-inbox`), вход/PIN (`s-login`, `s-pin`), админка (`s-admin-*`).
- Для каждого нажатого интерактивного элемента — визуальный отклик при тапе (scale или opacity), возврат после отпускания без задержки.
- **Особо проверить:** `.feed-cat-chip`, `.seg-btn`, `.audience-row`, `.push-template`, `.consent-check`, `.cs-add`, кнопки `.btn-secondary`, `.btn-danger`, `.btn-ghost`, `.btn-yandex`, `.feed-book`, `.tip-btn`, `.review-ext-btn`, `.chip`, `.slot`, `.tab` (не центральная), `.hero-card`, `.feed-card`, `.consent-item` — у них раньше press feedback не было.
- Уже работающие `:active`-эффекты (`.tab-center-btn`, `.btn-primary`, `.svc-catalog-card`, `.master-card`, `.pin-key`, `.review-ext-platform`, `.inbox-bell-btn`, `.inbox-clear-btn`, `.inbox-dots`, `.inbox-menu button`) — без визуального регресса.

### Haptic (Задача 2, Задача 4)

- На Android-устройстве с поддержкой Vibration API (Chrome/Samsung Internet):
  - Тап по карточке услуги → выбор услуги → короткая вибрация.
  - Тап по карточке мастера → короткая вибрация.
  - Тап по слоту времени → короткая вибрация.
  - «Подтвердить запись» на финальном шаге → короткая вибрация.
  - Отправить отзыв (после выбора звёзд) → короткая вибрация.
  - В админке: опубликовать пост → короткая вибрация; сохранить черновик → **вибрации нет**.
  - В админке: «Отправить push» (новый и из истории) → короткая вибрация.
  - Тап по центральной FAB-кнопке в таб-баре → короткая вибрация.
- **Не вибрирует:** прокрутка `.feed-cat-chip`/`.seg-btn`, тап по табам (кроме центральной), тап по `.inbox-bell-btn`, тап по `.feed-book` в карточке ленты, отмена записи.
- На iOS Safari: те же действия — без ошибок в консоли, без визуальных индикаторов недоступности.
- На десктопе (Chrome/Firefox/Edge): то же — без ошибок.
- Проверка единственности обёртки: `grep -rn "navigator.vibrate" docs/` — совпадения **только** в `docs/modules/utils.js` (КП-4).

### Pulse бейджа (Задача 3)

- Сценарий: получить push-уведомление (либо вручную поднять `count` через `localStorage`/тест) → бейдж появляется и мягко пульсирует.
- Зайти в `s-inbox` (помечает всё прочитанным, `markAllRead`) → бейдж исчезает, в DOM `inboxBadge` без класса `inbox-badge--pulse`.
- DevTools → Performance → запись 5 сек при активном пульсе: layout/paint — отсутствуют (только composite).

### `prefers-reduced-motion` (Задача 5)

- DevTools → Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce`.
- Бейдж с `count > 0` — **не пульсирует** (визуально статичен; DOM-класс `inbox-badge--pulse` присутствует — это норма).
- Тап по карточкам/чипам/кнопкам — **без анимации** (мгновенная смена состояния либо ничего).
- На Android: тап по тем же ключевым точкам — **без вибрации** (можно проверить через консольный mock: `navigator.vibrate = (...args) => console.log('vibrate', args)`; после эмуляции `reduce` — консоль пуста при тапах).

### Логика inbox-бейджа не изменилась (Задача 3, ФТ-11/КП-9)

- При `count = 0` — бейдж скрыт (`display:none`).
- При `count = 5` — текст «5».
- При `count = 12` — текст «9+».
- При `PUSH_RECEIVED` (`inbox.js:106-115`) — `updateInboxBadge` пересчитывает корректно; класс `inbox-badge--pulse` ставится/снимается синхронно.

### PWA / общая регрессия (Задача 6, НФТ-6)

- DevTools → Application → Service Workers: статус active, версия `studio-static-v67`.
- DevTools → Application → Manifest: PWA installable.
- DevTools → Console: ноль ошибок при прохождении полного сценария (логин → услуга → мастер → слот → подтверждение → отзыв → inbox → админка).
- Lighthouse (PWA): нет регрессий по сравнению с v1.17.0.

## Риски и митигации

- **Риск:** визуальный регресс уже работающих `:active`-эффектов при консолидации под токены. → **Митигация:** в Задаче 1.3 явно указано, какие правила трогать (минимально), какие оставить как есть; значения токенов выбраны в пределах текущих значений. Тестировщик сверяет «до/после» на уже работающих элементах.
- **Риск:** двойной haptic при тапе по карточке мастера (если бы `hapticTap` добавили и в `tapMaster`, и в `selectMaster`). → **Митигация:** только `tapMaster` (Задача 4). `selectMaster` остаётся без haptic.
- **Риск:** `navigator.vibrate` выбрасывает исключение на iOS-устройствах где функция существует, но игнорируется. → **Митигация:** `try/catch` внутри `hapticTap` (Задача 2).
- **Риск:** при `count === 0` класс `inbox-badge--pulse` не снимается в ветке `catch` `updateInboxBadge`. → **Митигация:** Задача 3 явно требует снятие класса в обеих ветках (`else` и `catch`).
- **Риск:** `prefers-reduced-motion` пользователь включает во время сессии — наш кэшированный `_reducedMotionMql` отдаёт устаревшее значение. → **Принято:** `matchMedia` возвращает live-объект, `.matches` всегда актуальное; кэширование самого MQL-объекта корректно. Без рисков.
- **Риск:** старый кэш SW отдаёт прежние файлы → пользователи не получают правок. → **Митигация:** поднятие `CACHE_VERSION` `v66 → v67` (Задача 6).
- **Риск:** `hapticTap` ещё не загружен в момент первого тапа по FAB (inline `onclick` в `prototype.html`). → **Митигация:** `utils.js` импортируется в `app.js`/модулях очень рано; до первого пользовательского клика по FAB `window.hapticTap` гарантированно определена. Если же по какой-то причине не определена — `go(...)` отработает (он тоже в `window`).
- **Риск:** scale 1.10 бейджа выходит за границы кнопки-колокольчика. → **Митигация:** бейдж 18×18 в углу bell-btn 44×44 → 19.8×19.8 при scale 1.10 → визуально в углу. Ручная проверка.

## Чек-лист готовности к релизу

- [ ] Все задачи (1–6) реализованы
- [ ] Соответствие ADR-020 проверено (architect)
- [ ] Code review пройден
- [ ] Ручные проверки из раздела «Тесты» выполнены (press feedback, haptic, pulse, `prefers-reduced-motion`, регрессия логики бейджа, PWA)
- [ ] `CACHE_VERSION` поднята (`v66` → `v67`)
- [ ] `docs/version.json` обновлён (`build` 34, `v1.18.0`)
- [ ] В консоли — ноль ошибок; PWA installable (Lighthouse)
- [ ] Релиз оформлен отдельным коммитом
