import { describe, expect, it } from 'vitest';

import {
  buildStudentRows,
  getStudentLessonHistory,
} from '../src/modules/students/students.selectors.js';
import { blankData } from '../src/state/schema.js';

describe('buildStudentRows', () => {
  it('в фильтре «Все» ставит проблемные оплаты первыми', () => {
    const state = blankData();
    state.students.push(
      { id: 'paid', name: 'Аня', payType: 'single', price: 1000 },
      { id: 'debt', name: 'Борис', payType: 'single', price: 1000 },
      { id: 'partial', name: 'Вера', payType: 'package', price: 1000 },
    );
    state.lessons.push({
      id: 'lesson-debt',
      studentId: 'debt',
      date: '2026-08-01T10:00',
      status: 'done',
      amount: 1000,
      payment: 'unpaid',
    });
    state.lessons.push({
      id: 'lesson-partial',
      studentId: 'partial',
      date: '2026-08-01T10:00',
      status: 'done',
      amount: 1000,
    });
    state.payments.push({
      id: 'pay-partial',
      studentId: 'partial',
      date: '2026-08-02',
      amount: 400,
    });

    expect(buildStudentRows(state, { filter: 'all' }).map((row) => row.student.id)).toEqual([
      'debt',
      'partial',
      'paid',
    ]);
  });

  it('показывает нейтральный статус ученику без начислений и платежей', () => {
    const state = blankData();
    state.students.push({ id: 'new', name: 'Новый ученик', payType: 'single', price: 1000 });

    const [row] = buildStudentRows(state, { filter: 'all' });

    expect(row.payment).toEqual({ label: 'Нет начислений', kind: 'empty' });
    expect(buildStudentRows(state, { filter: 'paid' })).toEqual([]);
  });
});

describe('getStudentLessonHistory', () => {
  it('возвращает только завершившиеся занятия от старых к новым', () => {
    const state = blankData();
    state.students.push({ id: 'student', name: 'Ученик', duration: 60 });
    state.lessons.push(
      { id: 'future', studentId: 'student', date: '2026-08-14T14:00', status: 'planned' },
      { id: 'recent', studentId: 'student', date: '2026-08-14T11:00', status: 'done' },
      { id: 'old', studentId: 'student', date: '2026-08-12T10:00', status: 'done' },
      {
        id: 'in-progress',
        studentId: 'student',
        date: '2026-08-14T12:30',
        duration: 60,
        status: 'planned',
      },
    );

    const history = getStudentLessonHistory(
      state,
      'student',
      new Date('2026-08-14T13:00').getTime(),
    );

    expect(history.map((lesson) => lesson.id)).toEqual(['old', 'recent']);
  });
});
