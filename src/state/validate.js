import { blankData } from './schema.js';
const isString = (value) => typeof value === 'string'; const isArray = Array.isArray; const isObj = (value) => value !== null && typeof value === 'object' && !isArray(value);
export function validateStructural(data) {
  const errors = []; if (!isObj(data)) return { ok: false, errors: ['data is not an object'] };
  const shape = blankData();
  for (const key of Object.keys(shape)) { if (data[key] === undefined) continue; if (isArray(shape[key]) && !isArray(data[key])) errors.push(`${key} must be array`); if (isObj(shape[key]) && !isObj(data[key])) errors.push(`${key} must be object`); }
  for (const col of ['students','groups','lessons','events','payments']) if (isArray(data[col])) data[col].forEach((item,i) => { if (!isObj(item)) errors.push(`${col}[${i}] not object`); else if (!isString(item.id)) errors.push(`${col}[${i}].id missing`); });
  for (const lesson of data.lessons || []) { if (!lesson.date || !Number.isFinite(new Date(lesson.date).getTime())) errors.push(`lesson ${lesson.id} has invalid date`); if (!lesson.studentId && !lesson.groupId) errors.push(`lesson ${lesson.id} has neither studentId nor groupId`); }
  for (const event of data.events || []) if (!event.date || !Number.isFinite(new Date(event.date).getTime())) errors.push(`event ${event.id} has invalid date`);
  for (const payment of data.payments || []) { if (!payment.date) errors.push(`payment ${payment.id} missing date`); if (!Number.isFinite(+payment.amount)) errors.push(`payment ${payment.id} amount not finite`); if (!payment.studentId) errors.push(`payment ${payment.id} missing studentId`); }
  return { ok: errors.length === 0, errors };
}
export function validateReferential(data) {
  const errors = [], studentIds = new Set((data.students || []).map((student)=>student.id)), groupIds = new Set((data.groups || []).map((group)=>group.id));
  const seen = new Set(); for (const student of data.students || []) { if (seen.has(student.id)) errors.push(`duplicate student id ${student.id}`); seen.add(student.id); }
  for (const group of data.groups || []) for (const member of group.members || []) if (!studentIds.has(member)) errors.push(`group ${group.id} refers to unknown student ${member}`);
  for (const lesson of data.lessons || []) { if (lesson.studentId && !studentIds.has(lesson.studentId)) errors.push(`lesson ${lesson.id} refers to unknown student ${lesson.studentId}`); if (lesson.groupId && !groupIds.has(lesson.groupId)) errors.push(`lesson ${lesson.id} refers to unknown group ${lesson.groupId}`); }
  for (const payment of data.payments || []) if (payment.studentId && !studentIds.has(payment.studentId)) errors.push(`payment ${payment.id} refers to unknown student ${payment.studentId}`);
  return { ok: errors.length === 0, errors };
}
