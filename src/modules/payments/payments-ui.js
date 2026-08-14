import { reactive } from 'vue';

// UI-only state for the payment form, shared across the payments Vue tree
// and other modules that need to open it (student cards, dashboard).
export const paymentFormUi = reactive({ open: false, studentId: '', amount: 0 });

export function openPaymentForm(studentId = '', amount = 0) {
  paymentFormUi.studentId = studentId;
  paymentFormUi.amount = amount;
  paymentFormUi.open = true;
}

export function closePaymentForm() {
  paymentFormUi.open = false;
}
