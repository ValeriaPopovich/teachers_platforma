import { $, escapeHtml } from '../../shared/dom.js';
import { formatDate, money, monthName } from '../../shared/format.js';
import { periodAnalytics } from '../../domain/analytics.js';
import { createPaymentFormView } from './payment-form.view.js';
import {
  getMonthlyPaymentSummary,
  getPackageMonthRows,
  getPaymentAttentionRows,
  getPaymentHistory,
  getPaymentRows,
} from './payments.selectors.js';

const LIST_LIMITS = { attention: 6, all: 8, packages: 6, history: 10 };

function expandButton(key, total, visible, expanded) {
  const hidden = Math.max(0, total - visible);
  if (!hidden && !expanded) return '';
  return `<button class="payments-show-more" type="button" data-payment-expand="${key}" aria-expanded="${expanded}">${expanded ? 'Свернуть список' : `Показать ещё <span>+${hidden}</span>`}</button>`;
}

function paymentStateMarkup(row) {
  const { student } = row;
  const stateText =
    row.kind === 'ok'
      ? row.label
      : row.amountDue > 0
        ? `${row.label} · ${money(row.amountDue)}`
        : row.label;
  const actionLabel =
    student.payType === 'package' && row.kind === 'ending' ? 'Пополнить' : 'Принять оплату';
  return `<article class="payment-balance-item" data-kind="${row.kind}"><div class="payment-balance-main"><b>${escapeHtml(student.name)}</b><small>${escapeHtml(student.payType === 'package' ? 'Абонемент' : 'Разовые занятия')}</small></div><div class="payment-balance-state">${escapeHtml(stateText)}</div><button class="btn payment-row-action" type="button" data-payment-for="${student.id}">${actionLabel}</button></article>`;
}

function visibleRows(rows, key, expanded) {
  return expanded[key] ? rows : rows.slice(0, LIST_LIMITS[key]);
}

