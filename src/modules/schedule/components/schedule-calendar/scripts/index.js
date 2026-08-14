import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

import { formatTime, localDay } from '../../../../../shared/format.js';
import { SCHEDULE_HOUR_HEIGHT } from '../../../schedule.selectors.js';
import { openEvent, openLesson } from '../../../schedule-ui.js';

const MONTH_WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const SNAP_MINUTES = 15;

function offsetFromPointer(event, rect) {
  return (
    Math.round(((event.clientY - rect.top) / SCHEDULE_HOUR_HEIGHT) * (60 / SNAP_MINUTES)) *
    SNAP_MINUTES
  );
}

function buildDraft(date, startOffset, duration) {
  const starts = new Date(`${date}T00:00:00`);
  starts.setMinutes(starts.getMinutes() + startOffset);
  const ends = new Date(starts.getTime() + duration * 60000);
  return {
    date,
    value: `${date}T${formatTime(starts)}`,
    top: startOffset * (SCHEDULE_HOUR_HEIGHT / 60),
    duration,
    height: duration * (SCHEDULE_HOUR_HEIGHT / 60),
    label: formatTime(starts),
    endLabel: formatTime(ends),
  };
}

export default {
  name: 'ScheduleCalendar',
  props: {
    /** Текущий режим отображения календаря. */
    view: { type: String, required: true },
    /** Модель дня/недели — из buildScheduleTimeline, актуальна вне месячного вида. */
    timeline: { type: Object, default: null },
    /** Модель месяца — из buildScheduleMonth, актуальна в месячном виде. */
    month: { type: Array, default: () => [] },
    /** Выбранный день в формате YYYY-MM-DD. */
    selectedDateKey: { type: String, required: true },
    /** Черновой слот, выделяемый перетаскиванием по таймлайну. */
    draftSlot: { type: Object, default: null },
  },
  emits: ['update:selectedDateKey', 'update:anchorDate', 'update:draftSlot', 'request-create'],
  setup(props, { emit, expose }) {
    const calendarRoot = ref(null);
    const hoveredColumnKey = ref('');
    const hoverSlot = ref(null);
    const rememberedScrollTop = ref(null);
    const timelineScrollEl = ref(null);
    let programmaticScroll = false;
    let selectionDrag = null;

    function selectDate(key) {
      emit('update:draftSlot', null);
      emit('update:selectedDateKey', key);
      emit('update:anchorDate', new Date(`${key}T12:00:00`));
    }

    function onEntryClick(entry) {
      if (entry.type === 'event') openEvent(entry.id);
      else openLesson(entry.id);
    }

    function onColumnMouseMove(event, column) {
      if (event.target.closest('.timeline-event, .timeline-draft')) {
        hoveredColumnKey.value = '';
        hoverSlot.value = null;
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const minutes = Math.max(0, Math.min(24 * 60 - 60, offsetFromPointer(event, rect)));
      hoveredColumnKey.value = column.key;
      hoverSlot.value = buildDraft(column.key, minutes, 60);
    }

    function onCalendarMouseLeave() {
      hoveredColumnKey.value = '';
      hoverSlot.value = null;
    }

    function onColumnPointerDown(event, column) {
      if (event.target.closest('.timeline-event, .timeline-draft')) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const rect = event.currentTarget.getBoundingClientRect();
      const startOffset = Math.max(0, Math.min(24 * 60 - 60, offsetFromPointer(event, rect)));
      emit('update:selectedDateKey', column.key);
      emit('update:anchorDate', new Date(`${column.key}T12:00:00`));
      selectionDrag = {
        pointerId: event.pointerId,
        startY: event.clientY,
        rect,
        date: column.key,
        startOffset,
        moved: false,
      };
      emit('update:draftSlot', buildDraft(column.key, startOffset, 60));
    }

    function onDocumentPointerMove(event) {
      if (!selectionDrag || event.pointerId !== selectionDrag.pointerId) return;
      if (Math.abs(event.clientY - selectionDrag.startY) < 4 && !selectionDrag.moved) return;
      selectionDrag.moved = true;
      const currentOffset = Math.max(
        0,
        Math.min(24 * 60, offsetFromPointer(event, selectionDrag.rect)),
      );
      const start = Math.min(selectionDrag.startOffset, currentOffset);
      const end = Math.max(selectionDrag.startOffset, currentOffset);
      emit('update:draftSlot', buildDraft(selectionDrag.date, start, Math.max(15, end - start)));
    }

    function finishSelectionDrag(event) {
      if (!selectionDrag || event.pointerId !== selectionDrag.pointerId) return;
      selectionDrag = null;
      if (props.draftSlot) emit('request-create', props.draftSlot);
    }

    onMounted(() => {
      document.addEventListener('pointermove', onDocumentPointerMove);
      document.addEventListener('pointerup', finishSelectionDrag);
      document.addEventListener('pointercancel', finishSelectionDrag);
    });
    onBeforeUnmount(() => {
      document.removeEventListener('pointermove', onDocumentPointerMove);
      document.removeEventListener('pointerup', finishSelectionDrag);
      document.removeEventListener('pointercancel', finishSelectionDrag);
    });

    function onTimelineScrollRef(el) {
      if (!el) return;
      timelineScrollEl.value = el;
      const initialHour =
        props.selectedDateKey === localDay(new Date()) ? Math.max(0, new Date().getHours() - 2) : 8;
      const target = rememberedScrollTop.value ?? initialHour * SCHEDULE_HOUR_HEIGHT;
      el.scrollTop = target;
      requestAnimationFrame(() => {
        if (el.isConnected) el.scrollTop = target;
      });
    }
    function onTimelineScroll(event) {
      if (!programmaticScroll) rememberedScrollTop.value = event.target.scrollTop;
    }

    async function scrollToCurrent({ fromStart = false } = {}) {
      await nextTick();
      const behavior = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth';
      if (props.view === 'month') {
        const today = calendarRoot.value?.querySelector(`[data-date="${localDay(new Date())}"]`);
        if (!today) return;
        const rootRect = calendarRoot.value.getBoundingClientRect();
        const todayRect = today.getBoundingClientRect();
        if (todayRect.top < rootRect.top || todayRect.bottom > rootRect.bottom) {
          today.scrollIntoView({ behavior, block: 'nearest' });
        }
        return;
      }
      const element = timelineScrollEl.value;
      if (!element) return;
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      const target = Math.max(0, minutes * (SCHEDULE_HOUR_HEIGHT / 60) - element.clientHeight / 3);
      programmaticScroll = true;
      if (fromStart && behavior === 'smooth') {
        element.scrollTop = 0;
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      element.scrollTo({ top: target, behavior });
      rememberedScrollTop.value = target;
      setTimeout(() => (programmaticScroll = false), behavior === 'smooth' ? 500 : 0);
    }

    expose({ scrollToCurrent });

    return {
      calendarRoot,
      hoveredColumnKey,
      hoverSlot,
      MONTH_WEEKDAYS,
      onCalendarMouseLeave,
      onColumnMouseMove,
      onColumnPointerDown,
      onEntryClick,
      onTimelineScroll,
      onTimelineScrollRef,
      scrollToCurrent,
      selectDate,
    };
  },
};
