import { BILLED_STATUSES, REPORT_STATUSES } from './constants.js';

/**
 * Какие блоки формы показывать при выбранном статусе.
 * Проведено и «Ждёт отчёта» — полный отчёт; запланированное занятие ещё не
 * оценивают и родителю о нём не пишут; отмена, пропуск и перенос оставляют
 * только основные данные и комментарий.
 */
export function lessonFieldVisibility({
  status = 'planned',
  lessonKind = 'oneoff',
  groupMode = false,
  hasStudent = false,
} = {}) {
  const report = REPORT_STATUSES.includes(status);
  const planned = status === 'planned';
  const billed = BILLED_STATUSES.includes(status) && lessonKind !== 'trial' && !groupMode;
  return {
    attendance: groupMode && report,
    movedTo: status === 'moved',
    amount: billed,
    payment: billed,
    topics: report || planned,
    previousHomework: report || planned,
    report,
    parentMessage: report && hasStudent,
  };
}
