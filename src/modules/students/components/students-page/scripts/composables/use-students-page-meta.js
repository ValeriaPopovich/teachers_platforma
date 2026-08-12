import { onBeforeUnmount, onMounted, ref } from 'vue';

export function useStudentsPageMeta() {
  const studentCount = ref(0);
  const groupCount = ref(0);
  const updatedLabel = ref('Обновлено: сейчас');

  function onStudentsListChange(event) {
    studentCount.value = event.detail.rows.length;
  }

  function onGroupsListChange(event) {
    groupCount.value = event.detail.rows.length;
  }

  function onStudentsUpdated(event) {
    updatedLabel.value = event.detail.label;
  }

  onMounted(() => {
    window.addEventListener('app:students-list-change', onStudentsListChange);
    window.addEventListener('app:groups-list-change', onGroupsListChange);
    window.addEventListener('app:students-updated', onStudentsUpdated);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('app:students-list-change', onStudentsListChange);
    window.removeEventListener('app:groups-list-change', onGroupsListChange);
    window.removeEventListener('app:students-updated', onStudentsUpdated);
  });

  return { groupCount, studentCount, updatedLabel };
}
