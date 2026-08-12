import { computed } from 'vue';

import { UI_BADGE_VARIANTS } from './constants.js';

export default {
  name: 'UiBadge',
  props: {
    /** Определяет визуальный вариант метки. */
    variant: {
      type: String,
      default: 'neutral',
      validator: (value) => UI_BADGE_VARIANTS.includes(value),
    },
  },
  setup(props) {
    const badgeClass = computed(() => `ui-badge--${props.variant}`);
    return { badgeClass };
  },
};
