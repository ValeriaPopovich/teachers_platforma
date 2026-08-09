// Единый pipeline загрузки:
//   raw → parse → structural → migration → referential → normalized envelope.
// Только валидный envelope может стать активным state. Ошибка НЕ перезаписывает
// последнюю валидную копию — это ответственность вызывающего кода (persistence),
// pipeline лишь возвращает результат {ok, envelope|null, stage, errors}.

import { blankData, blankState, CURRENT_SCHEMA_VERSION } from './schema.js';
import { validateStructural, validateReferential } from './validate.js';
import { normalizeToEnvelope, migrateToLatest } from './migrations.js';

/** Приводит envelope.data к нормализованной форме: дозаполняет defaults из blankData
 *  для отсутствующих коллекций (структурная validation уже прошла). */
function normalizeData(data) {
  const shape = blankData();
  const out = { ...shape, ...data };
  out.settings = { ...shape.settings, ...(data.settings || {}) };
  // Массивы/объекты: если поле пропущено, defaults применились; если было — оставляем.
  return out;
}

/** Основная функция. `raw` — строка (из localStorage / cloud / import), либо null. */
export function loadState(raw) {
  if (raw == null || raw === '') {
    // Пустой ввод — валидное «первый запуск» состояние.
    return { ok: true, envelope: blankState(), stage: 'empty', errors: [] };
  }

  // parse
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, envelope: null, stage: 'parse', errors: [err.message] };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, envelope: null, stage: 'parse', errors: ['input is not an object'] };
  }

  // envelope wrap
  const envelope = normalizeToEnvelope(parsed);

  // structural validation
  const s = validateStructural(envelope.data);
  if (!s.ok) return { ok: false, envelope: null, stage: 'structural', errors: s.errors };

  // migration
  const m = migrateToLatest(envelope);
  if (!m.ok) return { ok: false, envelope: null, stage: 'migration', errors: m.errors };

  // referential validation (после миграций)
  const r = validateReferential(m.envelope.data);
  if (!r.ok) return { ok: false, envelope: null, stage: 'referential', errors: r.errors };

  // normalize (defaults)
  const finalEnvelope = {
    meta: { schemaVersion: CURRENT_SCHEMA_VERSION, updatedAt: m.envelope.meta.updatedAt },
    data: normalizeData(m.envelope.data),
  };

  return { ok: true, envelope: finalEnvelope, stage: 'ok', errors: [] };
}
