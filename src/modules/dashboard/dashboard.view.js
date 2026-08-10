import { $, escapeHtml } from '../../shared/dom.js';
import { formatTime, localDay } from '../../shared/format.js';
import { lessonName, uniqueSessions } from '../schedule/schedule.selectors.js';

const STATUS_LABELS = {
  planned: 'Запланировано',
  unconfirmed: 'Заполнить занятие',
  done: 'Проведено',
  missed: 'Пропуск',
  paid_missed: 'Пропуск с оплатой',
  moved: 'Перенесено',
  cancelled: 'Отменено',
};

export function createDashboardView({ store, openLesson, retentionDays = 45 }) {
  const page = $('#page-dashboard');
  let bound = false;

  function rows(state, list, empty) {
    return list.length
      ? list
          .map(
            (lesson) =>
              `<button type="button" class="list-row lesson-row" data-open-lesson="${lesson.seriesId || lesson.id}"><span><b>${escapeHtml(lessonName(state, lesson))}</b><small>${formatTime(lesson.date)} · ${escapeHtml(STATUS_LABELS[lesson.status] || lesson.status)}</small></span><span>→</span></button>`,
          )
          .join('')
      : `<div class="empty">${empty}</div>`;
  }

  function bind() {
    if (bound || !page) return;
    bound = true;
    page.addEventListener('click', (event) => {
      const id = event.target.closest('[data-open-lesson]')?.dataset.openLesson;
      if (id) openLesson?.(id);
      if (event.target.closest('[data-scroll-unfilled]'))
        $('#unfilledSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function render() {
    bind();
    const state = store.getState();
    const now = new Date();
    const today = localDay(now);
    const sessions = uniqueSessions(state.lessons);
    const upcoming = sessions
      .filter(
        (lesson) =>
          String(lesson.date).slice(0, 10) === today &&
          ['planned', 'unconfirmed'].includes(lesson.status) &&
          new Date(lesson.date) >= now,
      )
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const completed = sessions
      .filter(
        (lesson) =>
          String(lesson.date).slice(0, 10) === today &&
          ['done', 'missed', 'paid_missed', 'moved', 'cancelled', 'unconfirmed'].includes(
            lesson.status,
          ) &&
          new Date(lesson.date) < now,
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const cutoff = Date.now() - retentionDays * 86400000;
    const unfilled = sessions
      .filter(
        (lesson) =>
          new Date(lesson.date).getTime() >= cutoff &&
          new Date(lesson.date) < now &&
          (lesson.status === 'unconfirmed' ||
            (lesson.status === 'done' && lesson.reportFilled === false)),
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    if ($('#hello'))
      $('#hello').textContent =
        `${now.getHours() < 12 ? 'Доброе утро' : now.getHours() < 18 ? 'Добрый день' : 'Добрый вечер'}${state.settings.tutor ? `, ${state.settings.tutor}` : ''}!`;
    if ($('#todayText'))
      $('#todayText').textContent = now.toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    if ($('#upcoming'))
      $('#upcoming').innerHTML = rows(
        state,
        upcoming,
        'На сегодня больше нет предстоящих занятий.',
      );
    if ($('#todayCompleted'))
      $('#todayCompleted').innerHTML = rows(state, completed, 'Сегодня ещё нет прошедших занятий.');
    if ($('#unfilledLessons'))
      $('#unfilledLessons').innerHTML = rows(state, unfilled, 'Все прошедшие занятия заполнены.');
    if ($('#dashboardUnfilledAlert'))
      $('#dashboardUnfilledAlert').innerHTML = unfilled.length
        ? `<button type="button" class="notice" data-scroll-unfilled>Незаполненных занятий: <b>${unfilled.length}</b></button>`
        : '';
  }

  return { render };
}
