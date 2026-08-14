import { formatDate, formatTime, localDay, money } from '../../shared/format.js';
import { calendarViewRange } from './schedule.domain.js';

// Pixel height of one hour row in the day/week timeline. Shared between the
// view-model builder below and ScheduleCalendar, which positions the
// hover-line and drag-draft using the same scale.
export const SCHEDULE_HOUR_HEIGHT = 72;

export function lessonDuration(state, lesson) {
  const owner = lesson.groupId
    ? state.groups.find((group) => group.id === lesson.groupId)
    : state.students.find((student) => student.id === lesson.studentId);
  return +lesson?.duration || +owner?.duration || 60;
}

export function lessonName(state, lesson) {
  if (lesson.groupId)
    return state.groups.find((group) => group.id === lesson.groupId)?.name || 'Группа';
  return (
    state.students.find((student) => student.id === lesson.studentId)?.name || 'Удалённый ученик'
  );
}

export function groupLessonRecords(state, lesson) {
  if (!lesson?.groupId) return lesson ? [lesson] : [];
  return state.lessons.filter((item) =>
    lesson.seriesId
      ? item.seriesId === lesson.seriesId
      : item.groupId === lesson.groupId && item.date === lesson.date,
  );
}

export function uniqueSessions(list) {
  const rank = { done: 6, paid_missed: 5, missed: 4, planned: 3, moved: 2, cancelled: 1 };
  const map = new Map();
  list.forEach((lesson, index) => {
    const key = lesson.groupId
      ? lesson.seriesId || `group:${lesson.groupId}:${lesson.date}`
      : `individual:${lesson.id || 'missing'}:${index}`;
    const old = map.get(key);
    if (!old || (rank[lesson.status] || 0) > (rank[old.status] || 0)) map.set(key, lesson);
  });
  return [...map.values()];
}

export function calendarConflicts(state, date, duration = 60, options = {}) {
  const {
    excludeLesson = '',
    excludeEvent = '',
    excludeType = '',
    excludeId = '',
    breakMinutes = 0,
  } = options;
  const start = new Date(date).getTime();
  if (!Number.isFinite(start)) return [];
  const end = start + (+duration || 60) * 60000;
  const gap = (+breakMinutes || 0) * 60000;
  const lessons = state.lessons
    .filter(
      (lesson) =>
        !['cancelled', 'moved'].includes(lesson.status) &&
        lesson.id !== excludeLesson &&
        lesson.seriesId !== excludeLesson,
    )
    .filter(
      (lesson) =>
        !(
          lesson.auto &&
          ((excludeType === 'student' && !lesson.groupId && lesson.studentId === excludeId) ||
            (excludeType === 'group' && lesson.groupId === excludeId))
        ),
    )
    .filter((lesson) => {
      const otherStart = new Date(lesson.date).getTime();
      const otherEnd = otherStart + lessonDuration(state, lesson) * 60000;
      return start < otherEnd + gap && end > otherStart - gap;
    })
    .map((lesson) => lessonName(state, lesson));
  const events = state.events
    .filter((event) => event.id !== excludeEvent)
    .filter((event) => {
      const otherStart = new Date(event.date).getTime();
      const otherEnd = otherStart + (+event.duration || 60) * 60000;
      return start < otherEnd + gap && end > otherStart - gap;
    })
    .map((event) => event.title);
  return [...new Set([...lessons, ...events])];
}

function minutesOf(time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + minutes;
}

export function ownSlotConflict(slots, duration) {
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      if (+slots[i].day !== +slots[j].day) continue;
      const a = minutesOf(slots[i].time);
      const b = minutesOf(slots[j].time);
      if (a < b + (+duration || 60) && b < a + (+duration || 60))
        return `${slots[i].time} и ${slots[j].time}`;
    }
  }
  return '';
}

