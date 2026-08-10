function mutate(data, fn) {
  const next = structuredClone(data);
  const changes = fn(next) || {};
  return { data: next, changes };
}
export function pruneOldHistory(data, retentionDays = 45, now = Date.now()) {
  return mutate(data, (draft) => {
    const cut = new Date(now);
    cut.setHours(0, 0, 0, 0);
    cut.setDate(cut.getDate() - retentionDays);
    const cutMs = cut.getTime();
    const eventsBefore = draft.events.length,
      lessonsBefore = draft.lessons.length,
      paymentsBefore = draft.payments.length;
    draft.financeArchive ||= {};
    for (const student of draft.students) {
      const cutoff = +student.billingSince || 0,
        archive = draft.financeArchive[student.id] || {};
      const oldLessons = draft.lessons.filter(
        (lesson) =>
          lesson.studentId === student.id &&
          new Date(lesson.date).getTime() < cutMs &&
          new Date(lesson.date).getTime() >= cutoff &&
          ['done', 'paid_missed'].includes(lesson.status),
      );
      const oldPayments = draft.payments.filter(
        (payment) =>
          payment.studentId === student.id &&
          !payment.ledgerOnly &&
          new Date(payment.date).getTime() < cutMs &&
          Math.max(+payment.createdAt || 0, new Date(payment.date).getTime()) >= cutoff,
      );
      const oldPackages = oldPayments.filter(
        (payment) => payment.billingType === 'package' || +payment.packageLessons > 0,
      );
      archive.packageUsed =
        (+archive.packageUsed || 0) +
        oldLessons.filter((lesson) => lesson.payment === 'package').length;
      archive.singleCharged =
        (+archive.singleCharged || 0) +
        oldLessons
          .filter((lesson) => lesson.payment === 'unpaid')
          .reduce((sum, lesson) => sum + (+lesson.amount || 0), 0);
      archive.packageBought =
        (+archive.packageBought || 0) +
        oldPackages.reduce((sum, payment) => sum + (+payment.packageLessons || 0), 0);
      archive.paidAmount =
        (+archive.paidAmount || 0) +
        oldPayments.reduce((sum, payment) => sum + (+payment.amount || 0), 0);
      if (
        archive.packageUsed ||
        archive.singleCharged ||
        archive.packageBought ||
        archive.paidAmount
      )
        draft.financeArchive[student.id] = archive;
    }
    draft.events = draft.events.filter((event) => new Date(event.date).getTime() >= cutMs);
    draft.lessons = draft.lessons.filter((lesson) => new Date(lesson.date).getTime() >= cutMs);
    draft.payments = draft.payments.filter((payment) => new Date(payment.date).getTime() >= cutMs);
    draft.topicLog = {};
    return {
      eventsRemoved: eventsBefore - draft.events.length,
      lessonsRemoved: lessonsBefore - draft.lessons.length,
      paymentsRemoved: paymentsBefore - draft.payments.length,
    };
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
    let archiveRemoved = 0,
      topicRemoved = 0;
    for (const id of Object.keys(draft.financeArchive)) {
      if (!hasStudent(id)) {
        delete draft.financeArchive[id];
        archiveRemoved++;
      }
    }
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
      archiveRemoved,
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
      const amount = +student?.price || 0,
        payment = student?.payType === 'package' ? 'package' : 'unpaid';
      if (lesson.amount !== amount || lesson.payment !== payment) {
        lesson.amount = amount;
        lesson.payment = payment;
        changed++;
      }
    }
    return { lessonsUpdated: changed };
  });
}
