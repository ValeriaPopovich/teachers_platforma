/**
 * Единая книга учёта: деньги считаются по фактам, занятия — только отображение.
 * Начисление рождается вместе с проведённым занятием и берёт его собственную
 * цену (`amount`), поэтому смена цены в карточке ученика не переписывает прошлое.
 */
export const CHARGED_STATUSES = Object.freeze(['done', 'paid_missed']);
export const RESERVED_STATUSES = Object.freeze(['planned', 'unconfirmed']);
export const ACTIVE_STATUSES = Object.freeze([...RESERVED_STATUSES, ...CHARGED_STATUSES]);

/** Пробное занятие бесплатно всегда — остальные стоят свою цену. */
export const isChargeable = (lesson) => lesson?.lessonKind !== 'trial';
export const lessonCharge = (lesson) => (isChargeable(lesson) ? +lesson.amount || 0 : 0);

const paymentTime = (payment) =>
  Math.max(+payment.createdAt || 0, new Date(payment.date).getTime());

export function chargedLessons(data, id, cutoff = 0) {
  return (data.lessons || []).filter(
    (lesson) =>
      lesson.studentId === id &&
      CHARGED_STATUSES.includes(lesson.status) &&
      new Date(lesson.date).getTime() >= cutoff,
  );
}

export function countedPayments(data, id, cutoff = 0) {
  return (data.payments || []).filter(
    (payment) => payment.studentId === id && !payment.ledgerOnly && paymentTime(payment) >= cutoff,
  );
}

export function finances(data, id) {
  const student = (data.students || []).find((item) => item.id === id);
  const cutoff = +student?.billingSince || 0;
  const charged = chargedLessons(data, id, cutoff).reduce(
    (sum, lesson) => sum + lessonCharge(lesson),
    0,
  );
  const paid = countedPayments(data, id, cutoff).reduce(
    (sum, payment) => sum + (+payment.amount || 0),
    0,
  );
  const balance = paid - charged;
  return { charged, paid, balance, debt: Math.max(0, -balance) };
}
