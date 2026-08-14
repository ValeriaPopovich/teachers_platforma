import { UiCollapse, UiHint, UiModal } from '@ui';
import { useConfirmDiscard } from '@use';
import { computed, reactive, ref, watch } from 'vue';

import { dialog, toast } from '../../../../../shared/app-ui.js';
import { formatDate, formatTime } from '../../../../../shared/format.js';
import { useAppState } from '../../../../../state/use-app-state.js';
import { calendarConflicts, groupLessonRecords } from '../../../schedule.selectors.js';
import { scheduleService } from '../../../schedule.service.js';
import { closeLessonForm, deleteLesson, lessonFormUi } from '../../../schedule-ui.js';
import { HOMEWORK_GRADE_OPTIONS, LESSON_KIND_OPTIONS, LESSON_STATUS_OPTIONS } from './constants.js';
import { defaultHomeworkGrade } from './form-defaults.js';
import { testResultError } from './validation.js';
import { lessonFieldVisibility } from './visibility.js';

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const BLANK_FORM = () => ({
  id: '',
  targetId: '',
  date: '',
  duration: 60,
  lessonKind: 'oneoff',
  status: 'planned',
  movedTo: '',
  amount: '',
  topics: '',
  homework: '',
  comment: '',
  nextNote: '',
  testName: '',
  testScore: '',
  testMax: '',
  homeworkGrade: '',
});

