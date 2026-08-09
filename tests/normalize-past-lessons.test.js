import { describe, it, expect } from 'vitest';
import { normalizePastLessons } from '../src/state/maintenance.js';
import { blankData } from '../src/state/schema.js';

const NOW = Date.parse('2026-08-09T12:00:00Z');

function seed(lessons) {
  return { ...blankData(), lessons };
}

describe('normalizePastLessons', () => {
  it('planned + закончившееся → done', () => {
    const data = seed([
      { id: 'l1', date: '2026-08-01T10:00:00Z', status: 'planned', duration: 60 },
    ]);
    const r = normalizePastLessons(data, NOW);
    expect(r.data.lessons[0].status).toBe('done');
    expect(r.data.lessons[0].reportFilled).toBe(false);
    expect(r.changes.lessonsCompleted).toBe(1);
    expect(r.changes.completedLessonIds).toEqual(['l1']);
  });

  it('planned + будущее → без изменений', () => {
    const data = seed([
      { id: 'l1', date: '2027-01-01T10:00:00Z', status: 'planned', duration: 60 },
    ]);
    const r = normalizePastLessons(data, NOW);
    expect(r.data.lessons[0].status).toBe('planned');
    expect(r.changes.lessonsCompleted).toBe(0);
  });

  it('done не трогает', () => {
    const data = seed([
      { id: 'l1', date: '2026-08-01T10:00:00Z', status: 'done', reportFilled: true },
    ]);
    const r = normalizePastLessons(data, NOW);
    expect(r.data.lessons[0].reportFilled).toBe(true);
  });

  it('идемпотентна', () => {
    const data = seed([{ id: 'l1', date: '2026-08-01T10:00:00Z', status: 'planned' }]);
    const r1 = normalizePastLessons(data, NOW);
    const r2 = normalizePastLessons(r1.data, NOW);
    expect(r2.data).toEqual(r1.data);
    expect(r2.changes.lessonsCompleted).toBe(0);
  });

  it('не мутирует вход', () => {
    const data = seed([{ id: 'l1', date: '2026-08-01T10:00:00Z', status: 'planned' }]);
    const snap = structuredClone(data);
    normalizePastLessons(data, NOW);
    expect(data).toEqual(snap);
  });
});
