import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearActivePage,
  pageFromHash,
  pageFromPath,
  pagePath,
  resolveInitialPage,
} from '../src/app/navigation-state.js';
import { coveredLessons, getMonthPlan } from '../src/modules/payments/payments.selectors.js';
import { defaultHomeworkGrade } from '../src/modules/schedule/components/lesson-form/scripts/form-defaults.js';
import { parentDetails } from '../src/modules/students/students.selectors.js';
import { createMinuteClock } from '../src/shared/minute-clock.js';
import { blankData } from '../src/state/schema.js';

afterEach(() => vi.useRealTimers());

describe('UX refactor contracts', () => {
  it('подставляет оценку 5 только при включении предыдущего ДЗ без оценки', () => {
    expect(defaultHomeworkGrade(true, '')).toBe('5');
    expect(defaultHomeworkGrade(true, '4')).toBe('4');
    expect(defaultHomeworkGrade(false, '')).toBe('');
  });

  it('читает новое поле контактов родителя и поддерживает старые данные', () => {
    expect(parentDetails({ parentDetails: 'Елена, @elena' })).toBe('Елена, @elena');
    expect(parentDetails({ parentName: 'Елена', parentContact: '+7 900' })).toBe('Елена · +7 900');
  });

  it('считает план месяца по реальным занятиям, включая групповые', () => {
    const state = blankData();
    state.students.push({ id: 's1', payType: 'package', price: 1000, createdAt: 0 });
    state.groups.push({ id: 'g1', name: 'Группа', members: ['s1'] });
    state.lessons.push(
      { id: 'done', studentId: 's1', date: '2026-08-02', status: 'done', amount: 1000 },
      { id: 'missed', studentId: 's1', date: '2026-08-03', status: 'paid_missed', amount: 1000 },
      {
        id: 'group',
        studentId: 's1',
        groupId: 'g1',
        date: '2026-08-05',
        status: 'done',
        amount: 500,
      },
      { id: 'future', studentId: 's1', date: '2026-08-20', status: 'planned', amount: 1000 },
      {
        id: 'trial',
        studentId: 's1',
        date: '2026-08-21',
        status: 'planned',
        lessonKind: 'trial',
        amount: 0,
      },
    );

    const plan = getMonthPlan(state, 's1', new Date('2026-08-14'));
    expect(plan).toMatchObject({
      lessons: 4,
      conducted: 3,
      conductedAmount: 2500,
      remainingAmount: 1000,
    });
  });

  it('покрывает ближайшие занятия по их собственной цене', () => {
    const state = blankData();
    state.students.push({ id: 's1', price: 1000 });
    state.lessons.push(
      { id: 'a', studentId: 's1', date: '2026-08-20', status: 'planned', amount: 500 },
      { id: 'b', studentId: 's1', date: '2026-08-21', status: 'planned', amount: 500 },
      { id: 'c', studentId: 's1', date: '2026-08-22', status: 'planned', amount: 1500 },
    );

    expect(coveredLessons(state, 's1', 1000)).toBe(2);
    expect(coveredLessons(state, 's1', 2500)).toBe(3);
  });

  it('сохраняет активную страницу до выхода из аккаунта', () => {
    const values = new Map([['tutorCabinet_activePage', 'payments']]);
    const storage = {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };

    expect(storage.getItem('tutorCabinet_activePage')).toBe('payments');
    clearActivePage(storage);
    expect(storage.getItem('tutorCabinet_activePage')).toBeNull();
  });

  it('преобразует разделы в SPA-маршруты и восстанавливает текущую страницу', () => {
    expect(pagePath('dashboard')).toBe('/');
    expect(pagePath('students')).toBe('/students');
    expect(pageFromPath('/schedule')).toBe('schedule');
    expect(pageFromPath('/unknown')).toBeNull();
    expect(pageFromHash('#/schedule')).toBe('schedule');
    expect(pageFromHash('#/unknown')).toBeNull();
    expect(resolveInitialPage('/', '#/reports')).toBe('reports');
    expect(resolveInitialPage('/payments')).toBe('payments');
    expect(resolveInitialPage('/unknown')).toBe('dashboard');
  });

  it('обновляет часы на границе минуты и при возврате вкладки', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T12:00:30.000Z'));
    let visibilityHandler;
    const documentRef = {
      visibilityState: 'visible',
      addEventListener: (_name, handler) => (visibilityHandler = handler),
      removeEventListener: vi.fn(),
    };
    const onTick = vi.fn();
    const clock = createMinuteClock({ onTick, documentRef });

    clock.start();
    vi.advanceTimersByTime(30_020);
    expect(onTick).toHaveBeenCalledTimes(2);

    vi.setSystemTime(new Date('2026-08-14T12:08:00.000Z'));
    visibilityHandler();
    expect(onTick).toHaveBeenLastCalledWith(new Date('2026-08-14T12:08:00.000Z'));
    clock.stop();
  });
});
