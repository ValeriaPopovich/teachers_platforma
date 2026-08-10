import { existingLessonOwnerPatch } from './schedule.domain.js';
import { groupLessonRecords } from './schedule.selectors.js';

function syncLinkedPayment(draft, lesson, { paid, amount, uid, now }) {
  const linked = draft.payments.filter((payment) => payment.lessonId === lesson.id);
  if (paid) {
    lesson.payment = 'paid';
    const existing = linked[0];
    if (existing) {
      existing.studentId = lesson.studentId;
      existing.amount = +amount || +lesson.amount || 0;
      existing.date = String(lesson.date).slice(0, 10);
      existing.billingType = 'single';
    } else {
      draft.payments.push({
        id: uid(),
        studentId: lesson.studentId,
        amount: +amount || +lesson.amount || 0,
        date: String(lesson.date).slice(0, 10),
        createdAt: now(),
        billingType: 'single',
        lessonId: lesson.id,
        note: 'Оплата занятия',
      });
    }
    for (const duplicate of linked.slice(1))
      draft.payments = draft.payments.filter((payment) => payment.id !== duplicate.id);
  } else {
    if (lesson.payment === 'paid') lesson.payment = 'unpaid';
    draft.payments = draft.payments.filter((payment) => payment.lessonId !== lesson.id);
  }
}

