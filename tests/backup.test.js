import { describe, it, expect } from 'vitest';
import {
  makeBackup,
  unwrapBackup,
  validateBackup,
  mergeImported,
  replaceImported,
} from '../src/domain/backup.js';
import { blankData } from '../src/state/schema.js';

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
    expect(b.schemaVersion).toBe(1);
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

  it('financeArchive полностью суммируется (packageBought и paidAmount тоже)', () => {
    reset();
    const target = {
      ...blankData(),
      students: [{ id: 't-s1', name: 'A' }],
      financeArchive: {
        't-s1': { packageBought: 4, packageUsed: 2, singleCharged: 100, paidAmount: 500 },
      },
    };
    const src = {
      ...blankData(),
      students: [{ id: 'S1', name: 'A' }],
      financeArchive: {
        S1: { packageBought: 8, packageUsed: 6, singleCharged: 200, paidAmount: 1000 },
      },
    };
    const merged = mergeImported(target, src, uid);
    // t-s1 не пересекся с S1 (после remap S1 стал новым id), поэтому оба ключа остались:
    expect(Object.keys(merged.financeArchive).length).toBe(2);
    const remapped = merged.financeArchive[merged.students.at(-1).id];
    expect(remapped).toEqual({
      packageBought: 8,
      packageUsed: 6,
      singleCharged: 200,
      paidAmount: 1000,
    });
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
});

describe('replaceImported — recovery copy', () => {
  it('возвращает { nextData, recovery }; recovery — копия текущего', () => {
    const current = { ...blankData(), students: [{ id: 'keep', name: 'Old' }] };
    const src = { ...blankData(), students: [{ id: 'new', name: 'New' }] };
    const { nextData, recovery } = replaceImported(current, src);
    expect(nextData.students).toEqual([{ id: 'new', name: 'New' }]);
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
