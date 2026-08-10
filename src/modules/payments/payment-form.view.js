import { $, escapeHtml } from '../../shared/dom.js';
import { localDay, monthName, money } from '../../shared/format.js';
import { expectedPackageLessons } from './payments.selectors.js';

export function createPaymentFormView({ store, service, modal, dialog, toast }) {
  const form = $('#paymentForm');
  if (!form) return {};

  function fillStudents(selected = '') {
    form.elements.studentId.innerHTML = `<option value="">Выберите...</option>${store.getState().students.map((student) => `<option value="${student.id}">${escapeHtml(student.name)}</option>`).join('')}`;
    form.elements.studentId.value = selected;
  }

  function syncPackage() {
    const student = store.getState().students.find((item) => item.id === form.elements.studentId.value);
    const date = new Date(`${form.elements.date.value || localDay()}T12:00`);
    const packageField = $('#paymentPackageField');
    const isPackage = student?.payType === 'package';
    packageField.style.display = isPackage ? 'block' : 'none';
    if (!student) return;
    if (isPackage) {
      const count = expectedPackageLessons(student, date);
      form.elements.packageLessons.value = count || 1;
      form.elements.amount.value = (count || 1) * (+student.price || 0);
      $('#paymentPackageMonthLabel').textContent = monthName(date).toLowerCase();
    }
  }

  function open(studentId = '') {
    form.reset();
    fillStudents(studentId);
    form.elements.date.value = localDay();
    syncPackage();
    modal.open('paymentModal');
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(form));
    const result = service.recordPayment(input);
    if (!result.ok) { dialog.inform(result.message || 'Не удалось сохранить оплату.', 'Проверьте данные', true); return; }
    modal.closeAll(); toast(`Оплата ${money(result.value.amount)} сохранена`);
  });
  form.elements.studentId.addEventListener('change', syncPackage);
  form.elements.date.addEventListener('change', syncPackage);
  form.elements.packageLessons.addEventListener('input', () => {
    const student = store.getState().students.find((item) => item.id === form.elements.studentId.value);
    if (student?.payType === 'package') form.elements.amount.value = (+form.elements.packageLessons.value || 0) * (+student.price || 0);
  });

  return { open, syncPackage };
}
