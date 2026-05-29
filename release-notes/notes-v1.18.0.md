# Release Notes v1.18.0

- **Дата:** 2026-05-29
- **Тип релиза:** minor

## Кратко

Интерфейс Studio PWA получил единый тактильный отклик: все интерактивные элементы реагируют на нажатие анимацией, ключевые действия (запись, выбор слота/мастера/услуги, отправка форм) сопровождаются короткой вибрацией на Android, а бейдж непрочитанных уведомлений мягко пульсирует, пока есть непрочитанное. Все эффекты уважают системный `prefers-reduced-motion`.

## Что нового

### Возможности
- **Единый CSS press feedback** — все интерактивные элементы (кнопки, карточки, чипы, слоты, переключатели, табы) теперь реагируют на нажатие: лёгкое уменьшение масштаба или снижение прозрачности в пределах 120 мс.
- **Haptic-вибрация** (`navigator.vibrate`) через утилиту `hapticTap(kind)` на ключевых действиях: выбор услуги/мастера/слота (10 мс), подтверждение записи/отправка формы (12 мс), тап по центральной FAB (12 мс). Graceful no-op на iOS Safari и десктопе.
- **Pulse-анимация бейджа уведомлений** — при `count > 0` бейдж колокольчика плавно пульсирует (`scale 1.0 → 1.10 → 1.0`, 1.6 с, бесконечно). При `count === 0` анимация останавливается.

### Улучшения
- CSS-токены press feedback в `:root`: `--press-scale-card`, `--press-scale-chip`, `--press-scale-key`, `--press-opacity-button`, `--press-opacity-soft`, `--press-duration` — единая точка подкрутки «жёсткости» отклика.
- Существующие `:active`-правила (`.btn-primary`, `.svc-catalog-card`, `.review-ext-platform`, `.inbox-bell-btn`) приведены к CSS-токенам без визуального регресса.
- Единый `@media (prefers-reduced-motion: reduce)` — отключает pulse и все press-переходы; `hapticTap` также не срабатывает при `reduce`.

### Исправления
- Нет.

## Изменения публичного контракта

- **`utils.js`:** новый экспорт `hapticTap(kind?: 'select' | 'submit' | 'fab' | 'tap')`. Обратная совместимость сохраняется.
- **`window.hapticTap`:** новая глобальная функция для inline-`onclick` в `prototype.html`. Обратная совместимость сохраняется.
- **CSS-класс `.inbox-badge--pulse`** и `@keyframes inboxBadgePulse` — добавлены; существующие классы и стили без изменений.
- **CSS-токены** `--press-scale-*`, `--press-opacity-*`, `--press-duration` — добавлены в `:root`; существующие токены без изменений.
- Миграции данных и схемы не требуется.

## Известные ограничения
- Токен `--press-scale-button: 0.98` объявлен в спецификации, но не добавлен в `:root` — группа «кнопки/действия» использует `opacity`, а не `scale`, поэтому токен не применялся бы; функциональных и визуальных расхождений нет.
- Haptic на устройствах с Android проверяется только в браузере; автотестов на вибрацию нет — требуется ручная проверка.
- Pulse-эффект бейджа (визуал), press feedback на элементах, поведение `prefers-reduced-motion` — проверены анализом кода; финальное визуальное подтверждение — в браузере.

## Связанные документы
- BA-требования: `ba-req/ba-requirements-023.md`
- ADR: `adrs/adr-020.md`
- Спецификация: `releases/release-spec-v1.18.0.md`

## Проверка

**Линтер:** `npm run lint` — пройден без ошибок (ESLint, `docs/modules/` + `docs/app.js`).

**Критерии приёмки (проверено анализом кода):**

- КП-1 ✅ — в `style.css` секция `/* ── PRESS FEEDBACK ── */` содержит `:active`-правила для всех групп элементов (кнопки/действия, карточки/строки, чипы/переключатели, табы) с `transition: ... 120ms` и значениями из токенов.
- КП-2 ✅ — существующие `:active`-правила (`.btn-primary`, `.svc-catalog-card`, `.master-card`, `.pin-key`, `.tab-center-btn .tab-fab`, `.review-ext-platform`, `.inbox-bell-btn`, `.inbox-clear-btn`, `.inbox-dots`, `.inbox-menu button`) сохранены; значения `.btn-primary`/`.review-ext-platform`/`.inbox-bell-btn` приведены к токенам с теми же числовыми значениями; `.master-card:active { transform: scale(0.99) }`, `.inbox-clear-btn:active { opacity: 0.6 }`, `.tab-center-btn:active .tab-fab` — оставлены без изменений согласно спецификации.
- КП-3 ✅ — `hapticTap('select')` добавлен в `selectService`, `tapMaster`, `selectAnyMaster`, `selectSlot`; `hapticTap('submit')` — в `startBooking`, `submitReview`, `publishPost(!draft)`, `sendNewPush` (после гварда), `sendPush`; `hapticTap('fab')` — в `onclick` FAB-кнопки. Ручная проверка на Android-устройстве — **не проверено в этой среде**.
- КП-4 ✅ — `grep -rn "navigator.vibrate" docs/` возвращает ровно одно совпадение: `docs/modules/utils.js:114` (внутри `hapticTap`). Прямых вызовов вне обёртки нет.
- КП-5 ✅ — `hapticTap` содержит `if (!('vibrate' in navigator)) return;` и `try { ... } catch {}` — graceful no-op без записи в консоль. Ручная проверка на iOS Safari — **не проверено в этой среде**.
- КП-6 ✅ — `@keyframes inboxBadgePulse { 0%,100% { scale(1) } 50% { scale(1.10) } }`, анимация `1.6s ease-in-out infinite` на классе `.inbox-badge--pulse`; `will-change: transform` без layout-thrash. Ручная визуальная проверка — **не проверено в этой среде**.
- КП-7 ✅ — в `updateInboxBadge`: ветка `else` и ветка `catch` оба вызывают `badge.classList.remove('inbox-badge--pulse')` перед скрытием бейджа.
- КП-8 ✅ — единый `@media (prefers-reduced-motion: reduce)` в конце секции press feedback: `.inbox-badge--pulse { animation: none }`, `transition: none` и `opacity: 1` / `transform: none` для всех элементов. `hapticTap` проверяет `matchMedia('(prefers-reduced-motion: reduce)').matches` перед вызовом `vibrate`.
- КП-9 ✅ — логика `updateInboxBadge` не изменена: `count > 0` → `display:flex` + текст `count > 9 ? '9+' : String(count)`; `else`/`catch` → `display:none`; `classList.add/remove` добавлены без изменения остальной логики.
- КП-10 ✅ — `CACHE_VERSION = 'v67'` в `docs/sw.js:1`; `docs/version.json` обновлён (`build: 34`, `version: v1.18.0`, `date: 2026-05-29`); рантайм-зависимостей не добавлено. Проверка DevTools (installable, active SW) — **не проверено в этой среде**.
