import { describe, it, expect } from 'vitest';
import {
  calendarViewRange,
  countMonthlyRecurringLessons,
  countMonthlyRecurringLessonsFrom,
  deduplicateLessons,
  existingLessonOwnerPatch,
  extendAllSchedules,
  generateSchedule,
  monthlyRecurringDates,
  timeConflicts,
} from '../src/domain/schedule.js';
import { blankData } from '../src/state/schema.js';

describe('countMonthlyRecurringLessons', () => {
  it('учитывает реальное число будних дней в конкретном месяце', () => {
    const slots = [
      { day: 1, time: '16:00' },
      { day: 3, time: '16:00' },
    ];
    expect(countMonthlyRecurringLessons(slots, new Date(2026, 7, 1))).toBe(9);
    expect(countMonthlyRecurringLessons(slots, new Date(2026, 8, 1))).toBe(9);
  });

  it('считает два занятия в один день как два слота', () => {
    const slots = [
      { day: 1, time: '16:00' },
      { day: 1, time: '18:00' },
    ];
    expect(countMonthlyRecurringLessons(slots, new Date(2026, 7, 1))).toBe(10);
  });
});

describe('monthlyRecurringDates', () => {
  it('возвращает точные даты и время занятий в выбранном месяце', () => {
    const dates = monthlyRecurringDates([{ day: 2, time: '16:30' }], new Date(2026, 8, 1));
    expect(dates.map((date) => [date.getDate(), date.getHours(), date.getMinutes()])).toEqual([
      [1, 16, 30],
      [8, 16, 30],
      [15, 16, 30],
      [22, 16, 30],
      [29, 16, 30],
    ]);
  });
});

describe('countMonthlyRecurringLessonsFrom', () => {
  it('считает первый абонемент только с момента добавления ученика', () => {
    const slots = [{ day: 1, time: '16:00' }];
    expect(
      countMonthlyRecurringLessonsFrom(
        slots,
        new Date(2026, 7, 1),
        new Date(2026, 7, 20, 12, 0).getTime(),
      ),
    ).toBe(2);
  });
});

describe('deduplicateLessons', () => {
  it('убирает дубли по (studentId, groupId, date)', () => {
    const r = deduplicateLessons([
      { id: 'a', studentId: 's1', date: '2026-01-01T10:00' },
      { id: 'b', studentId: 's1', date: '2026-01-01T10:00' }, // дубль
      { id: 'c', studentId: 's1', date: '2026-01-02T10:00' },
    ]);
    expect(r.map((l) => l.id)).toEqual(['a', 'c']);
  });

  it('различает student и group на ту же дату', () => {
    const r = deduplicateLessons([
      { id: 'a', studentId: 's1', date: '2026-01-01T10:00' },
      { id: 'b', groupId: 'g1', date: '2026-01-01T10:00' },
    ]);
    expect(r).toHaveLength(2);
  });

  it('идемпотентна', () => {
    const input = [
      { id: 'a', studentId: 's1', date: '2026-01-01T10:00' },
      { id: 'b', studentId: 's1', date: '2026-01-01T10:00' },
    ];
    const once = deduplicateLessons(input);
    const twice = deduplicateLessons(once);
    expect(twice).toEqual(once);
  });

  it('сохраняет первое вхождение (приоритет заполненных)', () => {
    const filled = { id: 'first', studentId: 's1', date: '2026-01-01T10:00', reportFilled: true };
    const auto = { id: 'second', studentId: 's1', date: '2026-01-01T10:00', auto: true };
    const r = deduplicateLessons([filled, auto]);
    expect(r).toEqual([filled]);
  });
});

describe('timeConflicts', () => {
  it('пересечение → true', () => {
    expect(
      timeConflicts({ date: '2026-01-01T10:00:00Z' }, { date: '2026-01-01T10:30:00Z' }, 60),
    ).toBe(true);
  });

  it('нет пересечения → false', () => {
    expect(
      timeConflicts({ date: '2026-01-01T10:00:00Z' }, { date: '2026-01-01T11:00:00Z' }, 60),
    ).toBe(false);
  });

  it('касание границ → false', () => {
    // end первого = 11:00, start второго = 11:00 — не пересекаются.
    expect(
      timeConflicts({ date: '2026-01-01T10:00:00Z' }, { date: '2026-01-01T11:00:00Z' }, 60),
    ).toBe(false);
  });
});

