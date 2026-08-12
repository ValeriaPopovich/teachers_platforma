import { computed } from 'vue';

export default {
  name: 'GroupsEmptyState',
  props: {
    /** Причина отображения пустого состояния групп. */
    reason: {
      type: String,
      required: true,
      validator: (value) => ['initial', 'filtered'].includes(value),
    },
  },
  setup(props) {
    const showDetails = computed(() => props.reason === 'filtered');
    const rootClass = computed(() => (showDetails.value ? 'students-empty' : 'empty'));
    return { rootClass, showDetails };
  },
};
