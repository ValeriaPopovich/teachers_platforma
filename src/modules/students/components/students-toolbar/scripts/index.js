import { UiButton, UiInput } from '@ui';
import { computed } from 'vue';

import { openNewGroup, openNewStudent } from '../../../students-ui.js';
import { STUDENT_FILTER_OPTIONS } from './constants.js';

export default {
  name: 'StudentsToolbar',
  components: { UiButton, UiInput },
  props: {
    /** Текущий поисковый запрос. */
    query: { type: String, default: '' },
    /** Активный фильтр списка учеников. */
    filter: { type: String, default: 'all' },
  },
  emits: ['update:query', 'update:filter'],
  setup(props, { emit }) {
    const filters = computed(() =>
      STUDENT_FILTER_OPTIONS.map((filter) => ({
        ...filter,
        classes: { 'is-active': props.filter === filter.value },
        isActive: props.filter === filter.value,
      })),
    );

    function onFilterButtonClick(value) {
      emit('update:filter', value);
    }

    function onSearchInput(value) {
      emit('update:query', value);
    }

    return { filters, onFilterButtonClick, onSearchInput, openNewGroup, openNewStudent };
  },
};
