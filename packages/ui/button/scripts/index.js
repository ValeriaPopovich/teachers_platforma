import { computed } from 'vue';

import { UI_BUTTON_SIZES, UI_BUTTON_TYPES, UI_BUTTON_VARIANTS } from './constants.js';

export default {
  name: 'UiButton',
  inheritAttrs: false,
  props: {
    /** Определяет визуальный вариант кнопки. */
    variant: {
      type: String,
      default: 'secondary',
      validator: (value) => UI_BUTTON_VARIANTS.includes(value),
    },
    /** Определяет размер кнопки. */
    size: { type: String, default: 'md', validator: (value) => UI_BUTTON_SIZES.includes(value) },
    /** Определяет нативный тип кнопки. */
    type: {
      type: String,
      default: 'button',
      validator: (value) => UI_BUTTON_TYPES.includes(value),
    },
    /** Превращает кнопку в ссылку. */
    href: { type: String, default: '' },
    /** Отключает интерактивность. */
    disabled: { type: Boolean, default: false },
    /** Показывает состояние загрузки и отключает интерактивность. */
    loading: { type: Boolean, default: false },
    /** Растягивает кнопку на доступную ширину. */
    block: { type: Boolean, default: false },
  },
  emits: ['click'],
  setup(props, { attrs, emit, slots }) {
    const component = computed(() => (props.href ? 'a' : 'button'));
    const isLink = computed(() => component.value === 'a');
    const isDisabled = computed(() => props.disabled || props.loading);
    const buttonClasses = computed(() => [
      props.variant === 'primary' ? 'primary' : props.variant,
      `ui-button--${props.size}`,
      { 'ui-button--block': props.block, 'ui-button--loading': props.loading },
    ]);
    const componentAttributes = computed(() => {
      if (isLink.value) {
        const linkAttributes = { ...attrs, href: props.href };
        if (!isDisabled.value) return linkAttributes;
        return { ...linkAttributes, 'aria-disabled': 'true', tabindex: -1 };
      }
      return { ...attrs, type: props.type, disabled: isDisabled.value };
    });
    const hasIconBefore = computed(() => Boolean(slots.iconBefore));
    const hasIconAfter = computed(() => Boolean(slots.iconAfter));

    function onButtonClick(event) {
      if (isDisabled.value) {
        event.preventDefault();
        return;
      }
      emit('click', event);
    }

    return {
      buttonClasses,
      component,
      componentAttributes,
      hasIconAfter,
      hasIconBefore,
      onButtonClick,
    };
  },
};
