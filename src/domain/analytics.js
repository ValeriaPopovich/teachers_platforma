import { monthlyRecurringDates } from './schedule.js';

/** Аналитика оплат и начислений за выбранный период. */
export function periodAnalytics(data, fromMs, toMs) {
  const inRange = (ms) => ms >= fromMs && ms <= toMs;
  const pays = (data.payments || []).filter((payment) => inRange(new Date(payment.date).getTime()));
  const lessons = (data.lessons || []).filter(
    (lesson) =>
      ['done', 'paid_missed'].includes(lesson.status) && inRange(new Date(lesson.date).getTime()),
  );
  const chargeableLessons = lessons.filter((lesson) => lesson.payment !== 'package'),
    paid = pays.reduce((sum, payment) => sum + (+payment.amount || 0), 0),
    plannedPackages = (data.students || [])
      .filter((student) => student.payType === 'package')
      .reduce((sum, student) => {
        const start = Math.max(+student.createdAt || 0, +student.billingSince || 0),
          dates = monthlyRecurringDates(student.scheduleSlots || [], new Date(fromMs)).filter(
            (date) => inRange(date.getTime()) && date.getTime() >= start,
          );
        return sum + dates.length * (+student.price || 0);
      }, 0),
    charged =
      plannedPackages + chargeableLessons.reduce((sum, lesson) => sum + (+lesson.amount || 0), 0),
    byStudent = {};
  for (const payment of pays) {
    byStudent[payment.studentId] ||= { paid: 0, charged: 0, lessons: 0 };
    byStudent[payment.studentId].paid += +payment.amount || 0;
  }
  for (const lesson of lessons) {
    if (!lesson.studentId) continue;
    byStudent[lesson.studentId] ||= { paid: 0, charged: 0, lessons: 0 };
    if (lesson.payment !== 'package') byStudent[lesson.studentId].charged += +lesson.amount || 0;
    byStudent[lesson.studentId].lessons++;
  }
  for (const student of data.students || []) {
    if (student.payType !== 'package') continue;
    const start = Math.max(+student.createdAt || 0, +student.billingSince || 0),
      dates = monthlyRecurringDates(student.scheduleSlots || [], new Date(fromMs)).filter(
        (date) => inRange(date.getTime()) && date.getTime() >= start,
      );
    byStudent[student.id] ||= { paid: 0, charged: 0, lessons: 0 };
    byStudent[student.id].charged += dates.length * (+student.price || 0);
  }
  return {
    paid,
    charged,
    paidCount: pays.length,
    lessonsCount: lessons.length,
    pays,
    lessons,
    byStudent,
  };
}
