export function createDialog(root = document) {
  let resolveCurrent = null;
  const wrap = root.querySelector('#appDialog');
  const card = root.querySelector('#appDialogCard');
  const confirmButton = root.querySelector('#appDialogConfirm');
  const cancelButton = root.querySelector('#appDialogCancel');

  function finish(result) {
    if (!resolveCurrent) return;
    const resolve = resolveCurrent;
    resolveCurrent = null;
    wrap?.classList.remove('open');
    resolve(result);
  }

  confirmButton?.addEventListener('click', () => finish(true));
  cancelButton?.addEventListener('click', () => finish(false));
  wrap?.addEventListener('click', (event) => {
    if (event.target === wrap) finish(false);
  });

  function show({ title = 'Сообщение', message = '', confirmText = 'Хорошо', cancelText = 'Отмена', danger = false, confirmOnly = false } = {}) {
    if (resolveCurrent) resolveCurrent(false);
    if (!wrap || !card || !confirmButton || !cancelButton) return Promise.resolve(false);
    card.scrollTop = 0;
    root.querySelector('#appDialogTitle').textContent = title;
    root.querySelector('#appDialogMessage').textContent = message;
    root.querySelector('#appDialogIcon').textContent = danger ? '!' : 'i';
    confirmButton.textContent = confirmText;
    cancelButton.textContent = cancelText;
    cancelButton.style.display = confirmOnly ? 'none' : '';
    confirmButton.classList.toggle('danger', danger);
    confirmButton.classList.toggle('primary', !danger);
    card.classList.toggle('danger-dialog', danger);
    wrap.classList.add('open');
    requestAnimationFrame(() => (danger && !confirmOnly ? cancelButton : confirmButton).focus());
    return new Promise((resolve) => { resolveCurrent = resolve; });
  }

  return {
    show,
    ask: (message, title = 'Подтверждение', confirmText = 'Продолжить') => show({ title, message, confirmText, danger: true }),
    inform: (message, title = 'Обратите внимание', danger = false) => show({ title, message, confirmOnly: true, danger }),
    finish,
  };
}
