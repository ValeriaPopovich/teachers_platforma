import { CURRENT_SCHEMA_VERSION, isEnvelope, wrapLegacy } from './schema.js';
const MIGRATIONS = { 0: (data) => data };
export function normalizeToEnvelope(parsed) { return isEnvelope(parsed) ? parsed : wrapLegacy(parsed); }
export function migrateToLatest(envelope) {
  const errors = []; let current = envelope;
  while (current.meta.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const from = current.meta.schemaVersion, step = MIGRATIONS[from];
    if (!step) return { ok: false, envelope: current, errors: [`no migration from schemaVersion ${from}`] };
    try { current = { meta: { schemaVersion: from + 1, updatedAt: new Date().toISOString() }, data: step(current.data) }; }
    catch (error) { errors.push(`migration ${from} failed: ${error.message}`); return { ok: false, envelope: current, errors }; }
  }
  if (current.meta.schemaVersion > CURRENT_SCHEMA_VERSION) return { ok: false, envelope: current, errors: [`state schemaVersion ${current.meta.schemaVersion} is newer than known ${CURRENT_SCHEMA_VERSION}`] };
  return { ok: true, envelope: current, errors };
}
