import { UiIcon } from '@icons';
import { UiModal } from '@ui';
import { computed, ref, watch } from 'vue';

import { dialog, toast } from '../../../../../shared/app-ui.js';
import { safeExternalUrl } from '../../../../../shared/dom.js';
import { formatDate, money } from '../../../../../shared/format.js';
import { useAppState } from '../../../../../state/use-app-state.js';
import { finances } from '../../../../payments/finances.js';
import { deleteLesson, openLesson, openNewLesson } from '../../../../schedule/schedule-ui.js';
import {
  getStudentById,
  getStudentLessonHistory,
  getStudentMetrics,
  homeworkGrade,
  parentDetails,
  scheduleText,
} from '../../../students.selectors.js';
import { studentsService } from '../../../students.service.js';
import { closeStudentProfile, openEditStudent, studentProfileUi } from '../../../students-ui.js';
import { LESSON_STATUS_LABELS } from './constants.js';

export default {
  name: 'StudentProfile',
  components: { UiIcon, UiModal },
  setup() {
    const state = useAppState();
    const activeTab = ref('overview');

    const student = computed(() =>
      studentProfileUi.studentId ? getStudentById(state.value, studentProfileUi.studentId) : null,
    );
    const metrics = computed(() =>
      student.value ? getStudentMetrics(state.value, student.value.id) : null,
    );
    const lessons = computed(() =>
      student.value ? getStudentLessonHistory(state.value, student.value.id) : [],
    );
    const testsCount = computed(
      () =>
        lessons.value.filter((lesson) => lesson.status === 'done' && lesson.testDone === 'yes')
          .length,
    );
    const next = computed(() => {
      if (!student.value) return null;
      return (
        state.value.lessons
          .filter(
            (lesson) =>
              lesson.studentId === student.value.id &&
              lesson.status === 'planned' &&
              new Date(lesson.date) > new Date(),
          )
          .sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null
      );
    });
    const nextDateLabel = computed(() =>
      next.value ? formatDate(next.value.date, true) : 'Ближайшее занятие не запланировано',
    );
    const nextNoteLabel = computed(() => next.value?.prepNote || 'Пометки пока нет');
    const lessonUrl = computed(() =>
      student.value ? safeExternalUrl(student.value.lessonLink) : '',
    );
    const paymentFormatLabel = computed(() =>
      student.value?.payType === 'package' ? 'Абонемент' : 'Разовая оплата',
    );
    const lastLesson = computed(() => lessons.value.at(-1) || null);
    const homeworkLabel = computed(() =>
      metrics.value?.homework == null
        ? '—'
        : `${String(metrics.value.homework).replace('.', ',')}/5`,
    );
    const topicLogEntries = computed(() =>
      student.value
        ? [...(state.value.topicLog[student.value.id] || [])].sort((a, b) => b.d.localeCompare(a.d))
        : [],
    );

    watch(
      () => studentProfileUi.open,
      (open) => {
        if (open) activeTab.value = 'overview';
      },
    );
    // Close the profile if the underlying student was removed elsewhere.
    watch(student, (value) => {
      if (studentProfileUi.open && !value) closeStudentProfile();
    });

    function statusLabel(value) {
      return LESSON_STATUS_LABELS[value] || 'Статус не указан';
    }

    function onEditButtonClick() {
      if (!student.value) return;
      // Profile and edit form are two independent modals (own open/close
      // state each) — closing the profile explicitly is what makes the new
      // one look like a single step instead of stacking on top of it.
      closeStudentProfile();
      openEditStudent(student.value.id);
    }

    function onAddLessonButtonClick() {
      if (!student.value) return;
      closeStudentProfile();
      openNewLesson({ studentId: student.value.id });
    }

    async function onDeleteButtonClick() {
      if (!student.value) return;
      if (
        !(await dialog.ask(
          `Удалить ученика «${student.value.name}», его занятия и платежи? Это действие нельзя отменить.`,
          'Удаление ученика',
          'Удалить',
        ))
      )
        return;
      studentsService.removeStudent(student.value.id);
      toast('Ученик удалён');
      closeStudentProfile();
    }

    function onHistoryRowClick(lessonId) {
      closeStudentProfile();
      openLesson(lessonId);
    }

    async function onDeleteHistoryLessonClick(lessonId) {
      await deleteLesson(lessonId);
    }

    return {
      activeTab,
      homeworkLabel,
      homeworkGrade,
      parentDetails,
      lastLesson,
      lessonUrl,
      lessons,
      metrics,
      money,
      formatDate,
      nextDateLabel,
      nextNoteLabel,
      onAddLessonButtonClick,
      onDeleteButtonClick,
      onDeleteHistoryLessonClick,
      onEditButtonClick,
      onHistoryRowClick,
      paymentFormatLabel,
      scheduleText,
      statusLabel,
      student,
      studentProfileUi,
      testsCount,
      topicLogEntries,
      finance: computed(() => (student.value ? finances(state.value, student.value.id) : null)),
      closeStudentProfile,
    };
  },
};
