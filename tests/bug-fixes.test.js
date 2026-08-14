import { describe, expect, it } from 'vitest';

import { buildDashboard } from '../src/modules/dashboard/dashboard.selectors.js';
import { getMonthlyPaymentSummary } from '../src/modules/payments/payments.selectors.js';
import { createScheduleService } from '../src/modules/schedule/schedule.service.js';
import { shiftCalendarAnchor } from '../src/modules/schedule/schedule.domain.js';
import { buildStudentRows } from '../src/modules/students/students.selectors.js';
import { createStore } from '../src/state/store.js';
import { blankData } from '../src/state/schema.js';

// #5 — перелистывание месяца перепрыгивало короткий месяц.
describe('shiftCalendarAnchor', () => {
  it('с 31 января шагает в февраль, а не в март', () => {
    const next = shiftCalendarAnchor('month', new Date(2026, 0, 31), 1);
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(1); // февраль
  });

  it('с 31 мая шагает назад в апрель, а не в март', () => {
    const prev = shiftCalendarAnchor('month', new Date(2026, 4, 31), -1);
    expect(prev.getMonth()).toBe(3); // апрель
  });

  it('неделя сдвигается на 7 дней, день — на 1', () => {
    expect(shiftCalendarAnchor('week', new Date(2026, 7, 14), 1).getDate()).toBe(21);
    expect(shiftCalendarAnchor('day', new Date(2026, 7, 14), -1).getDate()).toBe(13);
  });
});

// #7 — фильтр «Долг» показывал учеников без начислений (kind: 'empty').
describe('buildStudentRows filter=debt', () => {
  it('не включает учеников без начислений', () => {
    const state = blankData();
    state.students.push(
      { id: 'debtor', name: 'Должник', payType: 'single', price: 1000 },
      { id: 'clean', name: 'Новичок', payType: 'single', price: 1000 },
    );
    state.lessons.push({
      id: 'l1',
      studentId: 'debtor',
      date: '2026-08-01T10:00',
      status: 'done',
      amount: 1000,
      payment: 'unpaid',
    });

    const ids = buildStudentRows(state, { filter: 'debt' }).map((row) => row.student.id);
    expect(ids).toEqual(['debtor']);
  });
});

// #8 — groupSize читался из несуществующего group.students.
describe('buildDashboard groupSize', () => {
  it('берёт размер группы из members', () => {
    const now = new Date('2026-08-14T12:00:00');
    const state = blankData();
    state.groups.push({ id: 'g1', name: 'Группа', members: ['a', 'b', 'c'], duration: 60 });
    state.students.push(
      { id: 'a', name: 'A', payType: 'single', price: 0 },
      { id: 'b', name: 'B', payType: 'single', price: 0 },
      { id: 'c', name: 'C', payType: 'single', price: 0 },
    );
    state.lessons.push({
      id: 'gl',
      groupId: 'g1',
      seriesId: 'grp-g1-1',
      studentId: 'a',
      date: '2026-08-14T18:00',
      status: 'planned',
      duration: 60,
    });

    const model = buildDashboard(state, { now });
    const item = model.timeline
      .filter((row) => row.kind === 'slot')
      .flatMap((slot) => slot.lessons)
      .find((lesson) => lesson.type === 'group');
    expect(item.groupSize).toBe(3);
  });
});

// #3 — «Долг сейчас» суммировал amountDue строк «ending» (цену будущего абонемента).
describe('getMonthlyPaymentSummary debt', () => {
  it('считает только реальный долг, без будущих абонементов', () => {
    const now = new Date('2026-08-14T12:00:00');
    const state = blankData();
    // Абонемент с оплаченным прошлым и неоплаченным будущим занятием: строка
    // получит ненулевой amountDue, хотя просроченного долга (finance.debt) нет.
    state.students.push({
      id: 's-pkg',
      name: 'Абонемент',
      payType: 'package',
      price: 1000,
      billingSince: 0,
    });
    state.lessons.push(
      {
        id: 'done1',
        studentId: 's-pkg',
        date: '2026-08-01T10:00',
        status: 'done',
        amount: 1000,
      },
      {
        id: 'future1',
        studentId: 's-pkg',
        date: '2026-08-28T10:00',
        status: 'planned',
        amount: 1000,
      },
    );
    state.payments.push({ id: 'pay', studentId: 's-pkg', date: '2026-08-01', amount: 1000 });

    const summary = getMonthlyPaymentSummary(state, now);
    // Баланс = 0 (заплатил 1000, провёл 1000), долга нет.
    expect(summary.debt).toBe(0);
  });
});

// #10 — платёж за занятие хранил дату-день (парсилась как UTC-полночь).
describe('scheduleService оплата занятия', () => {
  it('сохраняет полную дату-время занятия, а не только день', () => {
    let counter = 0;
    const uid = () => `id${++counter}`;
    const base = blankData();
    base.students.push({ id: 's1', name: 'Ученик', payType: 'single', price: 1500 });
    const store = createStore(base);
    const service = createScheduleService({ store, uid, now: () => 1000 });

    const result = service.saveLesson({
      targetId: 's:s1',
      date: '2026-08-14T18:00',
      status: 'done',
      lessonKind: 'oneoff',
      lessonPaymentChoice: 'paid',
      amount: 1500,
    });
    expect(result.ok).toBe(true);

    const payment = store.getState().payments.find((item) => item.lessonId);
    expect(payment.date).toBe('2026-08-14T18:00');
  });
});
