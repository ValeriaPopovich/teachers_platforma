import { $, escapeHtml } from '../../shared/dom.js';
import { formatTime, localDay } from '../../shared/format.js';
import { calendarViewRange } from './schedule.domain.js';
import { lessonName, uniqueSessions } from './schedule.selectors.js';
import { createLessonFormView } from './lesson-form.view.js';

function statusLabel(status) {
  return (
    {
      planned: 'Запланировано',
      unconfirmed: 'Подтвердить',
      done: 'Проведено',
      missed: 'Пропуск',
      paid_missed: 'Пропуск · оплачено',
      moved: 'Перенесено',
      cancelled: 'Отменено',
    }[status] || status
  );
}

export function createScheduleView({ store, service, modal, dialog, toast }) {
  let calendarView = 'week';
  const savedCalendarView = sessionStorage.getItem('tutorCabinet_calendarView');
  if (['day', 'week', 'month'].includes(savedCalendarView)) calendarView = savedCalendarView;
  let anchorDate = new Date();
  const lessonForm = createLessonFormView({ store, service, modal, dialog, toast });

  function render() {
    const calendar = $('#calendar');
    if (!calendar) return;
    const state = store.getState();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { start, days } = calendarViewRange(calendarView, anchorDate);
    const sessions = uniqueSessions(state.lessons);
    const weekdayHeads =
      calendarView === 'day'
        ? [today.toLocaleDateString('ru-RU', { weekday: 'short' })]
        : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    calendar.className = 'calendar-days';
    calendar.dataset.calendarView = calendarView;
    calendar.innerHTML =
      weekdayHeads.map((day) => `<div class="calendar-weekday">${day}</div>`).join('') +
      Array.from({ length: days }, (_, index) => {
        const day = new Date(start);
        day.setDate(start.getDate() + index);
        const key = localDay(day);
        const lessons = sessions
          .filter((lesson) => String(lesson.date).slice(0, 10) === key)
          .sort((a, b) => String(a.date).localeCompare(String(b.date)));
        const events = state.events
          .filter((event) => String(event.date).slice(0, 10) === key)
          .sort((a, b) => String(a.date).localeCompare(String(b.date)));
        const entries = [
          ...lessons.map((lesson) => ({
            time: lesson.date,
            html: `<button type="button" class="event event--${lesson.status}" data-lesson="${lesson.seriesId || lesson.id}">${formatTime(lesson.date)} ${escapeHtml(lessonName(state, lesson))}<br><span class="sub">${escapeHtml(statusLabel(lesson.status))}${lesson.lessonKind === 'oneoff' ? ' · разовое' : ''}</span></button>`,
          })),
          ...events.map((event) => ({
            time: event.date,
            html: `<button type="button" class="event custom-event" data-event="${event.id}">${formatTime(event.date)} ${escapeHtml(event.title)}<br><span class="sub">Своё событие · ${event.duration || 60} мин</span></button>`,
          })),
        ].sort((a, b) => String(a.time).localeCompare(String(b.time)));
        const weekday = day.toLocaleDateString('ru-RU', { weekday: 'long' });
        return `<div class="day ${key === localDay(today) ? 'today' : ''} ${day < today ? 'past-day' : ''} ${calendarView === 'month' && day.getMonth() !== anchorDate.getMonth() ? 'outside-month' : ''} ${entries.length ? 'has-events' : ''}" data-date="${key}"><div class="date"><span class="mobile-weekday">${weekday},&nbsp;</span>${day.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</div>${entries.map((entry) => entry.html).join('')}</div>`;
      }).join('');
    $('#calendarViewSwitch')
      ?.querySelectorAll('[data-calendar-view]')
      .forEach((button) => {
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
    sessionStorage.setItem('tutorCabinet_calendarView', view);
    render();
  });

  return {
    render,
    openNewLesson: lessonForm.openNew,
    openLesson: lessonForm.openLesson,
    openEvent: lessonForm.openEvent,
    deleteLesson: async (id) => {
      if (
        !(await dialog.ask(
          'Удалить занятие? Связанный с ним платёж также будет удалён.',
          'Удаление занятия',
          'Удалить',
        ))
      )
        return false;
      const result = service.removeLesson(id);
      if (result.ok) toast('Занятие удалено');
      return result.ok;
    },
  };
}