export function createPaymentsView({ store, service, modal, dialog, toast }) {
  let currentView = 'attention';
  const expanded = { attention: false, all: false, packages: false, history: false };
  const paymentForm = createPaymentFormView({ store, service, modal, dialog, toast });

  function render() {
    const state = store.getState();
    const now = new Date();
    const summary = getMonthlyPaymentSummary(state, now);
    const monthFrom = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    const analytics = periodAnalytics(state, monthFrom, monthTo);
    const allRows = getPaymentRows(state, now);
    const attention = getPaymentAttentionRows(state, now);
    const packageRows = getPackageMonthRows(state, now);
    const historyDays = $('#paymentHistoryPeriod')?.value === '45' ? 45 : 31;
    const historyStudent = $('#paymentHistoryStudent')?.value || '';
    const history = getPaymentHistory(state, { days: historyDays, studentId: historyStudent, now });

    $('#analyticsRangeLabel').textContent = monthName(now);
    const statTips = [
      'Сколько денег фактически отмечено как полученные в текущем месяце — по дате платежа.',
      'Рассчитанные абонементы месяца плюс запланированные и проведённые разовые занятия.',
      'Общий долг прямо сейчас: неоплаченные занятия, абонементы и дополнительные долги.',
    ];
    $('#paymentStats').innerHTML = [
      [money(analytics.paid), 'Получено за месяц', 'По фактическим платежам', ''],
      [money(analytics.charged), 'Начислено за месяц', 'По расписанию и абонементам', ''],
      [
        money(summary.debt),
        'Долг сейчас',
        summary.attention ? `${summary.attention} чел. требуют оплаты` : 'Задолженности нет',
        summary.debt ? 'debt-stat' : '',
      ],
    ]
      .map(
        ([value, label, note, extra], index) =>
          `<div class="card stat ${extra}"><span class="help-tip" tabindex="0" data-tip="${escapeHtml(statTips[index])}">?</span><div class="value">${value}</div><div class="label">${label}</div><small class="payment-stat-note">${note}</small></div>`,
      )
      .join('');
    $('#paymentAttentionCount').textContent = attention.length;
    $('#paymentAllCount').textContent = allRows.length;

    const visibleAttention = visibleRows(attention, 'attention', expanded);
    $('#paymentAttentionPanel').innerHTML = attention.length
      ? `<div class="payment-balance-stack">${visibleAttention.map(paymentStateMarkup).join('')}</div>${expandButton('attention', attention.length, visibleAttention.length, expanded.attention)}`
      : allRows.length
        ? '<div class="payments-empty"><div><b>Сейчас всё оплачено</b>Ничего делать не нужно — можно спокойно закрывать вкладку.</div></div>'
        : '<div class="payments-empty"><div><b>Учеников пока нет</b>После добавления учеников здесь появятся расчёты.</div></div>';
    const visibleAll = visibleRows(allRows, 'all', expanded);
    $('#paymentAllPanel').innerHTML = allRows.length
      ? `<div class="payment-balance-stack">${visibleAll.map(paymentStateMarkup).join('')}</div>${expandButton('all', allRows.length, visibleAll.length, expanded.all)}`
      : '<div class="payments-empty"><div><b>Учеников пока нет</b>Здесь появится полный список расчётов.</div></div>';
    $('#paymentAttentionPanel').hidden = currentView !== 'attention';
    $('#paymentAllPanel').hidden = currentView !== 'all';
    $('#paymentAttentionTab').setAttribute('aria-selected', String(currentView === 'attention'));
    $('#paymentAllTab').setAttribute('aria-selected', String(currentView === 'all'));
    $('#paymentAttentionTab').tabIndex = currentView === 'attention' ? 0 : -1;
    $('#paymentAllTab').tabIndex = currentView === 'all' ? 0 : -1;

    const badge = $('#paymentNavBadge');
    if (badge) {
      badge.textContent = attention.length;
      badge.classList.toggle('show', attention.length > 0);
    }

    const packageCard = $('#packageMonthCard');
    packageCard.style.display = packageRows.length ? '' : 'none';
    $('#packageMonthLabel').textContent = monthName(now);
    if ($('#packageMonthMeta'))
      $('#packageMonthMeta').textContent = packageRows.length
        ? `${packageRows.length} абонем.`
        : '';
    const visiblePackages = visibleRows(packageRows, 'packages', expanded);
    $('#packageMonthGrid').innerHTML =
      visiblePackages
        .map(({ student, progress }) => {
          const bought = progress?.bought || 0;
          const used = progress?.used || 0;
          const percent = bought
            ? Math.max(0, Math.min(100, Math.round((used / bought) * 100)))
            : 0;
          return `<article class="package-month-item"><div class="package-month-main"><b>${escapeHtml(student.name)}</b><small>${progress?.planned || 0} занятий по плану</small></div><div class="package-month-progress"><div class="package-month-progress-label"><span>Использовано / куплено</span><b>${used}/${bought}</b></div><div class="package-month-progress-track"><i style="width:${percent}%"></i></div></div><button class="btn" type="button" data-payment-for="${student.id}">Оплата</button></article>`;
        })
        .join('') +
      expandButton('packages', packageRows.length, visiblePackages.length, expanded.packages);

    const historySelect = $('#paymentHistoryStudent');
    if (historySelect) {
      const current = historySelect.value;
      historySelect.innerHTML = `<option value="">Все ученики</option>${state.students.map((student) => `<option value="${student.id}">${escapeHtml(student.name)}</option>`).join('')}`;
      historySelect.value = current;
    }
    $('#paymentHistoryHint').textContent =
      historyDays === 45 ? 'За последние 45 дней' : 'За текущий месяц';
    const visibleHistory = visibleRows(history, 'history', expanded);
    $('#paymentHistory').innerHTML = history.length
      ? visibleHistory
          .map((payment) => {
            const student = state.students.find((item) => item.id === payment.studentId);
            return `<article class="payment-history-item"><div class="payment-history-main"><b>${escapeHtml(student?.name || 'Удалённый ученик')}</b><small>${formatDate(payment.date)}${payment.note ? ` · ${escapeHtml(payment.note)}` : ''}</small></div><strong class="payment-history-amount">${money(payment.amount)}</strong><button class="icon-btn" type="button" data-delete-payment="${payment.id}" aria-label="Удалить платёж">×</button></article>`;
          })
          .join('') +
        expandButton('history', history.length, visibleHistory.length, expanded.history)
      : '<div class="payments-empty"><div><b>Платежей за этот период нет</b>Попробуйте другой период или другого ученика.</div></div>';
  }

  function switchView(view, focus = false) {
    currentView = view;
    render();
    if (focus) $(view === 'attention' ? '#paymentAttentionTab' : '#paymentAllTab')?.focus();
  }

  $('#paymentAttentionTab')?.addEventListener('click', () => switchView('attention'));
  $('#paymentAllTab')?.addEventListener('click', () => switchView('all'));
  $('.payments-tabs')?.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 'attention'
        : event.key === 'End'
          ? 'all'
          : currentView === 'attention'
            ? 'all'
            : 'attention';
    switchView(next, true);
  });
  $('#paymentHistoryPeriod')?.addEventListener('change', render);
  $('#paymentHistoryStudent')?.addEventListener('change', render);
  $('#page-payments')?.addEventListener('click', async (event) => {
    const expand = event.target.closest('[data-payment-expand]')?.dataset.paymentExpand;
    if (expand && Object.hasOwn(expanded, expand)) {
      expanded[expand] = !expanded[expand];
      render();
      return;
    }
    const studentId = event.target.closest('[data-payment-for]')?.dataset.paymentFor;
    if (studentId) paymentForm.open(studentId);
    const paymentId = event.target.closest('[data-delete-payment]')?.dataset.deletePayment;
    if (paymentId && (await dialog.ask('Удалить этот платёж?', 'Удаление платежа', 'Удалить'))) {
      const result = service.removePayment(paymentId);
      if (result.ok) toast('Платёж удалён');
    }
  });

  return { render, openPayment: paymentForm.open };
}
