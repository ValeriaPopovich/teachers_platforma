export function deduplicateLessons(lessons) {
  const seen = new Set();
  const result = [];
  for (const lesson of lessons) {
    const key = `${lesson.groupId || ''}|${lesson.studentId || ''}|${lesson.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(lesson);
  }
  return result;
}

export function timeConflicts(a, b, durationMinutes) {
  const startA = new Date(a.date).getTime();
  const startB = new Date(b.date).getTime();
  return startA < startB + durationMinutes * 60000 && startB < startA + durationMinutes * 60000;
}

export function existingLessonOwnerPatch(lesson, { type, id }) {
  if (!lesson || !id) return null;
  if (lesson.groupId)
    return type === 'g' && id === lesson.groupId
      ? { groupId: lesson.groupId, seriesId: lesson.seriesId }
      : null;
  return type === 's' ? { studentId: id } : null;
}

// Сдвиг опорной даты календаря на шаг вперёд/назад. В режиме месяца сначала
// встаём на 1-е число, иначе setMonth от 31-го перепрыгивает короткий месяц.
export function shiftCalendarAnchor(view, date, amount) {
  const next = new Date(date);
  if (view === 'month') {
    next.setDate(1);
    next.setMonth(next.getMonth() + amount);
  } else next.setDate(next.getDate() + amount * (view === 'week' ? 7 : 1));
  return next;
}

export function calendarViewRange(view, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (view === 'month') {
    start.setDate(1);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return { start, days: 42 };
  }
  if (view === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return { start, days: view === 'day' ? 1 : 7 };
}

export function monthlyRecurringDates(slots = [], date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const dates = [];
  for (let day = 1; day <= days; day += 1) {
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

export const countMonthlyRecurringLessons = (slots = [], date = new Date()) =>
  monthlyRecurringDates(slots, date).length;
export const countMonthlyRecurringLessonsFrom = (slots = [], date = new Date(), fromMs = 0) =>
  monthlyRecurringDates(slots, date).filter((lessonDate) => lessonDate.getTime() >= +fromMs).length;

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

export function recurringScheduleKey(type, id, date) {
  const value = date instanceof Date ? date : new Date(date);
  return `${type}|${id}|${localDateTime(value)}`;
}

export function generateSchedule(data, { type, id, slots, replace = true, now = new Date(), uid }) {
  const next = structuredClone(data);
  const owner =
    type === 'group'
      ? next.groups.find((item) => item.id === id)
      : next.students.find((item) => item.id === id);
  const members = type === 'group' ? owner?.members || [] : [id];
  const start = new Date(now);
  const exclusions = new Set(next.settings?.scheduleExclusions || []);
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
  for (let offset = 0; offset < 56; offset += 1) {
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
        if (student?.status === 'paused') continue;
        next.lessons.push({
          id: uid(),
          ...(seriesId ? { seriesId, groupId: id } : {}),
          studentId,
          date: iso,
          status: 'planned',
          payment: 'unpaid',
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
    if (student.status === 'paused') continue;
    next = generateSchedule(next, {
      type: 'student',
      id: student.id,
      slots: student.scheduleSlots || [],
      replace: false,
      now,
      uid,
    });
  }
  for (const group of next.groups)
    next = generateSchedule(next, {
      type: 'group',
      id: group.id,
      slots: group.scheduleSlots || [],
      replace: false,
      now,
      uid,
    });
  return next;
}
