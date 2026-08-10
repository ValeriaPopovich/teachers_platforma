export function finances(data, id) {
  const students = data.students || [];
  const lessons = data.lessons || [];
  const payments = data.payments || [];
  const financeArchive = data.financeArchive || {};
  const student = students.find((item) => item.id === id);
  const cutoff = +(student?.billingSince) || 0;
  const done = lessons.filter((lesson) => lesson.studentId === id && ['done', 'paid_missed'].includes(lesson.status) && new Date(lesson.date).getTime() >= cutoff);
  const archive = financeArchive[id] || {};
  const balancePayments = payments.filter((payment) => payment.studentId === id && !payment.ledgerOnly && Math.max(+payment.createdAt || 0, new Date(payment.date).getTime()) >= cutoff);

  if (student?.payType === 'package') {
    const packagePayments = balancePayments.filter((payment) => payment.billingType === 'package' || +payment.packageLessons > 0);
    const bought = (+archive.packageBought || 0) + packagePayments.reduce((sum, payment) => sum + (+payment.packageLessons || 0), 0);
    const used = (+archive.packageUsed || 0) + done.filter((lesson) => lesson.payment === 'package').length;
    const extraDebt = (+archive.singleCharged || 0) + done.filter((lesson) => lesson.payment === 'unpaid').reduce((sum, lesson) => sum + (+lesson.amount || 0), 0);
    const paid = (+archive.paidAmount || 0) + balancePayments.reduce((sum, payment) => sum + (+payment.amount || 0), 0);
    const balanceLessons = bought - used;
    return {
      charged: used * (+student.price || 0) + extraDebt,
      paid,
      balanceLessons,
      extraDebt,
      debt: Math.max(0, -balanceLessons) * (+student.price || 0) + extraDebt,
      bought,
      used,
      balance: 0,
    };
  }

  const charged = (+archive.singleCharged || 0) + done.filter((lesson) => lesson.payment === 'unpaid').reduce((sum, lesson) => sum + (+lesson.amount || 0), 0);
  const paid = (+archive.paidAmount || 0) + balancePayments.reduce((sum, payment) => sum + (+payment.amount || 0), 0);
  return { charged, paid, balance: paid - charged, debt: Math.max(0, charged - paid) };
}
