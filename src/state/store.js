// Минимальный store. Единственная точка мутации state. subscribe/listeners по спеке
// сейчас необязательны — persistence и render вызываются явно после update
// (пока полный renderAll остаётся чистым и не тормозит). Оставлен для будущего.

export function createStore(initialState, { validate } = {}) {
  let state = initialState;
  const listeners = new Set();

  function getState() {
    return state;
  }

  /** update(actionName, mutator): mutator получает draft (structuredClone текущего state)
   *  и мутирует его. Название action — для логов/дебага. Возвращает новый state. */
  function update(actionName, mutator) {
    if (typeof mutator !== 'function') {
      throw new TypeError(`store.update("${actionName}"): mutator must be a function`);
    }
    const draft = structuredClone(state);
    mutator(draft);
    assertValid(draft, actionName);
    state = draft;
    notify(actionName);
    return state;
  }

  /** replace(nextState): для load/import/replace. Не проходит через mutator. */
  function replace(nextState) {
    assertValid(nextState, 'replace');
    state = nextState;
    notify('replace');
    return state;
  }

  /** subscribe(listener): подписаться на изменения. Возвращает unsubscribe. */
  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function notify(actionName) {
    for (const l of listeners) {
      try {
        l(state, actionName);
      } catch (err) {
        // Один плохой listener не роняет остальные.
        console.error(`store listener failed on "${actionName}":`, err);
      }
    }
  }

  function assertValid(candidate, actionName) {
    if (!validate) return;
    const result = validate(candidate);
    if (result?.ok === false) {
      throw new Error(`store rejected "${actionName}": ${result.errors.join('; ')}`);
    }
  }

  return { getState, update, replace, subscribe };
}
