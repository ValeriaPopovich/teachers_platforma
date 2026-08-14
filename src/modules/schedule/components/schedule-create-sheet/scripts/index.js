import { UiBottomSheet, UiButton, UiModal } from '@ui';
import { nextTick } from 'vue';

import { LAYOUT_DESKTOP_BREAKPOINT } from '../../../../../shared/dom.js';
import { useAppState } from '../../../../../state/use-app-state.js';
import { openNewStudent } from '../../../../students/students-ui.js';
import { closeCreateSheet, createSheetUi, openEvent, openNewLesson } from '../../../schedule-ui.js';

// Wrap a DOM/state swap in the browser's View Transitions API so the two
// panels (choice sheet ↔ lesson/event form) morph via shared view-transition-name.
function morph(swap) {
  if (typeof document.startViewTransition !== 'function') return swap();
  try {
    document.startViewTransition(async () => {
      swap();
      await nextTick();
    });
  } catch {
    swap();
  }
}

export default {
  name: 'ScheduleCreateSheet',
  components: { UiBottomSheet, UiButton, UiModal },
  data: () => ({
    isMobile: window.matchMedia(`(width <= ${LAYOUT_DESKTOP_BREAKPOINT}px)`).matches,
  }),
  setup() {
    return { state: useAppState() };
  },
  computed: {
    open() {
      return createSheetUi.open;
    },
  },
  mounted() {
    this.mql = window.matchMedia(`(width <= ${LAYOUT_DESKTOP_BREAKPOINT}px)`);
    this.onMqlChange = (event) => (this.isMobile = event.matches);
    this.mql.addEventListener('change', this.onMqlChange);
  },
  beforeUnmount() {
    this.mql?.removeEventListener('change', this.onMqlChange);
  },
  methods: {
    close: closeCreateSheet,
    select(type) {
      morph(() => {
        const { date, duration } = createSheetUi;
        closeCreateSheet();
        if (type === 'lesson' && !this.state.students.length) openNewStudent();
        else if (type === 'lesson') openNewLesson({ date, duration });
        else openEvent('', date, duration);
      });
    },
  },
};
