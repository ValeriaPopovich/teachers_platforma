// Утилиты расписания без DOM/storage/сети. Полная чистая реализация
// generateSchedule/extendAllSchedules — отдельный будущий PR (inline-версия завязана
// на глобальный state и uid-генератор; безопасное извлечение требует Playwright-теста
// на UI-workflow создания расписания).
//
// Здесь — только то, что реально нужно для инвариантов §5.9 и §5.10:
//   deduplicateLessons — гарантия «повторная генерация не создаёт дубли».

/**
 * Убирает дубли занятий, у которых одинаковые (studentId, groupId, date).
 * Сохраняет ПЕРВОЕ вхождение, чтобы вручную добавленные и заполненные занятия
 * (обычно они идут раньше в массиве, т.к. созданы ранее) имели приоритет.
 *
 * @param {Array<{id:string, studentId?:string, groupId?:string, date:string}>} lessons
 * @returns {Array} новый массив без дублей
 */
export function deduplicateLessons(lessons) {
  const seen = new Set();
  const result = [];
  for (const l of lessons) {
    const key = `${l.groupId || ''}|${l.studentId || ''}|${l.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(l);
  }
  return result;
}

/**
 * Проверяет, есть ли конфликт по времени между двумя занятиями (пересечение
 * интервалов). duration — минуты. Не проверяет владельца — это делает вызывающий.
 */
export function timeConflicts(a, b, durationMinutes) {
  const startA = new Date(a.date).getTime();
  const startB = new Date(b.date).getTime();
  const endA = startA + durationMinutes * 60000;
  const endB = startB + durationMinutes * 60000;
  return startA < endB && startB < endA;
}
