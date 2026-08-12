import { UiIcon } from '@icons';
import { computed } from 'vue';

import { lessonCountWord, money } from '../../../../../shared/format.js';

export default {
  name: 'PaymentBalanceItem',
  components: { UiIcon },
  props: {
    /** Строка расчёта: ученик, статус оплаты и прогресс абонемента. */
    row: { type: Object, required: true },
  },
  emits: ['pay'],
  setup(props, { emit }) {
    const student = computed(() => props.row.student);
    const bought = computed(() => {
      if (student.value.payType !== 'package') return 1;
      const rawBought = props.row.progress?.bought || 0;
      const used = props.row.progress?.used || 0;
      return Math.max(1, Math.round(student.value.packageSize || rawBought || used));
    });
    const used = computed(() => props.row.progress?.used || (props.row.kind === 'ok' ? 1 : 0));
    const percent = computed(() =>
      Math.max(4, Math.min(100, Math.round((used.value / bought.value) * 100))),
    );
    const priceLabel = computed(() =>
      student.value.payType === 'package'
        ? `Абонемент · ${money(student.value.price)}`
        : `Разовые занятия · ${money(student.value.price)}`,
    );
    const packageLabel = computed(() =>
      student.value.payType === 'package' ? `Абонемент ${bought.value} занятий` : 'Разовая оплата',
    );
    const progressText = computed(() =>
      student.value.payType === 'package'
        ? `Проведено ${used.value} из ${bought.value} ${lessonCountWord(bought.value)}`
        : props.row.label,
    );
    const stateText = computed(() => {
      const { kind, label, amountDue } = props.row;
      if (kind === 'ok' || !(amountDue > 0)) return label;
      return `${label} · ${money(amountDue)}`;
    });
    const paymentText = computed(() => {
      if (!(props.row.amountDue > 0)) return stateText.value;
      const lessonsDue = Math.max(
        0,
        Math.ceil((+props.row.amountDue || 0) / (+student.value.price || 1)),
      );
      return `· ${lessonsDue} ${lessonCountWord(lessonsDue)}`;
    });
    const actionLabel = computed(() =>
      student.value.payType === 'package' && props.row.kind === 'ending'
        ? 'Пополнить'
        : 'Принять оплату',
    );
    const amountLabel = computed(() => money(props.row.amountDue));

    function onActionClick() {
      emit('pay', student.value.id, props.row.amountDue);
    }

    return {
      actionLabel,
      amountLabel,
      onActionClick,
      packageLabel,
      percent,
      priceLabel,
      progressText,
      paymentText,
      used,
      bought,
    };
  },
};
