import { generateSchedule } from '../schedule/schedule.domain.js';
import { store as appStore, uid as appUid } from '../../state/app-store.js';
import { syncFutureGroupBilling } from '../../state/maintenance.js';

function replaceDraft(draft, next) {
  for (const key of Object.keys(draft)) delete draft[key];
  Object.assign(draft, next);
}

export function createStudentsService({ store, uid, now = () => Date.now() }) {
  function saveStudent(input, options = {}) {
    const current = input.id
      ? store.getState().students.find((student) => student.id === input.id)
      : null;
    const name = String(input.name || '').trim();
    if (!name)
      return {
        ok: false,
        code: 'NAME_REQUIRED',
        message: 'Введите имя ученика, а не только пробелы.',
      };
    const at = now();
    // Дата начала учёта нужна тем, кто пришёл в платформу в середине месяца:
    // всё, что было раньше, в баланс не попадает.
    const startedAt =
      input.billingStartDate && input.billingStartDate !== options.today
        ? new Date(`${input.billingStartDate}T00:00`).getTime()
        : at;
    const student = {
      ...input,
      name,
      price: +input.price || 0,
      duration: +input.duration || 60,
      status: input.status === 'paused' ? 'paused' : 'active',
      // Vue makes both the array and its slot objects reactive. Store only plain
      // objects, otherwise schedule generation cannot structuredClone the draft.
      scheduleSlots: (input.scheduleSlots || []).map((slot) => ({ ...slot })),
    };
    delete student.billingStartDate;
    if (current) {
      student.id = current.id;
      student.createdAt = current.createdAt;
      student.billingSince = +current.billingSince || current.createdAt || at;
    } else {
      student.id = uid();
      student.createdAt = startedAt;
      student.billingSince = startedAt;
    }

    store.update(current ? 'students:update' : 'students:create', (draft) => {
      if (current) {
        const index = draft.students.findIndex((item) => item.id === student.id);
        draft.students[index] = { ...draft.students[index], ...student };
      } else draft.students.push(student);

      if (student.status === 'paused') {
        // Пауза убирает только ещё не проведённые занятия — заполненные отчёты
        // и деньги остаются на месте.
        draft.lessons = draft.lessons.filter(
          (lesson) =>
            !(
              lesson.studentId === student.id &&
              lesson.status === 'planned' &&
              new Date(lesson.date).getTime() >= at
            ),
        );
        return;
      }

      let next = generateSchedule(draft, {
        type: 'student',
        id: student.id,
        slots: student.scheduleSlots,
        uid,
      });
      const savedStudent = next.students.find((item) => item.id === student.id);
      next.lessons
        .filter(
          (lesson) =>
            !lesson.groupId &&
            lesson.studentId === student.id &&
            lesson.status === 'planned' &&
            new Date(lesson.date).getTime() >= at,
        )
        .forEach((lesson) => {
          if (lesson.lessonKind !== 'trial') lesson.amount = +savedStudent?.price || 0;
        });
      next = syncFutureGroupBilling(next).data;
      replaceDraft(draft, next);
    });
    return { ok: true, value: student };
  }

  function removeStudent(id) {
    const current = store.getState().students.find((student) => student.id === id);
    if (!current) return { ok: false, code: 'NOT_FOUND', message: 'Ученик не найден.' };
    store.update('students:remove', (draft) => {
      draft.students = draft.students.filter((student) => student.id !== id);
      draft.lessons = draft.lessons.filter((lesson) => lesson.studentId !== id);
      draft.payments = draft.payments.filter((payment) => payment.studentId !== id);
      delete draft.topicLog[id];
      draft.groups.forEach((group) => {
        group.members = (group.members || []).filter((studentId) => studentId !== id);
      });
      const emptyGroups = new Set(
        draft.groups.filter((group) => !(group.members || []).length).map((group) => group.id),
      );
      draft.groups = draft.groups.filter((group) => !emptyGroups.has(group.id));
      draft.lessons = draft.lessons.filter((lesson) => !emptyGroups.has(lesson.groupId));
    });
    return { ok: true, value: current };
  }

  function saveGroup(input) {
    const name = String(input.name || '').trim();
    if (!name)
      return {
        ok: false,
        code: 'NAME_REQUIRED',
        message: 'Введите название группы, а не только пробелы.',
      };
    const members = [...new Set(input.members || [])];
    if (!members.length)
      return { ok: false, code: 'MEMBERS_REQUIRED', message: 'Выберите хотя бы одного ученика.' };
    const current = input.id
      ? store.getState().groups.find((group) => group.id === input.id)
      : null;
    const group = {
      ...input,
      name,
      members,
      duration: +input.duration || 60,
      scheduleSlots: (input.scheduleSlots || []).map((slot) => ({ ...slot })),
      id: current?.id || uid(),
    };
    store.update(current ? 'groups:update' : 'groups:create', (draft) => {
      if (current) {
        const index = draft.groups.findIndex((item) => item.id === group.id);
        draft.groups[index] = { ...draft.groups[index], ...group };
      } else draft.groups.push(group);
      let next = generateSchedule(draft, {
        type: 'group',
        id: group.id,
        slots: group.scheduleSlots,
        uid,
      });
      next.lessons = next.lessons.filter(
        (lesson) =>
          !(
            lesson.groupId === group.id &&
            lesson.status === 'planned' &&
            new Date(lesson.date) >= new Date() &&
            !group.members.includes(lesson.studentId)
          ),
      );
      next = syncFutureGroupBilling(next).data;
      replaceDraft(draft, next);
    });
    return { ok: true, value: group };
  }

  function removeGroup(id) {
    const current = store.getState().groups.find((group) => group.id === id);
    if (!current) return { ok: false, code: 'NOT_FOUND', message: 'Группа не найдена.' };
    store.update('groups:remove', (draft) => {
      const lessonIds = new Set(
        draft.lessons.filter((lesson) => lesson.groupId === id).map((lesson) => lesson.id),
      );
      draft.groups = draft.groups.filter((group) => group.id !== id);
      draft.lessons = draft.lessons.filter((lesson) => lesson.groupId !== id);
      draft.payments = draft.payments.filter((payment) => !lessonIds.has(payment.lessonId));
    });
    return { ok: true, value: current };
  }

  function addCustomGoal(goal) {
    const value = String(goal || '').trim();
    if (!value) return { ok: false, code: 'EMPTY_GOAL' };
    store.update('students:goal-add', (draft) => {
      draft.settings.customGoals = [...new Set([...(draft.settings.customGoals || []), value])];
      draft.settings.deletedGoals = (draft.settings.deletedGoals || []).filter(
        (item) => item.toLowerCase() !== value.toLowerCase(),
      );
    });
    return { ok: true, value };
  }

  function removeGoal(goal, builtinGoals = []) {
    store.update('students:goal-remove', (draft) => {
      if (builtinGoals.includes(goal))
        draft.settings.deletedGoals = [...new Set([...(draft.settings.deletedGoals || []), goal])];
      draft.settings.customGoals = (draft.settings.customGoals || []).filter(
        (item) => item !== goal,
      );
      draft.students.forEach((student) => {
        student.goals = String(student.goals || '')
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item && item !== goal)
          .join(', ');
      });
    });
    return { ok: true };
  }

  return { saveStudent, removeStudent, saveGroup, removeGroup, addCustomGoal, removeGoal };
}

export const studentsService = createStudentsService({ store: appStore, uid: appUid });
