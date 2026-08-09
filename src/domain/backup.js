// Backup export/validation/merge/replace. Чистые функции без DOM/storage/сети.
// Отличия от inline-реализации в assets/app.js:
//   1. mergeImported REMAP-ит payment.lessonId (баг из §2.4 — раньше не мапилось).
//   2. mergeImported переносит financeArchive.packageBought и paidAmount (были
//      потеряны inline-реализацией — сохраняются полностью).
//   3. Replace всегда возвращает recovery copy предыдущего data (§5.11).
//   4. Merge принимает uid-generator, чтобы тест был детерминирован.

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
    if (!s || typeof s.id !== 'string' || !String(s.name || '').trim())
      errors.push(`invalid student ${s?.id}`);
    else if (ids.has(s.id)) errors.push(`duplicate student id ${s.id}`);
    ids.add(s?.id);
  }
  for (const g of data.groups || []) {
    if (!g || typeof g.id !== 'string' || !String(g.name || '').trim() || !Array.isArray(g.members))
      errors.push(`invalid group ${g?.id}`);
  }
  for (const l of data.lessons || []) {
    if (
      !l ||
      typeof l.id !== 'string' ||
      !l.date ||
      !Number.isFinite(new Date(l.date).getTime()) ||
      (!l.studentId && !l.groupId)
    )
      errors.push(`invalid lesson ${l?.id}`);
  }
  for (const ev of data.events || []) {
    if (
      !ev ||
      typeof ev.id !== 'string' ||
      !String(ev.title || '').trim() ||
      !Number.isFinite(new Date(ev.date).getTime())
    )
      errors.push(`invalid event ${ev?.id}`);
  }
  for (const p of data.payments || []) {
    if (!p || typeof p.id !== 'string' || !p.studentId || !Number.isFinite(+p.amount) || !p.date)
      errors.push(`invalid payment ${p?.id}`);
  }
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
  const studentMap = new Map((src.students || []).map((x) => [x.id, uid()]));
  const groupMap = new Map((src.groups || []).map((x) => [x.id, uid()]));
  const lessonMap = new Map((src.lessons || []).map((x) => [x.id, uid()]));
  const seriesMap = new Map();
  const mapSeries = (id) => {
    if (!id) return id;
    if (!seriesMap.has(id)) seriesMap.set(id, uid());
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
  next.events.push(...(src.events || []).map((x) => ({ ...x, id: uid() })));
  next.payments.push(
    ...(src.payments || []).map((x) => ({
      ...x,
      id: uid(),
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
