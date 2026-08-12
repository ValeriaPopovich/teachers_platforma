import { computed } from 'vue';

export default {
  name: 'UiInput',
  inheritAttrs: false,
  props: {
    /** Значение поля для v-model. */
    modelValue: { type: [String, Number], default: '' },
    /** Помечает поле как невалидное. */
    invalid: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    const inputAttributes = computed(() =>
      props.invalid ? { ...attrs, 'aria-invalid': 'true' } : attrs,
    );

    function onInput(event) {
      emit('update:modelValue', event.target.value);
    }

    return { inputAttributes, onInput };
  },
};
