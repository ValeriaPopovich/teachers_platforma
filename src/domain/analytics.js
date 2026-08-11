import {
  monthlyRecurringDates,
  recurringScheduleKey,
} from '../modules/schedule/schedule.domain.js';
export function periodAnalytics(data, fromMs, toMs) {
  const inRange = (ms) => ms >= fromMs && ms <= toMs,
    allPeriodLessons = (data.lessons || []).filter((lesson) =>
      inRange(new Date(lesson.date).getTime()),
    ),
    lessons = allPeriodLessons.filter((lesson) => ['done', 'paid_missed'].includes(lesson.status)),
    chargeableLessons = allPeriodLessons.filter(
      (lesson) =>
        ['planned', 'unconfirmed', 'done', 'paid_missed'].includes(lesson.status) &&
        !['package', 'not_charged'].includes(lesson.payment),
    ),
    pays = (data.payments || []).filter((payment) => inRange(new Date(payment.date).getTime())),
    paid = pays.reduce((sum, payment) => sum + (+payment.amount || 0), 0),
    packageOneoffs = (student, start) =>
      (data.lessons || []).filter((lesson) => {
        const at = new Date(lesson.date).getTime();
        return (
          lesson.studentId === student.id &&
          !lesson.groupId &&
          lesson.lessonKind === 'oneoff' &&
          lesson.payment === 'package' &&
          ['planned', 'unconfirmed', 'done', 'paid_missed'].includes(lesson.status) &&
          inRange(at) &&
          at >= start
        );
      }),
    plannedPackages = (data.students || [])
      .filter((student) => student.payType === 'package')
      .reduce((sum, student) => {
        const start = Math.max(+student.createdAt || 0, +student.billingSince || 0),
          exclusions = new Set(data.settings?.scheduleExclusions || []),
          dates = monthlyRecurringDates(student.scheduleSlots || [], new Date(fromMs)).filter(
            (date) =>
              inRange(date.getTime()) &&
              date.getTime() >= start &&
              !exclusions.has(recurringScheduleKey('student', student.id, date)),
          );
        return sum + (dates.length + packageOneoffs(student, start).length) * (+student.price || 0);
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
    byStudent[lesson.studentId].lessons++;
  }
  for (const lesson of chargeableLessons) {
    if (!lesson.studentId) continue;
    byStudent[lesson.studentId] ||= { paid: 0, charged: 0, lessons: 0 };
    byStudent[lesson.studentId].charged += +lesson.amount || 0;
  }
  for (const student of data.students || []) {
    if (student.payType !== 'package') continue;
    const start = Math.max(+student.createdAt || 0, +student.billingSince || 0),
      exclusions = new Set(data.settings?.scheduleExclusions || []),
      dates = monthlyRecurringDates(student.scheduleSlots || [], new Date(fromMs)).filter(
        (date) =>
          inRange(date.getTime()) &&
          date.getTime() >= start &&
          !exclusions.has(recurringScheduleKey('student', student.id, date)),
      );
    byStudent[student.id] ||= { paid: 0, charged: 0, lessons: 0 };
    byStudent[student.id].charged +=
      (dates.length + packageOneoffs(student, start).length) * (+student.price || 0);
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
