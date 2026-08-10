# teachers_platforma

Кабинет репетитора: ученики, группы, расписание, оплаты и отчёты. Данные хранятся локально (`localStorage`) и синхронизируются с облаком (Supabase) для входа с других устройств.

## Запуск приложения

Это статический сайт — сборка не нужна. Открыть `index.html` локально или через любой static-сервер; в проде хостится на GitHub Pages.

Основной browser entry после архитектурного Pass 2:

```text
index.html
  -> assets/auth.js
  -> src/app/bootstrap.js
```

`bootstrap.js` является composition/application glue, а не владельцем feature-логики.

## Архитектура

Текущий подход — **Lean Domain Modules**:

```text
View
  ↓
Service
  ↓
Domain / selectors
  ↓
Global Store
  ↓
Persistence
  ↓
Cloud CAS
```

Persisted state имеет один runtime source of truth — глобальный store. View не мутирует persisted state напрямую; бизнес-команды принадлежат services.

Основные feature-модули:

```text
src/modules/students/
src/modules/schedule/
src/modules/payments/
src/modules/reports/
src/modules/settings/
src/modules/dashboard/
```

Общие UI primitives находятся в `src/shared/`, state/persistence — в `src/state/`, cloud/auth — в `src/cloud/` и `src/auth/`.

## Разработка (тесты и линт)

Требуется Node.js 20+. Зависимости — только dev-инструменты, само приложение их не использует.

```bash
npm install
npm test
npm run test:watch
npm run lint
npm run format
npm run format:check
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) прогоняет `lint` и `test` на каждый push и PR.

## Тесты и baseline

- Чистые domain-модули и compatibility re-export могут находиться в [`src/domain/`](src/domain/); feature-domain логика постепенно принадлежит соответствующим `src/modules/*/`.
- Эталонный fixture — [`tests/fixtures/baseline.json`](tests/fixtures/baseline.json), ожидаемые числа — [`docs/baseline-manifest.md`](docs/baseline-manifest.md).
- Ручной smoke — [`docs/smoke-checklist.md`](docs/smoke-checklist.md).
- Отдельный Pass 3 посвящён cleanup тестов, критическим Playwright E2E flows, architecture guards и CI finalization.

## Данные и резервные копии

- Локальный ключ: `tutorCabinet_v1`; owner marker: `tutorCabinet_owner_user_id`.
- Backup export создаёт JSON, который импортируется в режимах replace и merge. Старые копии должны продолжать импортироваться — это инвариант рефакторинга.
- CAS/optimistic concurrency для Supabase уже внедрён и миграция уже применена. Не применять CAS-миграцию повторно без отдельной причины.

## Документация

- Текущий handoff рефакторинга: [`REFACTOR_FLOW.md`](REFACTOR_FLOW.md).
- Утверждённая Lean-спецификация: [`docs/REFACTORING_SPEC_V5_LEAN.md`](docs/REFACTORING_SPEC_V5_LEAN.md).
- Исторический план: [`docs/REFACTORING_SPEC.md`](docs/REFACTORING_SPEC.md).
- Архитектурные решения: [`docs/adr/`](docs/adr/README.md).
- RLS-аудит: [`docs/SUPABASE_RLS_AUDIT.md`](docs/SUPABASE_RLS_AUDIT.md).
- Cloud sync: [`docs/CLOUD_SYNC_SETUP.md`](docs/CLOUD_SYNC_SETUP.md).

## Deploy

Push в ветку, обслуживающую GitHub Pages. Перед выпуском пройти release gate и [smoke-чеклист](docs/smoke-checklist.md).

### Release gate

Перед production deploy:

- [ ] `npm run lint`, `npm run validate:stage0`, `npm test` — зелёные либо известные legacy source-contract расхождения явно зафиксированы до Pass 3;
- [ ] прогнан [smoke-чеклист](docs/smoke-checklist.md), включая backup replace + recovery, cloud conflict и гейтинг доступа;
- [ ] проверен вход и reload session; cloud save и reload;
- [ ] подтверждено, что существующий CAS flow работает; CAS-миграцию повторно не применять;
- [ ] `docs/SUPABASE_RLS_AUDIT.md` не имеет открытых пунктов, критичных для выпуска;
- [ ] PR содержит риск и способ rollback;
- [ ] после deploy вручную: вход, открытие ученика, сохранение занятия, оплата, отчёт, reload, backup export.
