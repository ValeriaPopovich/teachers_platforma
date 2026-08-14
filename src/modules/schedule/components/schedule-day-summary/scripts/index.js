import { formatTime, localDay } from '../../../../../shared/format.js';
import { useAppState } from '../../../../../state/use-app-state.js';
import { openNewStudent } from '../../../../students/students-ui.js';
import { scheduleCreationMoment } from '../../../schedule.selectors.js';
import { openEvent, openLesson, openNewLesson } from '../../../schedule-ui.js';

export default {
  name: 'ScheduleDaySummary',
  setup() {
    return { state: useAppState() };
  },
  props: {
    /** Заголовок и секции занятий/дел выбранного дня — из buildScheduleSummary. */
    summary: { type: Object, required: true },
    /** Выбранный день в формате YYYY-MM-DD. */
    selectedDateKey: { type: String, required: true },
  },
  methods: {
    onItemClick(item) {
      if (item.type === 'event') openEvent(item.id);
      else openLesson(item.id);
    },
    onAddButtonClick(type) {
      if (type === 'lesson') {
        if (!this.state.students.length) {
          openNewStudent();
          return;
        }
        openNewLesson({ date: `${this.selectedDateKey}T09:00` });
        return;
      }
      const chosen = scheduleCreationMoment(this.selectedDateKey);
      openEvent('', `${localDay(chosen)}T${formatTime(chosen)}`, 60);
    },
  },
};
