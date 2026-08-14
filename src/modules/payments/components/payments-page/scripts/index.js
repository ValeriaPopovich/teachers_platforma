import { UiIcon } from '@icons';
import { UiButton, UiEmptyState, UiHint, UiInput, UiPageLayout } from '@ui';
import { computed, onBeforeUnmount, reactive, ref } from 'vue';

import { dialog, toast } from '../../../../../shared/app-ui.js';
import { money } from '../../../../../shared/format.js';
import { useAppState } from '../../../../../state/use-app-state.js';
import { buildPaymentsModel } from '../../../payments.selectors.js';
import { paymentsService } from '../../../payments.service.js';
import { openPaymentForm } from '../../../payments-ui.js';
import PaymentBalanceItem from '../../payment-balance-item/index.vue';
import PaymentForm from '../../payment-form/index.vue';
import PaymentHistoryItem from '../../payment-history-item/index.vue';

const LIST_LIMITS = { attention: 6, all: 8, history: 10 };
const TABS = [
  { id: 'attention', label: 'Требуют внимания' },
  { id: 'all', label: 'Все ученики' },
  { id: 'history', label: 'История платежей' },
];
const STAT_TIPS = [
  'Сколько денег фактически отмечено как полученные в текущем месяце — по дате платежа.',
  'Рассчитанные абонементы месяца плюс запланированные и проведённые разовые занятия.',
  'Общий долг прямо сейчас: неоплаченные занятия, абонементы и дополнительные долги.',
];

