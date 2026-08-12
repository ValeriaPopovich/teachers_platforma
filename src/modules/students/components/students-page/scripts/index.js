import GroupsGrid from '../../groups-grid/index.vue';
import StudentsGrid from '../../students-grid/index.vue';
import StudentsToolbar from '../../students-toolbar/index.vue';
import { useStudentsPageMeta } from './composables/index.js';

export default {
  name: 'StudentsPage',
  components: { GroupsGrid, StudentsGrid, StudentsToolbar, UiPageLayout },
  setup() {
    const { groupCount, studentCount, updatedLabel } = useStudentsPageMeta();
    return { groupCount, studentCount, updatedLabel };
  },
};
import { UiPageLayout } from '@ui';
