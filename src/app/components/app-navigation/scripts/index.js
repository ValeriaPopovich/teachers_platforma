import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { getPaymentAttentionRows } from '../../../../modules/payments/payments.selectors.js';
import { useAppState } from '../../../../state/use-app-state.js';
import {
  ACTIVE_PAGE_STORAGE_KEY,
  DEFAULT_PAGE,
  pageFromHash,
  pageFromPath,
} from '../../../navigation-state.js';
import { NAVIGATION_PAGES } from './constants.js';

export default {
  name: 'AppNavigation',
  setup() {
    const state = useAppState();
    const activePage = ref(
      pageFromHash(window.location.hash) ||
        pageFromPath(window.location.pathname) ||
        sessionStorage.getItem(ACTIVE_PAGE_STORAGE_KEY) ||
        DEFAULT_PAGE,
    );
    const paymentAttentionCount = computed(
      () => getPaymentAttentionRows(state.value, new Date()).length,
    );
    const pages = computed(() =>
      NAVIGATION_PAGES.map((page) => ({
        ...page,
        badgeClasses: { show: page.name === 'payments' && paymentAttentionCount.value > 0 },
        badgeText: page.name === 'payments' ? paymentAttentionCount.value || '' : '',
        classes: { active: activePage.value === page.name, 'nav-secondary': page.secondary },
        showBadge: page.name === 'payments',
      })),
    );

    function onPageChange(event) {
      activePage.value = event.detail.page;
    }

    onMounted(() => window.addEventListener('app:page-change', onPageChange));
    onBeforeUnmount(() => window.removeEventListener('app:page-change', onPageChange));

    return { pages };
  },
};