export default {
  name: 'LessonForm',
  components: { UiCollapse, UiHint, UiModal },
  setup() {
    const state = useAppState();
    const form = reactive(BLANK_FORM());
    const attendance = ref([]);
    const testDoneToggle = ref(false);
    const previousHomeworkToggle = ref(false);
    const lessonPaymentToggle = ref(false);
    const conflictMessage = ref('');
    const parentMessage = ref('');

    const isEditing = computed(() => Boolean(form.id));
    const targetInfo = computed(() => {
      const [type, id] = String(form.targetId || '').split(':');
      return type === 'g'
        ? { type, id, group: state.value.groups.find((group) => group.id === id) }
        : { type, id, student: state.value.students.find((student) => student.id === id) };
    });
    const groupMode = computed(() => targetInfo.value.type === 'g');
    const modalTitle = computed(() => {
      if (!isEditing.value) return 'Занятие';
      const info = targetInfo.value;
      if (info.group) return `Группа: ${info.group.name}`;
      return info.student?.name || 'Редактировать занятие';
    });
    const modalSubtitle = computed(() => {
      if (!isEditing.value || !form.date) return '';
      return `Редактировать занятие · ${formatDate(form.date)}, ${formatTime(form.date)}`;
    });
    const isPackage = computed(() => {
      const info = targetInfo.value;
      if (info.student) return info.student.payType === 'package';
      if (!info.group) return false;
      return (info.group.members || []).every(
        (id) => state.value.students.find((item) => item.id === id)?.payType === 'package',
      );
    });
    const testScoreError = computed(() =>
      testResultError(form.testScore, form.testMax, testDoneToggle.value),
    );

    // Набор полей зависит от статуса: правила собраны в lessonFieldVisibility.
    const visible = computed(() =>
      lessonFieldVisibility({
        status: form.status,
        lessonKind: form.lessonKind,
        groupMode: groupMode.value,
        hasStudent: !!targetInfo.value.student,
      }),
    );
    const showMovedTo = computed(() => visible.value.movedTo);
    const showAttendance = computed(() => visible.value.attendance);
    const showTopics = computed(() => visible.value.topics);
    const showPreviousHomework = computed(() => visible.value.previousHomework);
    const showReportFields = computed(() => visible.value.report);
    const showParentMessage = computed(() => visible.value.parentMessage);
    const showLessonAmountField = computed(() => visible.value.amount);
    const showLessonPaymentField = computed(() => visible.value.payment);
    const lessonPaymentLabel = 'Оплата за это занятие уже поступила';
    const lessonPaymentHint = computed(() =>
      isPackage.value
        ? 'Включайте только для отдельной оплаты сверх абонемента: обычные занятия списываются с баланса сами.'
        : 'Включите, если деньги за занятие уже получены — платёж добавится в историю оплат.',
    );

    const attendanceChips = computed(() => {
      const group = targetInfo.value.group;
      if (!group) return [];
      return (group.members || [])
        .map((id) => state.value.students.find((item) => item.id === id))
        .filter(Boolean)
        .map((student) => ({ id: student.id, name: student.name }));
    });

    const lessonContext = computed(() => {
      const info = targetInfo.value;
      if (!info.id) return '';
      const currentDate = new Date(form.date || Date.now());
      const previous = state.value.lessons
        .filter(
          (lesson) =>
            new Date(lesson.date) < currentDate &&
            lesson.status === 'done' &&
            (info.type === 'g'
              ? lesson.groupId === info.id
              : lesson.studentId === info.id && !lesson.groupId),
        )
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      const current = state.value.lessons.find(
        (lesson) => lesson.id === form.id || lesson.seriesId === form.id,
      );
      const parts = [];
      if (previous?.homework) parts.push(`Предыдущее ДЗ: ${previous.homework}`);
      if (previous?.topics) parts.push(`Последняя тема: ${previous.topics}`);
      if (current?.prepNote) parts.push(`Подготовить к уроку: ${current.prepNote}`);
      return parts.join(' · ');
    });

    function computeParentMessage() {
      const info = targetInfo.value;
      if (!info.student) return '';
      const details = [
        form.topics.trim() ? `Разобрали: ${form.topics.trim()}.` : '',
        form.comment.trim(),
        form.homework.trim() ? `Новое домашнее задание: ${form.homework.trim()}.` : '',
        previousHomeworkToggle.value
          ? `Предыдущее домашнее задание оценено на ${form.homeworkGrade}.`
          : '',
        testDoneToggle.value
          ? `Проверочная работа: ${form.testName.trim() || 'выполнена'}${
              form.testScore && form.testMax ? ` — ${form.testScore} из ${form.testMax}` : ''
            }.`
          : '',
      ].filter(Boolean);
      return [
        'Здравствуйте!',
        ['done', 'paid_missed'].includes(form.status)
          ? `Сегодня занятие с ${info.student.name} прошло${form.status === 'done' ? ' по плану' : ', но ученик отсутствовал'}.`
          : `Сообщаю о занятии с ${info.student.name}.`,
        ...details,
      ].join(' ');
    }

    watch(
      [
        () => form.targetId,
        () => form.topics,
        () => form.comment,
        () => form.homework,
        () => form.status,
        () => form.testName,
        () => form.testScore,
        () => form.testMax,
        () => form.homeworkGrade,
        testDoneToggle,
        previousHomeworkToggle,
      ],
      () => {
        parentMessage.value = computeParentMessage();
      },
    );

    watch(previousHomeworkToggle, (enabled) => {
      form.homeworkGrade = defaultHomeworkGrade(enabled, form.homeworkGrade);
    });

    // Prefill the amount from the student's price once, like the legacy form did.
    watch(
      () => targetInfo.value.student,
      (student) => {
        if (student && !form.amount) form.amount = +student.price || 0;
      },
    );

    watch(
      () => [targetInfo.value.student, targetInfo.value.group],
      ([student, group]) => {
        if (!isEditing.value && !lessonFormUi.duration && (student || group))
          form.duration = +(student || group).duration || 60;
      },
    );

    const confirmDiscard = useConfirmDiscard({
      ask: dialog.ask,
      snapshot: () => ({
        ...form,
        attendance: attendance.value,
        testDoneToggle: testDoneToggle.value,
        previousHomeworkToggle: previousHomeworkToggle.value,
        lessonPaymentToggle: lessonPaymentToggle.value,
      }),
    });

    function populateNew() {
      Object.assign(form, BLANK_FORM());
      form.date = lessonFormUi.date || toLocalInput(new Date());
      form.duration = +lessonFormUi.duration || 60;
      form.targetId = lessonFormUi.studentId
        ? `s:${lessonFormUi.studentId}`
        : lessonFormUi.groupId
          ? `g:${lessonFormUi.groupId}`
          : '';
      attendance.value = [];
      testDoneToggle.value = false;
      previousHomeworkToggle.value = false;
      lessonPaymentToggle.value = false;
      conflictMessage.value = '';
      parentMessage.value = computeParentMessage();
    }

    function populateEdit(lesson) {
      const records = groupLessonRecords(state.value, lesson);
      const representative = records.find((item) => item.status === 'done') || lesson;
      Object.assign(form, BLANK_FORM(), {
        id: lesson.seriesId || lesson.id,
        targetId: lesson.groupId ? `g:${lesson.groupId}` : `s:${lesson.studentId}`,
        date: String(lesson.date).slice(0, 16),
        duration:
          +lesson.duration ||
          +(lesson.groupId
            ? state.value.groups.find((group) => group.id === lesson.groupId)?.duration
            : state.value.students.find((student) => student.id === lesson.studentId)?.duration) ||
          60,
        lessonKind: representative.lessonKind || 'oneoff',
        status: representative.status || 'planned',
        amount: representative.amount ?? '',
        topics: representative.topics || '',
        homework: representative.homework || '',
        comment: representative.comment || '',
        nextNote: representative.nextNote || '',
        testName: representative.testName || '',
        testScore: representative.testScore || '',
        testMax: representative.testMax || '',
        homeworkGrade: representative.homeworkGrade || '',
      });
      testDoneToggle.value = representative.testDone === 'yes';
      previousHomeworkToggle.value =
        (representative.previousHomework ||
          (representative.homeworkGrade !== '' && representative.homeworkGrade != null
            ? 'yes'
            : 'no')) === 'yes';
      lessonPaymentToggle.value = representative.payment === 'paid';
      const selectedAttendance = records
        .filter((item) => item.status === 'done')
        .map((item) => item.studentId);
      attendance.value =
        lesson.groupId && selectedAttendance.length === 0 && representative.status === 'planned'
          ? attendanceChips.value.map((member) => member.id)
          : selectedAttendance;
      conflictMessage.value = '';
      parentMessage.value = computeParentMessage();
    }

    // Следим и за lessonId: открыть другое занятие поверх уже открытой формы
    // (из карточки ученика в дашборд) должно перезаполнить поля.
    watch(
      () => [lessonFormUi.open, lessonFormUi.lessonId],
      () => {
        if (!lessonFormUi.open) return;
        const lesson = lessonFormUi.lessonId
          ? state.value.lessons.find(
              (item) =>
                item.id === lessonFormUi.lessonId || item.seriesId === lessonFormUi.lessonId,
            )
          : null;
        if (lesson) populateEdit(lesson);
        else populateNew();
        confirmDiscard.arm();
      },
    );

    function onAttendanceToggle(studentId) {
      const index = attendance.value.indexOf(studentId);
      if (index >= 0) attendance.value.splice(index, 1);
      else attendance.value.push(studentId);
    }

    async function onFormSubmit() {
      if (testScoreError.value) {
        dialog.inform(testScoreError.value, 'Проверьте результат', true);
        return;
      }
      if (form.status === 'moved' && !form.movedTo) {
        dialog.inform('Укажите новую дату и время переноса.', 'Не указана дата переноса', true);
        return;
      }
      const duration = +form.duration || 60;
      const conflicts = calendarConflicts(state.value, form.date, duration, {
        excludeLesson: form.id,
      });
      if (
        conflicts.length &&
        !(await dialog.ask(
          `В это время уже есть: ${conflicts.join(', ')}. Всё равно сохранить занятие?`,
          'Пересечение в расписании',
          'Сохранить',
        ))
      )
        return;
      const input = {
        ...form,
        amount: +form.amount || 0,
        attendance: attendance.value,
        testDone: testDoneToggle.value ? 'yes' : 'no',
        previousHomework: previousHomeworkToggle.value ? 'yes' : 'no',
        lessonPaymentChoice: lessonPaymentToggle.value ? 'paid' : 'unpaid',
      };
      const result = scheduleService.saveLesson(input);
      if (!result.ok) {
        dialog.inform(result.message || 'Не удалось сохранить занятие.', 'Проверьте данные', true);
        return;
      }
      confirmDiscard.disarm();
      closeLessonForm();
      toast('Занятие сохранено');
    }

    async function onDeleteButtonClick() {
      if (await deleteLesson(form.id)) {
        confirmDiscard.disarm();
        closeLessonForm();
      }
    }

    async function onCopyParentMessageClick() {
      if (!parentMessage.value) return;
      await navigator.clipboard.writeText(parentMessage.value);
      toast('Сообщение скопировано');
    }

    function onModalClose() {
      closeLessonForm();
    }

    return {
      attendance,
      attendanceChips,
      conflictMessage,
      confirmDiscard,
      form,
      groupMode,
      homeworkGradeOptions: HOMEWORK_GRADE_OPTIONS,
      isEditing,
      isPackage,
      lessonContext,
      lessonFormUi,
      lessonKindOptions: LESSON_KIND_OPTIONS,
      modalSubtitle,
      modalTitle,
      lessonPaymentHint,
      lessonPaymentLabel,
      lessonPaymentToggle,
      onAttendanceToggle,
      onCopyParentMessageClick,
      onDeleteButtonClick,
      onFormSubmit,
      onModalClose,
      parentMessage,
      previousHomeworkToggle,
      showAttendance,
      showLessonAmountField,
      showLessonPaymentField,
      showMovedTo,
      showParentMessage,
      showPreviousHomework,
      showReportFields,
      showTopics,
      statusOptions: LESSON_STATUS_OPTIONS,
      students: computed(() => state.value.students),
      groups: computed(() => state.value.groups),
      targetInfo,
      testDoneToggle,
      testScoreError,
    };
  },
};
