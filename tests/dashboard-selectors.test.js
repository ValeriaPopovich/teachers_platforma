import { describe, expect, it } from 'vitest';

import { buildTimeline } from '../src/modules/dashboard/dashboard.selectors.js';
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
});
