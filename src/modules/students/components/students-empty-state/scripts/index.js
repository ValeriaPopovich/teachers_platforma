import { UiButton } from '@ui';
import { computed } from 'vue';

import { STUDENTS_EMPTY_CONTENT } from './constants.js';

export default {
  name: 'StudentsEmptyState',
  components: { UiButton },
  props: {
    /** Причина отображения пустого состояния. */
    reason: {
      type: String,
      required: true,
      validator: (value) => Object.hasOwn(STUDENTS_EMPTY_CONTENT, value),
    },
  },
  setup(props) {
    const content = computed(() => STUDENTS_EMPTY_CONTENT[props.reason]);
    const showAction = computed(() => props.reason === 'initial');
    return { content, showAction };
  },
};
