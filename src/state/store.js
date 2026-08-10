export function createStore(initialState, { validate } = {}) {
  let state = initialState; const listeners = new Set();
  function getState() { return state; }
  function update(actionName, mutator) { if (typeof mutator !== 'function') throw new TypeError(`store.update("${actionName}"): mutator must be a function`); const draft = structuredClone(state); mutator(draft); assertValid(draft, actionName); state = draft; notify(actionName); return state; }
  function replace(nextState, actionName = 'replace') { const copy = structuredClone(nextState); assertValid(copy, actionName); state = copy; notify(actionName); return state; }
  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  function notify(actionName) { for (const listener of listeners) try { listener(state, actionName); } catch (error) { console.error(`store listener failed on "${actionName}":`, error); } }
  function assertValid(candidate, actionName) { if (!validate) return; const result = validate(candidate); if (result?.ok === false) throw new Error(`store rejected "${actionName}": ${result.errors.join('; ')}`); }
  return { getState, update, replace, subscribe };
}
