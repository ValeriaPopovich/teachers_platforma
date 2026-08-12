import { computed, onBeforeUnmount, ref } from 'vue';

let tooltipSequence = 0;

export default {
  name: 'UiTooltip',
  props: {
    /** Текст короткой контекстной подсказки. */
    text: { type: String, required: true },
  },
  setup() {
    const trigger = ref(null);
    const isVisible = ref(false);
    const position = ref({ left: 0, top: 0 });
    const tooltipId = `ui-tooltip-${++tooltipSequence}`;
    const tooltipStyle = computed(() => ({
      left: `${position.value.left}px`,
      top: `${position.value.top}px`,
    }));

    function updatePosition() {
      const bounds = trigger.value?.getBoundingClientRect();
      if (!bounds) return;
      position.value = {
        left: bounds.left + bounds.width / 2,
        top: bounds.top,
      };
    }

    function show() {
      updatePosition();
      isVisible.value = true;
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }

    function hide() {
      isVisible.value = false;
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    }

    onBeforeUnmount(hide);

    return { hide, isVisible, show, tooltipId, tooltipStyle, trigger };
  },
};
