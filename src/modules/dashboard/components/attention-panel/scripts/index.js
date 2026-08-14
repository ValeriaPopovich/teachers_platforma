import { UiIcon } from '@icons';
import { UiBadge, UiButton, UiCard } from '@ui';
import { computed, nextTick, ref } from 'vue';

import { dialog, toast } from '../../../../../shared/app-ui.js';
import { money } from '../../../../../shared/format.js';
import { paymentsService } from '../../../../payments/payments.service.js';
import { openLesson } from '../../../../schedule/schedule-ui.js';

const MAX_VISIBLE = 3;

export default {
  name: 'AttentionPanel',
  components: { UiBadge, UiButton, UiCard, UiIcon },
  props: {
    /** Список задач, требующих внимания преподавателя. */
    items: { type: Array, default: () => [] },
  },
  setup(props) {
    const activePaymentId = ref('');
    const expanded = ref(false);
    const listRef = ref(null);
    const maxVisible = MAX_VISIBLE;
    const paymentAmount = ref('');
    const availableItems = computed(() => props.items);
    const visibleItems = computed(() =>
      expanded.value ? availableItems.value : availableItems.value.slice(0, MAX_VISIBLE),
    );

    async function onItemAction(item) {
      if (item.kind === 'fill') {
        openLesson(item.lessonId);
        return;
      }
      activePaymentId.value = item.id;
      paymentAmount.value = Math.round(+item.amountDue || 0);
      await nextTick();
      const input = document.getElementById(`attention-payment-${item.studentId}`);
      input?.focus();
      input?.select();
    }

    function closePaymentEditor() {
      activePaymentId.value = '';
      paymentAmount.value = '';
    }

    function submitPayment(item) {
      const result = paymentsService.recordPayment({
        studentId: item.studentId,
        amount: paymentAmount.value,
      });
      if (!result.ok) {
        dialog.inform(result.message || 'Не удалось сохранить оплату.', 'Проверьте данные', true);
        return;
      }
      closePaymentEditor();
      toast(`Оплата ${money(result.value.amount)} сохранена`);
    }

    function onPrimaryAction(item) {
      if (item.kind === 'pay' && activePaymentId.value === item.id) {
        submitPayment(item);
        return;
      }
      onItemAction(item);
    }

    async function toggleExpanded() {
      expanded.value = !expanded.value;
      if (!expanded.value) {
        await nextTick();
        const listElement = listRef.value?.$el || listRef.value;
        listElement?.scrollTo?.({ top: 0 });
      }
    }

    return {
      expanded,
      activePaymentId,
      closePaymentEditor,
      availableItems,
      listRef,
      maxVisible,
      onItemAction,
      onPrimaryAction,
      paymentAmount,
      submitPayment,
      toggleExpanded,
      visibleItems,
    };
  },
};
