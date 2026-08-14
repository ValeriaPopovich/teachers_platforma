import {
  ACTIVE_STATUSES,
  CHARGED_STATUSES,
  RESERVED_STATUSES,
  chargedLessons,
  countedPayments,
  finances,
  isChargeable,
  lessonCharge,
} from './finances.js';
import { periodAnalytics } from '../../domain/analytics.js';
import { monthName } from '../../shared/format.js';

function monthBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start: start.getTime(), end: end.getTime() };
}

export function hasFinancialActivity(state, student) {
  const cutoff = +student?.billingSince || 0;
  return (
    chargedLessons(state, student.id, cutoff).length > 0 ||
    countedPayments(state, student.id, cutoff).length > 0
  );
}

/**
 * План месяца строится по реальным занятиям ученика — и индивидуальным, и
 * групповым, — а не по слотам расписания. Цена берётся из каждого занятия,
 * поэтому группа по 500 и индивидуальные по 1500 складываются корректно.
 */
export function getMonthPlan(state, studentId, date = new Date()) {
  const { start, end } = monthBounds(date);
  const student = state.students.find((item) => item.id === studentId);
  const from = Math.max(start, +student?.billingSince || 0);
  const lessons = state.lessons.filter((lesson) => {
    const at = new Date(lesson.date).getTime();
    return (
      lesson.studentId === studentId &&
      at >= from &&
      at < end &&
      ACTIVE_STATUSES.includes(lesson.status) &&
      isChargeable(lesson)
    );
  });
  const conducted = lessons.filter((lesson) => CHARGED_STATUSES.includes(lesson.status));
  const remaining = lessons.filter((lesson) => RESERVED_STATUSES.includes(lesson.status));
  const sum = (list) => list.reduce((total, lesson) => total + lessonCharge(lesson), 0);
  return {
    lessons: lessons.length,
    conducted: conducted.length,
    remaining: remaining.length,
    amount: sum(lessons),
    conductedAmount: sum(conducted),
    remainingAmount: sum(remaining),
  };
}

/**
 * Сколько ближайших занятий покрыто балансом. Идём по реальным датам и
 * вычитаем цену каждого занятия — так работает и при разных ценах у одного
 * ученика (группа + индивидуальные).
 */
export function coveredLessons(state, studentId, balance) {
  const upcoming = state.lessons
    .filter(
      (lesson) =>
        lesson.studentId === studentId &&
        RESERVED_STATUSES.includes(lesson.status) &&
        isChargeable(lesson),
    )
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  let rest = balance;
  let count = 0;
  for (const lesson of upcoming) {
    const price = lessonCharge(lesson);
    if (price > rest) break;
    rest -= price;
    count += 1;
  }
  return count;
}

export function getStudentPaymentState(state, student, date = new Date()) {
  const finance = finances(state, student.id);
  if (!hasFinancialActivity(state, student))
    return { kind: 'empty', label: 'Нет начислений', amountDue: 0, finance };
  const plan = getMonthPlan(state, student.id, date);
  const covered = coveredLessons(state, student.id, finance.balance);
  const base = { plan, covered, finance };

  if (finance.debt > 0)
    return { ...base, kind: 'need', label: 'Есть долг', amountDue: finance.debt };

  if (student.payType === 'package') {
    const due = Math.max(0, Math.round(plan.remainingAmount - finance.balance));
    if (due > 0) return { ...base, kind: 'need', label: 'Нужно принять абонемент', amountDue: due };
    if (plan.remaining > 0 && covered <= 1) {
      const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      return {
        ...base,
        kind: 'ending',
        label: 'Абонемент заканчивается',
        amountDue: Math.max(0, Math.round(getMonthPlan(state, student.id, nextMonth).amount)),
      };
    }
    return { ...base, kind: 'ok', label: 'Оплачено', amountDue: 0 };
  }

  return {
    ...base,
    kind: 'ok',
    label: finance.balance > 0 ? 'Есть аванс' : 'Оплачено',
    amountDue: 0,
  };
}

export function getPaymentRows(state, date = new Date()) {
  return state.students
    .filter((student) => student.status !== 'paused')
    .map((student) => ({ student, ...getStudentPaymentState(state, student, date) }))
    .sort((a, b) => {
      const priority = { need: 0, ending: 1, ok: 2, empty: 3 };
      return (
        priority[a.kind] - priority[b.kind] || a.student.name.localeCompare(b.student.name, 'ru')
      );
    });
}

export function getPaymentAttentionRows(state, date = new Date()) {
  return getPaymentRows(state, date).filter((row) => ['need', 'ending'].includes(row.kind));
}

export function getMonthlyPaymentSummary(state, date = new Date()) {
  const { start, end } = monthBounds(date);
  const payments = state.payments.filter((payment) => {
    const time = new Date(payment.date).getTime();
    return time >= start && time < end && !payment.ledgerOnly;
  });
  const received = payments.reduce((sum, payment) => sum + (+payment.amount || 0), 0);
  const rows = getPaymentRows(state, date);
  // Только реальный долг: amountDue у строк «ending» — это цена будущего
  // абонемента, а не задолженность, и в «Долг сейчас» ей не место.
  const debt = rows.reduce((sum, row) => sum + Math.max(0, +row.finance?.debt || 0), 0);
  const attention = rows.filter((row) => ['need', 'ending'].includes(row.kind)).length;
  return { received, debt, attention, payments: payments.length };
}

export function getPaymentHistory(state, { days = 31, studentId = '', now = new Date() } = {}) {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - Math.max(0, days - 1));
  return state.payments
    .filter(
      (payment) =>
        !payment.ledgerOnly &&
        new Date(payment.date) >= from &&
        (!studentId || payment.studentId === studentId),
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/** Builds the view model consumed by the payments page. */
export function buildPaymentsModel(state, { now = new Date() } = {}) {
  const summary = getMonthlyPaymentSummary(state, now);
  const monthFrom = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
  const analytics = periodAnalytics(state, monthFrom, monthTo);
  const rows = getPaymentRows(state, now);
  const attentionCount = rows.filter((row) => ['need', 'ending'].includes(row.kind)).length;
  const history = state.payments
    .filter((payment) => !payment.ledgerOnly)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((payment) => ({
      ...payment,
      studentName:
        state.students.find((student) => student.id === payment.studentId)?.name ||
        'Удалённый ученик',
    }));

  return {
    monthLabel: monthName(now),
    stats: { paid: analytics.paid, charged: analytics.charged, debt: summary.debt, attentionCount },
    rows,
    students: state.students.map(({ id, name }) => ({ id, name })),
    history,
  };
}
