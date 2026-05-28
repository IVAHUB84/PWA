# Release Notes v1.4.0

- **Дата:** 2026-05-28
- **Тип релиза:** minor

## Кратко

Отзыв клиента теперь реально попадает в YCLIENTS: `POST /comments` перенесён с браузера на серверный прокси Cloudflare Worker, который использует токены из Cloudflare Secrets. Устранена архитектурная причина 401 Unauthorized, существовавшей с v1.3.0.

## Что нового

### Возможности
- Новый endpoint `POST /review` в Cloudflare Worker — принимает данные отзыва (`rating`, `text`, `staff_id`, `record_id`) и проксирует `POST /comments/{YC_COMPANY}` в YCLIENTS с серверными токенами.

### Улучшения
- `postComment` в `docs/modules/api.js` переведена на Worker URL вместо прямого вызова `api.yclients.com/comments` из браузера. YCLIENTS-токены для записи отзыва больше не передаются в браузер.
- `WORKER_URL` вынесена в `docs/modules/constants.js` как именованная публичная константа.
- `CACHE_VERSION` поднята с `v36` до `v37` — клиенты получат обновлённый `api.js`.

### Исправления
- Устранена причина 401 при отправке отзыва (статический admin `userToken` из браузера не имел права `client_comments_add_access`).

## Изменения публичного контракта

**Cloudflare Worker** — добавлен новый маршрут `POST /review` (аддитивно; `/subscribe`, `/unsubscribe`, `/send`, `/vapid-public-key`, cron — без изменений).

**PWA** — внутренний контракт `postComment` (`{ok:true}`/`{ok:false}`) не изменился; `review.js` и UI `s-review` не затронуты. Миграция не требуется.

**Secrets** — новых Secrets не вводится. При необходимости перевыпустить `YC_USER_TOKEN` с правом `client_comments_add_access` через `wrangler secret put YC_USER_TOKEN` (без изменения кода).

## Известные ограничения

- Контракт `POST /comments` YCLIENTS публично не подтверждён (наследие ADR-003); если YCLIENTS изменит форму тела — потребуется итерация в Worker. Закрыто fail-safe: при ошибке клиент уведомлён, поля не очищаются.
- Если `YC_USER_TOKEN` в Secrets не имеет права записи комментариев — YCLIENTS вернёт 401/403 со стороны Worker. Решение: перевыпустить токен через `wrangler secret put`.
- Захардкоженный admin `YC.userToken` в `api.js` для прочих запросов — известная проблема, в этом релизе не затрагивается.

## Порядок деплоя

Строго в таком порядке (сначала серверная часть):

1. **Worker:** `cd cf-worker && npx wrangler deploy` (требует `CLOUDFLARE_API_TOKEN`). Убедиться, что Secrets `YC_TOKEN`/`YC_USER_TOKEN`/`YC_COMPANY` заданы (`wrangler secret list`); при необходимости перевыпустить `YC_USER_TOKEN`.
2. **Проверка Worker:** `POST https://studio-push.ivahub84.workers.dev/review` с тестовым телом возвращает различимый исход.
3. **PWA:** `git push origin main` → GitHub Pages CD публикует `docs/` (~1 мин). Проверить: https://ivahub84.github.io/PWA/prototype.html

## Связанные документы

- BA-требования: `ba-req/ba-requirements-004.md`
- ADR: `adrs/adr-004.md`
- Спецификация: `releases/release-spec-v1.4.0.md`
- Исходное требование: `requirements/req-client-auth-token-004.md`

## Проверка

**Автотесты:**
- `post-comment-worker.test.js` — 17 тестов, 0 упало. Проверяет: HTTP 200+ok:true → `{ok:true}`, HTTP 502/400 → `{ok:false}`, исключение/AbortError → `{ok:false}`, URL оканчивается на `/review` и начинается с `WORKER_URL`, отсутствие `api.yclients.com` в URL, snake_case поля в теле (`staff_id`, `record_id`), HTTP 200 с `ok:false` в теле → `{ok:false}`.
- `review-post.test.js` — 28 тестов, 0 упало. Проверяет контракт `postComment`, корректность тела, признак `yc_reviewed_ids`.
- `npm run lint` — без ошибок.

**Критерии приёмки:**
- КП-1 (Network → Worker URL): подтверждён — `postComment` шлёт на `${WORKER_URL}/review`, а не на `api.yclients.com/comments`.
- КП-2 (отзыв на карточке мастера): проверяется при деплое.
- КП-3 (токены не в docs/): подтверждён — в пути `postComment` YCLIENTS-токены не используются; `YC.userToken`/`YC.token` присутствуют в `api.js` только для прочих запросов (известная проблема, вне рамок релиза).
- КП-4 (fail-safe): подтверждён — контракт `postComment` (`{ok:true}`/`{ok:false}`) сохранён; `review.js` не изменён, fail-safe работает как прежде.
- КП-5 (Worker деплоится): подтверждён — `cf-worker/wrangler.toml` и `cf-worker/src/index.js` присутствуют.
