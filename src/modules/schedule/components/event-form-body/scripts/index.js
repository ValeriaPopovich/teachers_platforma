import { useConfirmDiscard } from '@use';
import { computed, reactive, watch } from 'vue';

import { dialog, toast } from '../../../../../shared/app-ui.js';
import { useAppState } from '../../../../../state/use-app-state.js';
import { calendarConflicts } from '../../../schedule.selectors.js';
import { scheduleService } from '../../../schedule.service.js';

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function endDateFrom(start, duration = 60) {
  if (!start) return '';
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return '';
  return toLocalInput(new Date(date.getTime() + duration * 60000));
}

const BLANK_FORM = () => ({ id: '', title: '', date: '', endDate: '', duration: 60, note: '' });

export default {
  name: 'EventFormBody',
  props: {
    event: { type: Object, default: null },
    defaultDate: { type: String, default: '' },
    defaultDuration: { type: Number, default: 60 },
  },
  emits: ['close-request', 'dirty-change'],
  setup(props, { emit, expose }) {
    const state = useAppState();
    const form = reactive(BLANK_FORM());

    const isEditing = computed(() => Boolean(form.id));
    const submitLabel = computed(() =>
      isEditing.value ? 'Сохранить событие' : 'Добавить в расписание',
    );

    const confirmDiscard = useConfirmDiscard({ ask: dialog.ask, snapshot: () => ({ ...form }) });
    watch(
      () => confirmDiscard.isDirty(),
      (dirty) => emit('dirty-change', dirty),
      { immediate: true },
    );

    function populate() {
      if (props.event) {
        const date = toLocalInput(props.event.date);
        Object.assign(form, BLANK_FORM(), props.event, {
          date,
          endDate: endDateFrom(date, +props.event.duration || 60),
        });
      } else {
        const date = props.defaultDate || toLocalInput(new Date());
        Object.assign(form, BLANK_FORM(), {
          date,
          endDate: endDateFrom(date, props.defaultDuration || 60),
          duration: props.defaultDuration || 60,
        });
      }
      confirmDiscard.arm();
    }
    populate();
    watch(() => [props.event, props.defaultDate, props.defaultDuration], populate);

    async function onFormSubmit() {
      const duration = Math.round((new Date(form.endDate) - new Date(form.date)) / 60000);
      if (!Number.isFinite(duration) || duration < 5) {
        dialog.inform(
          'Конец должен быть минимум на 5 минут позже начала.',
          'Проверьте время',
          true,
        );
        return;
      }
      form.duration = duration;
      const conflicts = calendarConflicts(state.value, form.date, duration, {
        excludeEvent: form.id,
      });
      if (
        conflicts.length &&
        !(await dialog.ask(
          `В это время уже есть: ${conflicts.join(', ')}. Всё равно добавить событие?`,
          'Пересечение в расписании',
          'Добавить',
        ))
      )
        return;
      const result = scheduleService.saveEvent(form);
      if (!result.ok) {
        dialog.inform(result.message || 'Не удалось сохранить событие.', 'Проверьте данные', true);
        return;
      }
      confirmDiscard.disarm();
      toast('Событие сохранено');
      emit('close-request');
    }

    async function onDeleteButtonClick() {
      if (!form.id || !(await dialog.ask('Удалить событие?', 'Удаление события', 'Удалить')))
        return;
      scheduleService.removeEvent(form.id);
      confirmDiscard.disarm();
      toast('Событие удалено');
      emit('close-request');
    }

    expose({ isDirty: () => confirmDiscard.isDirty() });

    return { form, isEditing, submitLabel, onFormSubmit, onDeleteButtonClick };
  },
};
