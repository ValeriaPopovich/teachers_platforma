import { UiIcon } from '@icons';
import { UiButton, UiInput } from '@ui';
import { computed, ref } from 'vue';

import { STUDENT_FILTER_OPTIONS } from './constants.js';

export default {
  name: 'StudentsToolbar',
  components: { UiButton, UiIcon, UiInput },
  setup() {
    const query = ref('');
    const activeFilter = ref('all');
    const filters = computed(() =>
      STUDENT_FILTER_OPTIONS.map((filter) => ({
        ...filter,
        classes: { 'is-active': activeFilter.value === filter.value },
        isActive: activeFilter.value === filter.value,
      })),
    );

    function onFilterButtonClick(value) {
      activeFilter.value = value;
    }

    return { filters, onFilterButtonClick, query };
  },
};
