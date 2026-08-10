export function createModalManager(root = document, { ask } = {}) {
  const snapshots = new Map();
  let lastFocus = null;

  function formSnapshot(form) {
    return JSON.stringify(
      [...form.elements]
        .filter((control) => !['button', 'submit', 'reset', 'file'].includes(control.type))
        .map((control, index) => ({
          key: control.name || control.id || String(index),
          value: ['checkbox', 'radio'].includes(control.type) ? control.checked : control.value,
        })),
    );
  }

  function open(id) {
    const wrap = root.getElementById(id);
    if (!wrap) return;
    const modal = wrap.querySelector('.modal');
    if (modal) modal.scrollTop = 0;
    lastFocus = root.activeElement;
    wrap.classList.add('open');
    root.documentElement.classList.add('modal-open');
    const form = wrap.querySelector('form');
    if (form && id !== 'onboardingModal') snapshots.set(id, formSnapshot(form));
    requestAnimationFrame(() => {
      const focusable = modal?.querySelector(
        'input:not([type=hidden]),select,textarea,.modal-foot .btn.primary,button:not(.close),button',
      );
      focusable?.focus?.();
    });
  }

  function closeAll() {
    root.querySelectorAll('.modal-wrap').forEach((wrap) => wrap.classList.remove('open'));
    snapshots.clear();
    root.documentElement.classList.remove('modal-open');
    if (lastFocus && root.contains(lastFocus)) lastFocus.focus?.();
    lastFocus = null;
  }

  async function requestClose() {
    if (root.getElementById('onboardingModal')?.classList.contains('open')) return false;
    const dirty = [...root.querySelectorAll('.modal-wrap.open')].some((wrap) => {
      const form = wrap.querySelector('form');
      return form && snapshots.has(wrap.id) && formSnapshot(form) !== snapshots.get(wrap.id);
    });
    if (
      dirty &&
      ask &&
      !(await ask(
        'Введённые данные не сохранятся.',
        'Закрыть без сохранения?',
        'Закрыть без сохранения',
      ))
    )
      return false;
    closeAll();
    return true;
  }

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const wrap = [...root.querySelectorAll('.modal-wrap.open')].pop();
    if (!wrap) return;
    const focusable = [
      ...wrap.querySelectorAll(
        'a[href],button:not([disabled]),input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    ].filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!wrap.contains(root.activeElement)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && root.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && root.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  return { open, closeAll, requestClose, formSnapshot };
}
