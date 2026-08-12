import { UiButton, UiPageLayout } from '@ui';
import { computed } from 'vue';

import { lessonCountWord } from '../../../../../shared/format.js';
import AttentionPanel from '../../attention-panel/index.vue';
import DaySummary from '../../day-summary/index.vue';
import DayTimeline from '../../day-timeline/index.vue';
import { useDashboardBridge } from './composables/index.js';

function hoursWord(hours) {
  const mod10 = hours % 10;
  const mod100 = hours % 100;
  if (mod10 === 1 && mod100 !== 11) return 'час';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'часа';
  return 'часов';
}

export default {
  name: 'DashboardPage',
  components: { AttentionPanel, DaySummary, DayTimeline, UiButton, UiPageLayout },
  setup() {
    const { model } = useDashboardBridge();

    const statsLabel = computed(() => {
      const { lessons, hours } = model.value.stats;
      if (!lessons) return 'Занятий на сегодня нет';
      return `${lessons} ${lessonCountWord(lessons)} · ${hours} ${hoursWord(hours)} практики`;
    });

    return { model, statsLabel };
  },
};
