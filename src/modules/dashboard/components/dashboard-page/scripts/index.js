import { UiIcon } from '@icons';
import { UiButton, UiEmptyState, UiPageLayout } from '@ui';
import { computed } from 'vue';

import { lessonCountWord } from '../../../../../shared/format.js';
import { useMinuteNow } from '../../../../../shared/minute-clock.js';
import { RETENTION_DAYS } from '../../../../../state/app-store.js';
import { useAppState } from '../../../../../state/use-app-state.js';
import { openNewLesson } from '../../../../schedule/schedule-ui.js';
import { openNewStudent } from '../../../../students/students-ui.js';
import { buildDashboard } from '../../../dashboard.selectors.js';
import AttentionPanel from '../../attention-panel/index.vue';
import DaySummary from '../../day-summary/index.vue';
import DayTimeline from '../../day-timeline/index.vue';

function hoursWord(hours) {
  const mod10 = hours % 10;
  const mod100 = hours % 100;
  if (mod10 === 1 && mod100 !== 11) return 'час';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'часа';
  return 'часов';
}

export default {
  name: 'DashboardPage',
  components: {
    AttentionPanel,
    DaySummary,
    DayTimeline,
    UiButton,
    UiEmptyState,
    UiIcon,
    UiPageLayout,
  },
  setup() {
    const state = useAppState();
    const now = useMinuteNow();
    const model = computed(() =>
      buildDashboard(state.value, { now: now.value, retentionDays: RETENTION_DAYS }),
    );

    const statsLabel = computed(() => {
      const { lessons, hours } = model.value.stats;
      if (!lessons) return 'Занятий на сегодня нет';
      return `${lessons} ${lessonCountWord(lessons)} · ${hours} ${hoursWord(hours)} практики`;
    });

    const hasStudents = computed(() => state.value.students.length > 0);
    return {
      hasStudents,
      model,
      onAddLessonButtonClick: () => openNewLesson(),
      openNewStudent,
      statsLabel,
    };
  },
};
