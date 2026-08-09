# Architecture Decision Records

ADR фиксируют архитектурные решения проекта, их причины и последствия. Они не являются списком пожеланий: принятое решение действует, пока не заменено новым ADR.

## Статусы

- **Принято** — решение обязательно для текущей реализации.
- **Предложено** — решение обсуждается и ещё не обязательно.
- **Заменено** — действует более новый ADR.
- **Отклонено** — вариант рассмотрен и не принят.

## Реестр

| ADR | Решение | Статус |
|---|---|---|
| [0001](./0001-evolutionary-vanilla-es-modules.md) | Эволюционный рефакторинг на Vanilla JavaScript и ES Modules | Принято |
| [0002](./0002-single-account-local-ownership.md) | Локальные данные принадлежат единственному аккаунту устройства | Принято |
| [0003](./0003-versioned-state-and-migrations.md) | Versioned state, validation и миграции | Принято |
| [0004](./0004-state-persistence-render-boundaries.md) | Разделение state, persistence и rendering | Принято |
| [0005](./0005-characterization-tests-with-domain-extraction.md) | Domain extraction только вместе с characterization tests | Принято |
| [0006](./0006-cloud-sync-optimistic-concurrency.md) | Серверная optimistic concurrency для cloud sync | Принято |
| [0007](./0007-minimal-feature-oriented-modules.md) | Минимальные feature-oriented модули | Принято |
| [0008](./0008-defer-database-normalization-and-optimization.md) | Отложить нормализацию БД и преждевременные оптимизации | Принято |

## Формат нового ADR

```markdown
# ADR-NNNN: Краткое название

- Статус: Предложено
- Дата: YYYY-MM-DD

## Контекст

Почему решение необходимо.

## Решение

Что именно принято.

## Последствия

Положительные и отрицательные последствия.

## Рассмотренные альтернативы

Какие варианты не выбраны и почему.
```
