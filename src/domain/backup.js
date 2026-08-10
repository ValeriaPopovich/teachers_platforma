// Backup export/validation/merge/replace. Чистые функции без DOM/storage/сети.
// Отличия от inline-реализации в assets/app.js:
//   1. mergeImported REMAP-ит payment.lessonId (баг из §2.4 — раньше не мапилось).
//   2. mergeImported переносит financeArchive.packageBought и paidAmount (были
//      потеряны inline-реализацией — сохраняются полностью).
//   3. Replace всегда возвращает recovery copy предыдущего data (§5.11).
//   4. Merge принимает uid-generator, чтобы тест был детерминирован.

import { validateReferential, validateStructural } from '../state/validate.js';

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const SAFE_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function isSafeImportedId(value) {
  return typeof value === 'string' && SAFE_ID.test(value);
}

export function validateBackupSize(size, maxBytes = MAX_BACKUP_BYTES) {
  return Number.isFinite(size) && size >= 0 && size <= maxBytes;
}

/** Создать backup-объект для export. Envelope-совместимый; поле data — как раньше. */
export function makeBackup(data, { appVersion = 'unknown', now = () => new Date() } = {}) {
  return {
    app: 'teachers-platforma',
    appVersion,
    schemaVersion: 1,
    exportedAt: now().toISOString(),
    data,
  };
}

/** Развернуть backup к data. Поддерживает legacy flat формат (data === backup сам). */
export function unwrapBackup(backup) {
  if (backup && typeof backup === 'object' && backup.data && typeof backup.data === 'object') {
    return backup.data;
  }
  return backup;
}

/** Structural validation backup / raw data. Возвращает {ok, errors[]}. */
export function validateBackup(obj) {
  const errors = [];
  const data = unwrapBackup(obj);
  if (!data || typeof data !== 'object') return { ok: false, errors: ['not an object'] };
  if (!Array.isArray(data.students)) errors.push('students must be array');
  if (!Array.isArray(data.lessons)) errors.push('lessons must be array');
  for (const key of ['groups', 'events', 'payments']) {
    if (data[key] != null && !Array.isArray(data[key])) errors.push(`${key} must be array`);
  }
  const ids = new Set();
  for (const s of data.students || []) {
    if (!s || !isSafeImportedId(s.id) || !String(s.name || '').trim())
      errors.push(`invalid student ${s?.id}`);
    else if (ids.has(s.id)) errors.push(`duplicate student id ${s.id}`);
    ids.add(s?.id);
  }
  for (const collection of ['groups', 'lessons', 'events', 'payments']) {
    const collectionIds = new Set();
    for (const item of data[collection] || []) {
      if (collectionIds.has(item?.id)) errors.push(`duplicate ${collection} id ${item?.id}`);
      collectionIds.add(item?.id);
    }
  }
  for (const g of data.groups || []) {
    if (!g || !isSafeImportedId(g.id) || !String(g.name || '').trim() || !Array.isArray(g.members))
      errors.push(`invalid group ${g?.id}`);
  }
  for (const owner of [...(data.students || []), ...(data.groups || [])]) {
    for (const slot of owner?.scheduleSlots || []) {
      if (
        !slot ||
        !Number.isInteger(+slot.day) ||
        +slot.day < 0 ||
        +slot.day > 6 ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(slot.time || ''))
      )
        errors.push(`invalid schedule slot for ${owner?.id}`);
    }
  }
  for (const l of data.lessons || []) {
    if (
      !l ||
      !isSafeImportedId(l.id) ||
      !l.date ||
      !Number.isFinite(new Date(l.date).getTime()) ||
      (!l.studentId && !l.groupId)
    )
      errors.push(`invalid lesson ${l?.id}`);
    for (const reference of [l?.studentId, l?.groupId, l?.seriesId, l?.movedFrom]) {
      if (reference != null && reference !== '' && !isSafeImportedId(reference))
        errors.push(`unsafe lesson reference ${reference}`);
    }
  }
  for (const ev of data.events || []) {
    if (
      !ev ||
      !isSafeImportedId(ev.id) ||
      !String(ev.title || '').trim() ||
      !Number.isFinite(new Date(ev.date).getTime())
    )
      errors.push(`invalid event ${ev?.id}`);
  }
  for (const p of data.payments || []) {
    if (!p || !isSafeImportedId(p.id) || !p.studentId || !Number.isFinite(+p.amount) || !p.date)
      errors.push(`invalid payment ${p?.id}`);
    for (const reference of [p?.studentId, p?.lessonId]) {
      if (reference != null && reference !== '' && !isSafeImportedId(reference))
        errors.push(`unsafe payment reference ${reference}`);
    }
  }
  const structural = validateStructural(data);
  const referential = validateReferential(data);
  errors.push(...structural.errors, ...referential.errors);
  return { ok: errors.length === 0, errors };
}

