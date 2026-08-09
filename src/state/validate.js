// Валидация state. Два уровня:
//   structural — форма (типы полей). Достаточна, чтобы не разбить приложение.
//   referential — целостность ссылок (§5 инварианты 1–5).
// Оба возвращают { ok, errors[] }. При ok=false загружать state нельзя.

import { blankData } from './schema.js';

const isString = (v) => typeof v === 'string';
const isArray = Array.isArray;
const isObj = (v) => v !== null && typeof v === 'object' && !isArray(v);

/** Структурная проверка envelope-совместимого data. */
export function validateStructural(data) {
  const errors = [];
  if (!isObj(data)) return { ok: false, errors: ['data is not an object'] };

  const shape = blankData();
  for (const key of Object.keys(shape)) {
    if (data[key] === undefined) continue; // отсутствие поля допустимо (заполнится defaults)
    if (isArray(shape[key]) && !isArray(data[key])) errors.push(`${key} must be array`);
    if (isObj(shape[key]) && !isObj(data[key])) errors.push(`${key} must be object`);
  }

  // Каждый элемент коллекций должен иметь id-строку.
  for (const col of ['students', 'groups', 'lessons', 'events', 'payments']) {
    if (!isArray(data[col])) continue;
    for (const [i, item] of data[col].entries()) {
      if (!isObj(item)) errors.push(`${col}[${i}] not object`);
      else if (!isString(item.id)) errors.push(`${col}[${i}].id missing`);
    }
  }

  // Даты занятий/событий/платежей должны парситься.
  for (const l of data.lessons || []) {
    if (!l.date || !Number.isFinite(new Date(l.date).getTime()))
      errors.push(`lesson ${l.id} has invalid date`);
    if (!l.studentId && !l.groupId) errors.push(`lesson ${l.id} has neither studentId nor groupId`);
  }
  for (const ev of data.events || []) {
    if (!ev.date || !Number.isFinite(new Date(ev.date).getTime()))
      errors.push(`event ${ev.id} has invalid date`);
  }
  for (const p of data.payments || []) {
    if (!p.date) errors.push(`payment ${p.id} missing date`);
    if (!Number.isFinite(+p.amount)) errors.push(`payment ${p.id} amount not finite`);
    if (!p.studentId) errors.push(`payment ${p.id} missing studentId`);
  }

  return { ok: errors.length === 0, errors };
}

/** Ссылочная целостность. Legacy-платежи с lessonId, ссылающимся на отсутствующее занятие,
 *  допустимы — это отдельно документированное правило (§5 инвариант 5). */
export function validateReferential(data) {
  const errors = [];
  const studentIds = new Set((data.students || []).map((s) => s.id));
  const groupIds = new Set((data.groups || []).map((g) => g.id));

  // Уникальность ID (инвариант 1).
  const seen = new Set();
  for (const s of data.students || []) {
    if (seen.has(s.id)) errors.push(`duplicate student id ${s.id}`);
    seen.add(s.id);
  }

  // Участники группы — существующие ученики (инвариант 2).
  for (const g of data.groups || []) {
    for (const m of g.members || []) {
      if (!studentIds.has(m)) errors.push(`group ${g.id} refers to unknown student ${m}`);
    }
  }

  // Занятие имеет корректного владельца (инвариант 3).
  for (const l of data.lessons || []) {
    if (l.studentId && !studentIds.has(l.studentId))
      errors.push(`lesson ${l.id} refers to unknown student ${l.studentId}`);
    if (l.groupId && !groupIds.has(l.groupId))
      errors.push(`lesson ${l.id} refers to unknown group ${l.groupId}`);
  }

  // payment.studentId → существующий ученик (инвариант 4).
  for (const p of data.payments || []) {
    if (p.studentId && !studentIds.has(p.studentId))
      errors.push(`payment ${p.id} refers to unknown student ${p.studentId}`);
  }

  // financeArchive и topicLog ключей нет в students — предупреждаем, но это не error:
  // sweepOrphans мог не отработать в legacy. Полное решение — Maintenance operation.

  return { ok: errors.length === 0, errors };
}
