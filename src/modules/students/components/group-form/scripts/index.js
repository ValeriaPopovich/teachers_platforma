import { UiHint, UiModal } from '@ui';
import { useConfirmDiscard } from '@use';
import { computed, reactive, watch } from 'vue';

import { dialog, toast } from '../../../../../shared/app-ui.js';
import { useAppState } from '../../../../../state/use-app-state.js';
import { ownSlotConflict, recurringConflicts } from '../../../../schedule/schedule.selectors.js';
import { getGroupById } from '../../../students.selectors.js';
import { studentsService } from '../../../students.service.js';
import { closeGroupForm, groupFormUi } from '../../../students-ui.js';
import ScheduleSlotsField from '../../schedule-slots-field/index.vue';

const BLANK_FORM = () => ({
  id: '',
  name: '',
  grade: '',
  duration: 60,
  notes: '',
  members: [],
  scheduleSlots: [],
});

export default {
  name: 'GroupForm',
  components: { ScheduleSlotsField, UiHint, UiModal },
  setup() {
    const state = useAppState();
    const form = reactive(BLANK_FORM());

    const editingGroup = computed(() => (form.id ? getGroupById(state.value, form.id) : null));
    const modalTitle = computed(() =>
      editingGroup.value ? 'Редактировать группу' : 'Новая группа',
    );
    const isEditing = computed(() => Boolean(editingGroup.value));
    const nonPackageMemberNames = computed(() =>
      state.value.students
        .filter((student) => form.members.includes(student.id) && student.payType !== 'package')
        .map((student) => student.name),
    );

    const confirmDiscard = useConfirmDiscard({
      ask: dialog.ask,
      snapshot: () => ({ ...form, members: form.members, scheduleSlots: form.scheduleSlots }),
    });

    function populate() {
      const group = groupFormUi.groupId ? getGroupById(state.value, groupFormUi.groupId) : null;
      if (group) {
        Object.assign(form, {
          id: group.id,
          name: group.name || '',
          grade: group.grade || '',
          duration: group.duration ?? 60,
          notes: group.notes || '',
          members: [...(group.members || [])],
          scheduleSlots: (group.scheduleSlots || []).map((slot) => ({ ...slot })),
        });
      } else {
        Object.assign(form, BLANK_FORM());
      }
      confirmDiscard.arm();
    }

    watch(
      () => groupFormUi.open,
      (open) => {
        if (open && !state.value.students.length) {
          dialog.inform(
            'Сначала добавьте хотя бы одного ученика — участников группы вы будете выбирать из своих учеников.',
            'Нет учеников',
          );
          closeGroupForm();
          return;
        }
        if (open) populate();
      },
    );

    function onMemberToggle(studentId) {
      const index = form.members.indexOf(studentId);
      if (index >= 0) form.members.splice(index, 1);
      else form.members.push(studentId);
    }

    function slotWarnings(input) {
      const own = ownSlotConflict(input.scheduleSlots, input.duration);
      const conflicts = recurringConflicts(
        state.value,
        input.scheduleSlots,
        input.duration,
        'group',
        input.id,
      );
      return [
        own ? `занятия ${own} пересекаются между собой` : '',
        conflicts.length ? `расписание пересекается с: ${conflicts.join(', ')}` : '',
      ].filter(Boolean);
    }

    function onFormSubmit() {
      const input = { ...form, duration: +form.duration || 60 };
      const warnings = slotWarnings(input);
      const result = studentsService.saveGroup(input);
      if (!result.ok) {
        dialog.inform(result.message || 'Не удалось сохранить группу.', 'Проверьте данные', true);
        return;
      }
      confirmDiscard.disarm();
      closeGroupForm();
      toast(
        warnings.length
          ? `Сохранено. Внимание: ${warnings.join('; ')}`
          : 'Группа и расписание на 8 недель сохранены',
      );
    }

    async function onDeleteButtonClick() {
      if (!editingGroup.value) return;
      if (
        !(await dialog.ask(
          `Удалить группу «${editingGroup.value.name}» и все её занятия?`,
          'Удаление группы',
          'Удалить',
        ))
      )
        return;
      studentsService.removeGroup(editingGroup.value.id);
      confirmDiscard.disarm();
      closeGroupForm();
      toast('Группа удалена');
    }

    function onModalClose() {
      closeGroupForm();
    }

    return {
      confirmDiscard,
      form,
      groupFormUi,
      isEditing,
      modalTitle,
      nonPackageMemberNames,
      onDeleteButtonClick,
      onFormSubmit,
      onMemberToggle,
      onModalClose,
      students: computed(() => state.value.students),
    };
  },
};
