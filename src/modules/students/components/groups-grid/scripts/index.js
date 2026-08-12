import GroupCard from '../../group-card/index.vue';
import GroupsEmptyState from '../../groups-empty-state/index.vue';
import { useGroupsListBridge } from './composables/index.js';

export default {
  name: 'GroupsGrid',
  components: { GroupCard, GroupsEmptyState },
  setup() {
    return useGroupsListBridge();
  },
};
