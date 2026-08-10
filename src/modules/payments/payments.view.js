import { $, escapeHtml } from '../../shared/dom.js';
import { formatDate, money, monthName } from '../../shared/format.js';
import { createPaymentFormView } from './payment-form.view.js';
import { getMonthlyPaymentSummary, getPackageMonthRows, getPaymentAttentionRows, getPaymentHistory, getPaymentRows } from './payments.selectors.js';

function paymentStateMarkup(row) {
  const { student } = row;
  const stateText = row.kind === 'ok' ? row.label : row.amountDue > 0 ? `${row.label} · ${money(row.amountDue)}` : row.label;
  const detail = student.payType === 'package' && row.progress
    ? `${row.progress.used} использовано · ${row.progress.bought} куплено · ${row.progress.remaining} осталось`
    : row.finance.balance > 0 ? `Аванс ${money(row.finance.balance)}` : `Начислено ${money(row.finance.charged)} · оплачено ${money(row.finance.paid)}`;
  return `<article class="payment-balance-row state-${row.kind}" data-payment-student="${student.id}"><div class="payment-balance-main"><b>${escapeHtml(student.name)}</b><span>${escapeHtml(student.payType === 'package' ? 'Абонемент' : 'Разовые занятия')}</span></div><div class="payment-balance-state"><b>${escapeHtml(stateText)}</b><small>${escapeHtml(detail)}</small></div><button class="btn payment-row-action" type="button" data-payment-for="${student.id}">Принять оплату</button></article>`;
}

export function createPaymentsView({ store, service, modal, dialog, toast }) {
  let currentView = 'attention';
  const paymentForm = createPaymentFormView({ store, service, modal, dialog, toast });

  function render() {
    const state = store.getState();
    const now = new Date();
    const summary = getMonthlyPaymentSummary(state, now);
    const allRows = getPaymentRows(state, now);
    const attention = getPaymentAttentionRows(state, now);
    const packageRows = getPackageMonthRows(state, now);
    const historyDays = $('#paymentHistoryPeriod')?.value === '45' ? 45 : 31;
    const historyStudent = $('#paymentHistoryStudent')?.value || '';
    const history = getPaymentHistory(state, { days: historyDays, studentId: historyStudent, now });

    $('#analyticsRangeLabel').textContent = monthName(now);
    $('#paymentStats').innerHTML = `<div class="stat"><span>Получено</span><b>${money(summary.received)}</b></div><div class="stat"><span>Нужно получить</span><b>${money(summary.debt)}</b></div><div class="stat"><span>Требуют внимания</span><b>${summary.attention}</b></div><div class="stat"><span>Платежей</span><b>${summary.payments}</b></div>`;
    $('#paymentAttentionCount').textContent = attention.length;
    $('#paymentAllCount').textContent = allRows.length;
    $('#paymentAttentionPanel').innerHTML = attention.length ? attention.map(paymentStateMarkup).join('') : '<div class="payments-empty-state"><b>Всё оплачено</b><span>Сейчас нет учеников, требующих внимания.</span></div>';
    $('#paymentAllPanel').innerHTML = allRows.length ? allRows.map(paymentStateMarkup).join('') : '<div class="empty">Добавьте учеников, чтобы видеть расчёты.</div>';
    $('#paymentAttentionPanel').hidden = currentView !== 'attention';
    $('#paymentAllPanel').hidden = currentView !== 'all';
    $('#paymentAttentionTab').setAttribute('aria-selected', String(currentView === 'attention'));
    $('#paymentAllTab').setAttribute('aria-selected', String(currentView === 'all'));
    $('#paymentAttentionTab').tabIndex = currentView === 'attention' ? 0 : -1;
    $('#paymentAllTab').tabIndex = currentView === 'all' ? 0 : -1;

    const badge = $('#paymentNavBadge');
    if (badge) { badge.textContent = attention.length || ''; badge.style.display = attention.length ? '' : 'none'; }

    const packageCard = $('#packageMonthCard');
    packageCard.style.display = packageRows.length ? '' : 'none';
    $('#packageMonthLabel').textContent = monthName(now);
    $('#packageMonthMeta').textContent = packageRows.length ? `${packageRows.length} абонем.` : '';
    $('#packageMonthGrid').innerHTML = packageRows.map(({ student, progress }) => `<article class="package-month-item"><div><b>${escapeHtml(student.name)}</b><span>${progress?.planned || 0} занятий по плану</span></div><div class="package-month-progress"><strong>${progress?.used || 0}/${progress?.bought || 0}</strong><small>использовано / куплено</small></div><button class="btn" type="button" data-payment-for="${student.id}">Оплата</button></article>`).join('');

    const historySelect = $('#paymentHistoryStudent');
    if (historySelect) {
      const current = historySelect.value;
      historySelect.innerHTML = `<option value="">Все ученики</option>${state.students.map((student) => `<option value="${student.id}">${escapeHtml(student.name)}</option>`).join('')}`;
      historySelect.value = current;
    }
    $('#paymentHistoryHint').textContent = historyDays === 45 ? 'За последние 45 дней' : 'За текущий месяц';
    $('#paymentHistory').innerHTML = history.length ? history.map((payment) => {
      const student = state.students.find((item) => item.id === payment.studentId);
      return `<article class="payment-history-row"><div><b>${escapeHtml(student?.name || 'Удалённый ученик')}</b><span>${formatDate(payment.date)}${payment.note ? ` · ${escapeHtml(payment.note)}` : ''}</span></div><strong>${money(payment.amount)}</strong><button class="icon-btn" type="button" data-delete-payment="${payment.id}" aria-label="Удалить платёж">×</button></article>`;
    }).join('') : '<div class="empty">Платежей за выбранный период нет.</div>';
  }

  function switchView(view, focus = false) {
    currentView = view;
    render();
    if (focus) $(view === 'attention' ? '#paymentAttentionTab' : '#paymentAllTab')?.focus();
  }

  $('#paymentAttentionTab')?.addEventListener('click', () => switchView('attention'));
  $('#paymentAllTab')?.addEventListener('click', () => switchView('all'));
  $('.payments-tabs')?.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); switchView(currentView === 'attention' ? 'all' : 'attention', true);
  });
  $('#paymentHistoryPeriod')?.addEventListener('change', render);
  $('#paymentHistoryStudent')?.addEventListener('change', render);
  $('#page-payments')?.addEventListener('click', async (event) => {
    const studentId = event.target.closest('[data-payment-for]')?.dataset.paymentFor;
    if (studentId) paymentForm.open(studentId);
    const paymentId = event.target.closest('[data-delete-payment]')?.dataset.deletePayment;
    if (paymentId && await dialog.ask('Удалить этот платёж?', 'Удаление платежа', 'Удалить')) {
      const result = service.removePayment(paymentId);
      if (result.ok) toast('Платёж удалён');
    }
  });

  return { render, openPayment: paymentForm.open };
}
