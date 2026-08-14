import { describe, expect, it } from 'vitest';
import { createScheduleService } from '../src/modules/schedule/schedule.service.js';
import { recurringScheduleKey } from '../src/modules/schedule/schedule.domain.js';
import { blankData } from '../src/state/schema.js';
import { createStore } from '../src/state/store.js';

function setup() {
  const data = blankData();
  data.students.push({
    id: 's1',
    name: 'Аня',
    price: 1000,
    payType: 'package',
    scheduleSlots: [{ day: 1, time: '16:00' }],
  });
  data.lessons.push({
    id: 'l1',
    studentId: 's1',
    date: '2026-08-03T16:30',
    status: 'planned',
    lessonKind: 'regular',
    payment: 'package',
    amount: 1000,
    auto: true,
  });
  const store = createStore(data);
  const service = createScheduleService({ store, uid: () => 'new-id' });
  return { store, service };
}

function lessonInput(status) {
  return {
    id: 'l1',
    targetId: 's:s1',
    date: '2026-08-03T16:30',
    status,
    lessonKind: 'regular',
    amount: 1000,
    duration: 45,
    lessonPaymentChoice: 'package',
  };
}

describe('schedule service recurring exclusions', () => {
  it('сохраняет длительность конкретного занятия', () => {
    const { store, service } = setup();
    service.saveLesson(lessonInput('planned'));

    expect(store.getState().lessons[0].duration).toBe(45);
  });

  it('при отмене связывает исключение с исходным слотом расписания', () => {
    const { store, service } = setup();
    service.saveLesson(lessonInput('cancelled'));

    expect(store.getState().settings.scheduleExclusions).toEqual([
      recurringScheduleKey('student', 's1', new Date('2026-08-03T16:00')),
    ]);
  });

  it('снимает исключение при возврате регулярного занятия в активный статус', () => {
    const { store, service } = setup();
    service.saveLesson(lessonInput('cancelled'));
    service.saveLesson(lessonInput('planned'));

    expect(store.getState().settings.scheduleExclusions).toEqual([]);
  });

  it('после удаления не восстанавливает отредактированное по времени повторение', () => {
    const { store, service } = setup();
    service.removeLesson('l1');

    expect(store.getState().settings.scheduleExclusions).toEqual([
      recurringScheduleKey('student', 's1', new Date('2026-08-03T16:00')),
    ]);
  });
});
