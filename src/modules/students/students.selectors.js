import { finances } from '../payments/finances.js';

export const getStudentById = (state, id) => state.students.find((student) => student.id === id);
export const getGroupById = (state, id) => state.groups.find((group) => group.id === id);

export function getStudentLessons(state, id) {
  return state.lessons
    .filter((lesson) => lesson.studentId === id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function homeworkGrade(lesson) {
  if (!lesson) return null;
  const raw = lesson.homeworkResult;
  if (raw !== '' && raw != null) {
    const value = +raw || 0;
    return value > 0 ? Math.max(1, Math.min(5, value > 5 ? Math.round(value / 20) : value)) : null;
  }
  if (+lesson.homeworkPercent > 0)
    return Math.max(1, Math.min(5, Math.round(+lesson.homeworkPercent / 20)));
  return null;
}

export function getStudentMetrics(state, id) {
  const lessons = getStudentLessons(state, id);
  const done = lessons.filter((lesson) => lesson.status === 'done');
  const missed = lessons.filter((lesson) => ['missed', 'paid_missed'].includes(lesson.status));
  const completed = done.length + missed.length;
  const homework = done.map(homeworkGrade).filter(Number.isFinite);
  const finance = finances(state, id);
  return {
    done: done.length,
    miss: missed.length,
    attendance: completed ? Math.round((done.length / completed) * 100) : 100,
    homework: homework.length
      ? Math.round((homework.reduce((sum, value) => sum + value, 0) / homework.length) * 10) / 10
      : null,
    debt: finance.debt,
    pack: finance.used || 0,
  };
}

export function scheduleText(slots = []) {
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  return slots.length
    ? slots.map((slot) => `${days[slot.day]} ${slot.time}`).join(', ')
    : 'Без расписания';
}
