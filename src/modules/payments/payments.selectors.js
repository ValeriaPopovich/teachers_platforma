import { finances } from './finances.js';
import {
  countMonthlyRecurringLessons,
  countMonthlyRecurringLessonsFrom,
} from '../schedule/schedule.domain.js';

function monthBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start: start.getTime(), end: end.getTime() };
}

export function getPackageProgress(state, studentId, date = new Date()) {
  const student = state.students.find((item) => item.id === studentId);
  if (!student || student.payType !== 'package') return null;
  const { start, end } = monthBounds(date);
  const billingSince = +student.billingSince || +student.createdAt || 0;
  const effectiveStart = Math.max(start, billingSince);
  const planned =
    effectiveStart >= end
      ? 0
      : countMonthlyRecurringLessonsFrom(student.scheduleSlots || [], date, effectiveStart);
  const payments = state.payments.filter(
    (payment) =>
      payment.studentId === studentId &&
      (payment.billingType === 'package' || +payment.packageLessons > 0) &&
      new Date(payment.date).getTime() >= start &&
      new Date(payment.date).getTime() < end,
  );
  const bought = payments.reduce((sum, payment) => sum + (+payment.packageLessons || 0), 0);
  const used = state.lessons.filter(
    (lesson) =>
      lesson.studentId === studentId &&
      ['done', 'paid_missed'].includes(lesson.status) &&
      lesson.payment === 'package' &&
      new Date(lesson.date).getTime() >= start &&
      new Date(lesson.date).getTime() < end,
  ).length;
  return {
    planned,
    bought,
    used,
    remaining: bought - used,
    amount: planned * (+student.price || 0),
    payments,
  };
}

export function getStudentPaymentState(state, student, date = new Date()) {
  const finance = finances(state, student.id);
  if (student.payType === 'package') {
    const progress = getPackageProgress(state, student.id, date);
    if (!progress) return { kind: 'ok', finance };
    if (progress.planned > 0 && progress.bought === 0)
      return {
        kind: 'need',
        label: 'Нужно принять абонемент',
        amountDue: progress.amount,
        progress,
        finance,
      };
    if (progress.remaining <= 1)
      return {
        kind: 'ending',
        label: progress.remaining < 0 ? 'Абонемент закончился' : 'Абонемент заканчивается',
        amountDue:
          Math.max(0, -progress.remaining) * (+student.price || 0) + (+finance.extraDebt || 0),
        progress,
        finance,
      };
    if (finance.extraDebt > 0)
      return {
        kind: 'need',
        label: 'Есть доплата за разовые занятия',
        amountDue: finance.extraDebt,
        progress,
        finance,
      };
    return { kind: 'ok', label: 'Оплата в порядке', amountDue: 0, progress, finance };
  }
  if (finance.debt > 0)
    return { kind: 'need', label: 'Есть долг', amountDue: finance.debt, finance };
  return {
    kind: 'ok',
    label: finance.balance > 0 ? 'Есть аванс' : 'Оплата в порядке',
    amountDue: 0,
    finance,
  };
}

export function getPaymentRows(state, date = new Date()) {
  return state.students
    .map((student) => ({ student, ...getStudentPaymentState(state, student, date) }))
    .sort((a, b) => {
      const priority = { need: 0, ending: 1, ok: 2 };
      return (
        priority[a.kind] - priority[b.kind] || a.student.name.localeCompare(b.student.name, 'ru')
      );
    });
}

export function getPaymentAttentionRows(state, date = new Date()) {
  return getPaymentRows(state, date).filter((row) => row.kind !== 'ok');
}

export function getMonthlyPaymentSummary(state, date = new Date()) {
  const { start, end } = monthBounds(date);
  const payments = state.payments.filter((payment) => {
    const time = new Date(payment.date).getTime();
    return time >= start && time < end && !payment.ledgerOnly;
  });
  const received = payments.reduce((sum, payment) => sum + (+payment.amount || 0), 0);
  const rows = getPaymentRows(state, date);
  const debt = rows.reduce((sum, row) => sum + (+row.amountDue || 0), 0);
  const attention = rows.filter((row) => row.kind !== 'ok').length;
  return { received, debt, attention, payments: payments.length };
}

export function getPackageMonthRows(state, date = new Date()) {
  return state.students
    .filter((student) => student.payType === 'package')
    .map((student) => ({ student, progress: getPackageProgress(state, student.id, date) }));
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

export function expectedPackageLessons(student, date) {
  const billingSince = +student.billingSince || +student.createdAt || 0;
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
  if (billingSince >= monthEnd) return 0;
  return billingSince > monthStart
    ? countMonthlyRecurringLessonsFrom(student.scheduleSlots || [], date, billingSince)
    : countMonthlyRecurringLessons(student.scheduleSlots || [], date);
}
