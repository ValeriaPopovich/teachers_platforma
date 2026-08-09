import { describe, expect, it, vi } from 'vitest';
import { createLocalPersistence, RECOVERY_KEY } from '../src/state/persistence.js';
import { blankData } from '../src/state/schema.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: vi.fn((key, value) => values.set(key, value)),
    value: (key) => values.get(key),
  };
}

describe('local persistence boundary', () => {
  it('loads legacy flat state through the validation pipeline', () => {
    const data = blankData();
    const storage = memoryStorage({ app: JSON.stringify(data) });
    const persistence = createLocalPersistence({ storage, key: 'app' });
    const result = persistence.load();
    expect(result.ok).toBe(true);
    expect(result.needsWrite).toBe(true);
    expect(result.envelope.data).toEqual(data);
  });

  it('writes a versioned envelope and notifies cloud with the same raw snapshot', () => {
    const storage = memoryStorage();
    const onPersist = vi.fn();
    const persistence = createLocalPersistence({
      storage,
      key: 'app',
      now: () => new Date('2026-08-09T10:00:00Z'),
      onPersist,
    });
    const result = persistence.save(blankData());
    expect(result.ok).toBe(true);
    expect(JSON.parse(storage.value('app')).meta).toEqual({
      schemaVersion: 1,
      updatedAt: '2026-08-09T10:00:00.000Z',
    });
    expect(onPersist).toHaveBeenCalledWith(storage.value('app'));
  });

  it('invalid state never overwrites the last valid copy', () => {
    const storage = memoryStorage({ app: 'last-valid' });
    const persistence = createLocalPersistence({ storage, key: 'app' });
    const invalid = { ...blankData(), lessons: [{ id: 'l1', studentId: 'missing', date: 'x' }] };
    const result = persistence.save(invalid);
    expect(result.ok).toBe(false);
    expect(storage.value('app')).toBe('last-valid');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('stores a recovery copy independently from the active key', () => {
    const storage = memoryStorage();
    const persistence = createLocalPersistence({
      storage,
      key: 'app',
      now: () => new Date('2026-08-09T10:00:00Z'),
    });
    const data = { ...blankData(), students: [{ id: 's1', name: 'До импорта' }] };
    persistence.saveRecovery(data);
    expect(JSON.parse(storage.value(RECOVERY_KEY)).data).toEqual(data);
    expect(storage.value('app')).toBeUndefined();
  });
});
