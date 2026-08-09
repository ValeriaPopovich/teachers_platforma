// Цепочка миграций между schemaVersion. Сейчас единственная версия — 1, поэтому
// цепочка почти пустая. Каждая миграция — функция (data) => data, идемпотентна на
// уровне общего pipeline (см. ADR-0003).

import { CURRENT_SCHEMA_VERSION, isEnvelope, wrapLegacy } from './schema.js';

/** Массив миграций: индекс = откуда, значение = функция превращения data в следующую версию. */
const MIGRATIONS = {
  // v0 (legacy без envelope) → v1: содержимое data не меняется, только оборачивается.
  // Обёртка делается в normalizeToEnvelope ниже, миграции работают уже с data.
  0: (data) => data,
  // Следующие миграции добавляются здесь. Пример:
  // 1: (data) => { /* ... */ return data; },
};

/** Приводит произвольный parsed input к envelope-виду. Legacy flat object -> envelope v1. */
export function normalizeToEnvelope(parsed) {
  if (isEnvelope(parsed)) return parsed;
  // Legacy: любой object без envelope считается data v0.
  return wrapLegacy(parsed);
}

/** Применяет цепочку миграций к envelope до CURRENT_SCHEMA_VERSION.
 *  Возвращает { ok, envelope, errors[] }. */
export function migrateToLatest(envelope) {
  const errors = [];
  let current = envelope;
  while (current.meta.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const from = current.meta.schemaVersion;
    const step = MIGRATIONS[from];
    if (!step) {
      errors.push(`no migration from schemaVersion ${from}`);
      return { ok: false, envelope: current, errors };
    }
    try {
      const nextData = step(current.data);
      current = {
        meta: {
          schemaVersion: from + 1,
          updatedAt: new Date().toISOString(),
        },
        data: nextData,
      };
    } catch (err) {
      errors.push(`migration ${from} failed: ${err.message}`);
      return { ok: false, envelope: current, errors };
    }
  }
  if (current.meta.schemaVersion > CURRENT_SCHEMA_VERSION) {
    errors.push(
      `state schemaVersion ${current.meta.schemaVersion} is newer than known ${CURRENT_SCHEMA_VERSION}`,
    );
    return { ok: false, envelope: current, errors };
  }
  return { ok: true, envelope: current, errors };
}
