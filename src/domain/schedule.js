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

/**
 * Возвращает владельца для редактируемого занятия.
 * Индивидуальное занятие можно передать другому ученику. Преобразование
 * индивидуального занятия в групповое (и наоборот) требует отдельной операции,
 * потому что групповая встреча хранится как несколько связанных записей.
 */
export function existingLessonOwnerPatch(lesson, { type, id }) {
  if (!lesson || !id) return null;
  if (lesson.groupId) {
    return type === 'g' && id === lesson.groupId
      ? { groupId: lesson.groupId, seriesId: lesson.seriesId }
      : null;
  }
  return type === 's' ? { studentId: id } : null;
}

/** Диапазон дат для переключателя «день / неделя / месяц». */
export function calendarViewRange(view, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (view === 'month') {
    start.setDate(1);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + ((7 - end.getDay()) % 7));
    return { start, days: Math.round((end - start) / 864e5) + 1 };
  }
  if (view === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return {
    start,
    days: view === 'day' ? 1 : 7,
  };
}

/** Все повторения регулярных слотов в календарном месяце, отсортированные по дате. */
export function monthlyRecurringDates(slots = [], date = new Date()) {
  const year = date.getFullYear(),
    month = date.getMonth(),
    days = new Date(year, month + 1, 0).getDate();
  const dates = [];
  for (let day = 1; day <= days; day++) {
    const weekday = new Date(year, month, day).getDay();
    slots
      .filter((slot) => +slot.day === weekday)
      .forEach((slot) => {
        const [hours = 0, minutes = 0] = String(slot.time || '00:00')
          .split(':')
          .map(Number);
        dates.push(new Date(year, month, day, hours, minutes));
      });
  }
  return dates.sort((a, b) => a - b);
}

/** Точное число повторений регулярных слотов в календарном месяце. */
export function countMonthlyRecurringLessons(slots = [], date = new Date()) {
  return monthlyRecurringDates(slots, date).length;
}

/** Число регулярных занятий месяца, которые начинаются не раньше указанного момента. */
export function countMonthlyRecurringLessonsFrom(slots = [], date = new Date(), fromMs = 0) {
  return monthlyRecurringDates(slots, date).filter((lessonDate) => lessonDate.getTime() >= +fromMs)
    .length;
}

export function isProtectedAutomaticLesson(lesson) {
  return (
    lesson.manualEdited ||
    lesson.status !== 'planned' ||
    !!(
      lesson.prepNote ||
      lesson.nextNote ||
      lesson.topics ||
      lesson.homework ||
      lesson.comment ||
      lesson.testDone === 'yes' ||
      lesson.reportFilled
    )
  );
}

function localDateTime(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/** Устойчивый ключ исключения одного повторения из регулярного расписания. */
export function recurringScheduleKey(type, id, date) {
  const value = date instanceof Date ? date : new Date(date);
  return `${type}|${id}|${localDateTime(value)}`;
}

/** Generate the next eight weeks of recurring lessons without DOM or storage access. */
export function generateSchedule(data, { type, id, slots, replace = true, now = new Date(), uid }) {
  const next = structuredClone(data);
  const owner =
    type === 'group'
      ? next.groups.find((item) => item.id === id)
      : next.students.find((item) => item.id === id);
  const members = type === 'group' ? owner?.members || [] : [id];
  const start = new Date(now),
    exclusions = new Set(next.settings?.scheduleExclusions || []);
  start.setSeconds(0, 0);

  if (replace) {
    const protectedSeries = new Set(
      next.lessons
        .filter(
          (lesson) =>
            lesson.groupId === id &&
            lesson.auto &&
            new Date(lesson.date) >= start &&
            isProtectedAutomaticLesson(lesson),
        )
        .map((lesson) => lesson.seriesId)
        .filter(Boolean),
    );
    next.lessons = next.lessons.filter((lesson) => {
      const belongs =
        lesson.auto &&
        new Date(lesson.date) >= start &&
        (type === 'group' ? lesson.groupId === id : !lesson.groupId && lesson.studentId === id);
      if (!belongs) return true;
      if (type === 'group' && protectedSeries.has(lesson.seriesId)) return true;
      return isProtectedAutomaticLesson(lesson);
    });
  }

  for (let offset = 0; offset < 56; offset++) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    for (const slot of slots || []) {
      if (day.getDay() !== +slot.day) continue;
      const [hours, minutes] = slot.time.split(':').map(Number);
      const date = new Date(day);
      date.setHours(hours, minutes, 0, 0);
      if (date < start) continue;
      const iso = localDateTime(date);
      if (exclusions.has(recurringScheduleKey(type, id, date))) continue;
      const seriesId = type === 'group' ? `grp-${id}-${iso}` : undefined;
      for (const studentId of members) {
        if (
          next.lessons.some(
            (lesson) =>
              (type === 'group' ? lesson.groupId === id : !lesson.groupId) &&
              lesson.studentId === studentId &&
              lesson.date === iso,
          )
        )
          continue;
        const student = next.students.find((item) => item.id === studentId);
        next.lessons.push({
          id: uid(),
          ...(seriesId ? { seriesId, groupId: id } : {}),
          studentId,
          date: iso,
          status: 'planned',
          payment: student?.payType === 'package' ? 'package' : 'unpaid',
          topics: '',
          amount: +student?.price || 0,
          homework: '',
          comment: '',
          auto: true,
          lessonKind: 'regular',
        });
      }
    }
  }
  return next;
}

export function extendAllSchedules(data, { now = new Date(), uid }) {
  let next = structuredClone(data);
  for (const student of next.students) {
    next = generateSchedule(next, {
      type: 'student',
      id: student.id,
      slots: student.scheduleSlots || [],
      replace: false,
      now,
      uid,
    });
  }
  for (const group of next.groups) {
    next = generateSchedule(next, {
      type: 'group',
      id: group.id,
      slots: group.scheduleSlots || [],
      replace: false,
      now,
      uid,
    });
  }
  return next;
}
