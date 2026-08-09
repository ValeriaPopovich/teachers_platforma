import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../src/state/store.js';

describe('createStore', () => {
  it('getState возвращает исходное состояние', () => {
    const s = createStore({ n: 1 });
    expect(s.getState()).toEqual({ n: 1 });
  });

  it('update меняет state через mutator и не мутирует прежний', () => {
    const s = createStore({ n: 1, arr: [1, 2] });
    const before = s.getState();
    s.update('increment', (d) => {
      d.n += 1;
      d.arr.push(3);
    });
    expect(s.getState()).toEqual({ n: 2, arr: [1, 2, 3] });
    // Прежний state не мутирован (proof of clone).
    expect(before).toEqual({ n: 1, arr: [1, 2] });
  });

  it('replace полностью заменяет state', () => {
    const s = createStore({ n: 1 });
    s.replace({ n: 42 });
    expect(s.getState()).toEqual({ n: 42 });
  });

  it('subscribe уведомляет на update и replace, возвращает unsubscribe', () => {
    const s = createStore({ n: 0 });
    const listener = vi.fn();
    const unsub = s.subscribe(listener);
    s.update('inc', (d) => (d.n += 1));
    s.replace({ n: 100 });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, { n: 1 }, 'inc');
    expect(listener).toHaveBeenNthCalledWith(2, { n: 100 }, 'replace');
    unsub();
    s.update('inc', (d) => (d.n += 1));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('mutator не функция → TypeError', () => {
    const s = createStore({});
    expect(() => s.update('bad', 'not a function')).toThrow(TypeError);
  });

  it('исключение в одном listener не роняет остальных', () => {
    const s = createStore({ n: 0 });
    const bad = () => {
      throw new Error('boom');
    };
    const good = vi.fn();
    s.subscribe(bad);
    s.subscribe(good);
    // Не бросаем — просто логируем в консоль.
    const origErr = console.error;
    console.error = () => {};
    try {
      s.update('x', (d) => (d.n = 1));
    } finally {
      console.error = origErr;
    }
    expect(good).toHaveBeenCalledOnce();
  });
});
