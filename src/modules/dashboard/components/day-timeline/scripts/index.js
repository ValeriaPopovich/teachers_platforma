import { UiBadge, UiCard } from '@ui';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

export default {
  name: 'DayTimeline',
  components: { UiBadge, UiCard },
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
      if (row.isPast) return 'bead--done';
      if (row.lessons.some((lesson) => lesson.kind === 'next')) return 'bead--next';
      return 'bead--planned';
    }

    function onItemClick(item) {
      window.dispatchEvent(
        new CustomEvent(
          item.type === 'event' ? 'app:dashboard-open-event' : 'app:dashboard-open-lesson',
          { detail: { id: item.id } },
        ),
      );
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

    return { beadClass, isScrollable, onItemClick, onScroll, rowKey, scrollEl, showScrollHint };
  },
};
