import { computed } from 'vue';

import { ICONS } from '../icons.js';

export default {
  name: 'UiIcon',
  props: {
    /** Имя иконки из локального реестра. */
    name: { type: String, required: true, validator: (value) => Object.hasOwn(ICONS, value) },
    /** Размер иконки в CSS-пикселях. */
    size: { type: [Number, String], default: 20 },
    /** Доступное имя значимой иконки. */
    label: { type: String, default: '' },
  },
  setup(props) {
    const isDecorative = computed(() => !props.label);
    const shapes = computed(() =>
      (ICONS[props.name] || []).map((shape, index) => ({
        ...shape,
        key: `${props.name}-${index}`,
      })),
    );
    const iconAttributes = computed(() => {
      const sizeAttributes = { width: props.size, height: props.size };
      if (isDecorative.value) return { ...sizeAttributes, 'aria-hidden': 'true' };
      return { ...sizeAttributes, 'aria-label': props.label, role: 'img' };
    });

    return { iconAttributes, shapes };
  },
};
