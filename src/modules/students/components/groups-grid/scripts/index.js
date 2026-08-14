import GroupCard from '../../group-card/index.vue';
import GroupsEmptyState from '../../groups-empty-state/index.vue';

export default {
  name: 'GroupsGrid',
  components: { GroupCard, GroupsEmptyState },
  props: {
    /** Подготовленные строки карточек групп. */
    rows: { type: Array, required: true },
    /** Причина пустого состояния, если строк нет. */
    emptyReason: { type: String, required: true },
  },
  computed: {
    isEmpty() {
      return this.rows.length === 0;
    },
  },
};
