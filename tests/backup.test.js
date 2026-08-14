import { describe, it, expect } from 'vitest';
import {
  makeBackup,
  unwrapBackup,
  validateBackup,
  mergeImported,
  replaceImported,
  validateBackupSize,
} from '../src/domain/backup.js';
import { blankData, CURRENT_SCHEMA_VERSION } from '../src/state/schema.js';

let counter = 0;
const uid = () => `id-${++counter}`;

function reset() {
  counter = 0;
}

describe('makeBackup / unwrapBackup', () => {
  it('оборачивает data в envelope с метаданными и разворачивает обратно', () => {
    const data = blankData();
    const b = makeBackup(data, { appVersion: '0.1.0', now: () => new Date('2026-08-09') });
    expect(b.app).toBe('teachers-platforma');
    expect(b.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(b.appVersion).toBe('0.1.0');
    expect(unwrapBackup(b)).toEqual(data);
  });

  it('unwrap понимает legacy flat backup (data === сам объект)', () => {
    const legacy = { students: [], lessons: [] };
    expect(unwrapBackup(legacy)).toBe(legacy);
  });
});

describe('validateBackup', () => {
  it('минимальный валидный backup проходит', () => {
    expect(validateBackup({ students: [], lessons: [] }).ok).toBe(true);
  });

  it('нет students/lessons → invalid', () => {
    expect(validateBackup({}).ok).toBe(false);
  });

  it('дубликат id ученика → invalid', () => {
    const r = validateBackup({
      students: [
        { id: 's1', name: 'A' },
        { id: 's1', name: 'B' },
      ],
      lessons: [],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/duplicate/);
  });

  it('занятие без владельца → invalid', () => {
    const r = validateBackup({
      students: [{ id: 's1', name: 'A' }],
      lessons: [{ id: 'l1', date: '2026-01-01' }],
    });
    expect(r.ok).toBe(false);
  });

  it('не пропускает broken references', () => {
    const r = validateBackup({
      ...blankData(),
      students: [{ id: 's1', name: 'A' }],
      groups: [{ id: 'g1', name: 'G', members: ['missing'] }],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/unknown student/);
  });

  it('ограничивает размер до 10 МБ', () => {
    expect(validateBackupSize(10 * 1024 * 1024)).toBe(true);
    expect(validateBackupSize(10 * 1024 * 1024 + 1)).toBe(false);
  });

  it('rejects IDs that could break HTML attributes', () => {
    const r = validateBackup({
      ...blankData(),
      students: [{ id: 'bad" onclick="alert(1)', name: 'A' }],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/invalid student/);
  });
});

describe('mergeImported — remap payment.lessonId (fix §2.4)', () => {
  it('payment.lessonId после merge указывает на новый (remapped) lesson', () => {
    reset();
    const target = blankData();
    const src = {
      ...blankData(),
      students: [{ id: 'S1', name: 'Old' }],
      lessons: [{ id: 'L1', studentId: 'S1', date: '2026-01-01' }],
      payments: [{ id: 'P1', studentId: 'S1', lessonId: 'L1', amount: 100, date: '2026-01-01' }],
    };
    const merged = mergeImported(target, src, uid);
    expect(merged.students).toHaveLength(1);
    expect(merged.lessons).toHaveLength(1);
    expect(merged.payments).toHaveLength(1);
    const newLessonId = merged.lessons[0].id;
    const newStudentId = merged.students[0].id;
    expect(merged.payments[0].lessonId).toBe(newLessonId);
    expect(merged.payments[0].studentId).toBe(newStudentId);
    // Старые ID не остались.
    expect(newLessonId).not.toBe('L1');
    expect(newStudentId).not.toBe('S1');
  });

  it('payment без lessonId остаётся без него', () => {
    reset();
    const src = {
      ...blankData(),
      students: [{ id: 'S1', name: 'X' }],
      lessons: [],
      payments: [{ id: 'P1', studentId: 'S1', amount: 100, date: '2026-01-01' }],
    };
    const merged = mergeImported(blankData(), src, uid);
    expect(merged.payments[0].lessonId).toBeUndefined();
  });

  it('архив расчётов из старого бэкапа превращается в платёж, а не теряется', () => {
    reset();
    const target = { ...blankData(), students: [{ id: 't-s1', name: 'A' }] };
    const src = {
      ...blankData(),
      students: [{ id: 'S1', name: 'B', price: 500 }],
      financeArchive: { S1: { packageUsed: 6, singleCharged: 200, paidAmount: 4000 } },
    };
    const merged = mergeImported(target, src, uid);
    const importedId = merged.students.at(-1).id;
    // 4000 оплачено минус 6 × 500 списанных и 200 долга = 800 остатка на балансе.
    expect(merged.payments).toHaveLength(1);
    expect(merged.payments[0]).toMatchObject({ studentId: importedId, amount: 800 });
    expect(merged.financeArchive).toBeUndefined();
  });

  it('не создаёт ID collisions даже при одинаковых ID в target и src (инвариант §5.6)', () => {
    reset();
    // target и src намеренно используют одинаковый id — merge должен присвоить новый.
    const target = {
      ...blankData(),
      students: [{ id: 'shared-id', name: 'exists' }],
    };
    const src = {
      ...blankData(),
      students: [{ id: 'shared-id', name: 'imported same-id' }],
      lessons: [],
    };
    // uid-генератор гарантированно не выдаёт 'shared-id'.
    const merged = mergeImported(target, src, uid);
    const ids = merged.students.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Импортированный получил новый id, а не 'shared-id'.
    expect(merged.students.at(-1).id).not.toBe('shared-id');
  });

  it('повторяет uid generation, если генератор столкнулся с существующим ID', () => {
    const target = { ...blankData(), students: [{ id: 'collision', name: 'exists' }] };
    const src = { ...blankData(), students: [{ id: 'old', name: 'imported' }] };
    const values = ['collision', 'unique'];
    const merged = mergeImported(target, src, () => values.shift());
    expect(merged.students.map((item) => item.id)).toEqual(['collision', 'unique']);
  });
});

describe('replaceImported — recovery copy', () => {
  it('возвращает { nextData, recovery }; recovery — копия текущего', () => {
    const current = { ...blankData(), students: [{ id: 'keep', name: 'Old' }] };
    const src = { ...blankData(), students: [{ id: 'new', name: 'New' }] };
    const { nextData, recovery } = replaceImported(current, src);
    expect(nextData.students).toEqual([{ id: 'new', name: 'New', status: 'active' }]);
    expect(recovery.students).toEqual([{ id: 'keep', name: 'Old' }]);
  });

  it('recovery — глубокая копия (мутация nextData не задевает recovery)', () => {
    const current = { ...blankData(), students: [{ id: 'keep', name: 'Old' }] };
    const src = { ...blankData(), students: [{ id: 'new', name: 'New' }] };
    const { nextData, recovery } = replaceImported(current, src);
    nextData.students[0].name = 'Mutated';
    expect(recovery.students[0].name).toBe('Old');
  });
});
