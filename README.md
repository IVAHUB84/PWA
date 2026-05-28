# Project Template

Шаблон проекта для разработки через многоагентный workflow в Claude Code. Каждый новый проект начинается с копирования этого шаблона.

## Что внутри

- **7 subagents** в `.claude/agents/` — бизнес-аналитик, архитектор, разработчик, ревьюер, тестировщик, мейнтейнер, lead-оркестратор.
- **7 slash-команд** в `.claude/commands/` — `/ba`, `/adr`, `/implement`, `/review`, `/release`, `/deploy`, `/lead`.
- **Каталоги артефактов** — `requirements/`, `ba-req/`, `adrs/`, `releases/`, `release-notes/`.
- **CLAUDE.md** — описание workflow, соглашений, моделей агентов и команд.

## Как использовать как шаблон

1. **Создать новый проект из шаблона:**
   ```powershell
   # Windows / PowerShell
   Copy-Item -Recurse G:\ams-projects\template G:\ams-projects\my-new-project
   cd G:\ams-projects\my-new-project
   git init
   ```

   ```bash
   # POSIX
   cp -r ./template ./my-new-project
   cd ./my-new-project
   git init
   ```

2. **Адаптировать под проект:**
   - Удалить пример-плейсхолдер `requirements/req-example-001.md` (или превратить его в первое реальное требование).
   - Дописать в `CLAUDE.md` секцию про стек технологий, команды сборки и тестов конкретного проекта (агенты `developer`, `tester`, `maintainer` опираются на эти команды).
   - При необходимости — создать `roadmap.md`.
   - Настроить `git remote` (`git remote add origin ...`).

3. **Запустить первый цикл:**
   - Создать `requirements/req-<name>-001.md` с описанием задачи.
   - `/ba 001` → оформить BA-требование.
   - `/adr 001 v0.1.0` → спроектировать ADR и спецификацию релиза.
   - `/implement v0.1.0` → реализовать.
   - `/review v0.1.0` → код-ревью.
   - `/release v0.1.0` → тесты, коммиты, тег, release notes.
   - `/deploy v0.1.0` → пуш (после подтверждения).

   Или, если BA + ADR уже готовы: `/lead v0.1.0`.

## Подробности workflow

См. [`CLAUDE.md`](./CLAUDE.md).

## Модели агентов

| Агент | Модель | Почему |
|---|---|---|
| business-analyst | opus | Нужно глубокое понимание задачи, открытые вопросы |
| architect | opus | Архитектурные решения требуют рассуждения |
| developer | sonnet | Рутинная реализация по чёткой спецификации |
| code-reviewer | opus | Поиск нетривиальных багов и проблем |
| tester | sonnet | Прогон тестов, оформление коммитов — рутина |
| maintainer | sonnet | Чек-лист, пуш — рутина |
| lead | opus | Оркестрация, принятие решений между шагами |
