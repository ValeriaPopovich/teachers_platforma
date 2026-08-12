import { $, escapeHtml } from '../../shared/dom.js';
import { formatTime, localDay } from '../../shared/format.js';
import { calendarViewRange } from './schedule.domain.js';
import { lessonDuration, lessonName, uniqueSessions } from './schedule.selectors.js';
import { createLessonFormView } from './lesson-form.view.js';

const plusIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

export function createScheduleView({ store, service, modal, dialog, toast }) {
  let calendarView = 'week';
  const savedCalendarView = sessionStorage.getItem('tutorCabinet_calendarView');
  if (['day', 'week', 'month'].includes(savedCalendarView)) calendarView = savedCalendarView;
  let anchorDate = new Date();
  let selectedDateKey = localDay(anchorDate);
  let draftSlot = null;
  let selectionDrag = null;
  let timelineScrollTop = null;
  const lessonForm = createLessonFormView({ store, service, modal, dialog, toast });

  function periodLabel() {
    if (calendarView === 'month')
      return anchorDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    if (calendarView === 'day')
      return anchorDate.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    const { start } = calendarViewRange('week', anchorDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const left = start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const right = end.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `${left} — ${right}`;
  }

  function selectedDateTitle(date, today) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const prefix = date.toLocaleDateString('ru-RU', { weekday: 'short' });
    if (localDay(date) === localDay(today)) return 'Сегодня';
    if (localDay(date) === localDay(tomorrow)) return `${prefix} завтра`;
    return date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function renderTodaySummary(state, sessions, today) {
    const summary = $('#scheduleTodaySummary');
    if (!summary) return;
    const selected = new Date(`${selectedDateKey}T12:00:00`);
    const title = $('#scheduleTodayTitle');
    const sidebarAction = $('#scheduleSidebarAction');
    if (draftSlot) {
      if (title) title.textContent = 'Добавить событие';
      if (sidebarAction) {
        sidebarAction.hidden = false;
        delete sidebarAction.dataset.open;
        sidebarAction.dataset.cancelDraft = '';
        sidebarAction.setAttribute('aria-label', 'Закрыть добавление');
        sidebarAction.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
      }
      summary.innerHTML = `<div class="schedule-create-menu"><button type="button" data-create-slot="lesson">Занятие <span>↗</span></button><button type="button" data-create-slot="event">Дело <span>↗</span></button></div>`;
      $('.schedule-today')?.classList.add('is-creating');
      return;
    }
    $('.schedule-today')?.classList.remove('is-creating');
    if (sidebarAction) {
      sidebarAction.hidden = true;
      delete sidebarAction.dataset.cancelDraft;
    }
    if (title) title.textContent = selectedDateTitle(selected, today);
    const entries = entriesForDay(state, sessions, selectedDateKey);
    const lessons = entries.filter((entry) => entry.type === 'lesson');
    const events = entries.filter((entry) => entry.type === 'event');
    const rows = [
      ['Занятия', lessons, 'lesson'],
      ['Дела', events, 'event'],
      ['Заметки', [], 'event'],
    ];
    summary.innerHTML = rows
      .map(([label, items, type]) => {
        const cards = items
          .map((entry) => {
            const starts = new Date(entry.date);
            const ends = new Date(starts.getTime() + entry.duration * 60000);
            const data =
              entry.type === 'lesson' ? `data-lesson="${entry.id}"` : `data-event="${entry.id}"`;
            return `<button type="button" class="schedule-summary-card schedule-summary-card--${entry.type}" ${data}><time>${formatTime(starts)}</time><span><b>${escapeHtml(entry.title)}</b><small>${formatTime(starts)}–${formatTime(ends)}</small>${entry.type === 'lesson' ? `<strong>${Number(entry.amount || 0).toLocaleString('ru-RU')} ₽</strong>` : ''}</span></button>`;
          })
          .join('');
        return `<section class="schedule-summary-section"><div class="schedule-summary-row"><span>${label}</span><b>${items.length}</b><button type="button" data-open="${type}" aria-label="Добавить: ${label.toLowerCase()}">${plusIcon}</button></div>${cards ? `<div class="schedule-summary-cards">${cards}</div>` : ''}</section>`;
      })
      .join('');
  }

  function entriesForDay(state, sessions, key) {
    const lessons = sessions
      .filter((lesson) => String(lesson.date).slice(0, 10) === key)
      .map((lesson) => ({
        id: lesson.seriesId || lesson.id,
        type: 'lesson',
        date: lesson.date,
        duration: lessonDuration(state, lesson),
        title: lessonName(state, lesson),
        status: lesson.status,
        amount: lesson.amount,
      }));
    const events = state.events
      .filter((event) => String(event.date).slice(0, 10) === key)
      .map((event) => ({
        id: event.id,
        type: 'event',
        date: event.date,
        duration: +event.duration || 60,
        title: event.title,
      }));
    return [...lessons, ...events].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  function setDraftRange(date, startOffset, duration) {
    const starts = new Date(`${date}T00:00:00`);
    starts.setMinutes(starts.getMinutes() + startOffset);
    const ends = new Date(starts.getTime() + duration * 60000);
    draftSlot = {
      date,
      value: `${date}T${formatTime(starts)}`,
      top: startOffset * (72 / 60),
      duration,
      height: duration * (72 / 60),
      label: formatTime(starts),
      endLabel: formatTime(ends),
    };
  }

  function renderTimeline(state, sessions, start, days) {
    const hourHeight = 72;
    const startHour = 0;
    const endHour = 24;
    const shownDays = Array.from({ length: days }, (_, index) => {
      const date = new Date(start);
      date.setDate(date.getDate() + index);
      return date;
    });
    const headers = shownDays
      .map(
        (date) =>
          `<button type="button" class="timeline-day-head ${localDay(date) === localDay(new Date()) ? 'is-today' : ''} ${localDay(date) === selectedDateKey ? 'is-selected' : ''}" data-timeline-date="${localDay(date)}"><b>${date.getDate()}</b><span>${date.toLocaleDateString('ru-RU', { weekday: 'short' })}</span></button>`,
      )
      .join('');
    const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
    const labels = hours
      .map(
        (hour) =>
          `<span class="${hour === endHour ? 'is-last' : ''}" style="top:${(hour - startHour) * hourHeight}px">${String(hour % 24).padStart(2, '0')}:00</span>`,
      )
      .join('');
    const lines = hours
      .map((hour) => `<i style="top:${(hour - startHour) * hourHeight}px"></i>`)
      .join('');
    const columns = shownDays
      .map((date) => {
        const key = localDay(date);
        const cards = entriesForDay(state, sessions, key)
          .map((entry) => {
            const starts = new Date(entry.date);
            const top = (starts.getHours() * 60 + starts.getMinutes()) * (hourHeight / 60);
            if (top < 0 || top > (endHour - startHour) * hourHeight) return '';
            const height = Math.max(34, entry.duration * (hourHeight / 60) - 4);
            const data =
              entry.type === 'lesson' ? `data-lesson="${entry.id}"` : `data-event="${entry.id}"`;
            const end = new Date(starts.getTime() + entry.duration * 60000);
            return `<button type="button" class="timeline-event timeline-event--${entry.type} ${entry.status ? `timeline-event--${entry.status}` : ''}" ${data} style="top:${top}px;height:${height}px"><b>${escapeHtml(entry.title)}</b><span>${formatTime(starts)}–${formatTime(end)}</span></button>`;
          })
          .join('');
        const draft =
          draftSlot?.date === key
            ? `<div class="timeline-draft" style="top:${draftSlot.top}px;height:${draftSlot.height - 4}px"><span>${draftSlot.label}–${draftSlot.endLabel}</span></div>`
            : '';
        return `<div class="timeline-column ${key === localDay(new Date()) ? 'is-today' : ''} ${key === selectedDateKey ? 'is-selected' : ''}" data-date="${key}">${cards}${draft}<div class="timeline-hover-line" aria-hidden="true"><span></span></div></div>`;
      })
      .join('');
    return `<div class="timeline-head" style="--timeline-days:${days}"><span></span>${headers}</div><div class="timeline-scroll"><div class="timeline-grid" style="--timeline-days:${days};--timeline-height:${(endHour - startHour) * hourHeight}px"><div class="timeline-hours">${labels}</div><div class="timeline-lines">${lines}</div>${columns}</div></div>`;
  }

  function render() {
    const calendar = $('#calendar');
    if (!calendar) return;
    const currentTimeline = calendar.querySelector('.timeline-scroll');
    if (currentTimeline) timelineScrollTop = currentTimeline.scrollTop;
    const state = store.getState();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { start, days } = calendarViewRange(calendarView, anchorDate);
    const sessions = uniqueSessions(state.lessons);
    calendar.className = 'calendar-days';
    calendar.dataset.calendarView = calendarView;
    if (calendarView !== 'month') {
      calendar.innerHTML = renderTimeline(state, sessions, start, days);
      const timeline = calendar.querySelector('.timeline-scroll');
      if (timeline) {
        const initialHour =
          selectedDateKey === localDay(today) ? Math.max(0, new Date().getHours() - 2) : 8;
        timeline.scrollTop = timelineScrollTop ?? initialHour * 72;
        timeline.addEventListener('scroll', () => {
          timelineScrollTop = timeline.scrollTop;
        });
      }
    } else {
      calendar.innerHTML =
        ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
          .map((day) => `<div class="calendar-weekday">${day}</div>`)
          .join('') +
        Array.from({ length: days }, (_, index) => {
          const day = new Date(start);
          day.setDate(start.getDate() + index);
          const key = localDay(day);
          const entries = entriesForDay(state, sessions, key);
          const weekday = day.toLocaleDateString('ru-RU', { weekday: 'long' });
          return `<button type="button" class="day ${key === localDay(today) ? 'today' : ''} ${key === selectedDateKey ? 'selected' : ''} ${day < today ? 'past-day' : ''} ${day.getMonth() !== anchorDate.getMonth() ? 'outside-month' : ''} ${entries.length ? 'has-events' : ''}" data-date="${key}"><span class="date"><span class="mobile-weekday">${weekday},&nbsp;</span>${day.getDate()}</span>${entries.length ? `<span class="month-event-count" aria-label="Событий: ${entries.length}">${entries.length}</span>` : ''}</button>`;
        }).join('');
    }
    const period = $('#calendarPeriodLabel');
    if (period) period.textContent = periodLabel();
    renderTodaySummary(state, sessions, today);
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
    if (event.target.closest('.timeline-draft')) return;
    const date =
      event.target.closest('[data-date], [data-timeline-date]')?.dataset.date ||
      event.target.closest('[data-timeline-date]')?.dataset.timelineDate;
    if (date && !lessonId && !eventId) {
      draftSlot = null;
      selectedDateKey = date;
      anchorDate = new Date(`${date}T12:00:00`);
      render();
    }
  });
  $('#calendar')?.addEventListener('mousemove', (event) => {
    if (calendarView === 'month') return;
    const column = event.target.closest('.timeline-column');
    $('#calendar')
      ?.querySelectorAll('.timeline-column.is-hovered')
      .forEach((item) => item.classList.remove('is-hovered'));
    if (!column || event.target.closest('.timeline-event, .timeline-draft')) return;
    const rect = column.getBoundingClientRect();
    const minutes = Math.max(
      0,
      Math.min(24 * 60 - 15, Math.round(((event.clientY - rect.top) / 72) * 4) * 15),
    );
    const time = new Date(`${column.dataset.date}T00:00:00`);
    time.setMinutes(time.getMinutes() + minutes);
    const line = column.querySelector('.timeline-hover-line');
    line.style.top = `${minutes * (72 / 60)}px`;
    line.querySelector('span').textContent = formatTime(time);
    column.classList.add('is-hovered');
  });
  $('#calendar')?.addEventListener('pointerdown', (event) => {
    const column = event.target.closest('.timeline-column');
    if (!column || event.target.closest('.timeline-event, .timeline-draft')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = column.getBoundingClientRect();
    const startOffset = Math.max(
      0,
      Math.min(24 * 60 - 60, Math.round(((event.clientY - rect.top) / 72) * 4) * 15),
    );
    selectedDateKey = column.dataset.date;
    anchorDate = new Date(`${selectedDateKey}T12:00:00`);
    selectionDrag = {
      pointerId: event.pointerId,
      startY: event.clientY,
      rect,
      date: selectedDateKey,
      startOffset,
      moved: false,
    };
    setDraftRange(selectedDateKey, startOffset, 60);
    render();
  });
  document.addEventListener('pointermove', (event) => {
    if (!selectionDrag || event.pointerId !== selectionDrag.pointerId) return;
    if (Math.abs(event.clientY - selectionDrag.startY) < 4 && !selectionDrag.moved) return;
    selectionDrag.moved = true;
    const currentOffset = Math.max(
      0,
      Math.min(24 * 60, Math.round(((event.clientY - selectionDrag.rect.top) / 72) * 4) * 15),
    );
    const start = Math.min(selectionDrag.startOffset, currentOffset);
    const end = Math.max(selectionDrag.startOffset, currentOffset);
    setDraftRange(selectionDrag.date, start, Math.max(15, end - start));
    render();
  });
  const finishSelectionDrag = (event) => {
    if (!selectionDrag || event.pointerId !== selectionDrag.pointerId) return;
    const shouldOpenCreate = !selectionDrag.moved && window.matchMedia('(width <= 1024px)').matches;
    selectionDrag = null;
    render();
    if (shouldOpenCreate) window.dispatchEvent(new CustomEvent('schedule:create-sheet-open'));
  };
  document.addEventListener('pointerup', finishSelectionDrag);
  document.addEventListener('pointercancel', finishSelectionDrag);
  $('#calendar')?.addEventListener('mouseleave', () => {
    $('#calendar')
      ?.querySelectorAll('.timeline-column.is-hovered')
      .forEach((item) => item.classList.remove('is-hovered'));
  });
  $('#scheduleTodaySummary')?.addEventListener('click', (event) => {
    const createType = event.target.closest('[data-create-slot]')?.dataset.createSlot;
    if (createType && draftSlot) {
      const date = draftSlot.value;
      if (createType === 'lesson') lessonForm.openNew({ date });
      else lessonForm.openEvent('', date, draftSlot.duration);
      return;
    }
    const lessonId = event.target.closest('[data-lesson]')?.dataset.lesson;
    if (lessonId) lessonForm.openLesson(lessonId);
    const eventId = event.target.closest('[data-event]')?.dataset.event;
    if (eventId) lessonForm.openEvent(eventId);
  });
  $('#scheduleSidebarAction')?.addEventListener('click', (event) => {
    if (!event.currentTarget.hasAttribute('data-cancel-draft')) return;
    draftSlot = null;
    render();
  });
  $('#calendarViewSwitch')?.addEventListener('click', (event) => {
    const view = event.target.closest('[data-calendar-view]')?.dataset.calendarView;
    if (!view) return;
    calendarView = view;
    sessionStorage.setItem('tutorCabinet_calendarView', view);
    render();
  });
  const creationDate = () => {
    const chosen = new Date(`${selectedDateKey}T09:00:00`);
    const today = new Date();
    if (selectedDateKey === localDay(today)) {
      chosen.setHours(today.getHours(), Math.ceil(today.getMinutes() / 15) * 15, 0, 0);
    }
    return chosen;
  };
  window.addEventListener('schedule:create-type', (event) => {
    const chosen = creationDate();
    const value = draftSlot?.value || `${localDay(chosen)}T${formatTime(chosen)}`;
    const duration = draftSlot?.duration || 60;
    if (event.detail?.type === 'lesson') lessonForm.openNew({ date: value });
    if (event.detail?.type === 'event') lessonForm.openEvent('', value, duration);
  });
  $('.schedule-toolbar')?.addEventListener('click', (event) => {
    if (event.target.closest('[data-start-create]')) {
      if (window.matchMedia('(width <= 1024px)').matches) {
        window.dispatchEvent(new CustomEvent('schedule:create-sheet-open'));
        return;
      }
      const chosen = creationDate();
      const startOffset = Math.max(
        0,
        Math.min(24 * 60 - 60, chosen.getHours() * 60 + chosen.getMinutes()),
      );
      setDraftRange(selectedDateKey, startOffset, 60);
      render();
      return;
    }
    const direction = event.target.closest('[data-calendar-move]')?.dataset.calendarMove;
    if (direction) {
      const amount = direction === 'next' ? 1 : -1;
      if (calendarView === 'month') anchorDate.setMonth(anchorDate.getMonth() + amount);
      else anchorDate.setDate(anchorDate.getDate() + amount * (calendarView === 'week' ? 7 : 1));
      render();
    }
    if (event.target.closest('[data-calendar-today]')) {
      anchorDate = new Date();
      selectedDateKey = localDay(anchorDate);
      draftSlot = null;
      render();
    }
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
