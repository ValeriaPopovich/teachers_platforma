import { onBeforeUnmount, onMounted, ref } from 'vue';

const EMPTY_MODEL = Object.freeze({
  dayTitle: '',
  progress: { done: 0, total: 0, percent: 0 },
  stats: { lessons: 0, hours: 0 },
  next: null,
  income: { received: 0, goal: 0 },
  timeline: [],
  attention: [],
});

export function useDashboardBridge() {
  const model = ref(EMPTY_MODEL);

  function onDashboardChange(event) {
    model.value = event.detail;
  }

  onMounted(() => window.addEventListener('app:dashboard-change', onDashboardChange));
  onBeforeUnmount(() => window.removeEventListener('app:dashboard-change', onDashboardChange));

  return { model };
}
