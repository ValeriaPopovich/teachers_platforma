function reducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export default {
  name: 'UiCollapse',
  props: { open: { type: Boolean, default: false } },
  methods: {
    beforeEnter(element) {
      element.style.height = '0';
      element.style.opacity = '0';
      element.style.overflow = 'hidden';
    },
    enter(element, done) {
      if (reducedMotion()) {
        done();
        return;
      }
      requestAnimationFrame(() => {
        element.style.height = `${element.scrollHeight}px`;
        element.style.opacity = '1';
      });
      element.addEventListener('transitionend', done, { once: true });
    },
    afterEnter(element) {
      element.style.height = 'auto';
      element.style.overflow = 'visible';
    },
    beforeLeave(element) {
      element.style.height = `${element.scrollHeight}px`;
      element.style.opacity = '1';
      element.style.overflow = 'hidden';
    },
    leave(element, done) {
      if (reducedMotion()) {
        done();
        return;
      }
      requestAnimationFrame(() => {
        element.style.height = '0';
        element.style.opacity = '0';
      });
      element.addEventListener('transitionend', done, { once: true });
    },
  },
};
