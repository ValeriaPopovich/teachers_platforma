import { buildDashboard } from './dashboard.selectors.js';

export function createDashboardView({
  store,
  openLesson,
  openEvent,
  openPayment,
  retentionDays = 45,
}) {
  let bound = false;

  function bind() {
    if (bound) return;
    bound = true;
    window.addEventListener('app:dashboard-open-lesson', (event) => {
      if (event.detail?.id) openLesson?.(event.detail.id);
    });
    window.addEventListener('app:dashboard-open-payment', (event) => {
      openPayment?.(event.detail?.studentId);
    });
    window.addEventListener('app:dashboard-open-event', (event) => {
      if (event.detail?.id) openEvent?.(event.detail.id);
    });
  }

  function render() {
    bind();
    const model = buildDashboard(store.getState(), { now: new Date(), retentionDays });
    window.dispatchEvent(new CustomEvent('app:dashboard-change', { detail: model }));
  }

  return { render };
}
