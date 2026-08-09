import { describe, it, expect } from 'vitest';
import baseline from './fixtures/baseline.json';
import { finances } from '../src/domain/finances.js';

// Ожидаемые значения посчитаны вручную из формулы index.html и зафиксированы здесь
// как baseline. Если рефактор изменит финансовый результат — эти числа «поймают» это.
// Подробный вывод по каждому кейсу — в docs/baseline-manifest.md.
const EXPECTED = {
  's-single-debt': { charged: 3000, paid: 2000, balance: -1000, debt: 1000 },
  's-single-advance': { charged: 1000, paid: 1500, balance: 500, debt: 0 },
  's-single-billing': { charged: 1000, paid: 1200, balance: 200, debt: 0 },
  's-pack': {
    charged: 2400,
    paid: 6400,
    balanceLessons: 5,
    bought: 8,
    used: 3,
    debt: 0,
    balance: 0,
  },
  's-pack-archive': {
    charged: 5000,
    paid: 4000,
    balanceLessons: -2,
    bought: 8,
    used: 10,
    debt: 1000,
    balance: 0,
  },
};

describe('finances — characterization baseline (зеркалит index.html)', () => {
  for (const [id, expected] of Object.entries(EXPECTED)) {
    it(`баланс: ${id}`, () => {
      expect(finances(baseline, id)).toMatchObject(expected);
    });
  }

  it('paid-занятие нейтрально к балансу single-ученика', () => {
    // l-sd-paid (done/paid) не увеличивает charged, отдельного платежа под него нет.
    expect(finances(baseline, 's-single-debt').charged).toBe(3000);
  });

  it('ledgerOnly-платёж не учитывается в paid', () => {
    // p-sa-ledger (9999) исключён — иначе paid был бы 11499.
    expect(finances(baseline, 's-single-advance').paid).toBe(1500);
  });

  it('billingSince отсекает занятия и платежи до cutoff', () => {
    const r = finances(baseline, 's-single-billing');
    expect(r.charged).toBe(1000); // старое занятие исключено
    expect(r.paid).toBe(1200); // старый платёж исключён
  });

  it('результат не зависит от порядка массивов (инвариант §5.10)', () => {
    const shuffled = structuredClone(baseline);
    shuffled.lessons.reverse();
    shuffled.payments.reverse();
    for (const id of Object.keys(EXPECTED)) {
      expect(finances(shuffled, id)).toEqual(finances(baseline, id));
    }
  });

  it('несуществующий ученик даёт нулевой single-баланс', () => {
    expect(finances(baseline, 'does-not-exist')).toEqual({
      charged: 0,
      paid: 0,
      balance: 0,
      debt: 0,
    });
  });

  it('разовое занятие абонементного ученика можно учесть отдельной доплатой', () => {
    const data = {
      students: [{ id: 's1', payType: 'package', price: 2000 }],
      lessons: [
        {
          id: 'l1',
          studentId: 's1',
          date: '2026-08-09',
          status: 'done',
          payment: 'unpaid',
          amount: 2500,
        },
      ],
      payments: [],
      financeArchive: {},
    };
    expect(finances(data, 's1')).toMatchObject({ used: 0, extraDebt: 2500, debt: 2500 });
    data.lessons[0].payment = 'paid';
    data.payments.push({
      id: 'p1',
      studentId: 's1',
      lessonId: 'l1',
      date: '2026-08-09',
      createdAt: Date.now(),
      amount: 2500,
      billingType: 'extra',
    });
    expect(finances(data, 's1')).toMatchObject({ used: 0, extraDebt: 0, debt: 0 });
  });
});
