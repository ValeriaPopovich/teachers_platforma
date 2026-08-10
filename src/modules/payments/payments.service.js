export function createPaymentsService({ store, uid, now = () => Date.now() }) {
  function recordPayment(input) {
    const student = store.getState().students.find((item) => item.id === input.studentId);
    if (!student) return { ok: false, code: 'STUDENT_NOT_FOUND', message: 'Выберите ученика.' };
    const amount = +input.amount || 0;
    if (amount <= 0) return { ok: false, code: 'INVALID_AMOUNT', message: 'Введите сумму оплаты.' };
    const payment = {
      id: input.id || uid(),
      studentId: student.id,
      date: input.date,
      amount,
      note: String(input.note || '').trim(),
      createdAt: input.createdAt || now(),
      billingType: student.payType === 'package' ? 'package' : 'single',
    };
    if (student.payType === 'package')
      payment.packageLessons = Math.max(1, +input.packageLessons || 0);
    store.update(input.id ? 'payments:update' : 'payments:record', (draft) => {
      if (input.id) {
        const index = draft.payments.findIndex((item) => item.id === input.id);
        if (index >= 0) draft.payments[index] = { ...draft.payments[index], ...payment };
      } else draft.payments.push(payment);
    });
    return { ok: true, value: payment };
  }

  function removePayment(id) {
    const payment = store.getState().payments.find((item) => item.id === id);
    if (!payment) return { ok: false, code: 'NOT_FOUND', message: 'Платёж не найден.' };
    store.update('payments:remove', (draft) => {
      draft.payments = draft.payments.filter((item) => item.id !== id);
      if (payment.lessonId) {
        const lesson = draft.lessons.find((item) => item.id === payment.lessonId);
        if (lesson?.payment === 'paid') lesson.payment = 'unpaid';
      }
    });
    return { ok: true, value: payment };
  }

  return { recordPayment, removePayment };
}
