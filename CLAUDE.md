# Project: Studio PWA

PWA для клиентов студии красоты — онлайн-запись поверх YCLIENTS API. Vanilla HTML/CSS/JS, деплой на GitHub Pages из папки `docs/`.

## Stack
- Vanilla JS + HTML5 + CSS (без фреймворков)
- PWA: Web App Manifest + Service Worker (`docs/sw.js`)
- GitHub Pages (статический хостинг из `docs/`)
- YCLIENTS API (внешний бэкенд)

## Commands
- Открыть локально: `npx serve docs` или открыть `docs/prototype.html` напрямую
- Деплой: `git push origin main` → GitHub Pages CD
- Иконки: `npm run icons` (sharp, `package.json` в корне)
- Линтер: `npm run lint`
- Форматирование: `npm run fmt`

## Code Standards
1. Код в `docs/prototype.html` + `docs/sw.js` + `docs/modules/*.js`
2. Никаких npm-зависимостей в рантайме — только devDependencies
3. Тесты перед каждым мержем
4. Каждый релиз = отдельный коммит, откат через `git revert`

## Verification
- Всегда: ручная проверка в браузере + DevTools → Application → Service Workers
- Перед мержем: /review + убедиться что PWA installable (Lighthouse)
- После изменений APP_SHELL: поднять CACHE_VERSION в `sw.js`

## Boundaries
✓ Always: env vars для секретов, тесты перед финишем
⚠ Ask first: новая зависимость, схема API, push в remote
✗ Never: коммитить API ключи, --force в main, rm -rf без подтверждения
✗ Never: любые операции с веткой `backup` — она только для чтения, никогда не пушить туда, не мержить, не изменять

## Gotchas
- Приложение живёт в `docs/` — GitHub Pages обслуживает эту папку
- Service Worker кэшируется агрессивно: при изменениях поднимать CACHE_VERSION в `sw.js`
- YCLIENTS API токен захардкожен в prototype.html — известная проблема, не усугублять
- PWA работает только по HTTPS (GitHub Pages) или localhost
- `node_modules/` в корне, не в `docs/`

---

## Workflow разработки (AMS)

Разработка построена вокруг **последовательной передачи артефактов** между специализированными агентами.

```
requirements/req-*.md   ── /ba ──►   ba-req/ba-requirements-*.md
                                       │
                                       ▼
                             /adr ──►  adrs/adr-*.md
                                       releases/release-spec-vX.Y.Z.md
                                       │
                                       ▼
                      /implement ──►  изменения кода + тесты
                                       ↑ (повторно при отклонениях)
                                       ▼
                             architect (контроль соответствия ADR)
                                       │
                                       ▼
                         /review ──►  отчёт ревьюера + исправления
                                       │
                                       ▼
                         /release ──► tests + commits + tag + release-notes/
                                       │
                                       ▼
                         /deploy  ──► чек-лист + git push (после подтверждения)
```

Ускоренный режим (когда BA + ADR уже готовы): **`/lead vX.Y.Z`**

### Агенты

| Команда | Агент | Модель | Артефакт |
|---|---|---|---|
| `/ba` | business-analyst | opus | `ba-req/ba-requirements-NNN.md` |
| `/adr` | architect | opus | `adrs/adr-NNN.md`, `releases/release-spec-vX.Y.Z.md` |
| `/implement` | developer → architect | sonnet → opus | код + тесты + отчёт соответствия |
| `/review` | code-reviewer → developer | opus → sonnet | отчёт + исправления |
| `/release` | tester | sonnet | коммиты, тег, `release-notes/notes-vX.Y.Z.md` |
| `/deploy` | maintainer | sonnet | чек-лист + `git push` |
| `/lead vX.Y.Z` | lead (оркестратор) | opus | весь цикл implement → deploy |

### Структура артефактов
- `requirements/` — сырые требования (`req-<name>-NNN.md`)
- `ba-req/` — оформленные бизнес-требования
- `adrs/` — Architecture Decision Records
- `releases/` — спецификации релизов
- `release-notes/` — release notes

### Принципы
1. **Артефакты — источник истины.** Проверяй файл, не устный отчёт агента.
2. **Открытые вопросы блокируют переход.** Нерешённые вопросы BA → не запускать `/adr`.
3. **Лимит итераций.** Не более 3 циклов исправлений на этапе, затем эскалация пользователю.
4. **Push — только после подтверждения пользователя.**
5. **Минимальные изменения.** Только то, что описано в спецификации.
