import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

export function useStudentsListBridge() {
  const rows = ref([]);
  const emptyReason = ref('initial');
  const isEmpty = computed(() => rows.value.length === 0);

  function onStudentsListChange(event) {
    rows.value = event.detail.rows;
    emptyReason.value = event.detail.emptyReason;
  }

  onMounted(() => window.addEventListener('app:students-list-change', onStudentsListChange));
  onBeforeUnmount(() =>
    window.removeEventListener('app:students-list-change', onStudentsListChange),
  );

  return { emptyReason, isEmpty, rows };
}
