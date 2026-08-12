import StudentCard from '../../student-card/index.vue';
import StudentsEmptyState from '../../students-empty-state/index.vue';
import { useStudentsListBridge } from './composables/index.js';

export default {
  name: 'StudentsGrid',
  components: { StudentCard, StudentsEmptyState },
  setup() {
    return useStudentsListBridge();
  },
};
