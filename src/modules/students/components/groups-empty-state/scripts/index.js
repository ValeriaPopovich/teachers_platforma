import { UiButton, UiEmptyState } from '@ui';
import { computed } from 'vue';

import { useAppState } from '../../../../../state/use-app-state.js';
import { openNewGroup, openNewStudent } from '../../../students-ui.js';

export default {
  name: 'GroupsEmptyState',
  components: { UiButton, UiEmptyState },
  props: {
    /** Причина отображения пустого состояния групп. */
    reason: {
      type: String,
      required: true,
      validator: (value) => ['initial', 'filtered'].includes(value),
    },
  },
  setup(props) {
    const state = useAppState();
    const hasStudents = computed(() => state.value.students.length > 0);
    const content = computed(() =>
      props.reason === 'filtered'
        ? { title: 'Группы не найдены', description: 'Попробуйте изменить поисковый запрос' }
        : {
            title: 'Групп пока нет',
            description: hasStudents.value
              ? 'Объедините учеников с общим расписанием и стоимостью'
              : 'Сначала добавьте ученика, затем его можно будет включить в группу',
            action: hasStudents.value ? '+ Добавить группу' : '+ Добавить ученика',
          },
    );
    function onActionClick() {
      if (hasStudents.value) openNewGroup();
      else openNewStudent();
    }
    return { content, onActionClick };
  },
};
