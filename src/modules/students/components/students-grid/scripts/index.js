import StudentCard from '../../student-card/index.vue';
import StudentsEmptyState from '../../students-empty-state/index.vue';

export default {
  name: 'StudentsGrid',
  components: { StudentCard, StudentsEmptyState },
  props: {
    /** Подготовленные строки карточек учеников. */
    rows: { type: Array, required: true },
    /** Причина пустого состояния, если строк нет. */
    emptyReason: { type: String, required: true },
  },
};
