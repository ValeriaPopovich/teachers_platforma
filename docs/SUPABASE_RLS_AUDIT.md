# Supabase RLS audit

**Дата:** 2026-08-09  
**Проект:** `rbpxlzwycacrfupsthdn`  
**Область:** текущие таблицы `app_data`, `profiles`

## Зафиксированный контракт приложения

- `app_data.user_id` берётся только из текущей Supabase session.
- Cloud upload записывает `user_id = window.tutorCloud.user.id`.
- `profiles` загружается с фильтром `.eq('user_id', user.id)`.
- `app_data` загружается с фильтром `.eq('user_id', user.id)`.
- Frontend использует только publishable key; service role key в коде отсутствует.
- RPC `email_exists` сохраняется как принятое продуктовое решение и не пересматривается этим рефакторингом.

Frontend-фильтр не считается security boundary: изоляция пользователей должна обеспечиваться RLS.

## Выполненная внешняя проверка

Read-only REST-запросы с production publishable key без пользовательской session:

| Таблица | HTTP | PostgreSQL code | Результат |
|---|---:|---|---|
| `app_data` | 401 | `42501` | `permission denied for table app_data` |
| `profiles` | 401 | `42501` | `permission denied for table profiles` |

Анонимное чтение обеих таблиц закрыто.

## Требуемые policy

Для `app_data`:

- SELECT: `user_id = auth.uid()`;
- INSERT: `WITH CHECK (user_id = auth.uid())`;
- UPDATE: `USING (user_id = auth.uid())` и `WITH CHECK (user_id = auth.uid())`;
- DELETE, если доступен приложению: `user_id = auth.uid()`.

Для `profiles`:

- SELECT собственного профиля: `user_id = auth.uid()`;
- пользователь не должен самостоятельно менять `status` и `access_until`;
- остальные write-policy определяются административным процессом вне frontend.

## Проверка, требующая двух тестовых пользователей

Анонимный тест не доказывает cross-user isolation для авторизованных пользователей. Перед production release необходимо выполнить один ручной сценарий в тестовом окружении или SQL policy test:

1. Авторизоваться как пользователь A.
2. SELECT строки пользователя B из `app_data` возвращает 0 строк или permission denied.
3. UPDATE/UPSERT с `user_id` пользователя B завершается permission denied.
4. SELECT профиля пользователя B возвращает 0 строк или permission denied.
5. Повторить симметрично для пользователя B.

Не использовать реальные пользовательские данные в выводе теста. Достаточно зафиксировать дату, роли и результат allow/deny.

## Статус

- [x] Frontend не содержит service role key.
- [x] Анонимное чтение `app_data` запрещено.
- [x] Анонимное чтение `profiles` запрещено.
- [ ] Cross-user policy test с двумя авторизованными тестовыми пользователями.

