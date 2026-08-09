/* Progressive enhancement for the payments page tabs.
   Business calculations stay in assets/app.js. */
(() => {
  const page = document.getElementById('page-payments');
  if (!page) return;

  const tabs = [...page.querySelectorAll('[data-payment-view]')];
  const panels = [...page.querySelectorAll('[data-payment-panel]')];
  if (!tabs.length || !panels.length) return;

  function activate(view, { focus = false } = {}) {
    page.dataset.paymentView = view;
    tabs.forEach((tab) => {
      const active = tab.dataset.paymentView === view;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    panels.forEach((panel) => {
      const active = panel.dataset.paymentPanel === view;
      panel.hidden = !active;
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab.dataset.paymentView));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      let nextIndex = index;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      activate(tabs[nextIndex].dataset.paymentView, { focus: true });
    });
  });

  activate(page.dataset.paymentView || 'attention');
})();
