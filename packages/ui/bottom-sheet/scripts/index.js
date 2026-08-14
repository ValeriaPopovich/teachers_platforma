import { nextTick } from 'vue';

import UiButton from '../../button/index.vue';

let sheetSequence = 0;

export default {
  name: 'UiBottomSheet',
  components: { UiButton },
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, required: true },
    cancelLabel: { type: String, default: 'Отмена' },
    showCancel: { type: Boolean, default: true },
  },
  emits: ['close'],
  data() {
    sheetSequence += 1;
    return {
      titleId: `bottom-sheet-title-${sheetSequence}`,
      previousFocus: null,
    };
  },
  watch: {
    open(value) {
      if (value) this.onOpen();
      else this.onClosed();
    },
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.onKeydown);
    document.body.classList.remove('bottom-sheet-open');
  },
  methods: {
    close() {
      this.$emit('close');
    },
    async onOpen() {
      this.previousFocus = document.activeElement;
      document.body.classList.add('bottom-sheet-open');
      document.addEventListener('keydown', this.onKeydown);
      await nextTick();
      this.$refs.sheet?.querySelector('button, [href], input, select, textarea')?.focus();
    },
    onClosed() {
      document.removeEventListener('keydown', this.onKeydown);
      document.body.classList.remove('bottom-sheet-open');
      this.previousFocus?.focus?.();
      this.previousFocus = null;
    },
    onKeydown(event) {
      if (event.key === 'Escape') this.close();
    },
  },
};
