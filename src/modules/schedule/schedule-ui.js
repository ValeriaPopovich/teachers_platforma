import { reactive } from 'vue';

import { dialog, toast } from '../../shared/app-ui.js';
import { scheduleService } from './schedule.service.js';

// UI-only state for the lesson/event forms, shared across the schedule Vue
// tree and other modules that need to open them (student profile, dashboard).

export const lessonFormUi = reactive({
  open: false,
  lessonId: '',
  studentId: '',
  groupId: '',
  date: '',
  duration: 0,
});
export function openNewLesson({ studentId = '', groupId = '', date = '', duration = 0 } = {}) {
  lessonFormUi.lessonId = '';
  lessonFormUi.studentId = studentId;
  lessonFormUi.groupId = groupId;
  lessonFormUi.date = date;
  lessonFormUi.duration = duration;
  lessonFormUi.open = true;
}
export function openLesson(id) {
  lessonFormUi.lessonId = id;
  lessonFormUi.open = true;
}
export function closeLessonForm() {
  lessonFormUi.open = false;
}

export async function deleteLesson(id) {
  if (
    !(await dialog.ask(
      'Удалить занятие? Связанный с ним платёж также будет удалён.',
      'Удаление занятия',
      'Удалить',
    ))
  )
    return false;
  const result = scheduleService.removeLesson(id);
  if (result.ok) toast('Занятие удалено');
  return result.ok;
}

export const eventFormUi = reactive({ open: false, eventId: '', date: '', duration: 60 });
export function openEvent(id = '', date = '', duration = 60) {
  eventFormUi.eventId = id;
  eventFormUi.date = date;
  eventFormUi.duration = duration;
  eventFormUi.open = true;
}
export function closeEventForm() {
  eventFormUi.open = false;
}

// Choice sheet ("Занятие" / "Дело") shown from the schedule toolbar and from
// a drag-selected slot on the calendar. date/duration are the prefill passed
// to whichever form the user picks.
export const createSheetUi = reactive({ open: false, date: '', duration: 60 });
export function openCreateSheet({ date = '', duration = 60 } = {}) {
  createSheetUi.date = date;
  createSheetUi.duration = duration;
  createSheetUi.open = true;
}
export function closeCreateSheet() {
  createSheetUi.open = false;
}
