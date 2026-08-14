import { reactive } from 'vue';

export const appUiState = reactive({ hydrating: false });

export function setAppHydrating(value) {
  appUiState.hydrating = Boolean(value);
  globalThis.document?.body?.classList.toggle('app-is-hydrating', appUiState.hydrating);
  globalThis.document?.querySelectorAll('[id$="PageRoot"]').forEach((root) => {
    root.setAttribute('aria-busy', String(appUiState.hydrating));
  });
  globalThis.document
    ?.querySelector('#page-board')
    ?.setAttribute('aria-busy', String(appUiState.hydrating));
}
