import { UiPageLayout } from '@ui';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

import { useAppState } from '../../../../../state/use-app-state.js';
import { buildGroupRows, buildStudentRows } from '../../../students.selectors.js';
import GroupForm from '../../group-form/index.vue';
import GroupsGrid from '../../groups-grid/index.vue';
import StudentForm from '../../student-form/index.vue';
import StudentProfile from '../../student-profile/index.vue';
import StudentsGrid from '../../students-grid/index.vue';
import StudentsToolbar from '../../students-toolbar/index.vue';

export default {
  name: 'StudentsPage',
  components: {
    GroupForm,
    GroupsGrid,
    StudentForm,
    StudentProfile,
    StudentsGrid,
    StudentsToolbar,
    UiPageLayout,
  },
  setup() {
    const state = useAppState();
    const query = ref('');
    const filter = ref('all');
    const studentScroller = ref(null);
    const groupScroller = ref(null);
    const studentNavigation = reactive({ previous: false, next: false });
    const groupNavigation = reactive({ previous: false, next: false });

    const studentRows = computed(() =>
      buildStudentRows(state.value, { query: query.value, filter: filter.value }),
    );
    const groupRows = computed(() => buildGroupRows(state.value, { query: query.value }));
    const studentsEmptyReason = computed(() =>
      state.value.students.length ? 'filtered' : 'initial',
    );
    const groupsEmptyReason = computed(() => (state.value.groups.length ? 'filtered' : 'initial'));
    const studentCount = computed(() => state.value.students.length);
    const groupCount = computed(() => state.value.groups.length);

    const updateNavigation = (scroller, navigation) => {
      if (!scroller) return;

      const maximumScroll = scroller.scrollWidth - scroller.clientWidth;
      navigation.previous = scroller.scrollLeft > 2;
      navigation.next = maximumScroll > 2 && scroller.scrollLeft < maximumScroll - 2;
    };
    const updateAllNavigation = () => {
      updateNavigation(studentScroller.value, studentNavigation);
      updateNavigation(groupScroller.value, groupNavigation);
    };
    const scrollCarousel = (scroller, direction) => {
      if (!scroller) return;

      const firstCard = scroller.querySelector('.student-card');
      const cardWidth = firstCard?.getBoundingClientRect().width ?? scroller.clientWidth * 0.8;
      const gap = Number.parseFloat(getComputedStyle(scroller).columnGap) || 0;
      const visibleCards = Math.max(1, Math.floor(scroller.clientWidth / (cardWidth + gap)));

      scroller.scrollBy({ left: direction * (cardWidth + gap) * visibleCards, behavior: 'smooth' });
    };

    let resizeObserver;
    onMounted(() => {
      const scrollers = [studentScroller.value, groupScroller.value].filter(Boolean);
      resizeObserver = new ResizeObserver(updateAllNavigation);
      scrollers.forEach((scroller) => {
        resizeObserver.observe(scroller);
        scroller.addEventListener('scroll', updateAllNavigation, { passive: true });
      });
      updateAllNavigation();
    });
    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      [studentScroller.value, groupScroller.value]
        .filter(Boolean)
        .forEach((scroller) => scroller.removeEventListener('scroll', updateAllNavigation));
    });
    watch([studentRows, groupRows], () => nextTick(updateAllNavigation), { flush: 'post' });

    return {
      groupCount,
      groupNavigation,
      groupRows,
      groupScroller,
      groupsEmptyReason,
      filter,
      query,
      scrollCarousel,
      studentCount,
      studentNavigation,
      studentRows,
      studentScroller,
      studentsEmptyReason,
    };
  },
};
