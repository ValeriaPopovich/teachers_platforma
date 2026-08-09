import { describe, it, expect } from 'vitest';
import baseline from './fixtures/baseline.json';
import { loadState } from '../src/state/pipeline.js';
import { CURRENT_SCHEMA_VERSION } from '../src/state/schema.js';

describe('loadState pipeline', () => {
  it('пустой ввод даёт blank state (первый запуск)', () => {
    const r = loadState('');
    expect(r.ok).toBe(true);
    expect(r.envelope.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(r.envelope.data.students).toEqual([]);
    expect(r.envelope.data.settings.theme).toBe('light');
  });

  it('legacy flat object оборачивается в envelope v1 без изменения содержимого', () => {
    // fixture — legacy flat (без meta). Проверим, что финансовое содержимое сохраняется.
    const r = loadState(JSON.stringify(baseline));
    expect(r.ok).toBe(true);
    expect(r.envelope.meta.schemaVersion).toBe(1);
    expect(r.envelope.data.students).toHaveLength(baseline.students.length);
    expect(r.envelope.data.lessons).toHaveLength(baseline.lessons.length);
    expect(r.envelope.data.payments).toHaveLength(baseline.payments.length);
    // financeArchive сохранён точно
    expect(r.envelope.data.financeArchive).toEqual(baseline.financeArchive);
  });

  it('envelope v1 проходит без изменений', () => {
    const env = {
      meta: { schemaVersion: 1, updatedAt: '2026-01-01T00:00:00Z' },
      data: baseline,
    };
    const r = loadState(JSON.stringify(env));
    expect(r.ok).toBe(true);
    expect(r.envelope.data.students).toHaveLength(baseline.students.length);
  });

  it('невалидный JSON → ok=false, stage=parse', () => {
    const r = loadState('{not valid');
    expect(r.ok).toBe(false);
    expect(r.stage).toBe('parse');
  });

  it('structural fail: занятие без владельца', () => {
    const bad = structuredClone(baseline);
    bad.lessons.push({ id: 'x', date: '2026-08-01' });
    const r = loadState(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    expect(r.stage).toBe('structural');
  });

  it('referential fail: занятие ссылается на несуществующего ученика', () => {
    const bad = structuredClone(baseline);
    bad.lessons.push({ id: 'x', date: '2026-08-01T10:00:00Z', studentId: 'ghost' });
    const r = loadState(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    expect(r.stage).toBe('referential');
  });

  it('unknown future schemaVersion не проходит', () => {
    const env = {
      meta: { schemaVersion: 999, updatedAt: '2026-01-01T00:00:00Z' },
      data: baseline,
    };
    const r = loadState(JSON.stringify(env));
    expect(r.ok).toBe(false);
    expect(r.stage).toBe('migration');
  });

  it('идемпотентно: повторный loadState на уже загруженном envelope даёт то же', () => {
    const first = loadState(JSON.stringify(baseline));
    const second = loadState(JSON.stringify(first.envelope));
    // updatedAt может отличаться — сравним только data
    expect(second.envelope.data).toEqual(first.envelope.data);
  });
});
