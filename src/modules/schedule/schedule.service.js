import { existingLessonOwnerPatch, recurringScheduleKey } from './schedule.domain.js';
import { groupLessonRecords } from './schedule.selectors.js';
import { store as appStore, uid as appUid } from '../../state/app-store.js';

function syncLinkedPayment(draft, lesson, { paid, amount, uid, now }) {
  const linked = draft.payments.filter((payment) => payment.lessonId === lesson.id);
  if (paid) {
    lesson.payment = 'paid';
    const existing = linked[0];
    if (existing) {
      existing.studentId = lesson.studentId;
      existing.amount = +amount || +lesson.amount || 0;
      // Полная дата-время занятия (локальная), а не только день: обрезка до
      // 10 символов парсилась как UTC-полночь и в западных TZ уезжала на день.
      existing.date = String(lesson.date);
    } else {
      draft.payments.push({
        id: uid(),
        studentId: lesson.studentId,
        amount: +amount || +lesson.amount || 0,
        date: String(lesson.date),
        createdAt: now(),
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

function recurringOccurrenceDate(draft, lesson) {
  const owner = lesson.groupId
    ? draft.groups.find((group) => group.id === lesson.groupId)
    : draft.students.find((student) => student.id === lesson.studentId);
  const date = new Date(lesson.date);
  const slots = (owner?.scheduleSlots || []).filter((slot) => +slot.day === date.getDay());
  if (!slots.length) return date;
  const lessonMinutes = date.getHours() * 60 + date.getMinutes();
  const nearest = slots
    .map((slot) => {
      const [hours = 0, minutes = 0] = String(slot.time || '00:00')
        .split(':')
        .map(Number);
      return { hours, minutes, distance: Math.abs(hours * 60 + minutes - lessonMinutes) };
    })
    .sort((a, b) => a.distance - b.distance)[0];
  date.setHours(nearest.hours, nearest.minutes, 0, 0);
  return date;
}

function syncRecurringExclusion(draft, lesson) {
  if (!lesson || (!lesson.auto && lesson.lessonKind !== 'regular')) return;
  const type = lesson.groupId ? 'group' : 'student';
  const ownerId = lesson.groupId || lesson.studentId;
  const key = recurringScheduleKey(type, ownerId, recurringOccurrenceDate(draft, lesson));
  const exclusions = new Set(draft.settings?.scheduleExclusions || []);
  if (['cancelled', 'missed', 'moved'].includes(lesson.status)) exclusions.add(key);
  else if (['planned', 'unconfirmed', 'done', 'paid_missed'].includes(lesson.status))
    exclusions.delete(key);
  draft.settings.scheduleExclusions = [...exclusions];
}

function baseLesson(input, student, ownerPatch, id) {
  const lessonKind = input.lessonKind || 'oneoff';
  return {
    id,
    ...ownerPatch,
    studentId: student.id,
    date: input.date,
    duration: +input.duration || 60,
    status: input.status || 'planned',
    lessonKind,
    // Цена живёт в занятии: поднятие тарифа в карточке не переписывает историю.
    amount: lessonKind === 'trial' ? 0 : +input.amount || +student.price || 0,
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
    if (existing && input.lessonKind !== (existing.lessonKind || 'oneoff')) {
      return {
        ok: false,
        code: 'LESSON_KIND_CHANGE',
        message: 'Тип существующего занятия изменить нельзя.',
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
        syncLinkedPayment(draft, lesson, {
          paid: input.lessonPaymentChoice === 'paid' && lesson.amount > 0,
          amount: lesson.amount,
          uid,
          now,
        });
        if (input.previousHomework === 'yes')
          applyPreviousHomeworkGrade(draft, studentId, input.date, input.homeworkGrade);
        carryNextNote(draft, studentId, input.date, input.nextNote);
        syncRecurringExclusion(draft, lesson);
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
          // Перенос наследует тип и цену оригинала: регулярное занятие не должно
          // превращаться в разовое и выпадать из плана месяца.
          moved.payment = 'unpaid';
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
      if (lesson.auto || lesson.lessonKind === 'regular')
        syncRecurringExclusion(draft, { ...lesson, status: 'cancelled' });
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

export const scheduleService = createScheduleService({ store: appStore, uid: appUid });
