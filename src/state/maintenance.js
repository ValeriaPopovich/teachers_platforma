function mutate(data, fn) {
  const next = structuredClone(data);
  const changes = fn(next) || {};
  return { data: next, changes };
}
/**
 * Занятия и платежи — это книга учёта, её нельзя сворачивать: удалённое занятие
 * уносит с собой начисление. Чистим только прошедшие события календаря.
 */
export function pruneOldEvents(data, retentionDays = 365, now = Date.now()) {
  return mutate(data, (draft) => {
    const cut = new Date(now);
    cut.setHours(0, 0, 0, 0);
    cut.setDate(cut.getDate() - retentionDays);
    const cutMs = cut.getTime();
    const eventsBefore = draft.events.length;
    draft.events = draft.events.filter((event) => new Date(event.date).getTime() >= cutMs);
    return { eventsRemoved: eventsBefore - draft.events.length };
  });
}
export function normalizePastLessons(
  data,
  now = Date.now(),
  duration = (lesson) => +lesson.duration || 60,
) {
  return mutate(data, (draft) => {
    let changed = 0;
    const completedLessonIds = [];
    for (const lesson of draft.lessons) {
      if (lesson.status !== 'planned') continue;
      if (new Date(lesson.date).getTime() + duration(lesson) * 60000 < now) {
        lesson.status = 'unconfirmed';
        if (lesson.reportFilled == null) lesson.reportFilled = false;
        changed++;
        completedLessonIds.push(lesson.id);
      }
    }
    return { lessonsCompleted: changed, completedLessonIds };
  });
}
export function sweepOrphans(data) {
  return mutate(data, (draft) => {
    const hasStudent = (id) => draft.students.some((student) => student.id === id),
      hasGroup = (id) => draft.groups.some((group) => group.id === id);
    const lessonsBefore = draft.lessons.length,
      paymentsBefore = draft.payments.length;
    draft.lessons = draft.lessons.filter(
      (lesson) =>
        (!lesson.studentId || hasStudent(lesson.studentId)) &&
        (!lesson.groupId || hasGroup(lesson.groupId)),
    );
    draft.payments = draft.payments.filter(
      (payment) => !payment.studentId || hasStudent(payment.studentId),
    );
    let topicRemoved = 0;
    for (const id of Object.keys(draft.topicLog)) {
      if (!hasStudent(id)) {
        delete draft.topicLog[id];
        topicRemoved++;
      }
    }
    for (const group of draft.groups) group.members = (group.members || []).filter(hasStudent);
    const groupsBefore = draft.groups.length;
    draft.groups = draft.groups.filter((group) => (group.members || []).length > 0);
    if (draft.groups.length !== groupsBefore)
      draft.lessons = draft.lessons.filter(
        (lesson) => !lesson.groupId || draft.groups.some((group) => group.id === lesson.groupId),
      );
    return {
      lessonsRemoved: lessonsBefore - draft.lessons.length,
      paymentsRemoved: paymentsBefore - draft.payments.length,
      topicRemoved,
      groupsRemoved: groupsBefore - draft.groups.length,
    };
  });
}
export function syncFutureGroupBilling(data, now = Date.now()) {
  return mutate(data, (draft) => {
    let changed = 0;
    for (const lesson of draft.lessons) {
      if (!lesson.groupId || lesson.status !== 'planned' || new Date(lesson.date).getTime() < now)
        continue;
      const student = draft.students.find((item) => item.id === lesson.studentId);
      const amount = lesson.lessonKind === 'trial' ? 0 : +student?.price || 0;
      if (lesson.amount !== amount) {
        lesson.amount = amount;
        changed++;
      }
    }
    return { lessonsUpdated: changed };
  });
}
