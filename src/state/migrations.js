import { CURRENT_SCHEMA_VERSION, isEnvelope, wrapLegacy } from './schema.js';

/**
 * Схема 1 → 2: переход на единую книгу учёта.
 * Старая модель считала абонемент отдельной веткой (packageLessons, packageSize,
 * financeArchive). Теперь деньги = платежи минус проведённые занятия по их
 * собственной цене, поэтому свёрнутый архив нужно вернуть в баланс одной
 * корректирующей записью, иначе он потеряется вместе со старой формулой.
 */
export function migrateLegacyLedger(data) {
  const next = structuredClone(data);
  next.students ||= [];
  next.lessons ||= [];
  next.payments ||= [];
  const priceOf = (id) => +next.students.find((student) => student.id === id)?.price || 0;

  const hasLinkedPayment = (lessonId) =>
    next.payments.some((payment) => payment.lessonId === lessonId);

  for (const lesson of next.lessons) {
    // «Не начислять» становится бесплатным занятием, списание из абонемента —
    // обычным начислением: сам абонемент теперь живёт на балансе, а не в занятии.
    if (lesson.payment === 'not_charged') lesson.amount = 0;
    if (['package', 'not_charged'].includes(lesson.payment)) lesson.payment = 'unpaid';
    if (lesson.amount == null) lesson.amount = priceOf(lesson.studentId);
    // Раньше занятие «уже оплачено» не начислялось вовсе. Теперь начисляется, и
    // без встречного платежа у ученика возник бы долг из ниоткуда.
    if (lesson.payment === 'paid' && lesson.studentId && !hasLinkedPayment(lesson.id)) {
      next.payments.push({
        id: `lesson-${lesson.id}`,
        studentId: lesson.studentId,
        lessonId: lesson.id,
        date: String(lesson.date).slice(0, 10),
        createdAt: new Date(lesson.date).getTime() || 0,
        amount: +lesson.amount || 0,
        note: 'Оплата занятия',
      });
    }
  }

  for (const [id, archive] of Object.entries(next.financeArchive || {})) {
    const student = next.students.find((item) => item.id === id);
    if (!student) continue;
    const charged =
      (+archive.singleCharged || 0) + (+archive.packageUsed || 0) * (+student.price || 0);
    const net = Math.round((+archive.paidAmount || 0) - charged);
    if (!net) continue;
    const since = +archive.since || +student.billingSince || 0;
    next.payments.push({
      id: `archive-${id}`,
      studentId: id,
      date: new Date(since || Date.now()).toISOString().slice(0, 10),
      createdAt: since,
      amount: net,
      note: 'Перенос архива расчётов',
    });
  }
  delete next.financeArchive;

  for (const student of next.students) {
    delete student.packageSize;
    student.status ||= 'active';
  }
  return next;
}

const MIGRATIONS = { 0: (data) => data, 1: migrateLegacyLedger };

export function normalizeToEnvelope(parsed) {
  return isEnvelope(parsed) ? parsed : wrapLegacy(parsed);
}
export function migrateToLatest(envelope) {
  const errors = [];
  let current = envelope;
  while (current.meta.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const from = current.meta.schemaVersion,
      step = MIGRATIONS[from];
    if (!step)
      return { ok: false, envelope: current, errors: [`no migration from schemaVersion ${from}`] };
    try {
      current = {
        meta: { schemaVersion: from + 1, updatedAt: new Date().toISOString() },
        data: step(current.data),
      };
    } catch (error) {
      errors.push(`migration ${from} failed: ${error.message}`);
      return { ok: false, envelope: current, errors };
    }
  }
  if (current.meta.schemaVersion > CURRENT_SCHEMA_VERSION)
    return {
      ok: false,
      envelope: current,
      errors: [
        `state schemaVersion ${current.meta.schemaVersion} is newer than known ${CURRENT_SCHEMA_VERSION}`,
      ],
    };
  return { ok: true, envelope: current, errors };
}