// Lessons and events happening on a given day, merged and sorted by time.
// Shared by the timeline, the month grid and the day summary sidebar.
export function scheduleEntriesForDay(state, sessions, key) {
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

// Default date/time proposed when creating a lesson/event from the sidebar
// or the toolbar "Добавить" button, with no drag-selected slot on the
// calendar: 09:00 on the selected day, or now (rounded to 15 min) if today.
export function scheduleCreationMoment(selectedDateKey, now = new Date()) {
  const chosen = new Date(`${selectedDateKey}T09:00:00`);
  if (selectedDateKey === localDay(now)) {
    chosen.setHours(now.getHours(), Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  }
  return chosen;
}

export function buildSchedulePeriodLabel(view, anchorDate) {
  if (view === 'month')
    return anchorDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  if (view === 'day')
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

function scheduleDayTitle(date, today) {
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (localDay(date) === localDay(today)) return 'Сегодня';
  if (localDay(date) === localDay(tomorrow))
    return `${date.toLocaleDateString('ru-RU', { weekday: 'short' })} завтра`;
  return date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
}

// View model for the "Сегодня" sidebar: selected day's lessons/events grouped
// into two sections, ready for display.
export function buildScheduleSummary(state, sessions, selectedDateKey, now = new Date()) {
  const entries = scheduleEntriesForDay(state, sessions, selectedDateKey);
  const buildItem = (entry) => {
    const starts = new Date(entry.date);
    const ends = new Date(starts.getTime() + entry.duration * 60000);
    return {
      id: entry.id,
      type: entry.type,
      title: entry.title,
      startLabel: formatTime(starts),
      rangeLabel: `${formatTime(starts)}–${formatTime(ends)}`,
      amountLabel: entry.type === 'lesson' ? money(entry.amount) : '',
    };
  };
  return {
    title: scheduleDayTitle(new Date(`${selectedDateKey}T12:00:00`), now),
    sections: [
      {
        label: 'Занятия',
        type: 'lesson',
        count: entries.filter((entry) => entry.type === 'lesson').length,
        items: entries.filter((entry) => entry.type === 'lesson').map(buildItem),
      },
      {
        label: 'Дела',
        type: 'event',
        count: entries.filter((entry) => entry.type === 'event').length,
        items: entries.filter((entry) => entry.type === 'event').map(buildItem),
      },
    ],
  };
}

// View model for the day/week timeline: hour ruler plus one column per shown
// day, each with its entries already positioned in pixels.
export function buildScheduleTimeline(
  state,
  sessions,
  { start, days, selectedDateKey, now = new Date() },
) {
  const today = localDay(now);
  const shownDays = Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return date;
  });
  const headers = shownDays.map((date) => {
    const key = localDay(date);
    return {
      key,
      day: date.getDate(),
      weekday: date.toLocaleDateString('ru-RU', { weekday: 'short' }),
      isToday: key === today,
      isSelected: key === selectedDateKey,
    };
  });
  const hours = Array.from({ length: 25 }, (_, hour) => ({
    hour,
    label: `${String(hour % 24).padStart(2, '0')}:00`,
    top: hour * SCHEDULE_HOUR_HEIGHT,
    isLast: hour === 24,
  }));
  const columns = shownDays.map((date) => {
    const key = localDay(date);
    const entries = scheduleEntriesForDay(state, sessions, key)
      .map((entry) => {
        const starts = new Date(entry.date);
        const top = (starts.getHours() * 60 + starts.getMinutes()) * (SCHEDULE_HOUR_HEIGHT / 60);
        if (top < 0 || top > 24 * SCHEDULE_HOUR_HEIGHT) return null;
        const end = new Date(starts.getTime() + entry.duration * 60000);
        return {
          id: entry.id,
          type: entry.type,
          status: entry.status,
          title: entry.title,
          top,
          height: Math.max(34, entry.duration * (SCHEDULE_HOUR_HEIGHT / 60) - 4),
          startLabel: formatTime(starts),
          endLabel: formatTime(end),
        };
      })
      .filter(Boolean);
    return { key, isToday: key === today, isSelected: key === selectedDateKey, entries };
  });
  return { headers, hours, columns, gridHeight: 24 * SCHEDULE_HOUR_HEIGHT };
}

// View model for the month grid: one cell per shown day (including the
// leading/trailing days of adjacent months needed to fill full weeks).
export function buildScheduleMonth(
  state,
  sessions,
  { start, days, anchorMonth, selectedDateKey, now = new Date() },
) {
  const today = localDay(now);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = localDay(date);
    return {
      key,
      day: date.getDate(),
      weekdayLabel: date.toLocaleDateString('ru-RU', { weekday: 'long' }),
      isToday: key === today,
      isSelected: key === selectedDateKey,
      isPast: date < todayStart,
      isOutsideMonth: date.getMonth() !== anchorMonth,
      count: scheduleEntriesForDay(state, sessions, key).length,
    };
  });
}

export function recurringConflicts(state, slots, duration, type, id, now = new Date()) {
  const found = [];
  for (let offset = 0; offset < 56; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    for (const slot of slots) {
      if (date.getDay() !== +slot.day) continue;
      const [hours, minutes] = slot.time.split(':').map(Number);
      date.setHours(hours, minutes, 0, 0);
      if (date < now) continue;
      const ignore =
        type === 'group'
          ? `grp-${id}-${new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)}`
          : '';
      const names = calendarConflicts(state, date, duration, {
        excludeLesson: ignore,
        excludeType: type,
        excludeId: id,
      });
      if (names.length) found.push(...names.map((name) => `${formatDate(date, true)} — ${name}`));
    }
  }
  const unique = [...new Set(found)];
  return unique.length > 5 ? [...unique.slice(0, 5), `и ещё ${unique.length - 5}`] : unique;
}