function applyPreviousHomeworkGrade(draft, studentId, currentDate, grade) {
  if (!grade) return;
  const previous = draft.lessons
    .filter(
      (lesson) =>
        lesson.studentId === studentId &&
        lesson.status === 'done' &&
        new Date(lesson.date) < new Date(currentDate),
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  if (previous) previous.homeworkResult = +grade;
}

function carryNextNote(draft, studentId, currentDate, note) {
  if (!note) return;
  const next = draft.lessons
    .filter(
      (lesson) =>
        lesson.studentId === studentId &&
        lesson.status === 'planned' &&
        new Date(lesson.date) > new Date(currentDate),
    )
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  if (next) next.prepNote = note;
}

function baseLesson(input, student, ownerPatch, id) {
  return {
    id,
    ...ownerPatch,
    studentId: student.id,
    date: input.date,
    status: input.status || 'planned',
    lessonKind: input.lessonKind || 'oneoff',
    amount: +input.amount || +student.price || 0,
    topics: input.topics || '',
    homework: input.homework || '',
    comment: input.comment || '',
    nextNote: input.nextNote || '',
    previousHomework: input.previousHomework || 'no',
    homeworkGrade: input.previousHomework === 'yes' ? input.homeworkGrade || '' : '',
    testDone: input.testDone || 'no',
    testName: input.testName || '',
    testScore: input.testScore || '',
    testMax: input.testMax || '',
    reportFilled: ['done', 'missed', 'paid_missed'].includes(input.status),
    manualEdited: true,
  };
}

export function createScheduleService({ store, uid, now = () => Date.now() }) {
  function saveLesson(input) {
    const [targetType, targetId] = String(input.targetId || '').split(':');
    if (!targetId || !input.date)
      return {
        ok: false,
        code: 'REQUIRED',
        message: 'Выберите ученика или группу и дату занятия.',
      };
    const state = store.getState();
    const existing = input.id
      ? state.lessons.find((lesson) => lesson.id === input.id || lesson.seriesId === input.id)
      : null;
    if (existing && !existingLessonOwnerPatch(existing, { type: targetType, id: targetId })) {
      return {
        ok: false,
        code: 'OWNER_CHANGE',
        message:
          'Групповое занятие нельзя превратить в индивидуальное и наоборот. Создайте новое занятие.',
      };
    }
    const group = targetType === 'g' ? state.groups.find((item) => item.id === targetId) : null;
    const student = targetType === 's' ? state.students.find((item) => item.id === targetId) : null;
    if (!group && !student)
      return { ok: false, code: 'OWNER_NOT_FOUND', message: 'Ученик или группа не найдены.' };
    const members = group ? group.members || [] : [student.id];
    if (!members.length)
      return { ok: false, code: 'EMPTY_GROUP', message: 'В группе нет учеников.' };
    const attendance = new Set(input.attendance || members);

    store.update(existing ? 'schedule:lesson-update' : 'schedule:lesson-create', (draft) => {
      const oldRecords = existing ? groupLessonRecords(draft, existing) : [];
      const seriesId = group
        ? existing?.seriesId || `grp-${group.id}-${input.date}-${uid()}`
        : undefined;
      const oldByStudent = new Map(oldRecords.map((lesson) => [lesson.studentId, lesson]));
      const recordIds = new Set(oldRecords.map((lesson) => lesson.id));
      if (existing) draft.lessons = draft.lessons.filter((lesson) => !recordIds.has(lesson.id));

      const created = [];
      for (const studentId of members) {
        const member = draft.students.find((item) => item.id === studentId);
        if (!member) continue;
        const old = oldByStudent.get(studentId);
        const ownerPatch = group ? { groupId: group.id, seriesId } : {};
        const lesson = {
          ...(old || {}),
          ...baseLesson(
            input,
            member,
            ownerPatch,
            old?.id || (existing && !group ? existing.id : uid()),
          ),
        };
        if (group && ['done', 'missed', 'paid_missed'].includes(input.status)) {
          lesson.status = attendance.has(studentId)
            ? 'done'
            : member.payType === 'package'
              ? 'paid_missed'
              : 'missed';
        }
        if (member.payType === 'package') {
          const oneoff = (input.lessonKind || 'oneoff') === 'oneoff';
          if (oneoff && input.packageOneoffBilling === 'extra_paid')
            syncLinkedPayment(draft, lesson, { paid: true, amount: lesson.amount, uid, now });
          else if (oneoff && input.packageOneoffBilling === 'extra_unpaid') {
            lesson.payment = 'unpaid';
            draft.payments = draft.payments.filter((payment) => payment.lessonId !== lesson.id);
          } else {
            lesson.payment =
              input.lessonPaymentChoice === 'not_charged' ? 'not_charged' : 'package';
            draft.payments = draft.payments.filter((payment) => payment.lessonId !== lesson.id);
          }
        } else
          syncLinkedPayment(draft, lesson, {
            paid: input.lessonPaymentChoice === 'paid',
            amount: lesson.amount,
            uid,
            now,
          });
        if (input.previousHomework === 'yes')
          applyPreviousHomeworkGrade(draft, studentId, input.date, input.homeworkGrade);
        carryNextNote(draft, studentId, input.date, input.nextNote);
        created.push(lesson);
      }
      draft.lessons.push(...created);

      if (input.status === 'moved' && input.movedTo) {
        const movedSeriesId = group ? `grp-${group.id}-${input.movedTo}-${uid()}` : undefined;
        for (const source of created) {
          const moved = structuredClone(source);
          moved.id = uid();
          if (group) moved.seriesId = movedSeriesId;
          moved.date = input.movedTo;
          moved.status = 'planned';
          moved.lessonKind = 'oneoff';
          moved.reportFilled = false;
          moved.manualEdited = true;
          moved.movedFrom = source.id;
          moved.topics = '';
          moved.homework = '';
          moved.comment = '';
          moved.testDone = 'no';
          moved.testName = '';
          moved.testScore = '';
          moved.testMax = '';
          moved.nextNote = input.nextNote || '';
          draft.lessons.push(moved);
        }
      }
    });
    return { ok: true };
  }

  function removeLesson(id) {
    const state = store.getState();
    const lesson = state.lessons.find((item) => item.id === id || item.seriesId === id);
    if (!lesson) return { ok: false, code: 'NOT_FOUND', message: 'Занятие не найдено.' };
    store.update('schedule:lesson-remove', (draft) => {
      const records = groupLessonRecords(draft, lesson);
      const ids = new Set(records.map((item) => item.id));
      draft.lessons = draft.lessons.filter((item) => !ids.has(item.id));
      draft.payments = draft.payments.filter((payment) => !ids.has(payment.lessonId));
    });
    return { ok: true };
  }

  function saveEvent(input) {
    if (!String(input.title || '').trim() || !input.date)
      return { ok: false, code: 'REQUIRED', message: 'Введите название и дату события.' };
    const event = {
      id: input.id || uid(),
      title: String(input.title).trim(),
      date: input.date,
      duration: +input.duration || 60,
      note: input.note || '',
    };
    store.update(input.id ? 'schedule:event-update' : 'schedule:event-create', (draft) => {
      if (input.id) {
        const index = draft.events.findIndex((item) => item.id === input.id);
        if (index >= 0) draft.events[index] = event;
      } else draft.events.push(event);
    });
    return { ok: true, value: event };
  }

  function removeEvent(id) {
    if (!store.getState().events.some((event) => event.id === id))
      return { ok: false, code: 'NOT_FOUND' };
    store.update('schedule:event-remove', (draft) => {
      draft.events = draft.events.filter((event) => event.id !== id);
    });
    return { ok: true };
  }

  return { saveLesson, removeLesson, saveEvent, removeEvent };
}
