import { computed } from 'vue';

import { UI_CARD_PADDINGS, UI_CARD_VARIANTS } from './constants.js';

export default {
  name: 'UiCard',
  props: {
    /** Определяет корневой HTML-элемент. */
    as: { type: String, default: 'div' },
    /** Определяет визуальный вариант поверхности. */
    variant: {
      type: String,
      default: 'elevated',
      validator: (value) => UI_CARD_VARIANTS.includes(value),
    },
    /** Определяет внутренний отступ. */
    padding: {
      type: String,
      default: 'md',
      validator: (value) => UI_CARD_PADDINGS.includes(value),
    },
  },
  setup(props) {
    const cardClasses = computed(() => [
      `ui-card--${props.variant}`,
      `ui-card--padding-${props.padding}`,
    ]);
    return { cardClasses };
  },
};
