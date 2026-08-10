import { $, escapeHtml } from '../../shared/dom.js';
import { formatTime } from '../../shared/format.js';
import { calendarViewRange, extendAllSchedules } from './schedule.domain.js';
import { lessonName, uniqueSessions } from './schedule.selectors.js';
import { createLessonFormView } from './lesson-form.view.js';

function statusLabel(status) {
  return ({ planned: 'Запланировано', unconfirmed: 'Подтвердить', done: 'Проведено', missed: 'Пропуск', paid_missed: 'Пропуск · оплачено', moved: 'Перенесено', cancelled: 'Отменено' })[status] || status;
}

export function createScheduleView({ store, service, modal, dialog, toast }) {
  let calendarView = 'week';
  let anchorDate = new Date();
  const lessonForm = createLessonFormView({ store, service, modal, dialog, toast });

  function render() {
    const calendar = $('#calendar');
    if (!calendar) return;
    const state = store.getState();
    const { start, days } = calendarViewRange(calendarView, anchorDate);
    const sessions = uniqueSessions(state.lessons);
    calendar.className = `calendar-days calendar-${calendarView}`;
    calendar.innerHTML = Array.from({ length: days }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      const lessons = sessions.filter((lesson) => String(lesson.date).slice(0, 10) === key).sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const events = state.events.filter((event) => String(event.date).slice(0, 10) === key).sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const entries = [
        ...lessons.map((lesson) => ({ time: lesson.date, html: `<button type="button" class="calendar-item lesson-item status-${lesson.status}" data-lesson="${lesson.seriesId || lesson.id}"><span class="calendar-item-time">${formatTime(lesson.date)}</span><b>${escapeHtml(lessonName(state, lesson))}</b><small>${escapeHtml(statusLabel(lesson.status))}</small></button>` })),
        ...events.map((event) => ({ time: event.date, html: `<button type="button" class="calendar-item event-item" data-event="${event.id}"><span class="calendar-item-time">${formatTime(event.date)}</span><b>${escapeHtml(event.title)}</b><small>Личное событие</small></button>` })),
      ].sort((a, b) => String(a.time).localeCompare(String(b.time)));
      return `<section class="calendar-day ${key === new Date().toISOString().slice(0, 10) ? 'today' : ''}" data-date="${key}"><header><b>${day.toLocaleDateString('ru-RU', { weekday: 'short' })}</b><span>${day.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</span></header><div class="calendar-day-items">${entries.length ? entries.map((entry) => entry.html).join('') : '<span class="calendar-empty">—</span>'}</div></section>`;
    }).join('');
    $('#calendarViewSwitch')?.querySelectorAll('[data-calendar-view]').forEach((button) => {
      const active = button.dataset.calendarView === calendarView;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  $('#calendar')?.addEventListener('click', (event) => {
    const lessonId = event.target.closest('[data-lesson]')?.dataset.lesson;
    if (lessonId) lessonForm.openLesson(lessonId);
    const eventId = event.target.closest('[data-event]')?.dataset.event;
    if (eventId) lessonForm.openEvent(eventId);
  });
  $('#calendarViewSwitch')?.addEventListener('click', (event) => {
    const view = event.target.closest('[data-calendar-view]')?.dataset.calendarView;
    if (!view) return;
    calendarView = view;
    render();
  });

  return {
    render,
    openNewLesson: lessonForm.openNew,
    openLesson: lessonForm.openLesson,
    openEvent: lessonForm.openEvent,
    deleteLesson: async (id) => {
      if (!(await dialog.ask('Удалить занятие? Связанный с ним платёж также будет удалён.', 'Удаление занятия', 'Удалить'))) return false;
      const result = service.removeLesson(id);
      if (result.ok) toast('Занятие удалено');
      return result.ok;
    },
    extendSchedules(uid) {
      const next = extendAllSchedules(store.getState(), { uid });
      store.replace(next, 'schedule:extend');
    },
  };
}
