import { CURRENT_SCHEMA_VERSION } from './schema.js';
import { loadState } from './pipeline.js';
import { validateStructural, validateReferential } from './validate.js';

export const RECOVERY_KEY = 'tutorCabinet_recovery';

function envelopeFor(data, now) {
  return {
    meta: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      updatedAt: now().toISOString(),
    },
    data,
  };
}

/** Browser persistence boundary. It never renders and never mutates application state. */
export function createLocalPersistence({
  storage,
  key,
  now = () => new Date(),
  onPersist = () => {},
}) {
  function load() {
    const raw = storage.getItem(key);
    const result = loadState(raw);
    if (!result.ok || raw == null || raw === '') return { ...result, needsWrite: false };
    try {
      const parsed = JSON.parse(raw);
      return { ...result, needsWrite: !parsed?.meta || !parsed?.data };
    } catch {
      return { ...result, needsWrite: false };
    }
  }

  function save(data) {
    const structural = validateStructural(data);
    if (!structural.ok) return { ok: false, stage: 'structural', errors: structural.errors };
    const referential = validateReferential(data);
    if (!referential.ok) return { ok: false, stage: 'referential', errors: referential.errors };

    const envelope = envelopeFor(data, now);
    const raw = JSON.stringify(envelope);
    storage.setItem(key, raw);
    onPersist(raw);
    return { ok: true, envelope, raw, errors: [] };
  }

  function saveRecovery(data, reason = 'before-replace-import') {
    const recovery = {
      savedAt: now().toISOString(),
      reason,
      data: structuredClone(data),
    };
    storage.setItem(RECOVERY_KEY, JSON.stringify(recovery));
    return recovery;
  }

  return { load, save, saveRecovery };
}

export function createBrowserPersistence({ key, now, onPersist }) {
  return createLocalPersistence({ storage: window.localStorage, key, now, onPersist });
}
