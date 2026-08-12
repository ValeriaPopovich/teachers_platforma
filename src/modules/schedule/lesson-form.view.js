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
  const notice = $('#lessonForm .notice');
  if (notice && !$('#lessonContext')) {
    const context = document.createElement('div');
    context.id = 'lessonContext';
    context.className = 'notice';
    context.style.display = 'none';
    notice.after(context);
  }

  function fillTargets(selected = '') {
    const state = store.getState();
    form.elements.targetId.innerHTML = `<option value="">Выберите ученика или группу</option>${state.students.map((student) => `<option value="s:${student.id}">${escapeHtml(student.name)}</option>`).join('')}${state.groups.map((group) => `<option value="g:${group.id}">Группа: ${escapeHtml(group.name)}</option>`).join('')}`;
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
    if (!group) {
      wrap.style.display = 'none';
      $('#groupAttendanceMembers').innerHTML = '';
      return;
    }
    wrap.style.display = 'grid';
    const state = store.getState();
    const chosen = new Set(selected || group.members || []);
    $('#groupAttendanceMembers').innerHTML = (group.members || [])
      .map((id) => {
        const student = state.students.find((item) => item.id === id);
        return student
          ? `<label class="member-chip selected"><input type="checkbox" name="attendance" value="${id}" ${chosen.has(id) ? 'checked' : ''}>${escapeHtml(student.name)}</label>`
          : '';
      })
      .join('');
  }

  function syncAttendanceChips() {
    $$('#groupAttendanceMembers .member-chip').forEach((chip) =>
      chip.classList.toggle('selected', !!$('input', chip)?.checked),
    );
  }

  function syncFields() {
    const info = targetInfo();
    const student = info.student;
    const groupMode = info.type === 'g';
    const isPackage =
      student?.payType === 'package' ||
      (info.group &&
        (info.group.members || []).every(
          (id) => store.getState().students.find((item) => item.id === id)?.payType === 'package',
        ));
    $('#movedToField').style.display = form.elements.status.value === 'moved' ? 'grid' : 'none';
    $('#packageOneoffField').style.display =
      isPackage && form.elements.lessonKind.value === 'oneoff' ? 'grid' : 'none';
    const packageOneoff = isPackage && form.elements.lessonKind.value === 'oneoff';
    const packageOneoffHasExtraCharge =
      packageOneoff && $('#packageOneoffBilling').value !== 'package';
    $('#lessonPaymentField').style.display = groupMode || packageOneoff ? 'none' : 'grid';
    $('#lessonAmountField').style.display =
      groupMode || (isPackage && !packageOneoffHasExtraCharge) ? 'none' : 'grid';
    $('#testFields').style.display = $('#testDoneToggle').checked ? 'grid' : 'none';
    const hasPreviousHomework = $('#previousHomeworkToggle').checked;
    $('#homeworkGradeField').style.display = hasPreviousHomework ? 'grid' : 'none';
    form.elements.homeworkGrade.disabled = !hasPreviousHomework;
    form.elements.testDone.value = $('#testDoneToggle').checked ? 'yes' : 'no';
    form.elements.previousHomework.value = hasPreviousHomework ? 'yes' : 'no';
    const paid = $('#lessonPaymentToggle').checked;
    form.elements.lessonPaymentChoice.value = isPackage
      ? paid
        ? 'package'
        : 'not_charged'
      : paid
        ? 'paid'
        : 'unpaid';
    $('#lessonPaymentLabel').textContent = isPackage
      ? 'Списать занятие из абонемента'
      : 'Занятие оплачено';
    $('#lessonPaymentHint').textContent = paid
      ? isPackage
        ? 'Выключите, если занятие списывать не нужно'
        : 'Выключите, если оплата ещё не поступила'
      : isPackage
        ? 'Включите, если занятие нужно списать'
        : 'Включите, если оплата уже поступила';
    if (student && !form.elements.amount.value) form.elements.amount.value = +student.price || 0;
    renderLessonContext();
    refreshParentMessage();
  }

  function renderLessonContext() {
    const box = $('#lessonContext');
    const info = targetInfo();
    if (!box || !info.id) return;
    const currentDate = new Date(form.elements.date.value || Date.now());
    const previous = store
      .getState()
      .lessons.filter(
        (lesson) =>
          new Date(lesson.date) < currentDate &&
          lesson.status === 'done' &&
          (info.type === 'g'
            ? lesson.groupId === info.id
            : lesson.studentId === info.id && !lesson.groupId),
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    const current = store
      .getState()
      .lessons.find(
        (lesson) =>
          lesson.id === form.elements.id.value || lesson.seriesId === form.elements.id.value,
      );
    const parts = [];
    if (previous?.homework) parts.push(`<b>Предыдущее ДЗ:</b> ${escapeHtml(previous.homework)}`);
    if (previous?.topics) parts.push(`<b>Последняя тема:</b> ${escapeHtml(previous.topics)}`);
    if (current?.prepNote)
      parts.push(`<b>Подготовить к уроку:</b> ${escapeHtml(current.prepNote)}`);
    box.innerHTML = parts.join('<br>');
    box.style.display = parts.length ? 'block' : 'none';
  }

  function refreshParentMessage() {
    const field = $('#parentMessageField');
    const output = $('#parentMessage');
    const info = targetInfo();
    if (!field || !output) return;
    field.style.display = info.student ? 'grid' : 'none';
    if (!info.student) return;
    const parent = info.student.parentName?.trim() ? `, ${info.student.parentName.trim()}` : '';
    const details = [
      form.elements.topics.value.trim() ? `Разобрали: ${form.elements.topics.value.trim()}.` : '',
      form.elements.comment.value.trim(),
      form.elements.homework.value.trim()
        ? `Новое домашнее задание: ${form.elements.homework.value.trim()}.`
        : '',
      $('#previousHomeworkToggle').checked
        ? `Предыдущее домашнее задание оценено на ${form.elements.homeworkGrade.value}.`
        : '',
      $('#testDoneToggle').checked
        ? `Проверочная работа: ${form.elements.testName.value.trim() || 'выполнена'}${form.elements.testScore.value && form.elements.testMax.value ? ` — ${form.elements.testScore.value} из ${form.elements.testMax.value}` : ''}.`
        : '',
    ].filter(Boolean);
    output.value = [
      `Здравствуйте${parent}.`,
      ['done', 'paid_missed'].includes(form.elements.status.value)
        ? `Сегодня занятие с ${info.student.name} прошло${form.elements.status.value === 'done' ? ' по плану' : ', но ученик отсутствовал'}.`
        : `Сообщаю о занятии с ${info.student.name}.`,
      ...details,
    ].join(' ');
  }

  function serialize() {
    // targetId is disabled while editing so the user cannot silently transfer an
    // existing lesson to another student/group. Disabled controls are omitted by
    // FormData, therefore capture the owner explicitly before serialization.
    const targetId = form.elements.targetId.value;
    const fd = new FormData(form);
    const input = Object.fromEntries(fd);
    input.targetId = targetId;
    input.attendance = fd.getAll('attendance');
    input.lessonPaymentChoice = form.elements.lessonPaymentChoice.value;
    input.testDone = $('#testDoneToggle').checked ? 'yes' : 'no';
    input.previousHomework = $('#previousHomeworkToggle').checked ? 'yes' : 'no';
    input.packageOneoffBilling = $('#packageOneoffBilling').value;
    input.amount = +input.amount || 0;
    return input;
  }

  function openNew({ studentId = '', groupId = '', date = '' } = {}) {
    form.reset();
    form.elements.targetId.disabled = false;
    form.elements.id.value = '';
    fillTargets(studentId ? `s:${studentId}` : groupId ? `g:${groupId}` : '');
    form.elements.date.value = date || toLocalInput(new Date());
    form.elements.lessonKind.value = 'oneoff';
    form.elements.status.value = 'planned';
    $('#deleteLesson').style.display = 'none';
    $('#lessonModalTitle').textContent = 'Новое разовое занятие';
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
    form.elements.targetId.disabled = true;
    const keys = [
      'date',
      'lessonKind',
      'status',
      'amount',
      'topics',
      'homework',
      'comment',
      'nextNote',
      'testName',
      'testScore',
      'testMax',
      'homeworkGrade',
    ];
    keys.forEach((key) => {
      if (form.elements[key]) form.elements[key].value = representative[key] ?? '';
    });
    form.elements.date.value = String(lesson.date).slice(0, 16);
    $('#testDoneToggle').checked = representative.testDone === 'yes';
    $('#previousHomeworkToggle').checked =
      (representative.previousHomework ||
        (representative.homeworkGrade !== '' && representative.homeworkGrade != null
          ? 'yes'
          : 'no')) === 'yes';
    $('#lessonPaymentToggle').checked = ['paid', 'package'].includes(representative.payment);
    $('#packageOneoffBilling').value =
      representative.payment === 'paid'
        ? 'extra_paid'
        : representative.payment === 'unpaid'
          ? 'extra_unpaid'
          : 'package';
    renderAttendance(
      records.filter((item) => item.status === 'done').map((item) => item.studentId),
    );
    $('#deleteLesson').style.display = 'inline-block';
    $('#lessonModalTitle').textContent = 'Редактировать занятие';
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
    const conflicts = calendarConflicts(store.getState(), input.date, duration, {
      excludeLesson: input.id,
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
    const result = service.saveLesson(input);
    if (!result.ok) {
      dialog.inform(result.message || 'Не удалось сохранить занятие.', 'Проверьте данные', true);
      return;
    }
    modal.closeAll();
    toast('Занятие сохранено');
  });

  $('#deleteLesson').addEventListener('click', async () => {
    const id = form.elements.id.value;
    if (
      !id ||
      !(await dialog.ask(
        'Удалить занятие? Связанный с ним платёж также будет удалён.',
        'Удаление занятия',
        'Удалить',
      ))
    )
      return;
    const result = service.removeLesson(id);
    if (result.ok) {
      modal.closeAll();
      toast('Занятие удалено');
    }
  });
  form.elements.targetId.addEventListener('change', () => {
    renderAttendance();
    syncFields();
  });
  form.elements.status.addEventListener('change', syncFields);
  form.elements.lessonKind.addEventListener('change', syncFields);
  $('#packageOneoffBilling').addEventListener('change', syncFields);
  form.elements.date.addEventListener('change', syncFields);
  $('#testDoneToggle').addEventListener('change', syncFields);
  $('#previousHomeworkToggle').addEventListener('change', syncFields);
  $('#lessonPaymentToggle').addEventListener('change', syncFields);
  $('#groupAttendanceMembers').addEventListener('change', syncAttendanceChips);
  form.addEventListener('input', (event) => {
    if (event.target.id !== 'parentMessage') refreshParentMessage();
  });
  $('#copyParentMessage')?.addEventListener('click', async () => {
    const text = $('#parentMessage')?.value || '';
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast('Сообщение скопировано');
  });

  function openEvent(id = '', date = '', duration = 60) {
    eventForm.reset();
    eventForm.elements.id.value = '';
    const event = id ? store.getState().events.find((item) => item.id === id) : null;
    if (event)
      Object.keys(event).forEach((key) => {
        if (eventForm.elements[key]) eventForm.elements[key].value = event[key] ?? '';
      });
    if (!event) {
      eventForm.elements.date.value = date || toLocalInput(new Date());
      eventForm.elements.duration.value = duration;
    }
    $('#deleteEvent').style.display = event ? 'inline-block' : 'none';
    $('#eventModalTitle').textContent = event ? 'Редактировать событие' : 'Своё событие';
    $('#eventForm button[type="submit"]').textContent = event
      ? 'Сохранить событие'
      : 'Добавить в расписание';
    $('#eventConflict').textContent = '';
    modal.closeAll();
    modal.open('eventModal');
  }

  eventForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(eventForm));
    const conflicts = calendarConflicts(store.getState(), input.date, +input.duration || 60, {
      excludeEvent: input.id,
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
    const result = service.saveEvent(input);
    if (!result.ok) {
      dialog.inform(result.message || 'Не удалось сохранить событие.', 'Проверьте данные', true);
      return;
    }
    modal.closeAll();
    toast('Событие сохранено');
  });
  $('#deleteEvent')?.addEventListener('click', async () => {
    const id = eventForm.elements.id.value;
    if (!id || !(await dialog.ask('Удалить событие?', 'Удаление события', 'Удалить'))) return;
    service.removeEvent(id);
    modal.closeAll();
    toast('Событие удалено');
  });

  return { openNew, openLesson, openEvent };
}
