import { describe, expect, it } from 'vitest';

import { testResultError } from '../src/modules/schedule/components/lesson-form/scripts/validation.js';
import { lessonFieldVisibility } from '../src/modules/schedule/components/lesson-form/scripts/visibility.js';

describe('lesson form field visibility', () => {
  const shown = (options) =>
    Object.entries(lessonFieldVisibility(options))
      .filter(([, on]) => on)
      .map(([key]) => key)
      .sort();

  it('проведённое занятие показывает весь отчёт', () => {
    expect(shown({ status: 'done', hasStudent: true })).toEqual([
      'amount',
      'parentMessage',
      'payment',
      'previousHomework',
      'report',
      'topics',
    ]);
  });

  it('«Ждёт отчёта» совпадает с «Проведено»', () => {
    expect(shown({ status: 'unconfirmed', hasStudent: true })).toEqual(
      shown({ status: 'done', hasStudent: true }),
    );
  });

  it('запланированное скрывает проверочную, новое ДЗ и сообщение родителю', () => {
    expect(shown({ status: 'planned', hasStudent: true })).toEqual([
      'amount',
      'payment',
      'previousHomework',
      'topics',
    ]);
  });

  it('отмена и пропуск без оплаты оставляют только основные поля', () => {
    expect(shown({ status: 'cancelled', hasStudent: true })).toEqual([]);
    expect(shown({ status: 'missed', hasStudent: true })).toEqual([]);
  });

  it('перенос показывает новую дату, пропуск с оплатой — деньги', () => {
    expect(shown({ status: 'moved', hasStudent: true })).toEqual(['movedTo']);
    expect(shown({ status: 'paid_missed', hasStudent: true })).toEqual(['amount', 'payment']);
  });

  it('пробное занятие и групповое не спрашивают сумму', () => {
    expect(shown({ status: 'done', lessonKind: 'trial', hasStudent: true })).not.toContain(
      'amount',
    );
    expect(shown({ status: 'done', groupMode: true })).toEqual([
      'attendance',
      'previousHomework',
      'report',
      'topics',
    ]);
  });
});

describe('lesson form validation', () => {
  it('не разрешает набрать больше баллов, чем предусмотрено работой', () => {
    expect(testResultError(11, 1)).toBe('Баллы не могут быть больше максимума');
  });

  it('принимает корректный результат и не проверяет выключенный блок', () => {
    expect(testResultError(8, 10)).toBe('');
    expect(testResultError(11, 1, false)).toBe('');
  });
});
