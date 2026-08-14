import { SCHEDULE_DAY_OPTIONS } from './constants.js';

export default {
  name: 'ScheduleSlotsField',
  props: {
    /** Список слотов регулярного расписания: { day, time }. */
    modelValue: { type: Array, default: () => [] },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const dayOptions = SCHEDULE_DAY_OPTIONS;

    function updateSlot(index, patch) {
      emit(
        'update:modelValue',
        props.modelValue.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)),
      );
    }

    function onAddSlotButtonClick() {
      emit('update:modelValue', [...props.modelValue, { day: 1, time: '17:00' }]);
    }

    function onRemoveSlotButtonClick(index) {
      emit(
        'update:modelValue',
        props.modelValue.filter((_, i) => i !== index),
      );
    }

    return { dayOptions, onAddSlotButtonClick, onRemoveSlotButtonClick, updateSlot };
  },
};
