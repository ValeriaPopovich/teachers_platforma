import { UiModal } from '@ui';
import { useConfirmDiscard } from '@use';
import { computed, reactive, watch } from 'vue';

import { dialog, toast } from '../../../../../shared/app-ui.js';
import { money } from '../../../../../shared/format.js';
import { useAppState } from '../../../../../state/use-app-state.js';
import { finances } from '../../../finances.js';
import { paymentsService } from '../../../payments.service.js';
import { closePaymentForm, paymentFormUi } from '../../../payments-ui.js';

export default {
  name: 'PaymentForm',
  components: { UiModal },
  setup() {
    const state = useAppState();
    const form = reactive({ studentId: '', amount: '' });

    const student = computed(() => state.value.students.find((item) => item.id === form.studentId));
    const isPackage = computed(() => student.value?.payType === 'package');
    const modalTitle = computed(() =>
      isPackage.value ? 'Пополнить абонемент' : 'Добавить оплату',
    );
    const submitLabel = computed(() =>
      isPackage.value ? 'Пополнить абонемент' : 'Сохранить оплату',
    );
    const amountHint = computed(() => {
      const price = +student.value?.price || 0;
      const amount = +form.amount || 0;
      if (!student.value) return 'Сначала выберите ученика';
      if (!price) return 'В карточке ученика не указана стоимость занятия';
      if (!isPackage.value || !amount) return `Стоимость занятия: ${money(price)}`;
      const paidBefore = +finances(state.value, student.value.id).paid || 0;
      const combined = (((paidBefore % price) + price) % price) + amount;
      const lessons = Math.floor(combined / price + 1e-9);
      const remainder = Math.round(combined % price);
      return `Будет оплачено ещё ${lessons} зан.${remainder ? ` · аванс ${money(remainder)} сохранится` : ''}`;
    });

    const confirmDiscard = useConfirmDiscard({ ask: dialog.ask, snapshot: () => ({ ...form }) });

    watch(
      () => paymentFormUi.open,
      (open) => {
        if (!open) return;
        form.studentId = paymentFormUi.studentId;
        form.amount = +paymentFormUi.amount > 0 ? Math.round(+paymentFormUi.amount) : '';
        confirmDiscard.arm();
      },
    );

    function onFormSubmit() {
      const result = paymentsService.recordPayment(form);
      if (!result.ok) {
        dialog.inform(result.message || 'Не удалось сохранить оплату.', 'Проверьте данные', true);
        return;
      }
      confirmDiscard.disarm();
      closePaymentForm();
      toast(`Оплата ${money(result.value.amount)} сохранена`);
    }

    function onModalClose() {
      closePaymentForm();
    }

    return {
      confirmDiscard,
      amountHint,
      form,
      modalTitle,
      onFormSubmit,
      onModalClose,
      paymentFormUi,
      students: computed(() => state.value.students),
      submitLabel,
    };
  },
};
