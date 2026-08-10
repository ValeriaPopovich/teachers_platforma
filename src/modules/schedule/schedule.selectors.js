import { formatDate } from '../../shared/format.js';

export function lessonDuration(state, lesson) {
  const owner = lesson.groupId
    ? state.groups.find((group) => group.id === lesson.groupId)
    : state.students.find((student) => student.id === lesson.studentId);
  return +owner?.duration || 60;
}

export function lessonName(state, lesson) {
  if (lesson.groupId) return state.groups.find((group) => group.id === lesson.groupId)?.name || 'Группа';
  return state.students.find((student) => student.id === lesson.studentId)?.name || 'Удалённый ученик';
}

export function groupLessonRecords(state, lesson) {
  if (!lesson?.groupId) return lesson ? [lesson] : [];
  return state.lessons.filter((item) => lesson.seriesId ? item.seriesId === lesson.seriesId : item.groupId === lesson.groupId && item.date === lesson.date);
}

export function uniqueSessions(list) {
  const rank = { done: 6, paid_missed: 5, missed: 4, planned: 3, moved: 2, cancelled: 1 };
  const map = new Map();
  list.forEach((lesson, index) => {
    const key = lesson.groupId ? lesson.seriesId || `group:${lesson.groupId}:${lesson.date}` : `individual:${lesson.id || 'missing'}:${index}`;
    const old = map.get(key);
    if (!old || (rank[lesson.status] || 0) > (rank[old.status] || 0)) map.set(key, lesson);
  });
  return [...map.values()];
}

export function calendarConflicts(state, date, duration = 60, options = {}) {
  const { excludeLesson = '', excludeEvent = '', excludeType = '', excludeId = '', breakMinutes = 0 } = options;
  const start = new Date(date).getTime();
  if (!Number.isFinite(start)) return [];
  const end = start + (+duration || 60) * 60000;
  const gap = (+breakMinutes || 0) * 60000;
  const lessons = state.lessons
    .filter((lesson) => !['cancelled', 'moved'].includes(lesson.status) && lesson.id !== excludeLesson && lesson.seriesId !== excludeLesson)
    .filter((lesson) => !(lesson.auto && ((excludeType === 'student' && !lesson.groupId && lesson.studentId === excludeId) || (excludeType === 'group' && lesson.groupId === excludeId))))
    .filter((lesson) => {
      const otherStart = new Date(lesson.date).getTime();
      const otherEnd = otherStart + lessonDuration(state, lesson) * 60000;
      return start < otherEnd + gap && end > otherStart - gap;
    })
    .map((lesson) => lessonName(state, lesson));
  const events = state.events.filter((event) => event.id !== excludeEvent).filter((event) => {
    const otherStart = new Date(event.date).getTime();
    const otherEnd = otherStart + (+event.duration || 60) * 60000;
    return start < otherEnd + gap && end > otherStart - gap;
  }).map((event) => event.title);
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
      if (a < b + (+duration || 60) && b < a + (+duration || 60)) return `${slots[i].time} и ${slots[j].time}`;
    }
  }
  return '';
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
      const ignore = type === 'group' ? `grp-${id}-${new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)}` : '';
      const names = calendarConflicts(state, date, duration, { excludeLesson: ignore, excludeType: type, excludeId: id });
      if (names.length) found.push(...names.map((name) => `${formatDate(date, true)} — ${name}`));
    }
  }
  const unique = [...new Set(found)];
  return unique.length > 5 ? [...unique.slice(0, 5), `и ещё ${unique.length - 5}`] : unique;
}
