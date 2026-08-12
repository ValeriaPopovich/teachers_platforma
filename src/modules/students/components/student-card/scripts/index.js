import { UiIcon } from '@icons';
import { UiBadge, UiCard, UiMenu, UiTooltip } from '@ui';
import { computed } from 'vue';

import { STUDENT_CARD_MENU_ITEMS, STUDENT_PAYMENT_BADGE_VARIANTS } from './constants.js';

export default {
  name: 'StudentCard',
  components: { UiBadge, UiCard, UiIcon, UiMenu, UiTooltip },
  props: {
    /** Подготовленные данные карточки ученика. */
    row: { type: Object, required: true },
  },
  setup(props) {
    const studentId = computed(() => props.row.student.id);
    const studentName = computed(() => props.row.student.name);
    const grade = computed(() => props.row.student.grade || 'Класс не указан');
    const cardClass = computed(() => `student-card-${props.row.payment.kind}`);
    const paymentClass = computed(() => `is-${props.row.payment.kind}`);
    const badgeVariant = computed(
      () => STUDENT_PAYMENT_BADGE_VARIANTS[props.row.payment.kind] ?? 'neutral',
    );
    const hasLessonUrl = computed(() => Boolean(props.row.lessonUrl));
    const optionsLabel = computed(() => `Опции ученика ${studentName.value}`);
    const openCardLabel = computed(() => `Открыть карточку: ${studentName.value}`);
    const videoCallLabel = computed(() => `Открыть видеозвонок ученика ${studentName.value}`);
    const addVideoCallLabel = computed(() => `Добавить видеозвонок для ${studentName.value}`);
    const menuItems = STUDENT_CARD_MENU_ITEMS;

    function handleInteractiveClick(event) {
      event.stopPropagation();
    }

    return {
      addVideoCallLabel,
      badgeVariant,
      cardClass,
      grade,
      hasLessonUrl,
      handleInteractiveClick,
      menuItems,
      openCardLabel,
      optionsLabel,
      paymentClass,
      studentId,
      videoCallLabel,
    };
  },
};
