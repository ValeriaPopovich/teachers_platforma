import { createBrowserPersistence, createLocalPersistence } from './persistence.js';
import { blankData } from './schema.js';
import { createStore } from './store.js';
import { validateReferential, validateStructural } from './validate.js';

// The single app-wide store instance. Both bootstrap.js and module services
// import it from here instead of each creating their own.
export const STORAGE_KEY = 'tutorCabinet_v1';
export const RETENTION_DAYS = 45;
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Module services import this file just to reach the store singleton, so
// importing it must stay safe outside a browser (e.g. Node test runners that
// exercise a service factory directly without touching localStorage).
function createMemoryPersistence({ key, onPersist }) {
  const memory = new Map();
  return createLocalPersistence({
    storage: {
      getItem: (k) => (memory.has(k) ? memory.get(k) : null),
      setItem: (k, value) => memory.set(k, value),
    },
    key,
    onPersist,
  });
}

export const persistence =
  typeof window === 'undefined'
    ? createMemoryPersistence({ key: STORAGE_KEY, onPersist: () => {} })
    : createBrowserPersistence({
        key: STORAGE_KEY,
        onPersist: (raw) => window.tutorCloud?.queueSave?.(raw),
      });

const loaded = persistence.load();
export const store = createStore(loaded.ok ? loaded.envelope.data : blankData(), {
  validate(candidate) {
    const structural = validateStructural(candidate);
    return structural.ok ? validateReferential(candidate) : structural;
  },
});

export const persistenceState = { enabled: loaded.ok };
if (!loaded.ok)
  console.error(
    `Local state rejected at ${loaded.stage}; the last copy was not overwritten.`,
    loaded.errors,
  );

store.subscribe((nextState, actionName) => {
  if (!persistenceState.enabled) return;
  const result = persistence.save(nextState);
  if (!result.ok) console.error(`Persistence rejected action "${actionName}".`, result.errors);
});
