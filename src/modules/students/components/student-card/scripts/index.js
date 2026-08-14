import { UiIcon } from '@icons';
import { UiBadge, UiCard, UiMenu, UiTooltip } from '@ui';
import { computed } from 'vue';

import { dialog, toast } from '../../../../../shared/app-ui.js';
import { openPaymentForm } from '../../../../payments/index.js';
import { studentsService } from '../../../students.service.js';
import { openEditStudent, openStudentProfile } from '../../../students-ui.js';
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

    function onCardClick() {
      openStudentProfile(studentId.value);
    }

    function onAddLessonLinkClick(event) {
      event.stopPropagation();
      openEditStudent(studentId.value);
    }

    async function onMenuSelect(action) {
      if (action === 'edit') openEditStudent(studentId.value);
      if (action === 'payment') openPaymentForm(studentId.value);
      if (action === 'delete') {
        if (
          !(await dialog.ask(
            `Удалить ученика «${studentName.value}», его занятия и платежи? Это действие нельзя отменить.`,
            'Удаление ученика',
            'Удалить',
          ))
        )
          return;
        studentsService.removeStudent(studentId.value);
        toast('Ученик удалён');
      }
    }

    return {
      addVideoCallLabel,
      badgeVariant,
      cardClass,
      grade,
      hasLessonUrl,
      handleInteractiveClick,
      menuItems,
      onAddLessonLinkClick,
      onCardClick,
      onMenuSelect,
      openCardLabel,
      optionsLabel,
      paymentClass,
      studentId,
      videoCallLabel,
    };
  },
};
