import { CHARGED_STATUSES, RESERVED_STATUSES, lessonCharge } from '../modules/payments/finances.js';

/**
 * Начислено = проведённые занятия периода по их собственной цене.
 * Плановая сумма (то, что ещё предстоит провести) считается отдельно как
 * `reserved`, чтобы не смешивать факт и ожидание в одном числе.
 */
export function periodAnalytics(data, fromMs, toMs) {
  const inRange = (ms) => ms >= fromMs && ms <= toMs;
  const periodLessons = (data.lessons || []).filter((lesson) =>
    inRange(new Date(lesson.date).getTime()),
  );
  const lessons = periodLessons.filter((lesson) => CHARGED_STATUSES.includes(lesson.status));
  const reservedLessons = periodLessons.filter((lesson) =>
    RESERVED_STATUSES.includes(lesson.status),
  );
  const pays = (data.payments || []).filter((payment) => inRange(new Date(payment.date).getTime()));
  const paid = pays.reduce((sum, payment) => sum + (+payment.amount || 0), 0);
  const charged = lessons.reduce((sum, lesson) => sum + lessonCharge(lesson), 0);
  const reserved = reservedLessons.reduce((sum, lesson) => sum + lessonCharge(lesson), 0);

  const byStudent = {};
  const bucket = (id) => (byStudent[id] ||= { paid: 0, charged: 0, lessons: 0 });
  for (const payment of pays) bucket(payment.studentId).paid += +payment.amount || 0;
  for (const lesson of lessons) {
    if (!lesson.studentId) continue;
    const entry = bucket(lesson.studentId);
    entry.lessons += 1;
    entry.charged += lessonCharge(lesson);
  }

  return {
    paid,
    charged,
    reserved,
    paidCount: pays.length,
    lessonsCount: lessons.length,
    pays,
    lessons,
    byStudent,
  };
}
