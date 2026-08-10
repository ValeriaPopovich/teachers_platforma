// Чистый финансовый расчёт, извлечённый из `index.html` (функция `finances`).
// Поведение зеркалит текущую inline-реализацию 1:1 — это characterization baseline
// (см. docs/REFACTORING_SPEC.md §4.1 и ADR-0005). Никаких изменений финансовых правил.
//
// Отличие от inline-версии только в сигнатуре: `finances(data, id)` вместо замыкания
// на модульную переменную `data`. Ни DOM, ни storage, ни Supabase здесь нет.

/**
 * @param {object} data - полное состояние приложения (students, lessons, payments, financeArchive).
 * @param {string} id - id ученика.
 * @returns {{charged:number, paid:number, balance:number, debt:number,
 *            balanceLessons?:number, bought?:number, used?:number}}
 */
export function finances(data, id) {
  const students = data.students || [];
  const lessons = data.lessons || [];
  const payments = data.payments || [];
  const financeArchive = data.financeArchive || {};

  const s = students.find((x) => x.id === id);
  const cutoff = +(s && s.billingSince) || 0;

  const done = lessons.filter(
    (x) =>
      x.studentId === id &&
      ['done', 'paid_missed'].includes(x.status) &&
      new Date(x.date).getTime() >= cutoff,
  );
  const arch = financeArchive[id] || {};
  const balancePayments = payments.filter(
    (p) =>
      p.studentId === id &&
      !p.ledgerOnly &&
      Math.max(+p.createdAt || 0, new Date(p.date).getTime()) >= cutoff,
  );

  if (s && s.payType === 'package') {
    const packagePayments = balancePayments.filter(
      (p) => p.billingType === 'package' || +p.packageLessons > 0,
    );
    const bought =
      (+arch.packageBought || 0) +
      packagePayments.reduce((n, p) => n + (+p.packageLessons || 0), 0);
    const used = (+arch.packageUsed || 0) + done.filter((x) => x.payment === 'package').length;
    const extraDebt =
      (+arch.singleCharged || 0) +
      done.filter((x) => x.payment === 'unpaid').reduce((n, x) => n + (+x.amount || 0), 0);
    const paid =
      (+arch.paidAmount || 0) + balancePayments.reduce((n, p) => n + (+p.amount || 0), 0);
    const balanceLessons = bought - used;
    const wholeLessons = Math.max(0, Math.floor(balanceLessons + 1e-9));
    const creditAmount = Math.max(0, Math.round((balanceLessons - wholeLessons) * (+s.price || 0)));
    return {
      charged: used * (+s.price || 0) + extraDebt,
      paid,
      balanceLessons,
      wholeLessons,
      creditAmount,
      extraDebt,
      debt: Math.max(0, -balanceLessons) * (+s.price || 0) + extraDebt,
      bought,
      used,
      balance: 0,
    };
  }

  const charged =
    (+arch.singleCharged || 0) +
    done.filter((x) => x.payment === 'unpaid').reduce((n, x) => n + (+x.amount || 0), 0);
  const paid = (+arch.paidAmount || 0) + balancePayments.reduce((n, p) => n + (+p.amount || 0), 0);
  return { charged, paid, balance: paid - charged, debt: Math.max(0, charged - paid) };
}
