import { onBeforeUnmount, onMounted, ref } from 'vue';

export default {
  name: 'UiMenu',
  props: {
    /** Доступное название кнопки, открывающей меню. */
    ariaLabel: { type: String, required: true },
    /** Доступные действия меню. */
    items: {
      type: Array,
      default: () => [],
      validator: (items) =>
        items.every((item) => item && item.value && item.label && typeof item.value === 'string'),
    },
  },
  emits: ['select'],
  setup(props, { emit }) {
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

    function onItemClick(item) {
      close();
      emit('select', item.value);
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

    return { close, isOpen, itemClass, onItemClick, root, toggle };
  },
};
