import { describe, expect, it } from 'vitest';

import { buildAttention, buildTimeline } from '../src/modules/dashboard/dashboard.selectors.js';
import { blankData } from '../src/state/schema.js';

const NOW = new Date('2026-08-09T12:05:00');
const STUDENTS = [
  { id: 's1', name: 'Артём', duration: 60 },
  { id: 's2', name: 'Мария', duration: 60 },
];

function stateWith(lessons) {
  return { ...blankData(), students: STUDENTS, groups: [], lessons };
}

describe('buildTimeline', () => {
  it('группирует пересекающиеся по времени занятия в один слот', () => {
    const lessons = [
      { id: 'l1', studentId: 's1', date: '2026-08-09T10:00:00', status: 'done' },
      { id: 'l2', studentId: 's2', date: '2026-08-09T10:30:00', status: 'done' },
      { id: 'l3', studentId: 's1', date: '2026-08-09T13:30:00', status: 'planned' },
    ];
    const { timeline, progress } = buildTimeline(stateWith(lessons), NOW);
    const slots = timeline.filter((row) => row.kind === 'slot');

    expect(slots).toHaveLength(2);
    expect(slots[0].lessons).toHaveLength(2);
    expect(slots[0]).toMatchObject({ maxConcurrent: 2, overlapMinutes: 30 });
    expect(slots[0].lessons.map((lesson) => lesson.timeRange)).toEqual([
      '10:00–11:00',
      '10:30–11:30',
    ]);
    expect(slots[1].lessons).toHaveLength(1);
    expect(progress).toMatchObject({ done: 2, total: 3 });
    expect(timeline.some((row) => row.kind === 'now')).toBe(true);
  });

  it('оставляет непересекающиеся занятия отдельными слотами', () => {
    const lessons = [
      { id: 'l1', studentId: 's1', date: '2026-08-09T10:00:00', status: 'done' },
      { id: 'l2', studentId: 's2', date: '2026-08-09T11:30:00', status: 'planned' },
    ];
    const slots = buildTimeline(stateWith(lessons), NOW).timeline.filter(
      (row) => row.kind === 'slot',
    );

    expect(slots).toHaveLength(2);
    expect(slots[0].lessons).toHaveLength(1);
  });

  it('различает стык без перерыва и короткую паузу', () => {
    const lessons = [
      { id: 'l1', studentId: 's1', date: '2026-08-09T09:00:00', status: 'done' },
      { id: 'l2', studentId: 's2', date: '2026-08-09T10:00:00', status: 'done' },
      {
        id: 'l3',
        studentId: 's1',
        date: '2026-08-09T11:05:00',
        status: 'planned',
      },
    ];

    const slots = buildTimeline(stateWith(lessons), NOW).timeline.filter(
      (row) => row.kind === 'slot',
    );

    expect(slots.map((slot) => slot.gapLabel)).toEqual(['', 'Без перерыва', 'Перерыв 5 мин']);
  });

  it('показывает длинное окно между занятиями', () => {
    const lessons = [
      { id: 'l1', studentId: 's1', date: '2026-08-09T09:00:00', status: 'done' },
      { id: 'l2', studentId: 's2', date: '2026-08-09T13:20:00', status: 'planned' },
    ];

    const slots = buildTimeline(stateWith(lessons), NOW).timeline.filter(
      (row) => row.kind === 'slot',
    );

    expect(slots[1].gapLabel).toBe('Окно 3 ч 20 мин');
  });

  it('не склеивает весь день в один слот из-за длинного дела', () => {
    const state = {
      ...stateWith([
        { id: 'l1', studentId: 's1', date: '2026-08-09T10:00:00', status: 'done' },
        { id: 'l2', studentId: 's2', date: '2026-08-09T16:00:00', status: 'planned' },
      ]),
      events: [{ id: 'e1', title: 'Конференция', date: '2026-08-09T09:00:00', duration: 600 }],
    };

    const slots = buildTimeline(state, NOW).timeline.filter((row) => row.kind === 'slot');

    expect(slots).toHaveLength(3);
    expect(slots.map((slot) => slot.lessons.length)).toEqual([1, 1, 1]);
    expect(slots[1].gapLabel).toBe('');
    // 16:00 наступает во время конференции (09:00–19:00), а не через 5 часов после урока.
    expect(slots[2].gapLabel).toBe('');
  });

  it('помечает «Скоро» все занятия с одинаковым стартом', () => {
    const lessons = [
      { id: 'l1', studentId: 's1', date: '2026-08-09T14:00:00', status: 'planned' },
      { id: 'l2', studentId: 's2', date: '2026-08-09T14:00:00', status: 'planned' },
    ];

    const slot = buildTimeline(stateWith(lessons), NOW).timeline.find((row) => row.kind === 'slot');

    expect(slot.lessons.map((lesson) => lesson.kind)).toEqual(['next', 'next']);
  });

  it('показывает идущее со вчерашнего вечера занятие', () => {
    const lessons = [{ id: 'l1', studentId: 's1', date: '2026-08-08T23:30:00', duration: 60 }];

    const midnight = new Date('2026-08-09T00:05:00');
    const slots = buildTimeline(stateWith(lessons), midnight).timeline.filter(
      (row) => row.kind === 'slot',
    );

    expect(slots).toHaveLength(1);
    expect(slots[0].lessons[0].kind).toBe('in_progress');
  });

  it('не рисует маркер «Сейчас» в пустом дне и считает остаток текущего занятия', () => {
    expect(buildTimeline(stateWith([]), NOW).timeline).toEqual([]);

    const running = stateWith([
      { id: 'l1', studentId: 's1', date: '2026-08-09T11:45:00', status: 'planned' },
    ]);

    expect(buildTimeline(running, NOW).timeline.find((row) => row.kind === 'now')).toMatchObject({
      remainingMinutes: 40,
    });
  });

  it('не отдаёт пустую подпись ближайшего занятия', () => {
    const soon = stateWith([
      { id: 'l1', studentId: 's1', date: '2026-08-09T12:05:20', status: 'planned' },
    ]);
    const inTwoHours = stateWith([
      { id: 'l1', studentId: 's1', date: '2026-08-09T14:05:00', status: 'planned' },
    ]);

    expect(buildTimeline(soon, NOW).next.label).toBe('Ближайший через 1м');
    expect(buildTimeline(inTwoHours, NOW).next.label).toBe('Ближайший через 2ч');
  });

  it('использует длительность конкретного занятия вместо длительности ученика', () => {
    const lessons = [
      {
        id: 'l1',
        studentId: 's1',
        date: '2026-08-09T10:00:00',
        duration: 30,
        status: 'done',
      },
      { id: 'l2', studentId: 's2', date: '2026-08-09T10:45:00', status: 'planned' },
    ];

    const slots = buildTimeline(stateWith(lessons), NOW).timeline.filter(
      (row) => row.kind === 'slot',
    );

    expect(slots).toHaveLength(2);
  });

  it('добавляет личные события в общий таймлайн дня', () => {
    const state = {
      ...stateWith([]),
      events: [
        {
          id: 'e1',
          title: 'Консультация',
          note: 'Подготовить материалы',
          date: '2026-08-09T13:00:00',
          duration: 30,
        },
      ],
    };

    const slots = buildTimeline(state, NOW).timeline.filter((row) => row.kind === 'slot');

    expect(slots).toHaveLength(1);
    expect(slots[0].lessons[0]).toMatchObject({
      id: 'e1',
      name: 'Консультация',
      type: 'event',
      topic: 'Подготовить материалы',
    });
  });

  it('показывает понятные статусы для прошедших и будущих занятий', () => {
    const lessons = [
      { id: 'l1', studentId: 's1', date: '2026-08-09T09:00:00', status: 'done' },
      {
        id: 'l2',
        studentId: 's2',
        date: '2026-08-09T10:30:00',
        status: 'unconfirmed',
      },
      { id: 'l3', studentId: 's1', date: '2026-08-09T13:00:00', status: 'planned' },
      { id: 'l4', studentId: 's2', date: '2026-08-09T15:00:00', status: 'planned' },
    ];

    const statuses = buildTimeline(stateWith(lessons), NOW)
      .timeline.filter((row) => row.kind === 'slot')
      .flatMap((row) => row.lessons.map((lesson) => lesson.statusLabel));

    expect(statuses).toEqual(['Проведено', 'Ждёт отчёта', 'Скоро', 'Запланировано']);
  });

  it('помечает текущее занятие и дело как «В процессе», включая пересечение', () => {
    const state = {
      ...stateWith([{ id: 'l1', studentId: 's1', date: '2026-08-09T11:45:00', status: 'planned' }]),
      events: [{ id: 'e1', title: 'Звонок', date: '2026-08-09T12:00:00', duration: 30 }],
    };

    const current = buildTimeline(state, NOW)
      .timeline.filter((row) => row.kind === 'slot')
      .flatMap((row) => row.lessons);

    expect(current).toEqual([
      expect.objectContaining({ id: 'l1', kind: 'in_progress', statusLabel: 'В процессе' }),
      expect.objectContaining({ id: 'e1', kind: 'in_progress', statusLabel: 'В процессе' }),
    ]);
    expect(buildTimeline(state, NOW).timeline.find((row) => row.kind === 'now')).toMatchObject({
      activeCount: 2,
    });
  });
});

