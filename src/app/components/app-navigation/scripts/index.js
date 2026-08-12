import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { NAVIGATION_PAGES } from './constants.js';

export default {
  name: 'AppNavigation',
  setup() {
    const activePage = ref(sessionStorage.getItem('tutorCabinet_activePage') || 'dashboard');
    const paymentAttentionCount = ref(0);
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

    function onPaymentAttentionChange(event) {
      paymentAttentionCount.value = event.detail.count;
    }

    onMounted(() => {
      window.addEventListener('app:page-change', onPageChange);
      window.addEventListener('app:payment-attention-change', onPaymentAttentionChange);
    });
    onBeforeUnmount(() => {
      window.removeEventListener('app:page-change', onPageChange);
      window.removeEventListener('app:payment-attention-change', onPaymentAttentionChange);
    });

    return { pages };
  },
};
