import { nextTick } from 'vue';

let modalSequence = 0;

export default {
  name: 'UiModal',
  props: {
    /** Управляет видимостью модального окна. */
    open: { type: Boolean, default: false },
    /** Заголовок в шапке модального окна. */
    title: { type: String, required: true },
    /** Необязательная поясняющая строка под заголовком. */
    subtitle: { type: String, default: '' },
    /** Дополнительный класс для карточки модального окна. */
    contentClass: { type: [String, Array, Object], default: '' },
    /** Дополнительный класс для оверлея и позиционирования окна. */
    wrapClass: { type: [String, Array, Object], default: '' },
    /** Выдвигать окно справа (десктоп) / снизу как боттом-щит (мобилки). */
    side: { type: Boolean, default: true },
    /** Необязательный стабильный id заголовка (например, для e2e-тестов). */
    titleId: { type: String, default: '' },
    /** Делает содержимое и подвал модального окна единой HTML-формой. */
    formId: { type: String, default: '' },
    /** Возвращает true, когда перед закрытием нужно подтвердить потерю изменений. */
    shouldConfirmClose: { type: Function, default: null },
  },
  emits: ['close', 'submit'],
  data() {
    modalSequence += 1;
    return {
      generatedTitleId: this.titleId || `ui-modal-title-${modalSequence}`,
      previousFocus: null,
      discardVisible: false,
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
    document.documentElement.classList.remove('modal-open');
  },
  methods: {
    requestClose() {
      if (this.shouldConfirmClose?.()) {
        this.discardVisible = true;
        nextTick(() => this.$refs.dialog?.querySelector('.modal-discard .btn.primary')?.focus());
        return;
      }
      this.$emit('close');
    },
    continueEditing() {
      this.discardVisible = false;
      nextTick(() =>
        this.$refs.dialog?.querySelector('input:not([type=hidden]),select,textarea')?.focus(),
      );
    },
    discardAndClose() {
      this.discardVisible = false;
      this.$emit('close');
    },
    onBackdropClick() {
      this.requestClose();
    },
    async onOpen() {
      this.previousFocus = document.activeElement;
      this.discardVisible = false;
      document.documentElement.classList.add('modal-open');
      document.addEventListener('keydown', this.onKeydown);
      await nextTick();
      const dialog = this.$refs.dialog;
      dialog.scrollTop = 0;
      dialog
        ?.querySelector(
          'input:not([type=hidden]),select,textarea,.modal-foot .btn.primary,button:not(.close)',
        )
        ?.focus?.();
    },
    onClosed() {
      document.removeEventListener('keydown', this.onKeydown);
      document.documentElement.classList.remove('modal-open');
      this.discardVisible = false;
      this.previousFocus?.focus?.();
      this.previousFocus = null;
    },
    onKeydown(event) {
      if (event.key !== 'Escape') return;
      if (this.discardVisible) this.continueEditing();
      else this.requestClose();
    },
  },
};
