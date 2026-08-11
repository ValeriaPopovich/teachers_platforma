import { $, escapeHtml } from '../../shared/dom.js';
import { money } from '../../shared/format.js';
import { finances } from './finances.js';

export function createPaymentFormView({ store, service, modal, dialog, toast }) {
  const form = $('#paymentForm');
  if (!form) return {};

  function fillStudents(selected = '') {
    form.elements.studentId.innerHTML = `<option value="">Выберите ученика</option>${store
      .getState()
      .students.map(
        (student) => `<option value="${student.id}">${escapeHtml(student.name)}</option>`,
      )
      .join('')}`;
    form.elements.studentId.value = selected;
  }

  function syncPaymentForm() {
    const student = store
      .getState()
      .students.find((item) => item.id === form.elements.studentId.value);
    const amount = +form.elements.amount.value || 0;
    const price = +student?.price || 0;
    const hint = $('#paymentAmountHint');
    const title = $('#paymentModal .modal-head h2');
    const submit = $('#paymentForm button[type=submit]');
    title.textContent = student?.payType === 'package' ? 'Пополнить абонемент' : 'Добавить оплату';
    submit.textContent =
      student?.payType === 'package' ? 'Пополнить абонемент' : 'Сохранить оплату';
    if (!student) hint.textContent = 'Сначала выберите ученика';
    else if (!price) hint.textContent = 'В карточке ученика не указана стоимость занятия';
    else if (student.payType !== 'package' || !amount)
      hint.textContent = `Стоимость занятия: ${money(price)}`;
    else {
      const paidBefore = +finances(store.getState(), student.id).paid || 0;
      const combined = (((paidBefore % price) + price) % price) + amount;
      const lessons = Math.floor(combined / price + 1e-9);
      const remainder = Math.round(combined % price);
      hint.textContent = `Будет оплачено ещё ${lessons} зан.${remainder ? ` · аванс ${money(remainder)} сохранится` : ''}`;
    }
  }

  function open(studentId = '') {
    form.reset();
    fillStudents(studentId);
    syncPaymentForm();
    modal.open('paymentModal');
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(form));
    const result = service.recordPayment(input);
    if (!result.ok) {
      dialog.inform(result.message || 'Не удалось сохранить оплату.', 'Проверьте данные', true);
      return;
    }
    modal.closeAll();
    toast(`Оплата ${money(result.value.amount)} сохранена`);
  });
  form.elements.studentId.addEventListener('change', syncPaymentForm);
  form.elements.amount.addEventListener('input', syncPaymentForm);

  return { open, syncPaymentForm };
}
