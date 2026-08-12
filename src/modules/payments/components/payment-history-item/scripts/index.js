import { UiIcon } from '@icons';
import { computed } from 'vue';

import { formatDate, lessonCountWord, money } from '../../../../../shared/format.js';

export default {
  name: 'PaymentHistoryItem',
  components: { UiIcon },
  props: {
    /** Запись платежа с именем ученика, уже разрешённым по id. */
    payment: { type: Object, required: true },
  },
  emits: ['delete'],
  setup(props, { emit }) {
    const paymentType = computed(() => {
      const { note, billingType, coveredLessons } = props.payment;
      if (note) return note;
      if (billingType !== 'package') return 'Разовая оплата';
      return coveredLessons
        ? `Абонемент · ${coveredLessons} ${lessonCountWord(coveredLessons)}`
        : 'Абонемент';
    });
    const dateLabel = computed(() => formatDate(props.payment.date, true));
    const amountLabel = computed(() => `+${money(props.payment.amount)}`);

    function onDeleteClick() {
      emit('delete', props.payment.id);
    }

    return { amountLabel, dateLabel, onDeleteClick, paymentType };
  },
};
