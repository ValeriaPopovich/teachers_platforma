import { validateReferential, validateStructural } from '../state/validate.js';
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const SAFE_ID = /^[A-Za-z0-9._:-]{1,128}$/;
export const isSafeImportedId = (value) => typeof value === 'string' && SAFE_ID.test(value);
export const validateBackupSize = (size, maxBytes = MAX_BACKUP_BYTES) =>
  Number.isFinite(size) && size >= 0 && size <= maxBytes;
export function makeBackup(data, { appVersion = 'unknown', now = () => new Date() } = {}) {
  return {
    app: 'teachers-platforma',
    appVersion,
    schemaVersion: 1,
    exportedAt: now().toISOString(),
    data,
  };
}
export function unwrapBackup(backup) {
  return backup && typeof backup === 'object' && backup.data && typeof backup.data === 'object'
    ? backup.data
    : backup;
}
export function validateBackup(obj) {
  const errors = [],
    data = unwrapBackup(obj);
  if (!data || typeof data !== 'object') return { ok: false, errors: ['not an object'] };
  if (!Array.isArray(data.students)) errors.push('students must be array');
  if (!Array.isArray(data.lessons)) errors.push('lessons must be array');
  for (const key of ['groups', 'events', 'payments'])
    if (data[key] != null && !Array.isArray(data[key])) errors.push(`${key} must be array`);
  const ids = new Set();
  for (const student of data.students || []) {
    if (!student || !isSafeImportedId(student.id) || !String(student.name || '').trim())
      errors.push(`invalid student ${student?.id}`);
    else if (ids.has(student.id)) errors.push(`duplicate student id ${student.id}`);
    ids.add(student?.id);
  }
  for (const collection of ['groups', 'lessons', 'events', 'payments']) {
    const collectionIds = new Set();
    for (const item of data[collection] || []) {
      if (collectionIds.has(item?.id)) errors.push(`duplicate ${collection} id ${item?.id}`);
      collectionIds.add(item?.id);
    }
  }
  for (const group of data.groups || [])
    if (
      !group ||
      !isSafeImportedId(group.id) ||
      !String(group.name || '').trim() ||
      !Array.isArray(group.members)
    )
      errors.push(`invalid group ${group?.id}`);
  for (const owner of [...(data.students || []), ...(data.groups || [])])
    for (const slot of owner?.scheduleSlots || [])
      if (
        !slot ||
        !Number.isInteger(+slot.day) ||
        +slot.day < 0 ||
        +slot.day > 6 ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(slot.time || ''))
      )
        errors.push(`invalid schedule slot for ${owner?.id}`);
  for (const lesson of data.lessons || []) {
    if (
      !lesson ||
      !isSafeImportedId(lesson.id) ||
      !lesson.date ||
      !Number.isFinite(new Date(lesson.date).getTime()) ||
      (!lesson.studentId && !lesson.groupId)
    )
      errors.push(`invalid lesson ${lesson?.id}`);
    for (const reference of [
      lesson?.studentId,
      lesson?.groupId,
      lesson?.seriesId,
      lesson?.movedFrom,
    ])
      if (reference != null && reference !== '' && !isSafeImportedId(reference))
        errors.push(`unsafe lesson reference ${reference}`);
  }
  for (const event of data.events || [])
    if (
      !event ||
      !isSafeImportedId(event.id) ||
      !String(event.title || '').trim() ||
      !Number.isFinite(new Date(event.date).getTime())
    )
      errors.push(`invalid event ${event?.id}`);
  for (const payment of data.payments || []) {
    if (
      !payment ||
      !isSafeImportedId(payment.id) ||
      !payment.studentId ||
      !Number.isFinite(+payment.amount) ||
      !payment.date
    )
      errors.push(`invalid payment ${payment?.id}`);
    for (const reference of [payment?.studentId, payment?.lessonId])
      if (reference != null && reference !== '' && !isSafeImportedId(reference))
        errors.push(`unsafe payment reference ${reference}`);
  }
  const structural = validateStructural(data),
    referential = validateReferential(data);
  errors.push(...structural.errors, ...referential.errors);
  return { ok: errors.length === 0, errors };
}
export function mergeImported(data, src, uid) {
  const next = structuredClone(data),
    usedIds = new Set([
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
  const studentMap = new Map((src.students || []).map((item) => [item.id, nextId()])),
    groupMap = new Map((src.groups || []).map((item) => [item.id, nextId()])),
    lessonMap = new Map((src.lessons || []).map((item) => [item.id, nextId()])),
    seriesMap = new Map();
  const mapSeries = (id) => {
    if (!id) return id;
    if (!seriesMap.has(id)) seriesMap.set(id, nextId());
    return seriesMap.get(id);
  };
  next.students.push(
    ...(src.students || []).map((item) => ({ ...item, id: studentMap.get(item.id) })),
  );
  next.groups.push(
    ...(src.groups || []).map((item) => ({
      ...item,
      id: groupMap.get(item.id),
      members: (item.members || []).map((id) => studentMap.get(id) || id),
    })),
  );
  next.lessons.push(
    ...(src.lessons || []).map((item) => ({
      ...item,
      id: lessonMap.get(item.id),
      studentId: studentMap.get(item.studentId) || item.studentId,
      groupId: groupMap.get(item.groupId) || item.groupId,
      seriesId: mapSeries(item.seriesId),
      movedFrom: lessonMap.get(item.movedFrom) || item.movedFrom,
    })),
  );
  next.events.push(...(src.events || []).map((item) => ({ ...item, id: nextId() })));
  next.payments.push(
    ...(src.payments || []).map((item) => ({
      ...item,
      id: nextId(),
      studentId: studentMap.get(item.studentId) || item.studentId,
      lessonId: item.lessonId ? lessonMap.get(item.lessonId) || item.lessonId : item.lessonId,
    })),
  );
  next.settings.customGoals = [
    ...new Set([...(next.settings.customGoals || []), ...(src.settings?.customGoals || [])]),
  ];
  next.settings.deletedGoals = [
    ...new Set([...(next.settings.deletedGoals || []), ...(src.settings?.deletedGoals || [])]),
  ];
  for (const [oldId, list] of Object.entries(src.topicLog || {})) {
    const id = studentMap.get(oldId) || oldId,
      cur = next.topicLog[id] || [];
    next.topicLog[id] = [
      ...cur,
      ...(Array.isArray(list)
        ? list.filter((entry) => !cur.some((old) => old.d === entry.d && old.t === entry.t))
        : []),
    ];
  }
  for (const [oldId, value] of Object.entries(src.financeArchive || {})) {
    const id = studentMap.get(oldId) || oldId,
      current = next.financeArchive[id] || {};
    next.financeArchive[id] = {
      packageBought: (+current.packageBought || 0) + (+value.packageBought || 0),
      packageUsed: (+current.packageUsed || 0) + (+value.packageUsed || 0),
      singleCharged: (+current.singleCharged || 0) + (+value.singleCharged || 0),
      paidAmount: (+current.paidAmount || 0) + (+value.paidAmount || 0),
    };
  }
  return next;
}
export function replaceImported(currentData, src) {
  return { nextData: structuredClone(src), recovery: structuredClone(currentData) };
}
