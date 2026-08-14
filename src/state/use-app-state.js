import { onBeforeUnmount, shallowRef } from 'vue';

import { store } from './app-store.js';

/**
 * Reactive read access to the app store for Vue components. The store already
 * replaces its state wholesale on every change, so a shallow ref is enough —
 * no deep reactive copy of application data is made.
 */
export function useAppState() {
  const state = shallowRef(store.getState());
  const unsubscribe = store.subscribe((next) => {
    state.value = next;
  });
  onBeforeUnmount(unsubscribe);
  return state;
}
