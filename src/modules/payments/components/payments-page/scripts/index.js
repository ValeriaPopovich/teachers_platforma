import { UiIcon } from '@icons';
import { UiButton, UiInput, UiPageLayout } from '@ui';
import { computed, reactive, ref } from 'vue';

import { money } from '../../../../../shared/format.js';
import PaymentBalanceItem from '../../payment-balance-item/index.vue';
import PaymentHistoryItem from '../../payment-history-item/index.vue';
import { usePaymentsBridge } from './composables/use-payments-bridge.js';

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

function withinDays(dateValue, days) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - Math.max(0, days - 1));
  return new Date(dateValue) >= from;
}

export default {
  name: 'PaymentsPage',
  components: { PaymentBalanceItem, PaymentHistoryItem, UiButton, UiIcon, UiInput, UiPageLayout },
  setup() {
    const { model } = usePaymentsBridge();
    const activeTab = ref('attention');
    const query = ref('');
    const expanded = reactive({ attention: false, all: false, history: false });
    const historyDays = ref(31);
    const historyStudentId = ref('');
    const tabRefs = {};

    const filteredRows = computed(() => {
      const needle = query.value.trim().toLocaleLowerCase('ru');
      if (!needle) return model.value.rows;
      return model.value.rows.filter((row) =>
        row.student.name.toLocaleLowerCase('ru').includes(needle),
      );
    });
    const attentionRows = computed(() => filteredRows.value.filter((row) => row.kind !== 'ok'));
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

    const filteredHistory = computed(() =>
      model.value.history.filter(
        (payment) =>
          withinDays(payment.date, historyDays.value) &&
          (!historyStudentId.value || payment.studentId === historyStudentId.value),
      ),
    );
    const visibleHistory = computed(() =>
      expanded.history
        ? filteredHistory.value
        : filteredHistory.value.slice(0, LIST_LIMITS.history),
    );
    const historyHint = computed(() =>
      historyDays.value === 45 ? 'За последние 45 дней' : 'За текущий месяц',
    );

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
      window.dispatchEvent(
        new CustomEvent('app:payments-open-form', { detail: { studentId, amount } }),
      );
    }

    function onHistoryDelete(id) {
      window.dispatchEvent(new CustomEvent('app:payments-delete-payment', { detail: { id } }));
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
      historyDays,
      historyHint,
      historyStudentId,
      model,
      onBalancePay,
      onHistoryDelete,
      onTabClick,
      onTabsKeydown,
      query,
      setTabRef,
      statCards,
      tabs: TABS,
      toggleExpand,
      visibleAll,
      visibleAttention,
      visibleHistory,
    };
  },
};
