import { store as appStore } from '../../state/app-store.js';

export function createSettingsService({ store }) {
  function toggleTheme() {
    return store.update('settings:theme', (draft) => {
      draft.settings.theme = draft.settings.theme === 'dark' ? 'light' : 'dark';
    });
  }

  function toggleSidebar() {
    return store.update('settings:sidebar', (draft) => {
      draft.settings.sidebarCompact = !draft.settings.sidebarCompact;
    });
  }

  function save({ tutor = '', reminder = 0 }) {
    return store.update('settings:update', (draft) => {
      draft.settings.tutor = String(tutor).trim();
      draft.settings.reminder = Number(reminder) || 0;
    });
  }

  function completeOnboarding(tutor) {
    const name = String(tutor || '').trim();
    if (!name) return { ok: false, error: 'Tutor name is required' };
    return store.update('onboarding:complete', (draft) => {
      draft.settings.tutor = name;
    });
  }

  return { toggleTheme, toggleSidebar, save, completeOnboarding };
}

export const settingsService = createSettingsService({ store: appStore });
