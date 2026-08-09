import { describe, expect, it } from 'vitest';
import { periodAnalytics } from '../src/domain/analytics.js';

describe('periodAnalytics', () => {
  const from = Date.parse('2026-08-01T00:00:00');
  const to = Date.parse('2026-08-31T23:59:59');

  it('планирует стоимость абонемента по расписанию независимо от оплаты', () => {
    const result = periodAnalytics(
      {
        students: [
          { id: 's1', payType: 'package', price: 1800, scheduleSlots: [{ day: 1, time: '16:00' }] },
        ],
        payments: [],
        lessons: [],
      },
      from,
      to,
    );
    expect(result.paid).toBe(0);
    expect(result.charged).toBe(9000);
  });

  it('не начисляет урок из уже оплаченного абонемента повторно', () => {
    const result = periodAnalytics(
      {
        students: [
          { id: 's1', payType: 'package', price: 1800, scheduleSlots: [{ day: 1, time: '16:00' }] },
        ],
        payments: [
          {
            id: 'p1',
            studentId: 's1',
            date: '2026-08-05',
            amount: 9000,
            packageLessons: 5,
          },
        ],
        lessons: [
          {
            id: 'l1',
            studentId: 's1',
            date: '2026-08-06T10:00',
            status: 'done',
            payment: 'package',
            amount: 1800,
          },
        ],
      },
      from,
      to,
    );
    expect(result.paid).toBe(9000);
    expect(result.charged).toBe(9000);
    expect(result.lessonsCount).toBe(1);
  });

  it('учитывает внутреннюю запись оплаченного разового занятия как реальный доход', () => {
    const result = periodAnalytics(
      {
        students: [{ id: 's1', payType: 'single', price: 1800 }],
        payments: [
          {
            id: 'p1',
            studentId: 's1',
            date: '2026-08-05',
            amount: 1800,
            ledgerOnly: true,
            billingType: 'single',
          },
        ],
        lessons: [],
      },
      from,
      to,
    );
    expect(result.paid).toBe(1800);
    expect(result.pays).toHaveLength(1);
  });

  it('не включает даты до начала работы ученика в первый абонемент', () => {
    const result = periodAnalytics(
      {
        students: [
          {
            id: 's1',
            payType: 'package',
            price: 1800,
            createdAt: Date.parse('2026-08-20T00:00:00'),
            scheduleSlots: [{ day: 1, time: '16:00' }],
          },
        ],
        payments: [],
        lessons: [],
      },
      from,
      to,
    );
    expect(result.charged).toBe(3600);
  });
});
