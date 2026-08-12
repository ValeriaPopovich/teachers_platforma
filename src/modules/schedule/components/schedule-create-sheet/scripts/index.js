import { UiBottomSheet } from '@ui';

export default {
  name: 'ScheduleCreateSheet',
  components: { UiBottomSheet },
  data: () => ({ open: false }),
  mounted() {
    window.addEventListener('schedule:create-sheet-open', this.show);
  },
  beforeUnmount() {
    window.removeEventListener('schedule:create-sheet-open', this.show);
  },
  methods: {
    show() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
    select(type) {
      this.close();
      window.dispatchEvent(new CustomEvent('schedule:create-type', { detail: { type } }));
    },
  },
};
