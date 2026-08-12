import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

export function useGroupsListBridge() {
  const rows = ref([]);
  const emptyReason = ref('initial');
  const isEmpty = computed(() => rows.value.length === 0);

  function onGroupsListChange(event) {
    rows.value = event.detail.rows;
    emptyReason.value = event.detail.emptyReason;
  }

  onMounted(() => window.addEventListener('app:groups-list-change', onGroupsListChange));
  onBeforeUnmount(() => window.removeEventListener('app:groups-list-change', onGroupsListChange));

  return { emptyReason, isEmpty, rows };
}
