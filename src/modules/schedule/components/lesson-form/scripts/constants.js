export const LESSON_KIND_OPTIONS = Object.freeze([
  { value: 'oneoff', label: 'Разовое' },
  { value: 'regular', label: 'Из регулярного расписания' },
  { value: 'trial', label: 'Пробное — бесплатно' },
]);

export const LESSON_STATUS_OPTIONS = Object.freeze([
  { value: 'planned', label: 'Запланировано' },
  { value: 'unconfirmed', label: 'Ждёт отчёта' },
  { value: 'done', label: 'Проведено' },
  { value: 'missed', label: 'Пропуск без оплаты' },
  { value: 'paid_missed', label: 'Пропуск с оплатой' },
  { value: 'moved', label: 'Перенесено' },
  { value: 'cancelled', label: 'Отменено' },
]);

/** Статусы, в которых преподаватель заполняет отчёт об уроке. */
export const REPORT_STATUSES = Object.freeze(['done', 'unconfirmed']);
/** Статусы, в которых занятие стоит денег. */
export const BILLED_STATUSES = Object.freeze(['planned', 'unconfirmed', 'done', 'paid_missed']);

export const HOMEWORK_GRADE_OPTIONS = Object.freeze([
  { value: '5', label: '5 — отлично' },
  { value: '4', label: '4 — хорошо' },
  { value: '3', label: '3 — удовлетворительно' },
  { value: '2', label: '2 — нужно повторить' },
  { value: '1', label: '1 — не выполнено' },
]);
