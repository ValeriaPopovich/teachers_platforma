import { UiBadge, UiButton, UiCard } from '@ui';
import { computed } from 'vue';

const ICONS = { fill: '⚠️', pay: '💳' };
const MAX_VISIBLE = 2;

export default {
  name: 'AttentionPanel',
  components: { UiBadge, UiButton, UiCard },
  props: {
    /** Список задач, требующих внимания преподавателя. */
    items: { type: Array, default: () => [] },
  },
  setup(props) {
    const maxVisible = MAX_VISIBLE;
    const visibleItems = computed(() => props.items.slice(0, MAX_VISIBLE));

    function iconFor(kind) {
      return ICONS[kind] || '•';
    }

    function onItemAction(item) {
      if (item.kind === 'fill') {
        window.dispatchEvent(
          new CustomEvent('app:dashboard-open-lesson', { detail: { id: item.lessonId } }),
        );
        return;
      }
      window.dispatchEvent(
        new CustomEvent('app:dashboard-open-payment', { detail: { studentId: item.studentId } }),
      );
    }

    return { iconFor, maxVisible, onItemAction, visibleItems };
  },
};
