import { describe, it, expect } from 'vitest';
import legacyBaseline from './fixtures/baseline.json';
import { finances } from '../src/domain/finances.js';
import { migrateLegacyLedger } from '../src/state/migrations.js';

// Единая книга учёта: начислено = проведённые занятия по их собственной цене,
// оплачено = платежи. Baseline прогоняется через миграцию, потому что зафиксирован
// на старой схеме — числа при этом должны совпасть со старыми балансами.
const baseline = migrateLegacyLedger(legacyBaseline);

const EXPECTED = {
  's-single-debt': { charged: 4000, paid: 3000, balance: -1000, debt: 1000 },
  's-single-advance': { charged: 1000, paid: 1500, balance: 500, debt: 0 },
  's-single-billing': { charged: 1000, paid: 1200, balance: 200, debt: 0 },
  's-pack': { charged: 2400, paid: 6400, balance: 4000, debt: 0 },
  's-pack-archive': { charged: 3000, paid: 2000, balance: -1000, debt: 1000 },
};

describe('finances — единая книга учёта', () => {
  for (const [id, expected] of Object.entries(EXPECTED)) {
    it(`баланс: ${id}`, () => {
      expect(finances(baseline, id)).toEqual(expected);
    });
  }

  it('оплаченное занятие не создаёт аванс из воздуха', () => {
    const data = {
      students: [{ id: 's1', price: 1000 }],
      lessons: [{ id: 'l1', studentId: 's1', date: '2026-08-09', status: 'done', amount: 1000 }],
      payments: [{ id: 'p1', studentId: 's1', lessonId: 'l1', date: '2026-08-09', amount: 1000 }],
    };
    expect(finances(data, 's1')).toMatchObject({ charged: 1000, paid: 1000, balance: 0, debt: 0 });
  });

  it('пробное занятие бесплатно', () => {
    const data = {
      students: [{ id: 's1', price: 1000 }],
      lessons: [
        {
          id: 'l1',
          studentId: 's1',
          date: '2026-08-09',
          status: 'done',
          lessonKind: 'trial',
          amount: 1000,
        },
      ],
      payments: [],
    };
    expect(finances(data, 's1')).toMatchObject({ charged: 0, balance: 0, debt: 0 });
  });

  it('начисляют только проведённые занятия и пропуски с оплатой', () => {
    const lesson = (id, status) => ({
      id,
      studentId: 's1',
      date: '2026-08-09',
      status,
      amount: 500,
    });
    const data = {
      students: [{ id: 's1', price: 500 }],
      payments: [],
      lessons: [
        lesson('l1', 'done'),
        lesson('l2', 'paid_missed'),
        lesson('l3', 'missed'),
        lesson('l4', 'cancelled'),
        lesson('l5', 'moved'),
        lesson('l6', 'planned'),
        lesson('l7', 'unconfirmed'),
      ],
    };
    expect(finances(data, 's1').charged).toBe(1000);
  });

  it('цена берётся из занятия, а не из текущего тарифа ученика', () => {
    const data = {
      students: [{ id: 's1', price: 2000 }],
      lessons: [{ id: 'l1', studentId: 's1', date: '2026-08-09', status: 'done', amount: 1200 }],
      payments: [],
    };
    expect(finances(data, 's1').charged).toBe(1200);
  });

  it('ledgerOnly-платёж не учитывается в paid', () => {
    expect(finances(baseline, 's-single-advance').paid).toBe(1500);
  });

  it('billingSince отсекает занятия и платежи до cutoff', () => {
    const result = finances(baseline, 's-single-billing');
    expect(result.charged).toBe(1000);
    expect(result.paid).toBe(1200);
  });

  it('результат не зависит от порядка массивов (инвариант §5.10)', () => {
    const shuffled = structuredClone(baseline);
    shuffled.lessons.reverse();
    shuffled.payments.reverse();
    for (const id of Object.keys(EXPECTED)) {
      expect(finances(shuffled, id)).toEqual(finances(baseline, id));
    }
  });

  it('несуществующий ученик даёт нулевой баланс', () => {
    expect(finances(baseline, 'does-not-exist')).toEqual({
      charged: 0,
      paid: 0,
      balance: 0,
      debt: 0,
    });
  });
});
