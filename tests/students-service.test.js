import { reactive } from 'vue';
import { describe, expect, it } from 'vitest';

import { createStudentsService } from '../src/modules/students/students.service.js';
import { blankData } from '../src/state/schema.js';
import { createStore } from '../src/state/store.js';

describe('students service', () => {
  it('saves a student with reactive recurring schedule slots as plain data', () => {
    const store = createStore(blankData());
    const service = createStudentsService({
      store,
      uid: (() => {
        let sequence = 0;
        return () => `test-${++sequence}`;
      })(),
      now: () => new Date('2026-08-14T12:00:00').getTime(),
    });
    const input = reactive({
      name: 'Юрий',
      price: 1500,
      duration: 60,
      payType: 'single',
      scheduleSlots: [{ day: 1, time: '17:00' }],
    });

    const result = service.saveStudent(input, { today: '2026-08-14' });

    expect(result.ok).toBe(true);
    expect(store.getState().students[0].scheduleSlots).toEqual([{ day: 1, time: '17:00' }]);
    expect(store.getState().lessons.length).toBeGreaterThan(0);
    expect(() => structuredClone(store.getState())).not.toThrow();
  });
});
