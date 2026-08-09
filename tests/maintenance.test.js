import { describe, it, expect } from 'vitest';
import { pruneOldHistory, sweepOrphans, syncFutureGroupBilling } from '../src/state/maintenance.js';
import { blankData } from '../src/state/schema.js';

function seed(overrides = {}) {
  return { ...blankData(), ...overrides };
}

describe('pruneOldHistory', () => {
  it('удаляет events старше retentionDays', () => {
    const data = seed({
      events: [
        { id: 'old', date: '2020-01-01T00:00:00Z' },
        { id: 'new', date: '2100-01-01T00:00:00Z' },
      ],
    });
    const r = pruneOldHistory(data, 45, Date.parse('2026-08-09T00:00:00Z'));
    expect(r.data.events.map((e) => e.id)).toEqual(['new']);
    expect(r.changes.eventsRemoved).toBe(1);
  });

  it('идемпотентна', () => {
    const data = seed({ events: [{ id: 'a', date: '2100-01-01T00:00:00Z' }] });
    const r1 = pruneOldHistory(data);
    const r2 = pruneOldHistory(r1.data);
    expect(r2.data).toEqual(r1.data);
    expect(r2.changes.eventsRemoved).toBe(0);
  });

  it('не мутирует вход', () => {
    const data = seed({ events: [{ id: 'old', date: '2020-01-01T00:00:00Z' }] });
    const snap = structuredClone(data);
    pruneOldHistory(data, 45, Date.parse('2026-08-09T00:00:00Z'));
    expect(data).toEqual(snap);
  });

  it('сворачивает старые занятия и платежи в финансовый архив', () => {
    const data = seed({
      students: [
        { id: 's1', payType: 'single', price: 1000 },
        { id: 's2', payType: 'package', price: 1500, packageSize: 4 },
      ],
      lessons: [
        {
          id: 'l1',
          studentId: 's1',
          date: '2026-01-01',
          status: 'done',
          payment: 'unpaid',
          amount: 1000,
        },
        {
          id: 'l2',
          studentId: 's2',
          date: '2026-01-01',
          status: 'done',
          payment: 'package',
          amount: 1500,
        },
      ],
      payments: [
        { id: 'p1', studentId: 's1', date: '2026-01-02', amount: 1000 },
        { id: 'p2', studentId: 's2', date: '2026-01-02', amount: 6000, packageLessons: 4 },
      ],
    });
    const r = pruneOldHistory(data, 45, Date.parse('2026-08-09T00:00:00Z'));
    expect(r.data.lessons).toEqual([]);
    expect(r.data.payments).toEqual([]);
    expect(r.data.financeArchive.s1).toMatchObject({ singleCharged: 1000, paidAmount: 1000 });
    expect(r.data.financeArchive.s2).toMatchObject({
      packageUsed: 1,
      packageBought: 4,
      paidAmount: 6000,
    });
    expect(r.changes).toMatchObject({ lessonsRemoved: 2, paymentsRemoved: 2 });
  });
});

describe('sweepOrphans', () => {
  it('удаляет занятия/платежи/архив с несуществующими учениками и группами', () => {
    const data = seed({
      students: [{ id: 's1', name: 'A' }],
      groups: [{ id: 'g1', name: 'G', members: ['s1', 'ghost'] }],
      lessons: [
        { id: 'l1', studentId: 's1', date: '2026-01-01' },
        { id: 'l2', studentId: 'ghost', date: '2026-01-01' },
        { id: 'l3', groupId: 'g1', date: '2026-01-02' },
        { id: 'l4', groupId: 'g-ghost', date: '2026-01-02' },
      ],
      payments: [
        { id: 'p1', studentId: 's1', amount: 100, date: '2026-01-01' },
        { id: 'p2', studentId: 'ghost', amount: 999, date: '2026-01-01' },
      ],
      financeArchive: { s1: {}, ghost: {} },
      topicLog: { s1: [], ghost: [] },
    });
    const r = sweepOrphans(data);
    expect(r.data.lessons.map((l) => l.id).sort()).toEqual(['l1', 'l3']);
    expect(r.data.payments.map((p) => p.id)).toEqual(['p1']);
    expect(Object.keys(r.data.financeArchive)).toEqual(['s1']);
    expect(Object.keys(r.data.topicLog)).toEqual(['s1']);
    // Ghost вычеркнут из members, группа осталась.
    expect(r.data.groups[0].members).toEqual(['s1']);
    expect(r.changes).toMatchObject({
      lessonsRemoved: 2,
      paymentsRemoved: 1,
      archiveRemoved: 1,
      topicRemoved: 1,
    });
  });

  it('идемпотентна', () => {
    const data = seed({
      students: [{ id: 's1', name: 'A' }],
      lessons: [{ id: 'l1', studentId: 's1', date: '2026-01-01' }],
    });
    const r1 = sweepOrphans(data);
    const r2 = sweepOrphans(r1.data);
    expect(r2.data).toEqual(r1.data);
    expect(r2.changes).toMatchObject({ lessonsRemoved: 0, paymentsRemoved: 0 });
  });

  it('удаляет группу, если все её участники были orphans', () => {
    const data = seed({
      students: [],
      groups: [{ id: 'g1', name: 'G', members: ['ghost'] }],
      lessons: [{ id: 'l1', groupId: 'g1', date: '2026-01-01' }],
    });
    const r = sweepOrphans(data);
    expect(r.data.groups).toEqual([]);
    expect(r.data.lessons).toEqual([]);
    expect(r.changes.groupsRemoved).toBe(1);
  });
});

describe('syncFutureGroupBilling', () => {
  it('обновляет только будущие плановые групповые занятия и идемпотентна', () => {
    const now = Date.parse('2026-08-09T10:00:00Z');
    const data = seed({
      students: [{ id: 's1', name: 'A', price: 1500, payType: 'package' }],
      groups: [{ id: 'g1', name: 'G', members: ['s1'] }],
      lessons: [
        {
          id: 'future',
          groupId: 'g1',
          studentId: 's1',
          date: '2026-08-10T10:00:00Z',
          status: 'planned',
          amount: 1000,
          payment: 'unpaid',
        },
        {
          id: 'done',
          groupId: 'g1',
          studentId: 's1',
          date: '2026-08-01T10:00:00Z',
          status: 'done',
          amount: 1000,
          payment: 'unpaid',
        },
      ],
    });
    const once = syncFutureGroupBilling(data, now);
    expect(once.data.lessons[0]).toMatchObject({ amount: 1500, payment: 'package' });
    expect(once.data.lessons[1]).toEqual(data.lessons[1]);
    expect(once.changes.lessonsUpdated).toBe(1);
    const twice = syncFutureGroupBilling(once.data, now);
    expect(twice.data).toEqual(once.data);
    expect(twice.changes.lessonsUpdated).toBe(0);
  });
});
