# teachers_platforma

Кабинет репетитора: ученики, группы, расписание, оплаты и отчёты. Данные хранятся локально (`localStorage`) и синхронизируются с облаком (Supabase) для входа с других устройств.

## Запуск приложения

Это статический сайт — сборка не нужна. Открыть `index.html` локально или через любой static-сервер; в проде хостится на GitHub Pages.

## Разработка (тесты и линт)

Требуется Node.js 20+. Зависимости — только dev-инструменты, само приложение их не использует.

```bash
npm install       # установить dev-зависимости
npm test          # unit-тесты (Vitest)
npm run test:watch
npm run lint       # ESLint (src/ и tests/)
npm run format     # Prettier --write
npm run format:check
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) прогоняет `lint` и `test` на каждый push и PR.

## Тесты и baseline

- Чистые domain-модули — в [`src/domain/`](src/domain/), тесты — в [`tests/`](tests/).
- Эталонный fixture — [`tests/fixtures/baseline.json`](tests/fixtures/baseline.json), ожидаемые числа — [`docs/baseline-manifest.md`](docs/baseline-manifest.md).
- Ручной smoke — [`docs/smoke-checklist.md`](docs/smoke-checklist.md).

## Данные и резервные копии

- Локальный ключ: `tutorCabinet_v1`; owner marker: `tutorCabinet_owner_user_id` (данные привязаны к одному аккаунту устройства).
- Backup export создаёт JSON, который импортируется в режимах replace и merge. Старые копии должны продолжать импортироваться — это инвариант рефакторинга.

## Документация

- План рефакторинга: [`docs/REFACTORING_SPEC.md`](docs/REFACTORING_SPEC.md).
- Архитектурные решения: [`docs/adr/`](docs/adr/README.md).
- RLS-аудит: [`docs/SUPABASE_RLS_AUDIT.md`](docs/SUPABASE_RLS_AUDIT.md).
- Atomic cloud save включён; инструкция и сценарий проверки: [`docs/CLOUD_SYNC_SETUP.md`](docs/CLOUD_SYNC_SETUP.md).

## Deploy

Push в ветку, обслуживающую GitHub Pages. Перед выпуском пройти release gate и [smoke-чеклист](docs/smoke-checklist.md).

### Release gate

Перед production deploy:

- [ ] `npm run lint`, `npm run validate:stage0`, `npm test` — зелёные;
- [ ] прогнан [smoke-чеклист](docs/smoke-checklist.md), включая пункт про backup replace + recovery, cloud conflict и гейтинг доступа;
- [ ] проверен вход и reload session; cloud save и reload;
- [ ] в live Supabase применена CAS-миграция из `supabase/migrations/2026_stage5_add_revision_cas.sql`;
- [ ] `docs/SUPABASE_RLS_AUDIT.md` не имеет открытых пунктов, критичных для этого выпуска;
- [ ] PR содержит риск и способ rollback (обычно `git revert HEAD` на соответствующий этап);
- [ ] после deploy вручную: вход, открытие ученика, сохранение занятия, оплата, reload, backup export.
