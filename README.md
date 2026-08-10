# teachers_platforma

Кабинет репетитора: ученики, группы, расписание, оплаты и отчёты. Данные хранятся локально (`localStorage`) и синхронизируются с облаком (Supabase) для входа с других устройств.

## Запуск приложения

Это статический сайт: единственный production-файл `assets/styles.css` генерируется из SCSS и хранится в репозитории для GitHub Pages. Открыть `index.html` через static-сервер.

Основной browser entry после архитектурного рефакторинга:

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

Feature ownership:

```text
students + groups -> src/modules/students/
schedule + lessons/events -> src/modules/schedule/
payments -> src/modules/payments/
reports -> src/modules/reports/
settings -> src/modules/settings/
dashboard -> src/modules/dashboard/
```

Общие UI primitives находятся в `src/shared/`, state/persistence — в `src/state/`, cloud/auth — в `src/cloud/` и `src/auth/`.

## Разработка: проверки

Локально требуется Node.js 20+; CI использует Node.js 24. Зависимости нужны только для разработки, само приложение остаётся статическим.

```bash
npm install
npm run styles:build
npm run lint
npm run format:check
npm run refactor:check
npm run validate:stage0
npm test
npm run test:architecture
npx playwright install chromium
npm run test:e2e
```

SCSS-исходники находятся в `styles/`: `core/`, `components/`, `features/` и единая точка входа `entries/main.scss`. Feature partials используют Sass nesting под единственным корневым селектором страницы или модального окна. После изменения SCSS выполните `npm run styles:build`; для разработки доступен `npm run styles:watch`. Не редактируйте `assets/styles.css` вручную.

`npm run lint` запускает ESLint и Stylelint. `npm run refactor:check` проверяет неиспользуемые файлы/зависимости через Knip и архитектурные связи через dependency-cruiser. `npm test` запускает Vitest unit/integration/source-contract suites и lightweight architecture guards. `npm run test:e2e` запускает только критические Chromium E2E flows.

CI (`.github/workflows/ci.yml`) на каждый push/PR выполняет:

```text
lint
Prettier check
SCSS build freshness
dependency architecture and unused-code audit
Stage 0 validation
unit/integration + architecture guards
critical Playwright E2E
```

## Тесты и baseline

- Чистые compatibility re-export могут находиться в `src/domain/`; feature-domain логика принадлежит соответствующим `src/modules/*/`.
- Эталонный fixture — `tests/fixtures/baseline.json`, ожидаемые числа — `docs/baseline-manifest.md`.
- Architecture guards — `tests/architecture-guards.test.js`.
- Критические browser flows — `tests/e2e/critical-flows.e2e.js`.
- Ручной smoke — `docs/smoke-checklist.md`; он дополняет автоматизацию, а не заменяется ею.

Критический E2E gate покрывает:

- создание/редактирование ученика + reload persistence;
- создание занятия + сохранение + запрет тихой смены владельца при редактировании;
- разовую оплату;
- расчёт абонемента;
- report builder + preview + copy text;
- backup export.

## Данные и резервные копии

- Локальный ключ: `tutorCabinet_v1`; owner marker: `tutorCabinet_owner_user_id`.
- Backup export создаёт JSON, который импортируется в режимах replace и merge. Старые копии должны продолжать импортироваться — это инвариант рефакторинга.
- CAS/optimistic concurrency для Supabase уже внедрён и миграция уже применена. Не применять CAS-миграцию повторно без отдельной причины.

## Документация

- Текущий handoff рефакторинга: `REFACTOR_FLOW.md`.
- Утверждённая Lean-спецификация: `docs/REFACTORING_SPEC_V5_LEAN.md`.
- Исторический план: `docs/REFACTORING_SPEC.md`.
- Архитектурные решения: `docs/adr/`.
- RLS-аудит: `docs/SUPABASE_RLS_AUDIT.md`.
- Cloud sync: `docs/CLOUD_SYNC_SETUP.md`.

## Deploy

Push в ветку, обслуживающую GitHub Pages, только после зелёного release gate и ручного smoke по критичным интеграциям.

### Release gate

Перед production deploy:

- [ ] `npm run lint` — зелёный;
- [ ] `npm run format:check` и `npm run styles:check` — зелёные;
- [ ] `npm run refactor:check` — зелёный;
- [ ] `npm run validate:stage0` — зелёный;
- [ ] `npm test` — зелёный, включая architecture guards;
- [ ] `npm run test:e2e` — зелёный;
- [ ] прогнан `docs/smoke-checklist.md`, особенно auth/cloud conflict и backup import/replace/recovery;
- [ ] проверен вход и reload session; cloud save и reload;
- [ ] подтверждено, что существующий CAS flow работает; CAS-миграцию повторно не применять;
- [ ] `docs/SUPABASE_RLS_AUDIT.md` не имеет открытых пунктов, критичных для выпуска;
- [ ] PR содержит риск и способ rollback;
- [ ] после deploy вручную: вход, открытие ученика, сохранение занятия, оплата, отчёт, reload, backup export.
