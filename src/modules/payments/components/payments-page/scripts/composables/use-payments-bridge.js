import { onBeforeUnmount, onMounted, ref } from 'vue';

const EMPTY_MODEL = {
  monthLabel: '',
  stats: { paid: 0, charged: 0, debt: 0, attentionCount: 0 },
  rows: [],
  students: [],
  history: [],
};

export function usePaymentsBridge() {
  const model = ref(EMPTY_MODEL);

  function onPaymentsChange(event) {
    model.value = event.detail;
  }

  onMounted(() => window.addEventListener('app:payments-change', onPaymentsChange));
  onBeforeUnmount(() => window.removeEventListener('app:payments-change', onPaymentsChange));

  return { model };
}
