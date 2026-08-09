# ADR-0004: Разделение state, persistence и rendering

- Статус: Принято
- Дата: 2026-08-09

## Контекст

Сейчас mutation, `localStorage.setItem`, cloud sync и `renderAll()` связаны. Сам `renderAll()` запускает cleanup и нормализацию, которые изменяют persisted state. Из-за этого чтение и отображение могут удалять данные, а отдельные операции трудно тестировать и повторять безопасно.

## Решение

Ввести небольшой store как единственную точку изменения application state. Persistence и UI подписываются на подтверждённые изменения независимо друг от друга.

Границы ответственности:

- domain action изменяет state;
- store фиксирует изменение и уведомляет подписчиков;
- local persistence сохраняет snapshot;
- cloud sync ставит snapshot в очередь;
- UI отображает state;
- render не вызывает mutation, cleanup или persistence.

Maintenance operations — retention, orphan handling, завершение прошедших занятий — становятся отдельными именованными actions с тестами.

Полный `renderAll()` разрешён, пока он чистый и не создаёт измеримой проблемы. Selective rendering не является обязательным условием текущего рефакторинга.

## Последствия

- Сохранение и отображение можно тестировать отдельно.
- Исчезают скрытые side effects при навигации и render.
- Первое внедрение store затронет большинство mutation call sites.
- Не требуется Redux, immutable library или сложная event architecture.

## Рассмотренные альтернативы

### Сразу реализовать selective rendering всех частей UI

Отклонено: увеличивает объём и риск до доказанной проблемы производительности.

### Сохранять данные из render-функций

Отклонено: делает обычное отображение потенциально destructive operation.

