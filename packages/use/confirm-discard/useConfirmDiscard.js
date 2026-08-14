/**
 * Guards a form close action behind a confirmation dialog when the form was
 * edited since it was armed. No business terms: `snapshot` and `ask` are
 * supplied by the caller.
 */
export function useConfirmDiscard({ ask, snapshot }) {
  let baseline = null;

  function arm() {
    baseline = JSON.stringify(snapshot());
  }

  function disarm() {
    baseline = null;
  }

  function isDirty() {
    return baseline !== null && JSON.stringify(snapshot()) !== baseline;
  }

  async function confirmDiscard(
    message = 'Введённые данные не сохранятся.',
    title = 'Закрыть без сохранения?',
    confirmText = 'Закрыть без сохранения',
  ) {
    if (!isDirty()) return true;
    return ask(message, title, confirmText);
  }

  return { arm, disarm, isDirty, confirmDiscard };
}
