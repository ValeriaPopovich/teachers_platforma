import { UiIcon } from '@icons';
import { UiHint } from '@ui';
import { computed } from 'vue';

import { lessonCountWord, money } from '../../../../../shared/format.js';

export default {
  name: 'PaymentBalanceItem',
  components: { UiHint, UiIcon },
  props: {
    /** Строка расчёта: ученик, статус оплаты и план месяца. */
    row: { type: Object, required: true },
  },
  emits: ['pay'],
  setup(props, { emit }) {
    const student = computed(() => props.row.student);
    const plan = computed(() => props.row.plan || { lessons: 0, conducted: 0 });
    const total = computed(() => Math.max(1, plan.value.lessons));
    const used = computed(() => plan.value.conducted);
    const percent = computed(() =>
      Math.max(4, Math.min(100, Math.round((used.value / total.value) * 100))),
    );
    const priceLabel = computed(() =>
      student.value.payType === 'package'
        ? `Абонемент · ${money(student.value.price)}`
        : `Разовые занятия · ${money(student.value.price)}`,
    );
    const packageLabel = 'Проведено в этом месяце';
    const progressText = computed(() => {
      const covered = +props.row.covered || 0;
      if (props.row.kind === 'empty') return props.row.label;
      return covered > 0
        ? `Баланса хватает ещё на ${covered} ${lessonCountWord(covered)}`
        : props.row.label;
    });
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
      total,
    };
  },
};
