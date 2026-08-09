import { describe, it, expect } from 'vitest';
import { deduplicateLessons, timeConflicts } from '../src/domain/schedule.js';

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
