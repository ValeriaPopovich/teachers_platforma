import { describe, it, expect, vi } from 'vitest';
import {
  SYNC_STATUS,
  initialLoad,
  saveWithCas,
  createSaveQueue,
} from '../src/cloud/sync-protocol.js';

function mockClient({ row = null, updateFn } = {}) {
  return {
    loadRow: vi.fn(async () => row),
    updateRow: vi.fn(updateFn),
  };
}

describe('initialLoad', () => {
  it('нет строки → пустой снимок, revision=0', async () => {
    const r = await initialLoad(mockClient({ row: null }), 'u1');
    expect(r).toMatchObject({ ok: true, data: null, revision: 0, schemaVersion: 1 });
  });

  it('строка есть → возвращает data и revision', async () => {
    const row = { data: { students: [] }, revision: 7, schemaVersion: 1 };
    const r = await initialLoad(mockClient({ row }), 'u1');
    expect(r.data).toEqual({ students: [] });
    expect(r.revision).toBe(7);
  });

  it('exception в loadRow → ok:false', async () => {
    const client = {
      loadRow: vi.fn(async () => {
        throw new Error('boom');
      }),
    };
    const r = await initialLoad(client, 'u1');
    expect(r.ok).toBe(false);
    expect(r.error).toBeInstanceOf(Error);
  });
});

describe('saveWithCas', () => {
  it('успех → SAVED + newRevision', async () => {
    const client = mockClient({
      updateFn: async () => ({ ok: true, rowsAffected: 1, newRevision: 8 }),
    });
    const r = await saveWithCas(client, { userId: 'u1', nextData: {}, expectedRevision: 7 });
    expect(r.status).toBe(SYNC_STATUS.SAVED);
    expect(r.newRevision).toBe(8);
  });

  it('rowsAffected=0 → CONFLICT (не перезаписываем)', async () => {
    const client = mockClient({ updateFn: async () => ({ ok: false, rowsAffected: 0 }) });
    const r = await saveWithCas(client, { userId: 'u1', nextData: {}, expectedRevision: 7 });
    expect(r.status).toBe(SYNC_STATUS.CONFLICT);
  });

  it('network error → OFFLINE', async () => {
    const client = mockClient({
      updateFn: async () => {
        throw new Error('Failed to fetch');
      },
    });
    const r = await saveWithCas(client, { userId: 'u1', nextData: {}, expectedRevision: 7 });
    expect(r.status).toBe(SYNC_STATUS.OFFLINE);
  });

  it('прочая ошибка → ERROR', async () => {
    const client = mockClient({
      updateFn: async () => {
        throw new Error('boom');
      },
    });
    const r = await saveWithCas(client, { userId: 'u1', nextData: {}, expectedRevision: 7 });
    expect(r.status).toBe(SYNC_STATUS.ERROR);
  });

  it('malformed response → ERROR', async () => {
    const client = mockClient({ updateFn: async () => ({ ok: true, rowsAffected: 1 }) });
    const r = await saveWithCas(client, { userId: 'u1', nextData: {}, expectedRevision: 7 });
    expect(r.status).toBe(SYNC_STATUS.ERROR);
  });
});

describe('createSaveQueue', () => {
  it('save-операции сериализуются: одна за раз', async () => {
    const q = createSaveQueue();
    const order = [];
    const job = (label, ms) => async () => {
      order.push(`start ${label}`);
      await new Promise((r) => setTimeout(r, ms));
      order.push(`end ${label}`);
      return { status: SYNC_STATUS.SAVED };
    };
    const p1 = q.enqueue(job('A', 20));
    const p2 = q.enqueue(job('B', 5));
    await Promise.all([p1, p2]);
    expect(order).toEqual(['start A', 'end A', 'start B', 'end B']);
  });

  it('исключение в одном job не убивает очередь', async () => {
    const q = createSaveQueue();
    const p1 = q.enqueue(async () => {
      throw new Error('boom');
    });
    const p2 = q.enqueue(async () => ({ status: SYNC_STATUS.SAVED }));
    const r1 = await p1;
    const r2 = await p2;
    expect(r1.status).toBe(SYNC_STATUS.ERROR);
    expect(r2.status).toBe(SYNC_STATUS.SAVED);
  });
});