describe('buildAttention', () => {
  it('и «ждёт отчёта», и незаполненное занятие ведут в форму заполнения', () => {
    const state = stateWith([
      {
        id: 'l1',
        studentId: 's1',
        date: '2026-08-08T10:00:00',
        status: 'unconfirmed',
      },
      {
        id: 'l2',
        studentId: 's2',
        date: '2026-08-07T10:00:00',
        status: 'done',
        reportFilled: false,
      },
    ]);

    const attention = buildAttention(state, NOW, 45);

    expect(attention.map(({ title, actionLabel }) => ({ title, actionLabel }))).toEqual([
      { title: 'Заполнить занятие', actionLabel: 'Заполнить' },
      { title: 'Заполнить занятие', actionLabel: 'Заполнить' },
    ]);
  });

  it('показывает только фактический долг и передаёт недостающую сумму', () => {
    const state = {
      ...blankData(),
      students: [
        { id: 'single', name: 'Артём', payType: 'single', price: 1200 },
        {
          id: 'package',
          name: 'Мария',
          payType: 'package',
          price: 1000,
          packageSize: 4,
          scheduleSlots: [],
        },
      ],
      lessons: [
        {
          id: 'debt',
          studentId: 'single',
          date: '2026-08-08T10:00:00',
          status: 'done',
          payment: 'unpaid',
          amount: 1200,
          reportFilled: true,
        },
      ],
    };

    const payments = buildAttention(state, NOW, 45).filter((item) => item.kind === 'pay');

    expect(payments).toEqual([
      expect.objectContaining({
        studentId: 'single',
        title: 'Долг',
        amountDue: 1200,
      }),
    ]);
  });
});