function dateKey(date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function monthRange() {
  const now = new Date();
  return {
    from: dateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: dateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function formatRange(from, to) {
  const format = (value) =>
    new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return `${format(from)} — ${format(to)}`;
}

export default {
  name: 'PaymentsPage',
  components: {
    PaymentBalanceItem,
    PaymentForm,
    PaymentHistoryItem,
    UiButton,
    UiEmptyState,
    UiHint,
    UiIcon,
    UiInput,
    UiPageLayout,
  },
  setup() {
    const state = useAppState();
    const model = computed(() => buildPaymentsModel(state.value, { now: new Date() }));
    const activeTab = ref('attention');
    const query = ref('');
    const expanded = reactive({ attention: false, all: false, history: false });
    const historyRange = reactive(monthRange());
    const historyRangeDraft = reactive({ ...historyRange });
    const historyRangeOpen = ref(false);
    const historyCalendarMonth = ref(new Date().getMonth());
    const historyCalendarYear = ref(new Date().getFullYear());
    const historyStudentId = ref('');
    const tabRefs = {};

    const filteredRows = computed(() => {
      const needle = query.value.trim().toLocaleLowerCase('ru');
      if (!needle) return model.value.rows;
      return model.value.rows.filter((row) =>
        row.student.name.toLocaleLowerCase('ru').includes(needle),
      );
    });
    const attentionRows = computed(() =>
      filteredRows.value.filter((row) => ['need', 'ending'].includes(row.kind)),
    );
    const visibleAttention = computed(() =>
      expanded.attention
        ? attentionRows.value
        : attentionRows.value.slice(0, LIST_LIMITS.attention),
    );
    const visibleAll = computed(() =>
      expanded.all ? filteredRows.value : filteredRows.value.slice(0, LIST_LIMITS.all),
    );
    const attentionEmptyText = computed(() =>
      model.value.rows.length ? 'Сейчас всё оплачено' : 'Учеников пока нет',
    );
    const attentionEmptyHint = computed(() =>
      model.value.rows.length
        ? 'Ничего делать не нужно — можно спокойно закрывать вкладку.'
        : 'После добавления учеников здесь появятся расчёты.',
    );

    const filteredHistory = computed(() => {
      const from = new Date(`${historyRange.from}T00:00:00`);
      const to = new Date(`${historyRange.to}T23:59:59.999`);
      return model.value.history.filter((payment) => {
        const date = new Date(payment.date);
        return (
          date >= from &&
          date <= to &&
          (!historyStudentId.value || payment.studentId === historyStudentId.value)
        );
      });
    });
    const visibleHistory = computed(() =>
      expanded.history
        ? filteredHistory.value
        : filteredHistory.value.slice(0, LIST_LIMITS.history),
    );
    const currentMonth = monthRange();
    const historyHint = computed(() =>
      historyRange.from === currentMonth.from && historyRange.to === currentMonth.to
        ? 'За текущий месяц'
        : `За период ${formatRange(historyRange.from, historyRange.to)}`,
    );
    const historyRangeLabel = computed(() =>
      historyRange.from === currentMonth.from && historyRange.to === currentMonth.to
        ? 'Этот месяц'
        : formatRange(historyRange.from, historyRange.to),
    );
    const calendarTitle = computed(() =>
      new Date(historyCalendarYear.value, historyCalendarMonth.value).toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric',
      }),
    );
    const calendarDays = computed(() => {
      const first = new Date(historyCalendarYear.value, historyCalendarMonth.value, 1);
      const start = new Date(first);
      start.setDate(1 - ((first.getDay() + 6) % 7));
      return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        const key = dateKey(date);
        return {
          key,
          label: date.getDate(),
          outside: date.getMonth() !== historyCalendarMonth.value,
          selected: key === historyRangeDraft.from || key === historyRangeDraft.to,
          inRange: key >= historyRangeDraft.from && key <= historyRangeDraft.to,
        };
      });
    });

    function toggleHistoryRange() {
      historyRangeDraft.from = historyRange.from;
      historyRangeDraft.to = historyRange.to;
      historyRangeOpen.value = !historyRangeOpen.value;
    }

    function shiftCalendarMonth(amount) {
      const date = new Date(historyCalendarYear.value, historyCalendarMonth.value + amount, 1);
      historyCalendarYear.value = date.getFullYear();
      historyCalendarMonth.value = date.getMonth();
    }

    function selectRangeDay(key) {
      if (historyRangeDraft.from !== historyRangeDraft.to) {
        historyRangeDraft.from = key;
        historyRangeDraft.to = key;
      } else if (key < historyRangeDraft.from) {
        historyRangeDraft.from = key;
      } else {
        historyRangeDraft.to = key;
      }
    }

    function applyHistoryRange() {
      historyRange.from = historyRangeDraft.from;
      historyRange.to = historyRangeDraft.to;
      expanded.history = false;
      historyRangeOpen.value = false;
    }

    function resetHistoryRange() {
      Object.assign(historyRangeDraft, monthRange());
      applyHistoryRange();
    }

    function closeHistoryRange(event) {
      if (!event.target.closest('.payments-period-picker')) historyRangeOpen.value = false;
    }

    document.addEventListener('pointerdown', closeHistoryRange);
    onBeforeUnmount(() => document.removeEventListener('pointerdown', closeHistoryRange));

    const statCards = computed(() => {
      const { stats } = model.value;
      return [
        {
          key: 'paid',
          label: 'Фактически получено',
          value: money(stats.paid),
          note: 'По фактическим платежам',
          tip: STAT_TIPS[0],
          extra: 'received-stat',
          chip: 'В норме',
        },
        {
          key: 'charged',
          label: 'Начислено за месяц',
          value: money(stats.charged),
          note: 'По расписанию и абонементам',
          tip: STAT_TIPS[1],
          extra: 'charged-stat',
          chip: 'План',
        },
        {
          key: 'debt',
          label: 'Долг сейчас',
          value: money(stats.debt),
          note: stats.attentionCount
            ? `${stats.attentionCount} чел. требуют оплаты`
            : 'Задолженности нет',
          tip: STAT_TIPS[2],
          extra: stats.debt ? 'debt-stat' : '',
          chip: stats.debt ? 'Требует оплаты' : 'В норме',
        },
      ];
    });

    function expandButtonLabel(key, total, visible) {
      const hidden = Math.max(0, total - visible);
      return expanded[key] ? 'Свернуть список' : `Показать ещё +${hidden}`;
    }

    function toggleExpand(key) {
      expanded[key] = !expanded[key];
    }

    function setTabRef(id, element) {
      if (element) tabRefs[id] = element;
    }

    function onTabClick(id) {
      activeTab.value = id;
    }

    function onTabsKeydown(event) {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const ids = TABS.map((tab) => tab.id);
      const index = ids.indexOf(activeTab.value);
      const next =
        event.key === 'Home'
          ? ids[0]
          : event.key === 'End'
            ? ids.at(-1)
            : ids[(index + (event.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length];
      activeTab.value = next;
      tabRefs[next]?.focus();
    }

    function onBalancePay(studentId, amount) {
      openPaymentForm(studentId, amount);
    }

    async function onHistoryDelete(id) {
      if (!(await dialog.ask('Удалить этот платёж?', 'Удаление платежа', 'Удалить'))) return;
      const result = paymentsService.removePayment(id);
      if (result.ok) toast('Платёж удалён');
    }

    return {
      activeTab,
      attentionEmptyHint,
      attentionEmptyText,
      attentionRows,
      expandButtonLabel,
      expanded,
      filteredHistory,
      filteredRows,
      applyHistoryRange,
      calendarDays,
      calendarTitle,
      historyHint,
      historyRangeLabel,
      historyRangeOpen,
      historyStudentId,
      model,
      onBalancePay,
      onHistoryDelete,
      onTabClick,
      onTabsKeydown,
      openPaymentForm,
      query,
      resetHistoryRange,
      selectRangeDay,
      setTabRef,
      shiftCalendarMonth,
      statCards,
      tabs: TABS,
      toggleExpand,
      toggleHistoryRange,
      visibleAll,
      visibleAttention,
      visibleHistory,
    };
  },
};
