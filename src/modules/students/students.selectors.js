import { finances } from '../payments/finances.js';
import { hasFinancialActivity } from '../payments/payments.selectors.js';
import { safeExternalUrl } from '../../shared/dom.js';
import { initials, money } from '../../shared/format.js';

export const getStudentById = (state, id) => state.students.find((student) => student.id === id);
export const getGroupById = (state, id) => state.groups.find((group) => group.id === id);

export function getStudentLessons(state, id) {
  return state.lessons
    .filter((lesson) => lesson.studentId === id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function getStudentLessonHistory(state, id, now = Date.now()) {
  const student = getStudentById(state, id);
  return state.lessons
    .filter((lesson) => lesson.studentId === id)
    .filter((lesson) => {
      const startsAt = new Date(lesson.date).getTime();
      const duration = +lesson.duration || +student?.duration || 60;
      return Number.isFinite(startsAt) && startsAt + duration * 60000 <= now;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
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

export function parentDetails(student) {
  if (String(student?.parentDetails || '').trim()) return String(student.parentDetails).trim();
  return [student?.parentName, student?.parentContact]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' · ');
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
    balance: finance.balance,
  };
}

export function scheduleText(slots = []) {
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  return slots.length
    ? slots.map((slot) => `${days[slot.day]} ${slot.time}`).join(', ')
    : 'Без расписания';
}

function countWord(value, one, few, many) {
  const count = Math.abs(Math.round(Number(value) || 0));
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return few;
  return many;
}

function firstLetters(value) {
  return [
    ...String(value || '')
      .trim()
      .replace(/\s+/g, ''),
  ]
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function paymentPresentation(student, finance, hasActivity = true) {
  if (!hasActivity) return { label: 'Нет начислений', kind: 'empty' };
  if (finance.debt > 0)
    return {
      label: finance.paid > 0 ? 'Частично оплачено' : `Долг ${money(finance.debt)}`,
      kind: finance.paid > 0 ? 'partial' : 'debt',
    };
  if (finance.balance > 0) return { label: `Аванс ${money(finance.balance)}`, kind: 'paid' };
  return { label: 'Оплачено', kind: 'paid' };
}

/** Prepares sorted, filtered student cards for the students grid. */
export function buildStudentRows(state, { query = '', filter = 'all', sort = 'name' } = {}) {
  const needle = query.trim().toLowerCase();
  const paymentById = new Map(
    state.students.map((student) => {
      const finance = finances(state, student.id);
      return [
        student.id,
        {
          finance,
          payment: paymentPresentation(student, finance, hasFinancialActivity(state, student)),
        },
      ];
    }),
  );
  const list = state.students.filter((student) => {
    const haystack =
      `${student.name || ''} ${student.grade || ''} ${student.contact || ''} ${parentDetails(student)}`.toLowerCase();
    if (needle && !haystack.includes(needle)) return false;
    const payment = paymentById.get(student.id).payment;
    if (filter === 'debt' && !['debt', 'partial'].includes(payment.kind)) return false;
    if (filter === 'paid' && payment.kind !== 'paid') return false;
    if (filter === 'unscheduled' && (student.scheduleSlots || []).length) return false;
    return true;
  });
  const nextLesson = (student) =>
    Math.min(
      ...state.lessons
        .filter(
          (lesson) =>
            lesson.studentId === student.id && new Date(lesson.date).getTime() >= Date.now(),
        )
        .map((lesson) => new Date(lesson.date).getTime()),
      Number.POSITIVE_INFINITY,
    );
  list.sort((a, b) => {
    if (filter === 'all' && sort === 'name') {
      const rank = { debt: 0, partial: 1, paid: 2, empty: 3 };
      return (
        rank[paymentById.get(a.id).payment.kind] - rank[paymentById.get(b.id).payment.kind] ||
        paymentById.get(b.id).finance.debt - paymentById.get(a.id).finance.debt ||
        String(a.name || '').localeCompare(String(b.name || ''), 'ru')
      );
    }
    if (sort === 'next')
      return nextLesson(a) - nextLesson(b) || String(a.name).localeCompare(String(b.name), 'ru');
    if (sort === 'debt') {
      const rank = { debt: 0, partial: 1, paid: 2, empty: 3 };
      return (
        rank[paymentById.get(a.id).payment.kind] - rank[paymentById.get(b.id).payment.kind] ||
        String(a.name).localeCompare(String(b.name), 'ru')
      );
    }
    return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
  });
  return list.map((student) => {
    const finance = paymentById.get(student.id).finance;
    return {
      student,
      initials: initials(student.name),
      contact: student.contact || parentDetails(student) || student.grade || 'Класс не указан',
      schedule: scheduleText(student.scheduleSlots || []),
      terms: `${money(student.price)} / ${+student.duration || 60} мин`,
      payment: paymentPresentation(student, finance, hasFinancialActivity(state, student)),
      lessonUrl: safeExternalUrl(student.lessonLink),
    };
  });
}

/** Prepares sorted, filtered group cards for the groups grid. */
export function buildGroupRows(state, { query = '' } = {}) {
  const needle = query.trim().toLowerCase();
  const groups = state.groups.filter((group) => {
    const memberNames = (group.members || [])
      .map((id) => getStudentById(state, id)?.name || '')
      .join(' ');
    return `${group.name || ''} ${group.grade || ''} ${memberNames}`.toLowerCase().includes(needle);
  });
  return groups.map((group) => {
    const memberNames = (group.members || [])
      .map((id) => getStudentById(state, id)?.name)
      .filter(Boolean);
    return {
      group,
      direction: group.grade || 'Учебная группа',
      schedule: scheduleText(group.scheduleSlots || []),
      membersLabel: `${memberNames.length} ${countWord(memberNames.length, 'участник', 'участника', 'участников')}`,
      durationLabel: `${+group.duration || 60} мин`,
      members: memberNames.slice(0, 5).map((name) => ({ name, initials: firstLetters(name) })),
      moreCount: Math.max(0, memberNames.length - 5),
    };
  });
}
