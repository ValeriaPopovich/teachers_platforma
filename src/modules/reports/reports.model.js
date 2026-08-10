import { getPackageProgress } from '../payments/payments.selectors.js';
import { formatDate, localDay, money } from '../../shared/format.js';

const REPORT_STATUSES = new Set(['done', 'missed', 'paid_missed']);

export function getReportBounds({ period = '30', dateFrom = '', dateTo = '', now = Date.now() } = {}) {
  if (period === 'custom') {
    const fallback = localDay(now);
    return {
      from: new Date(`${dateFrom || fallback}T00:00`).getTime(),
      to: new Date(`${dateTo || fallback}T23:59:59`).getTime(),
    };
  }
  const days = Number(period) || 30;
  return { from: now - (days - 1) * 86400000, to: now };
}

export function getReportLessons(state, studentId, bounds) {
  if (!studentId) return [];
  return state.lessons
    .filter((lesson) => {
      const time = new Date(lesson.date).getTime();
      return lesson.studentId === studentId && time >= bounds.from && time <= bounds.to && REPORT_STATUSES.has(lesson.status);
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function buildReportSource(state, studentId, bounds) {
  const student = state.students.find((item) => item.id === studentId) || null;
  const lessons = getReportLessons(state, studentId, bounds);
  const topics = [...new Set(lessons.flatMap((lesson) => String(lesson.topics || '').split(',').map((topic) => topic.trim()).filter(Boolean)))];
  const tests = lessons
    .filter((lesson) => lesson.testDone === 'yes')
    .map((lesson) => `${lesson.testName || 'Проверочная работа'}${lesson.testScore || lesson.testMax ? ` — ${lesson.testScore || '—'}/${lesson.testMax || '—'}` : ''}`);
  const homeworks = lessons
    .filter((lesson) => lesson.homework)
    .map((lesson) => `${formatDate(lesson.date)} — ${lesson.homework}`);
  const done = lessons.filter((lesson) => lesson.status === 'done').length;
  return { student, lessons, topics, tests, homeworks, progressPercent: lessons.length ? Math.round(done / lessons.length * 100) : 100 };
}

export function getNextPackageSummary(state, studentId, now = new Date()) {
  const student = state.students.find((item) => item.id === studentId);
  if (!student || student.payType !== 'package') return '';
  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
  const progress = getPackageProgress(state, studentId, nextMonth);
  return `В следующем месяце по регулярному расписанию запланировано ${progress?.planned || 0} занятий на сумму ${money(progress?.amount || 0)}.`;
}
