import { $, $$, escapeHtml } from '../../shared/dom.js';
import { calendarConflicts, groupLessonRecords } from './schedule.selectors.js';

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function createLessonFormView({ store, service, modal, dialog, toast }) {
  const form = $('#lessonForm');
  const eventForm = $('#eventForm');
  if (!form) return {};

  function fillTargets(selected = '') {
    const state = store.getState();
    form.elements.targetId.innerHTML = `<option value="">Выберите...</option>${state.students.map((student) => `<option value="s:${student.id}">${escapeHtml(student.name)}</option>`).join('')}${state.groups.map((group) => `<option value="g:${group.id}">Группа: ${escapeHtml(group.name)}</option>`).join('')}`;
    form.elements.targetId.value = selected;
  }

  function targetInfo() {
    const [type, id] = String(form.elements.targetId.value || '').split(':');
    const state = store.getState();
    return type === 'g'
      ? { type, id, group: state.groups.find((group) => group.id === id) }
      : { type, id, student: state.students.find((student) => student.id === id) };
  }

  function renderAttendance(selected = null) {
    const { group } = targetInfo();
    const wrap = $('#groupAttendance');
    if (!group) { wrap.style.display = 'none'; $('#groupAttendanceMembers').innerHTML = ''; return; }
    wrap.style.display = 'block';
    const state = store.getState();
    const chosen = new Set(selected || group.members || []);
    $('#groupAttendanceMembers').innerHTML = (group.members || []).map((id) => {
      const student = state.students.find((item) => item.id === id);
      return student ? `<label class="member-chip selected"><input type="checkbox" name="attendance" value="${id}" ${chosen.has(id) ? 'checked' : ''}>${escapeHtml(student.name)}</label>` : '';
    }).join('');
  }

  function syncAttendanceChips() {
    $$('#groupAttendanceMembers .member-chip').forEach((chip) => chip.classList.toggle('selected', !!$('input', chip)?.checked));
  }

  function syncFields() {
    const info = targetInfo();
    const student = info.student;
    const isPackage = student?.payType === 'package' || (info.group && (info.group.members || []).every((id) => store.getState().students.find((item) => item.id === id)?.payType === 'package'));
    $('#movedToField').style.display = form.elements.status.value === 'moved' ? 'block' : 'none';
    $('#packageOneoffField').style.display = isPackage && form.elements.lessonKind.value === 'oneoff' ? 'block' : 'none';
    $('#lessonPaymentField').style.display = isPackage ? 'none' : 'block';
    $('#testFields').style.display = $('#testDoneToggle').checked ? 'block' : 'none';
    $('#homeworkGradeField').style.display = $('#previousHomeworkToggle').checked ? 'block' : 'none';
    form.elements.testDone.value = $('#testDoneToggle').checked ? 'yes' : 'no';
    form.elements.previousHomework.value = $('#previousHomeworkToggle').checked ? 'yes' : 'no';
    form.elements.lessonPaymentChoice.value = $('#lessonPaymentToggle').checked ? 'paid' : 'unpaid';
    $('#lessonPaymentLabel').textContent = $('#lessonPaymentToggle').checked ? 'Занятие оплачено' : 'Занятие не оплачено';
    if (student && !form.elements.amount.value) form.elements.amount.value = +student.price || 0;
  }

  function serialize() {
    const fd = new FormData(form);
    const input = Object.fromEntries(fd);
    input.attendance = fd.getAll('attendance');
    input.lessonPaymentChoice = $('#lessonPaymentToggle').checked ? 'paid' : 'unpaid';
    input.testDone = $('#testDoneToggle').checked ? 'yes' : 'no';
    input.previousHomework = $('#previousHomeworkToggle').checked ? 'yes' : 'no';
    input.packageOneoffBilling = $('#packageOneoffBilling').value;
    input.amount = +input.amount || 0;
    return input;
  }

  function openNew({ studentId = '', groupId = '', date = '' } = {}) {
    form.reset();
    form.elements.id.value = '';
    fillTargets(studentId ? `s:${studentId}` : groupId ? `g:${groupId}` : '');
    form.elements.date.value = date || toLocalInput(new Date());
    form.elements.lessonKind.value = 'oneoff';
    form.elements.status.value = 'planned';
    $('#deleteLesson').style.display = 'none';
    $('#lessonModalTitle').textContent = 'Информация о занятии';
    $('#lessonConflict').textContent = '';
    $('#testDoneToggle').checked = false;
    $('#previousHomeworkToggle').checked = false;
    $('#lessonPaymentToggle').checked = false;
    renderAttendance();
    syncFields();
    modal.open('lessonModal');
  }

  function openLesson(id) {
    const state = store.getState();
    const lesson = state.lessons.find((item) => item.id === id || item.seriesId === id);
    if (!lesson) return;
    form.reset();
    const records = groupLessonRecords(state, lesson);
    const representative = records.find((item) => item.status === 'done') || lesson;
    form.elements.id.value = lesson.seriesId || lesson.id;
    fillTargets(lesson.groupId ? `g:${lesson.groupId}` : `s:${lesson.studentId}`);
    const keys = ['date', 'lessonKind', 'status', 'amount', 'topics', 'homework', 'comment', 'nextNote', 'testName', 'testScore', 'testMax'];
    keys.forEach((key) => { if (form.elements[key]) form.elements[key].value = representative[key] ?? ''; });
    form.elements.date.value = String(lesson.date).slice(0, 16);
    $('#testDoneToggle').checked = representative.testDone === 'yes';
    $('#previousHomeworkToggle').checked = false;
    $('#lessonPaymentToggle').checked = representative.payment === 'paid';
    $('#packageOneoffBilling').value = representative.payment === 'paid' ? 'extra_paid' : representative.payment === 'unpaid' ? 'extra_unpaid' : 'package';
    renderAttendance(records.filter((item) => item.status === 'done').map((item) => item.studentId));
    $('#deleteLesson').style.display = 'inline-block';
    $('#lessonModalTitle').textContent = 'Информация о занятии';
    $('#lessonConflict').textContent = '';
    syncFields();
    modal.closeAll();
    modal.open('lessonModal');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    syncFields();
    const input = serialize();
    if (input.status === 'moved' && !input.movedTo) {
      dialog.inform('Укажите новую дату и время переноса.', 'Не указана дата переноса', true);
      return;
    }
    const info = targetInfo();
    const duration = +(info.student?.duration || info.group?.duration || 60);
    const conflicts = calendarConflicts(store.getState(), input.date, duration, { excludeLesson: input.id });
    if (conflicts.length && !(await dialog.ask(`В это время уже есть: ${conflicts.join(', ')}. Всё равно сохранить занятие?`, 'Пересечение в расписании', 'Сохранить'))) return;
    const result = service.saveLesson(input);
    if (!result.ok) { dialog.inform(result.message || 'Не удалось сохранить занятие.', 'Проверьте данные', true); return; }
    modal.closeAll();
    toast('Занятие сохранено');
  });

  $('#deleteLesson').addEventListener('click', async () => {
    const id = form.elements.id.value;
    if (!id || !(await dialog.ask('Удалить занятие? Связанный с ним платёж также будет удалён.', 'Удаление занятия', 'Удалить'))) return;
    const result = service.removeLesson(id);
    if (result.ok) { modal.closeAll(); toast('Занятие удалено'); }
  });
  form.elements.targetId.addEventListener('change', () => { renderAttendance(); syncFields(); });
  form.elements.status.addEventListener('change', syncFields);
  form.elements.lessonKind.addEventListener('change', syncFields);
  $('#testDoneToggle').addEventListener('change', syncFields);
  $('#previousHomeworkToggle').addEventListener('change', syncFields);
  $('#lessonPaymentToggle').addEventListener('change', syncFields);
  $('#groupAttendanceMembers').addEventListener('change', syncAttendanceChips);

  function openEvent(id = '') {
    eventForm.reset();
    eventForm.elements.id.value = '';
    const event = id ? store.getState().events.find((item) => item.id === id) : null;
    if (event) Object.keys(event).forEach((key) => { if (eventForm.elements[key]) eventForm.elements[key].value = event[key] ?? ''; });
    if (!event) eventForm.elements.date.value = toLocalInput(new Date());
    $('#deleteEvent').style.display = event ? 'inline-block' : 'none';
    $('#eventConflict').textContent = '';
    modal.closeAll();
    modal.open('eventModal');
  }

  eventForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(eventForm));
    const conflicts = calendarConflicts(store.getState(), input.date, +input.duration || 60, { excludeEvent: input.id });
    if (conflicts.length && !(await dialog.ask(`В это время уже есть: ${conflicts.join(', ')}. Всё равно добавить событие?`, 'Пересечение в расписании', 'Добавить'))) return;
    const result = service.saveEvent(input);
    if (!result.ok) { dialog.inform(result.message || 'Не удалось сохранить событие.', 'Проверьте данные', true); return; }
    modal.closeAll(); toast('Событие сохранено');
  });
  $('#deleteEvent')?.addEventListener('click', async () => {
    const id = eventForm.elements.id.value;
    if (!id || !(await dialog.ask('Удалить событие?', 'Удаление события', 'Удалить'))) return;
    service.removeEvent(id); modal.closeAll(); toast('Событие удалено');
  });

  return { openNew, openLesson, openEvent };
}
