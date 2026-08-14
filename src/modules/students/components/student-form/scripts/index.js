import { UiHint, UiModal } from '@ui';
import { useConfirmDiscard } from '@use';
import { computed, reactive, ref, watch } from 'vue';

import { dialog, toast } from '../../../../../shared/app-ui.js';
import { lessonCountWord, localDay, money } from '../../../../../shared/format.js';
import { useAppState } from '../../../../../state/use-app-state.js';
import { countMonthlyRecurringLessonsFrom } from '../../../../schedule/schedule.domain.js';
import { ownSlotConflict, recurringConflicts } from '../../../../schedule/schedule.selectors.js';
import { getStudentById, parentDetails } from '../../../students.selectors.js';
import { studentsService } from '../../../students.service.js';
import { closeStudentForm, studentFormUi } from '../../../students-ui.js';
import ScheduleSlotsField from '../../schedule-slots-field/index.vue';
import { BUILTIN_GOALS, GRADE_OPTIONS } from './constants.js';

const BLANK_FORM = () => ({
  id: '',
  name: '',
  grade: '',
  contact: '',
  parentDetails: '',
  lessonLink: '',
  price: '',
  duration: 60,
  payType: 'single',
  billingStartDate: localDay(),
  paused: false,
  notes: '',
  scheduleSlots: [],
});

export default {
  name: 'StudentForm',
  components: { ScheduleSlotsField, UiHint, UiModal },
  setup() {
    const state = useAppState();
    const form = reactive(BLANK_FORM());
    const selectedGoals = ref([]);
    const customGoalInput = ref('');

    const editingStudent = computed(() => (form.id ? getStudentById(state.value, form.id) : null));
    const isEditing = computed(() => Boolean(editingStudent.value));
    const modalTitle = computed(() =>
      editingStudent.value ? 'Редактировать ученика' : 'Новый ученик',
    );
    const billingFieldVisible = computed(() => form.payType === 'package' && !editingStudent.value);
    const billingStartHint = computed(() => {
      if (form.payType !== 'package' || editingStudent.value) return '';
      const start = form.billingStartDate
        ? form.billingStartDate === localDay()
          ? Date.now()
          : new Date(`${form.billingStartDate}T00:00`).getTime()
        : Date.now();
      const count = countMonthlyRecurringLessonsFrom(form.scheduleSlots, new Date(start), start);
      return form.scheduleSlots.length
        ? `${count} ${lessonCountWord(count)} · ${money(count * (+form.price || 0))}`
        : 'Добавьте регулярное расписание — сумма рассчитается автоматически';
    });

    const goalOptions = computed(() => {
      const settings = state.value.settings || {};
      const deleted = new Set(settings.deletedGoals || []);
      const unknown = selectedGoals.value.filter(
        (goal) => !BUILTIN_GOALS.includes(goal) && !(settings.customGoals || []).includes(goal),
      );
      const custom = [...new Set([...(settings.customGoals || []), ...unknown])];
      const all = [...BUILTIN_GOALS.filter((goal) => !deleted.has(goal)), ...custom];
      return [...all].sort(
        (a, b) => Number(selectedGoals.value.includes(b)) - Number(selectedGoals.value.includes(a)),
      );
    });

    const confirmDiscard = useConfirmDiscard({
      ask: dialog.ask,
      snapshot: () => ({ ...form, scheduleSlots: form.scheduleSlots, goals: selectedGoals.value }),
    });

    function populate() {
      const student = studentFormUi.studentId
        ? getStudentById(state.value, studentFormUi.studentId)
        : null;
      if (student) {
        Object.assign(form, {
          id: student.id,
          name: student.name || '',
          grade: student.grade || '',
          contact: student.contact || '',
          parentDetails: parentDetails(student),
          lessonLink: student.lessonLink || '',
          price: student.price ?? '',
          duration: student.duration ?? 60,
          payType: student.payType || 'single',
          billingStartDate: localDay(),
          paused: student.status === 'paused',
          notes: student.notes || '',
          scheduleSlots: (student.scheduleSlots || []).map((slot) => ({ ...slot })),
        });
        selectedGoals.value = String(student.goals || '')
          .split(',')
          .map((goal) => goal.trim())
          .filter(Boolean);
      } else {
        Object.assign(form, BLANK_FORM());
        selectedGoals.value = [];
      }
      customGoalInput.value = '';
      confirmDiscard.arm();
    }

    watch(
      () => studentFormUi.open,
      (open) => {
        if (open) populate();
      },
    );

    function onGoalToggle(goal) {
      const index = selectedGoals.value.indexOf(goal);
      if (index >= 0) selectedGoals.value.splice(index, 1);
      else selectedGoals.value.push(goal);
    }

    async function onRemoveGoalButtonClick(goal) {
      if (selectedGoals.value.includes(goal)) return;
      if (
        !(await dialog.ask(
          `Удалить цель «${goal}» из списка? Она также будет убрана у учеников, которым назначена.`,
          'Удаление цели',
          'Удалить',
        ))
      )
        return;
      studentsService.removeGoal(goal, BUILTIN_GOALS);
      toast('Цель удалена');
    }

    function onCustomGoalKeydown(event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const value = customGoalInput.value.trim();
      if (!value) return;
      const existing = goalOptions.value.find((goal) => goal.toLowerCase() === value.toLowerCase());
      if (existing) {
        if (!selectedGoals.value.includes(existing)) selectedGoals.value.push(existing);
      } else {
        studentsService.addCustomGoal(value);
        selectedGoals.value.push(value);
      }
      customGoalInput.value = '';
      toast('Цель выбрана');
    }

    function slotWarnings(input) {
      const own = ownSlotConflict(input.scheduleSlots, input.duration);
      const conflicts = recurringConflicts(
        state.value,
        input.scheduleSlots,
        input.duration,
        'student',
        input.id,
      );
      return [
        own ? `занятия ${own} пересекаются между собой` : '',
        conflicts.length ? `время пересекается с: ${conflicts.join(', ')}` : '',
      ].filter(Boolean);
    }

    async function onFormSubmit() {
      const input = {
        ...form,
        price: +form.price || 0,
        duration: +form.duration || 60,
        status: form.paused ? 'paused' : 'active',
        goals: selectedGoals.value.join(', '),
      };
      delete input.paused;
      const warnings = slotWarnings(input);
      const result = studentsService.saveStudent(input, { today: localDay() });
      if (!result.ok) {
        dialog.inform(result.message || 'Не удалось сохранить ученика.', 'Проверьте данные', true);
        return;
      }
      confirmDiscard.disarm();
      closeStudentForm();
      toast(
        warnings.length
          ? `Сохранено. Внимание: ${warnings.join('; ')}`
          : form.paused
            ? 'Ученик на паузе, будущие занятия сняты с расписания'
            : 'Ученик и расписание сохранены',
      );
    }

    function onModalClose() {
      closeStudentForm();
    }

    return {
      confirmDiscard,
      billingFieldVisible,
      billingStartHint,
      customGoalInput,
      form,
      goalOptions,
      gradeOptions: GRADE_OPTIONS,
      isEditing,
      modalTitle,
      onCustomGoalKeydown,
      onFormSubmit,
      onGoalToggle,
      onModalClose,
      onRemoveGoalButtonClick,
      selectedGoals,
      studentFormUi,
    };
  },
};
