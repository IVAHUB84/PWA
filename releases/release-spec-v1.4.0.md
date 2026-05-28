# Спецификация релиза v1.4.0

- **Дата планирования:** 2026-05-28
- **Тип релиза:** minor (добавление функциональности: серверный endpoint `/review`; обратимо-совместимо — контракт `postComment` для PWA сохраняется)
- **Цели:** Отзыв клиента реально попадает в YCLIENTS (устранение 401) за счёт переноса `POST /comments` с браузера на серверный прокси Cloudflare Worker; YCLIENTS-токены для записи отзыва уходят из браузера в Cloudflare Secrets.

## Источники

- BA-требования: `ba-req/ba-requirements-004.md`
- ADR: `adrs/adr-004.md` (дополняет `adrs/adr-003.md` — меняется только транспорт `POST /comments`)
- Исходное требование: `requirements/req-client-auth-token-004.md`

## Объём релиза

### Задача 1: Добавить endpoint `POST /review` в Cloudflare Worker

- **Что:** новый маршрут Worker принимает данные отзыва от PWA и проксирует их в YCLIENTS `POST /comments/{YC_COMPANY}` с серверными токенами из Secrets. Worker — только прокси, без хранилища.
- **Где (файлы/модули):** `cf-worker/src/index.js`.
- **Контракт:**
  - **Запрос:** `POST /review`, заголовок `Content-Type: application/json`, тело JSON:
    ```json
    { "rating": 5, "text": "строка (опционально)", "staff_id": 123, "record_id": 456 }
    ```
  - **Валидация:** `rating` обязателен (целое 1–5). При отсутствии тела/обязательных полей — `json({ error: 'missing_fields' }, 400)` (как в существующих handler-ах). Невалидный JSON — `json({ error: 'bad_json' }, 400)`.
  - **Запрос к YCLIENTS:** `POST https://api.yclients.com/api/v1/comments/${env.YC_COMPANY}`, заголовки как в `handleCron`:
    `Authorization: Bearer ${env.YC_TOKEN}, User ${env.YC_USER_TOKEN}`, `Accept: application/vnd.yclients.v2+json`, `Content-Type: application/json`. Тело: `{ rating, text, staff_id, record_id }`.
  - **Ответ Worker:** при ответе YCLIENTS 2xx (или `success:true`) — `json({ ok: true })`; иначе — `json({ ok: false, status: <yc_status> }, 502)` либо иной не-2xx. Главное: исход 2xx vs не-2xx **различим** для PWA.
  - Использовать существующие хелперы `CORS`/`json`. Регистрация в `fetch`: `if (req.method === 'POST' && url.pathname === '/review') return handleReview(req, env);`. OPTIONS уже обрабатывается общим кодом.
- **Критерии готовности:**
  - Маршрут `POST /review` зарегистрирован и вызывает отдельный handler.
  - Handler читает тело, валидирует `rating`, ходит в YCLIENTS `POST /comments/${env.YC_COMPANY}` с серверными токенами.
  - Возврат различает успех (2xx) и ошибку.
  - Новых Secrets и новых KV binding не добавлено (переиспользуются `YC_TOKEN`/`YC_USER_TOKEN`/`YC_COMPANY`).
- **Связь с ADR:** ADR-004, Вопрос 1 (Вариант 1A), Вопрос 3 (Вариант 3A).

### Задача 2: Перенаправить `postComment` в PWA на Worker

- **Что:** `postComment` перестаёт бить напрямую в YCLIENTS (`YC.post('/comments/...')`) и отправляет данные отзыва на Worker URL. Контракт возврата (`{ok:true}`/`{ok:false}`) **сохраняется** — UI `submitReview` не меняется.
- **Где (файлы/модули):** `docs/modules/api.js`. Константа Worker URL — в `docs/modules/constants.js` (или рядом с `postComment`).
- **Контракт:**
  - Базовый URL Worker — публичная **константа** (например `WORKER_URL = 'https://studio-push.ivahub84.workers.dev'`). **Не** из `localStorage`.
  - `postComment({ rating, text, staffId, recordId })`:
    - `fetch(\`${WORKER_URL}/review\`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ rating, text, staff_id: staffId, record_id: recordId }) })`.
    - Таймаут через `AbortController` (~15 с, как в `YC.post`).
    - Возврат: `{ ok: true }` если ответ ok и `{ok:true}`/`success:true`; иначе `{ ok: false }`. При сетевой ошибке/таймауте — `{ ok: false }`.
  - Для тестируемости — инъекция fetch-зависимости (например параметр `_fetch = fetch`), аналогично прежнему `_ycPost`.
  - YCLIENTS-токены (`YC.token`, `YC.userToken`) в этом пути **не используются** и в запрос на Worker не передаются.
- **Критерии готовности:**
  - `postComment` шлёт на `<WORKER_URL>/review`, не на `api.yclients.com/comments`.
  - Контракт возврата неизменен (`review.js` править не нужно).
  - Worker URL — захардкоженная константа, не из `localStorage`.
- **Связь с ADR:** ADR-004, Вопрос 1 (1A), Вопрос 2 (2A).

### Задача 3: Поднять CACHE_VERSION и версию сборки

- **Что:** изменён `api.js` (и `constants.js`, если константа там) в `APP_SHELL` → клиенты должны получить новый код. Обновить версию проекта.
- **Где (файлы/модули):** `docs/sw.js` (`CACHE_VERSION`), `docs/version.json`.
- **Контракт:**
  - `CACHE_VERSION` поднять на одну ступень: `v36` → `v37`.
  - `version.json`: `build` 4 → 5, `version` → `v1.4.0`, `date`/`time`/`sha` обновляются при релизе мейнтейнером.
