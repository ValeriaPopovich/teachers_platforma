import { describe, expect, it } from 'vitest';
import { periodAnalytics } from '../src/domain/analytics.js';

describe('periodAnalytics', () => {
  const from = Date.parse('2026-08-01T00:00:00');
  const to = Date.parse('2026-08-31T23:59:59');
  const lesson = (id, status, amount, extra = {}) => ({
    id,
    studentId: 's1',
    date: '2026-08-10T17:00',
    status,
    amount,
    ...extra,
  });

  it('начисляет проведённые занятия по их собственной цене', () => {
    const result = periodAnalytics(
      {
        students: [{ id: 's1', price: 1800 }],
        payments: [],
        lessons: [lesson('l1', 'done', 1800), lesson('l2', 'done', 1200)],
      },
      from,
      to,
    );
    expect(result.charged).toBe(3000);
    expect(result.lessonsCount).toBe(2);
    expect(result.byStudent.s1.charged).toBe(3000);
  });

  it('пропуск с оплатой начисляется, пропуск без оплаты — нет', () => {
    const result = periodAnalytics(
      {
        students: [{ id: 's1', price: 1000 }],
        payments: [],
        lessons: [lesson('l1', 'paid_missed', 1000), lesson('l2', 'missed', 1000)],
      },
      from,
      to,
    );
    expect(result.charged).toBe(1000);
  });

  it('запланированное занятие попадает в reserved, а не в charged', () => {
    const result = periodAnalytics(
      {
        students: [{ id: 's1', price: 1800 }],
        payments: [],
        lessons: [lesson('l1', 'planned', 1800), lesson('l2', 'unconfirmed', 1800)],
      },
      from,
      to,
    );
    expect(result.charged).toBe(0);
    expect(result.reserved).toBe(3600);
  });

  it('пробное занятие не начисляется', () => {
    const result = periodAnalytics(
      {
        students: [{ id: 's1', price: 1800 }],
        payments: [],
        lessons: [lesson('l1', 'done', 1800, { lessonKind: 'trial' })],
      },
      from,
      to,
    );
    expect(result.charged).toBe(0);
    expect(result.lessonsCount).toBe(1);
  });

  it('отмены и переносы не начисляются', () => {
    const result = periodAnalytics(
      {
        students: [{ id: 's1', price: 1800 }],
        payments: [],
        lessons: [lesson('l1', 'cancelled', 1800), lesson('l2', 'moved', 1800)],
      },
      from,
      to,
    );
    expect(result.charged).toBe(0);
    expect(result.reserved).toBe(0);
  });

  it('учитывает внутреннюю запись оплаченного занятия как реальный доход', () => {
    const result = periodAnalytics(
      {
        students: [{ id: 's1', price: 1800 }],
        payments: [
          { id: 'p1', studentId: 's1', date: '2026-08-05', amount: 1800, ledgerOnly: true },
        ],
        lessons: [],
      },
      from,
      to,
    );
    expect(result.paid).toBe(1800);
    expect(result.pays).toHaveLength(1);
  });

  it('не учитывает занятия и платежи вне периода', () => {
    const result = periodAnalytics(
      {
        students: [{ id: 's1', price: 1000 }],
        payments: [{ id: 'p1', studentId: 's1', date: '2026-07-05', amount: 1000 }],
        lessons: [lesson('l1', 'done', 1000, { date: '2026-07-10T17:00' })],
      },
      from,
      to,
    );
    expect(result).toMatchObject({ paid: 0, charged: 0, lessonsCount: 0 });
  });
});
