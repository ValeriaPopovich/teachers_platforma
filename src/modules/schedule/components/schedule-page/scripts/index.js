import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { formatTime, localDay } from '../../../../../shared/format.js';
import { useMinuteNow } from '../../../../../shared/minute-clock.js';
import { useAppState } from '../../../../../state/use-app-state.js';
import { calendarViewRange, shiftCalendarAnchor } from '../../../schedule.domain.js';
import {
  buildScheduleMonth,
  buildSchedulePeriodLabel,
  buildScheduleSummary,
  buildScheduleTimeline,
  scheduleCreationMoment,
  uniqueSessions,
} from '../../../schedule.selectors.js';
import { createSheetUi, eventFormUi, lessonFormUi, openCreateSheet } from '../../../schedule-ui.js';
import ScheduleCalendar from '../../schedule-calendar/index.vue';
import ScheduleCreateSheet from '../../schedule-create-sheet/index.vue';
import ScheduleDaySummary from '../../schedule-day-summary/index.vue';
import ScheduleForms from '../../schedule-forms/index.vue';

const VIEW_STORAGE_KEY = 'tutorCabinet_calendarView';
const VALID_VIEWS = ['day', 'week', 'month'];

function initialView() {
  const saved = sessionStorage.getItem(VIEW_STORAGE_KEY);
  return VALID_VIEWS.includes(saved) ? saved : 'week';
}

export default {
  name: 'SchedulePage',
  components: { ScheduleCalendar, ScheduleCreateSheet, ScheduleDaySummary, ScheduleForms },
  setup() {
    const state = useAppState();
    const now = useMinuteNow();
    const calendarRef = ref(null);
    const view = ref(initialView());
    const anchorDate = ref(new Date());
    const selectedDateKey = ref(localDay(anchorDate.value));
    const draftSlot = ref(null);
    const creationFlowOpen = computed(
      () => createSheetUi.open || lessonFormUi.open || eventFormUi.open,
    );

    // The drag selection is only a preview for the create flow. Keep it visible
    // while the choice sheet/form is open, then remove it after save or cancel
    // so it cannot overlap the newly persisted calendar entry.
    watch(creationFlowOpen, (isOpen, wasOpen) => {
      if (wasOpen && !isOpen) draftSlot.value = null;
    });

    const sessions = computed(() => uniqueSessions(state.value.lessons));
    const range = computed(() => calendarViewRange(view.value, anchorDate.value));
    const isMonthView = computed(() => view.value === 'month');
    const periodLabel = computed(() => buildSchedulePeriodLabel(view.value, anchorDate.value));
    const timeline = computed(() =>
      isMonthView.value
        ? null
        : buildScheduleTimeline(state.value, sessions.value, {
            start: range.value.start,
            days: range.value.days,
            selectedDateKey: selectedDateKey.value,
            now: now.value,
          }),
    );
    const month = computed(() =>
      isMonthView.value
        ? buildScheduleMonth(state.value, sessions.value, {
            start: range.value.start,
            days: range.value.days,
            anchorMonth: anchorDate.value.getMonth(),
            selectedDateKey: selectedDateKey.value,
            now: now.value,
          })
        : [],
    );
    const summary = computed(() =>
      buildScheduleSummary(state.value, sessions.value, selectedDateKey.value, now.value),
    );

    async function setView(next) {
      if (view.value === next) return;
      view.value = next;
      sessionStorage.setItem(VIEW_STORAGE_KEY, next);
      if (next === 'week') {
        await nextTick();
        calendarRef.value?.scrollToCurrent({ fromStart: true });
      }
    }
    function moveCalendar(direction) {
      anchorDate.value = shiftCalendarAnchor(
        view.value,
        anchorDate.value,
        direction === 'next' ? 1 : -1,
      );
    }
    function goToday() {
      anchorDate.value = new Date();
      selectedDateKey.value = localDay(anchorDate.value);
      draftSlot.value = null;
    }
    async function onPageChange(event) {
      if (event.detail?.page !== 'schedule') return;
      goToday();
      await nextTick();
      calendarRef.value?.scrollToCurrent();
    }

    onMounted(() => window.addEventListener('app:page-change', onPageChange));
    onBeforeUnmount(() => window.removeEventListener('app:page-change', onPageChange));
    function openCreateSheetFromSlot(slot) {
      openCreateSheet({ date: slot.value, duration: slot.duration });
    }
    function onToolbarAddButtonClick() {
      if (draftSlot.value) {
        openCreateSheetFromSlot(draftSlot.value);
        return;
      }
      const chosen = scheduleCreationMoment(selectedDateKey.value);
      openCreateSheetFromSlot({ value: `${localDay(chosen)}T${formatTime(chosen)}`, duration: 60 });
    }

    return {
      anchorDate,
      calendarRef,
      draftSlot,
      goToday,
      isMonthView,
      month,
      moveCalendar,
      onCalendarRequestCreate: openCreateSheetFromSlot,
      onToolbarAddButtonClick,
      periodLabel,
      selectedDateKey,
      setView,
      summary,
      timeline,
      view,
    };
  },
};
