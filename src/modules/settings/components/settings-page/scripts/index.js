import { UiButton, UiHint, UiPageLayout } from '@ui';
import { computed, ref, watch } from 'vue';

import { toast } from '../../../../../shared/app-ui.js';
import { useAppState } from '../../../../../state/use-app-state.js';
import { settingsService } from '../../../settings.service.js';

export default {
  name: 'SettingsPage',
  components: { UiButton, UiHint, UiPageLayout },
  setup() {
    const state = useAppState();
    const settings = computed(() => state.value.settings);
    const tutor = ref(settings.value.tutor || '');
    const reminder = ref(String(settings.value.reminder ?? 15));

    watch(
      settings,
      (value) => {
        tutor.value = value.tutor || '';
        reminder.value = String(value.reminder ?? 15);
        // Theme/sidebar are global app chrome, not just this page, but this
        // page is always mounted (like the other page roots), so it is a
        // safe single place to keep the DOM classes in sync with the store.
        document.documentElement.dataset.theme = value.theme || 'light';
        // .dark also goes on <html> (not just <body>): design-system.css's
        // dark overrides and the legacy --bg/--color-* alias chain in
        // _base.scss both live on :root, so the toggle has to reach that
        // same element for indirect var() chains to re-resolve.
        document.documentElement.classList.toggle('dark', value.theme === 'dark');
        document.body.classList.toggle('dark', value.theme === 'dark');
        document.querySelector('.app')?.classList.toggle('sidebar-compact', !!value.sidebarCompact);
      },
      { immediate: true },
    );

    function onSaveButtonClick() {
      settingsService.save({ tutor: tutor.value, reminder: reminder.value });
      toast('Настройки сохранены');
    }

    function onThemeButtonClick() {
      settingsService.toggleTheme();
    }

    return { onSaveButtonClick, onThemeButtonClick, reminder, tutor };
  },
};
