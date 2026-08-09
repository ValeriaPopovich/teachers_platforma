// Именованные maintenance operations. Каждая:
//   - принимает data, возвращает { data, changes: {...числа...} };
//   - идемпотентна: повторный вызов на результате не должен ничего изменить;
//   - не бросает исключений на корректных входах;
//   - НЕ трогает DOM/storage/сеть.
// Момент запуска — на bootstrap и/или в интервале (см. §3, Этап 3).

/** Оборачивает мутирующую операцию в шаблон "клонируем → мутируем → считаем изменения". */
function mutate(data, fn) {
  const next = structuredClone(data);
  const changes = fn(next) || {};
  return { data: next, changes };
}

/** Удаляет events старше `retentionDays` дней (по умолчанию 45). */
export function pruneOldHistory(data, retentionDays = 45, now = Date.now()) {
  return mutate(data, (d) => {
    const cut = new Date(now);
    cut.setHours(0, 0, 0, 0);
    cut.setDate(cut.getDate() - retentionDays);
    const cutMs = cut.getTime();
    const before = d.events.length;
    d.events = d.events.filter((ev) => new Date(ev.date).getTime() >= cutMs);
    return { eventsRemoved: before - d.events.length };
  });
}

/**
 * Переводит закончившиеся планы в 'done'. Мутирующая, но идемпотентная —
 * повторный вызов на результате ничего не меняет. `now` — точка "сейчас",
 * `duration(l)` — минуты; по умолчанию берётся из l.duration или 60.
 */
export function normalizePastLessons(data, now = Date.now(), duration = (l) => +l.duration || 60) {
  return mutate(data, (d) => {
    let changed = 0;
    const completedLessonIds = [];
    for (const l of d.lessons) {
      if (l.status !== 'planned') continue;
      const endMs = new Date(l.date).getTime() + duration(l) * 60000;
      if (endMs < now) {
        l.status = 'done';
        if (l.reportFilled == null) l.reportFilled = false;
        changed++;
        completedLessonIds.push(l.id);
      }
    }
    return { lessonsCompleted: changed, completedLessonIds };
  });
}

/** Удаляет ссылки на несуществующих учеников/группы. Именованный аналог inline sweepOrphans. */
export function sweepOrphans(data) {
  return mutate(data, (d) => {
    const hasS = (id) => d.students.some((s) => s.id === id);
    const hasG = (id) => d.groups.some((g) => g.id === id);

    const lessonsBefore = d.lessons.length;
    d.lessons = d.lessons.filter((l) => {
      if (l.studentId && !hasS(l.studentId)) return false;
      if (l.groupId && !hasG(l.groupId)) return false;
      return true;
    });

    const paymentsBefore = d.payments.length;
    d.payments = d.payments.filter((p) => !p.studentId || hasS(p.studentId));

    let archiveRemoved = 0;
    for (const id of Object.keys(d.financeArchive)) {
      if (!hasS(id)) {
        delete d.financeArchive[id];
        archiveRemoved++;
      }
    }
    let topicRemoved = 0;
    for (const id of Object.keys(d.topicLog)) {
      if (!hasS(id)) {
        delete d.topicLog[id];
        topicRemoved++;
      }
    }

    // Убрать несуществующих участников из групп и пустые группы.
    for (const g of d.groups) {
      g.members = (g.members || []).filter(hasS);
    }
    const groupsBefore = d.groups.length;
    d.groups = d.groups.filter((g) => (g.members || []).length > 0);
    // Пустые группы могли быть владельцами занятий — уберём их занятия.
    if (d.groups.length !== groupsBefore) {
      d.lessons = d.lessons.filter((l) => !l.groupId || d.groups.some((g) => g.id === l.groupId));
    }

    return {
      lessonsRemoved: lessonsBefore - d.lessons.length,
      paymentsRemoved: paymentsBefore - d.payments.length,
      archiveRemoved,
      topicRemoved,
      groupsRemoved: groupsBefore - d.groups.length,
    };
  });
}

/** Refresh financial defaults of future group lessons from their current student cards. */
export function syncFutureGroupBilling(data, now = Date.now()) {
  return mutate(data, (draft) => {
    let changed = 0;
    for (const lesson of draft.lessons) {
      if (!lesson.groupId || lesson.status !== 'planned' || new Date(lesson.date).getTime() < now)
        continue;
      const student = draft.students.find((item) => item.id === lesson.studentId);
      const amount = +student?.price || 0;
      const payment = student?.payType === 'package' ? 'package' : 'unpaid';
      if (lesson.amount !== amount || lesson.payment !== payment) {
        lesson.amount = amount;
        lesson.payment = payment;
        changed++;
      }
    }
    return { lessonsUpdated: changed };
  });
}
