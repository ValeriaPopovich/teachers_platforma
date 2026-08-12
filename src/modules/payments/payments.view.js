import { monthName } from '../../shared/format.js';
import { periodAnalytics } from '../../domain/analytics.js';
import { createPaymentFormView } from './payment-form.view.js';
import {
  getMonthlyPaymentSummary,
  getPaymentHistory,
  getPaymentRows,
} from './payments.selectors.js';

export function createPaymentsView({ store, service, modal, dialog, toast }) {
  const paymentForm = createPaymentFormView({ store, service, modal, dialog, toast });
  let bound = false;

  function bind() {
    if (bound) return;
    bound = true;
    window.addEventListener('app:payments-open-form', (event) => {
      paymentForm.open(event.detail?.studentId, event.detail?.amount);
    });
    window.addEventListener('app:payments-delete-payment', async (event) => {
      const id = event.detail?.id;
      if (!id) return;
      if (!(await dialog.ask('Удалить этот платёж?', 'Удаление платежа', 'Удалить'))) return;
      const result = service.removePayment(id);
      if (result.ok) toast('Платёж удалён');
    });
  }

  function render() {
    bind();
    const state = store.getState();
    const now = new Date();
    const summary = getMonthlyPaymentSummary(state, now);
    const monthFrom = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    const analytics = periodAnalytics(state, monthFrom, monthTo);
    const rows = getPaymentRows(state, now);
    const attentionCount = rows.filter((row) => row.kind !== 'ok').length;
    const history = getPaymentHistory(state, { days: 45, now }).map((payment) => ({
      ...payment,
      studentName:
        state.students.find((student) => student.id === payment.studentId)?.name ||
        'Удалённый ученик',
    }));

    window.dispatchEvent(
      new CustomEvent('app:payments-change', {
        detail: {
          monthLabel: monthName(now),
          stats: {
            paid: analytics.paid,
            charged: analytics.charged,
            debt: summary.debt,
            attentionCount,
          },
          rows,
          students: state.students.map(({ id, name }) => ({ id, name })),
          history,
        },
      }),
    );
    window.dispatchEvent(
      new CustomEvent('app:payment-attention-change', { detail: { count: attentionCount } }),
    );
  }

  return { render, openPayment: paymentForm.open };
}
