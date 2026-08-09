# Этап 5 — включение серверного CAS для cloud sync

Клиентский протокол и адаптер уже написаны (`src/cloud/sync-protocol.js`, `src/cloud/supabase-adapter.js`) и покрыты тестами. Осталось выполнить два ручных шага, требующих доступа к Supabase и правки live `assets/auth.js`.

## Шаг 1 — применить SQL миграцию

Supabase Dashboard → SQL Editor → New query → вставить содержимое [`supabase/migrations/2026_stage5_add_revision_cas.sql`](../supabase/migrations/2026_stage5_add_revision_cas.sql) → Run.

Что произойдёт:

- в `app_data` появятся колонки `revision integer not null default 1` и `schema_version integer not null default 1` (существующие строки получат `revision = 1`);
- появится RPC-функция `save_app_data(p_data, p_expected_revision, p_schema_version)` — атомарный compare-and-swap (проверяет `user_id = auth.uid()` и совпадение `revision`);
- `grant execute` даётся только роли `authenticated`.

Миграция идемпотентна. Rollback описан внутри файла в комментарии.

## Шаг 2 — переключить `assets/auth.js` на RPC

Найти в `assets/auth.js` строку `client.from('app_data').upsert(...)` — сейчас это единственный save. Заменить блок целиком на CAS-вариант. Псевдо-diff:

```diff
- const { error } = await client.from('app_data').upsert(
-   { user_id: userId, data: parsed, updated_at: new Date().toISOString() },
-   { onConflict: 'user_id' },
- );
- if (error) { showSync('Не удалось сохранить', 'error'); return false; }
- setLocalOwner(userId); ...; showSync('Сохранено'); return true;
+ // expectedRevision хранится в window.tutorCloud.revision, инициализируется при openAccount.
+ const { data: newRev, error } = await client.rpc('save_app_data', {
+   p_data: parsed,
+   p_expected_revision: window.tutorCloud.revision ?? 0,
+   p_schema_version: 1,
+ });
+ if (error) { showSync('Не удалось сохранить', 'error'); return false; }
+ if (newRev == null) { showSync('Конфликт — данные обновлены на другом устройстве', 'error'); return false; }
+ window.tutorCloud.revision = newRev;
+ setLocalOwner(userId); ...; showSync('Сохранено'); return true;
```

В `openAccount` при первом чтении cloud row прочитать `revision` из ответа и записать в `window.tutorCloud.revision` (сейчас читается только `data,updated_at` — надо добавить `revision`).

При конфликте пользователь при следующем ручном действии должен:

1. скачать локальный backup (кнопка «Резервная копия» — уже есть);
2. либо перезагрузить страницу, чтобы подтянуть облачную версию;
3. либо, если уверен — заменить облако локальным через явный контрол (можно добавить позже).

Автоматический merge полного JSON в рамках этого рефакторинга не выполняется (§4 «Не входит»).

## Проверка

1. Применить миграцию.
2. Обновить `auth.js` по псевдо-diff.
3. Сохранить любое изменение в приложении — должно вернуться «Сохранено».
4. Открыть в двух вкладках, изменить в первой, потом попытаться сохранить во второй → появится статус «Конфликт», без автоматической перезаписи.

## Почему это не сделано автоматически

Изменение `assets/auth.js` без применённой миграции сломает cloud save (RPC не существует). Порядок «сначала SQL, затем клиент» безопасен только при ручной последовательности. Как только применишь миграцию — скажи, я внесу правки в `auth.js` одним коммитом.