describe('existingLessonOwnerPatch', () => {
  it('передаёт существующее индивидуальное занятие другому ученику', () => {
    const lesson = { id: 'l1', studentId: 's1', date: '2026-08-12T18:00' };

    expect(existingLessonOwnerPatch(lesson, { type: 's', id: 's2' })).toEqual({
      studentId: 's2',
    });
    expect(lesson.studentId).toBe('s1');
  });

  it('сохраняет владельца существующего группового занятия', () => {
    const lesson = { id: 'l1', studentId: 's1', groupId: 'g1', seriesId: 'series-1' };

    expect(existingLessonOwnerPatch(lesson, { type: 'g', id: 'g1' })).toEqual({
      groupId: 'g1',
      seriesId: 'series-1',
    });
  });

  it('отклоняет преобразование индивидуального занятия в групповое и наоборот', () => {
    expect(
      existingLessonOwnerPatch({ id: 'individual', studentId: 's1' }, { type: 'g', id: 'g1' }),
    ).toBeNull();
    expect(
      existingLessonOwnerPatch(
        { id: 'group', studentId: 's1', groupId: 'g1', seriesId: 'series-1' },
        { type: 's', id: 's2' },
      ),
    ).toBeNull();
  });
});

describe('calendarViewRange', () => {
  const now = new Date(2026, 7, 12, 18, 30);

  it('для дня показывает только сегодняшний день', () => {
    const range = calendarViewRange('day', now);
    expect(range.days).toBe(1);
    expect([range.start.getDate(), range.start.getHours(), range.start.getMinutes()]).toEqual([
      12, 0, 0,
    ]);
  });

  it('для недели и месяца начинает диапазон с понедельника', () => {
    const week = calendarViewRange('week', now);
    const month = calendarViewRange('month', now);
    expect([week.start.getDay(), week.start.getDate(), week.days]).toEqual([1, 10, 7]);
    expect([month.start.getDay(), month.start.getDate(), month.days]).toEqual([1, 10, 35]);
  });
});

describe('generateSchedule', () => {
  const now = new Date(2026, 7, 9, 9, 0, 0);
  const seed = () => ({
    ...blankData(),
    students: [
      {
        id: 's1',
        name: 'Аня',
        price: 1000,
        payType: 'single',
        scheduleSlots: [{ day: now.getDay(), time: '10:00' }],
      },
    ],
  });

  it('создаёт регулярные занятия и не мутирует вход', () => {
    const data = seed();
    let id = 0;
    const next = generateSchedule(data, {
      type: 'student',
      id: 's1',
      slots: data.students[0].scheduleSlots,
      now,
      uid: () => `l${++id}`,
    });
    expect(data.lessons).toEqual([]);
    expect(next.lessons.length).toBe(8);
    expect(next.lessons[0]).toMatchObject({ studentId: 's1', amount: 1000, auto: true });
  });

  it('повторное расширение не создаёт дублей', () => {
    const data = seed();
    let id = 0;
    const once = extendAllSchedules(data, { now, uid: () => `l${++id}` });
    const twice = extendAllSchedules(once, { now, uid: () => `l${++id}` });
    expect(twice.lessons).toEqual(once.lessons);
  });

  it('не удаляет вручную отредактированное автоматическое занятие при regenerate', () => {
    const data = seed();
    data.lessons.push({
      id: 'protected',
      studentId: 's1',
      date: '2026-08-09T10:00',
      status: 'planned',
      auto: true,
      manualEdited: true,
    });
    let id = 0;
    const next = generateSchedule(data, {
      type: 'student',
      id: 's1',
      slots: data.students[0].scheduleSlots,
      now,
      uid: () => `l${++id}`,
    });
    expect(next.lessons.filter((lesson) => lesson.date === '2026-08-09T10:00')).toEqual([
      data.lessons[0],
    ]);
  });
});
