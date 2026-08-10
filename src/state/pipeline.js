import { blankData, blankState, CURRENT_SCHEMA_VERSION } from './schema.js';
import { validateStructural, validateReferential } from './validate.js';
import { normalizeToEnvelope, migrateToLatest } from './migrations.js';
function normalizeData(data) {
  const shape = blankData();
  const out = { ...shape, ...data };
  out.settings = { ...shape.settings, ...(data.settings || {}) };
  return out;
}
export function loadState(raw) {
  if (raw == null || raw === '')
    return { ok: true, envelope: blankState(), stage: 'empty', errors: [] };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { ok: false, envelope: null, stage: 'parse', errors: [error.message] };
  }
  if (!parsed || typeof parsed !== 'object')
    return { ok: false, envelope: null, stage: 'parse', errors: ['input is not an object'] };
  const envelope = normalizeToEnvelope(parsed);
  const structural = validateStructural(envelope.data);
  if (!structural.ok)
    return { ok: false, envelope: null, stage: 'structural', errors: structural.errors };
  const migrated = migrateToLatest(envelope);
  if (!migrated.ok)
    return { ok: false, envelope: null, stage: 'migration', errors: migrated.errors };
  const referential = validateReferential(migrated.envelope.data);
  if (!referential.ok)
    return { ok: false, envelope: null, stage: 'referential', errors: referential.errors };
  return {
    ok: true,
    envelope: {
      meta: { schemaVersion: CURRENT_SCHEMA_VERSION, updatedAt: migrated.envelope.meta.updatedAt },
      data: normalizeData(migrated.envelope.data),
    },
    stage: 'ok',
    errors: [],
  };
}
