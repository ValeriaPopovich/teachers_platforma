-- Этап 5 — надёжная cloud sync (ADR-0006, REFACTORING_SPEC.md §5).
-- Добавляет колонки revision/schema_version в app_data и RPC-функцию для
-- атомарного compare-and-swap. Клиент вызывает save_app_data(...) вместо
-- upsert; если expected_revision не совпадает — CAS возвращает 0 rows и
-- клиент видит conflict (не автоматическая перезапись).
--
-- Как применить: Supabase Dashboard → SQL Editor → выполнить этот файл.
-- Идемпотентно: повторный запуск ничего не сломает.
--
-- Rollback:
--   drop function if exists public.save_app_data(uuid, jsonb, integer, integer);
--   alter table public.app_data drop column if exists revision;
--   alter table public.app_data drop column if exists schema_version;

-- 1. Колонки. Дефолты нужны, чтобы существующие строки получили revision=1.
alter table public.app_data
  add column if not exists revision integer not null default 1,
  add column if not exists schema_version integer not null default 1;

-- 2. Атомарный CAS. Возвращает новую revision при успехе, NULL при конфликте.
--    security definer, чтобы функция работала под привилегиями владельца,
--    но проверка user_id идёт через auth.uid() — чужие строки трогать нельзя.
create or replace function public.save_app_data(
  p_data jsonb,
  p_expected_revision integer,
  p_schema_version integer default 1
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new_revision integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Первый save (строки ещё нет): expected должен быть 0.
  if not exists (select 1 from public.app_data where user_id = v_uid) then
    if p_expected_revision <> 0 then
      return null; -- клиент думал, что уже есть строка — конфликт
    end if;
    insert into public.app_data (user_id, data, revision, schema_version, updated_at)
    values (v_uid, p_data, 1, p_schema_version, now());
    return 1;
  end if;

  -- CAS-обновление. Возвращает новую revision только если expected совпал.
  update public.app_data
     set data = p_data,
         revision = revision + 1,
         schema_version = p_schema_version,
         updated_at = now()
   where user_id = v_uid
     and revision = p_expected_revision
  returning revision into v_new_revision;

  return v_new_revision; -- NULL, если условие не совпало
end;
$$;

-- 3. Разрешить authenticated роли вызывать RPC.
grant execute on function public.save_app_data(jsonb, integer, integer) to authenticated;

-- 4. Опционально: индекс уже есть, потому что user_id — PK/уникален.
--    Если это не так — раскомментировать:
-- create unique index if not exists app_data_user_id_uidx on public.app_data(user_id);
