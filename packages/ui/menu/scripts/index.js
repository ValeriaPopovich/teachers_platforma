import { onBeforeUnmount, onMounted, ref } from 'vue';

export default {
  name: 'UiMenu',
  props: {
    /** Доступное название кнопки, открывающей меню. */
    ariaLabel: { type: String, required: true },
    /** Идентификатор владельца меню для делегирования действия. */
    ownerId: { type: String, default: '' },
    /** Доступные действия меню. */
    items: {
      type: Array,
      default: () => [],
      validator: (items) =>
        items.every((item) => item && item.value && item.label && typeof item.value === 'string'),
    },
  },
  setup() {
    const root = ref(null);
    const isOpen = ref(false);

    function close() {
      isOpen.value = false;
    }

    function toggle() {
      isOpen.value = !isOpen.value;
    }

    function itemClass(item) {
      return item.danger ? 'is-danger' : '';
    }

    function handleOutsideClick(event) {
      if (!root.value?.contains(event.target)) close();
    }

    function handleKeydown(event) {
      if (event.key === 'Escape') close();
    }

    onMounted(() => {
      document.addEventListener('click', handleOutsideClick);
      document.addEventListener('keydown', handleKeydown);
    });
    onBeforeUnmount(() => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleKeydown);
    });

    return { close, isOpen, itemClass, root, toggle };
  },
};