- **Критерии готовности:** `CACHE_VERSION === 'v37'`; `version.json.version === 'v1.4.0'`.
- **Связь с ADR:** ADR-004, «Влияние на код» (`docs/sw.js`).

## Изменения публичного контракта

- **Cloudflare Worker:** добавлен новый публичный маршрут `POST /review` (аддитивно; существующие `/subscribe`, `/unsubscribe`, `/send`, `/vapid-public-key`, cron — без изменений). Миграции не требуется.
- **PWA:** внутренний контракт `postComment` (`{ok:true}`/`{ok:false}`) — без изменений. Внешний вид `s-review` — без изменений.
- **Secrets:** новых Secrets не вводится. Если у текущего `YC_USER_TOKEN` нет права записи комментариев — значение перевыпускается через `wrangler secret put YC_USER_TOKEN` без изменения кода (см. «Риски»).

## Тесты

Минимальный набор тестов, обязательный в этом релизе (стиль — как `review-post.test.js` из v1.3.0):

- **Тест `postComment` → Worker (PWA):**
  - При HTTP-успехе Worker (`{ok:true}`) → `postComment` возвращает `{ ok: true }`.
  - При не-2xx ответе Worker → `{ ok: false }`.
  - При брошенном fetch (сеть/таймаут) → `{ ok: false }`.
  - Запрос уходит на URL вида `.../review` (а не на `api.yclients.com/comments`); тело содержит `staff_id`/`record_id` (snake_case).
- Тесты используют инъекцию fetch (мок), не делают реальных сетевых вызовов.

(Запуск тестов — зона тестировщика на этапе `/release`; здесь требуется лишь физическое наличие тестов.)

## Риски и митигации

- **Риск:** у текущего `YC_USER_TOKEN` в Secrets нет права `client_comments_add_access` → YCLIENTS вернёт 401/403 даже с серверной стороны. → **Митигация:** перевыпустить user-токен с нужными правами и обновить Secret (`wrangler secret put YC_USER_TOKEN`); код менять не нужно. Fail-safe в PWA уведомляет клиента, отзыв не теряется.
- **Риск:** контракт `POST /comments` YCLIENTS публично не подтверждён (наследие ADR-003) — иное имя/набор обязательных полей. → **Митигация:** проверить тело против реального ответа `GET /comments` на этапе реализации; итеративная подстройка тела в Worker; fail-safe сохранён.
- **Риск:** недоступность Worker → отзыв не уходит. → **Митигация:** fail-safe в `review.js` (наследие ADR-003) — сообщение клиенту, поля не очищаются, повтор.
- **Риск:** смена домена Worker сломает захардкоженный URL. → **Митигация:** URL в одной константе; смена домена → правка константы + релиз PWA. Событие редкое.

## Порядок деплоя

Строго в этом порядке (сначала серверная часть, чтобы endpoint существовал к моменту выхода нового кода PWA):

1. **Worker:** `cd cf-worker && npx wrangler deploy` (требует `CLOUDFLARE_API_TOKEN`). Убедиться, что Secrets `YC_TOKEN`/`YC_USER_TOKEN`/`YC_COMPANY` заданы (`wrangler secret list`); при необходимости перевыпустить `YC_USER_TOKEN` (`wrangler secret put YC_USER_TOKEN`).
2. **Проверка Worker:** `POST https://studio-push.ivahub84.workers.dev/review` с тестовым телом возвращает различимый исход (вручную / curl).
3. **PWA:** `git push origin main` → GitHub Pages CD публикует `docs/` (~1 мин). Проверить: https://ivahub84.github.io/PWA/prototype.html

## Примечания по безопасности

- YCLIENTS-токены (partner + user) хранятся **только** в Cloudflare Secrets (`YC_TOKEN`, `YC_USER_TOKEN`). В код PWA (`docs/`) для пути отправки отзыва они **не добавляются** и в браузер **не передаются** (НФТ-1, КП-3).
- Worker URL — публичный адрес, **не секрет**; захардкодить как константу допустимо.
- Захардкоженный `YC.userToken` в `api.js` для прочих запросов — известная проблема (CLAUDE.md), в этом релизе не трогается и не усугубляется.
- Не коммитить значения токенов; задавать только через `wrangler secret put` или Cloudflare Dashboard.

## Чек-лист готовности к релизу

- [x] Задача 1: endpoint `POST /review` в Worker реализован
- [x] Задача 2: `postComment` шлёт на Worker, контракт возврата сохранён
- [x] Задача 3: `CACHE_VERSION` v36 → v37, `version.json` → v1.4.0
- [x] Соответствие ADR-004 проверено (architect)
- [x] Тесты `postComment` → Worker добавлены и проходят
- [x] КП-1: в DevTools → Network виден запрос на Worker URL, не на `api.yclients.com/comments`
- [ ] КП-2: отзыв появляется на карточке мастера (`s-master`, `GET /comments`) — проверяется при деплое
- [x] КП-3: YCLIENTS-токены отсутствуют в коде PWA — они в Cloudflare Secrets
- [x] КП-4: при ошибке Worker fail-safe в `review.js` работает (сообщение, поля не очищаются)
- [x] КП-5: Worker деплоится командой `cd cf-worker && npx wrangler deploy`
- [x] Code review пройден
- [ ] Деплой по порядку: сначала Worker, потом PWA — выполняется при деплое
