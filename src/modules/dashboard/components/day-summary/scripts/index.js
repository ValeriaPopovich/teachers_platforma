import { UiCard } from '@ui';
import { computed } from 'vue';

import { money } from '../../../../../shared/format.js';

const RING_RADIUS = 30;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default {
  name: 'DaySummary',
  components: { UiCard },
  props: {
    /** Прогресс проведённых занятий за день. */
    progress: { type: Object, default: () => ({ done: 0, total: 0, percent: 0 }) },
    /** Доход за текущий месяц. */
    income: { type: Object, default: () => ({ received: 0, goal: 0 }) },
    /** Количество занятий и часов на сегодня. */
    statsLabel: { type: String, default: '' },
  },
  setup(props) {
    const ringCircumference = RING_CIRCUMFERENCE.toFixed(1);
    const ringOffset = computed(() =>
      (RING_CIRCUMFERENCE * (1 - (props.progress.percent || 0) / 100)).toFixed(1),
    );
    const progressLabel = computed(
      () =>
        `Проведено ${props.progress.done}, осталось ${props.progress.total - props.progress.done}`,
    );
    const receivedLabel = computed(() => money(props.income.received));
    const hasGoal = computed(() => props.income.goal > 0);
    const goalLabel = computed(() => money(props.income.goal));
    const goalStyle = computed(() => {
      const ratio = props.income.goal ? Math.min(1, props.income.received / props.income.goal) : 0;
      return { width: `${Math.round(ratio * 100)}%` };
    });

    return {
      goalLabel,
      goalStyle,
      hasGoal,
      progressLabel,
      receivedLabel,
      ringCircumference,
      ringOffset,
    };
  },
};
