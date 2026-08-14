import { UiIcon } from '@icons';
import { UiCard } from '@ui';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { openEvent, openLesson } from '../../../../schedule/schedule-ui.js';

export default {
  name: 'DayTimeline',
  components: { UiCard, UiIcon },
  props: {
    /** Слоты дня с занятиями и маркером текущего времени. */
    timeline: { type: Array, default: () => [] },
    /** Подпись ближайшего занятия. */
    next: { type: Object, default: null },
  },
  setup(props) {
    const scrollEl = ref(null);
    const isScrollable = ref(false);
    const showScrollHint = ref(false);

    function measure() {
      const el = scrollEl.value;
      if (!el) return;
      const overflow = el.scrollHeight - el.clientHeight > 8;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
      isScrollable.value = overflow;
      showScrollHint.value = overflow && !atBottom;
    }

    function onScroll() {
      measure();
    }

    function rowKey(row, index) {
      return row.kind === 'now' ? `now-${index}` : `slot-${row.time}-${index}`;
    }

    function beadClass(row) {
      const { lessons } = row;
      if (lessons.some((lesson) => lesson.kind === 'in_progress')) return 'bead--in-progress';
      if (lessons.some((lesson) => lesson.kind === 'next')) return 'bead--next';
      if (lessons.some((lesson) => lesson.kind === 'unconfirmed')) return 'bead--unconfirmed';
      if (row.isPast) return 'bead--done';
      return 'bead--planned';
    }

    function onItemClick(item) {
      if (item.type === 'event') openEvent(item.id);
      else openLesson(item.id);
    }

    onMounted(() => {
      measure();
      window.addEventListener('resize', measure);
    });
    onBeforeUnmount(() => window.removeEventListener('resize', measure));
    watch(
      () => props.timeline,
      () => nextTick(measure),
    );

    return {
      beadClass,
      isScrollable,
      onItemClick,
      onScroll,
      rowKey,
      scrollEl,
      showScrollHint,
    };
  },
};