/**
 * Merge импортируемого backup в текущий data. Полный remap ID во избежание
 * коллизий (§5.6). Исправлен баг: payment.lessonId теперь мапится.
 *
 * @param {object} data - целевой data (мутируется-подобно: возвращается новый объект).
 * @param {object} src - импортируемый data (без envelope; уже unwrapBackup).
 * @param {() => string} uid - генератор новых ID.
 * @returns {object} новый data после merge.
 */
export function mergeImported(data, src, uid) {
  const next = structuredClone(data);
  const usedIds = new Set([
    ...['students', 'groups', 'lessons', 'events', 'payments'].flatMap((key) =>
      (next[key] || []).map((item) => item.id),
    ),
    ...(next.lessons || []).map((lesson) => lesson.seriesId).filter(Boolean),
  ]);
  const nextId = () => {
    for (let attempts = 0; attempts < 1000; attempts++) {
      const candidate = uid();
      if (!usedIds.has(candidate)) {
        usedIds.add(candidate);
        return candidate;
      }
    }
    throw new Error('Unable to generate a unique import ID');
  };
  const studentMap = new Map((src.students || []).map((x) => [x.id, nextId()]));
  const groupMap = new Map((src.groups || []).map((x) => [x.id, nextId()]));
  const lessonMap = new Map((src.lessons || []).map((x) => [x.id, nextId()]));
  const seriesMap = new Map();
  const mapSeries = (id) => {
    if (!id) return id;
    if (!seriesMap.has(id)) seriesMap.set(id, nextId());
    return seriesMap.get(id);
  };

  next.students.push(...(src.students || []).map((x) => ({ ...x, id: studentMap.get(x.id) })));
  next.groups.push(
    ...(src.groups || []).map((x) => ({
      ...x,
      id: groupMap.get(x.id),
      members: (x.members || []).map((id) => studentMap.get(id) || id),
    })),
  );
  next.lessons.push(
    ...(src.lessons || []).map((x) => ({
      ...x,
      id: lessonMap.get(x.id),
      studentId: studentMap.get(x.studentId) || x.studentId,
      groupId: groupMap.get(x.groupId) || x.groupId,
      seriesId: mapSeries(x.seriesId),
      movedFrom: lessonMap.get(x.movedFrom) || x.movedFrom,
    })),
  );
  next.events.push(...(src.events || []).map((x) => ({ ...x, id: nextId() })));
  next.payments.push(
    ...(src.payments || []).map((x) => ({
      ...x,
      id: nextId(),
      studentId: studentMap.get(x.studentId) || x.studentId,
      // FIX §2.4: раньше lessonId оставался старым и указывал в никуда.
      lessonId: x.lessonId ? lessonMap.get(x.lessonId) || x.lessonId : x.lessonId,
    })),
  );

  next.settings.customGoals = [
    ...new Set([...(next.settings.customGoals || []), ...(src.settings?.customGoals || [])]),
  ];
  next.settings.deletedGoals = [
    ...new Set([...(next.settings.deletedGoals || []), ...(src.settings?.deletedGoals || [])]),
  ];
  const importedExclusions = (src.settings?.scheduleExclusions || []).map((key) => {
    const [type, oldId, date] = String(key).split('|');
    const id = type === 'group' ? groupMap.get(oldId) || oldId : studentMap.get(oldId) || oldId;
    return `${type}|${id}|${date}`;
  });
  next.settings.scheduleExclusions = [
    ...new Set([...(next.settings.scheduleExclusions || []), ...importedExclusions]),
  ];

  for (const [oldId, list] of Object.entries(src.topicLog || {})) {
    const id = studentMap.get(oldId) || oldId;
    const cur = next.topicLog[id] || [];
    next.topicLog[id] = [
      ...cur,
      ...(Array.isArray(list)
        ? list.filter((e) => !cur.some((x) => x.d === e.d && x.t === e.t))
        : []),
    ];
  }

  for (const [oldId, value] of Object.entries(src.financeArchive || {})) {
    const id = studentMap.get(oldId) || oldId;
    const current = next.financeArchive[id] || {};
    next.financeArchive[id] = {
      packageBought: (+current.packageBought || 0) + (+value.packageBought || 0),
      packageUsed: (+current.packageUsed || 0) + (+value.packageUsed || 0),
      singleCharged: (+current.singleCharged || 0) + (+value.singleCharged || 0),
      paidAmount: (+current.paidAmount || 0) + (+value.paidAmount || 0),
    };
  }

  return next;
}

/**
 * Replace: полная замена data копией из backup, но возвращаем recovery copy
 * предыдущего состояния (§5.11). Вызывающий код обязан сохранить recovery до
 * применения nextData.
 */
export function replaceImported(currentData, src) {
  const recovery = structuredClone(currentData);
  const nextData = structuredClone(src);
  return { nextData, recovery };
}
