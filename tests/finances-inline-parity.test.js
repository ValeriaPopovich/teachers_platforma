// Гарантирует, что чистый модуль src/domain/finances.js даёт то же самое, что inline-функция
// в assets/app.js. Пока inline и модуль сосуществуют, тест ловит рассинхрон. Когда на Этапе 4
// inline будет заменена на import из модуля, тест снимается или сводится к smoke.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import baseline from './fixtures/baseline.json';
import { finances as moduleFinances } from '../src/domain/finances.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appJs = fs.readFileSync(path.resolve(here, '../assets/app.js'), 'utf8');

// finances в assets/app.js — одна строка. Вытаскиваем её целиком через brace-matching.
function extractFn(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) return null;
  const openBrace = source.indexOf('{', start);
  let depth = 0;
  for (let i = openBrace; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}
const inlineSource = extractFn(appJs, 'finances');
const lessonsOfSource = extractFn(appJs, 'lessonsOf');

function makeInlineFinances(data) {
  // Замыкание с локальными student/group/lessonsOf/data — inline-функция обращается ко всем.
  const factory = new Function(
    'data',
    `
    const student = (id) => (data.students || []).find(s => s.id === id);
    const group  = (id) => (data.groups   || []).find(g => g.id === id);
    ${lessonsOfSource}
    ${inlineSource}
    return finances;
  `,
  );
  return factory(data);
}

describe('finances: inline vs module parity', () => {
  it('inline-функция извлечена из assets/app.js', () => {
    expect(inlineSource).toBeTruthy();
  });

  const inlineFinances = makeInlineFinances(baseline);
  const ids = baseline.students.map((s) => s.id);
  for (const id of ids) {
    it(`эквивалентно для ${id}`, () => {
      expect(inlineFinances(id)).toEqual(moduleFinances(baseline, id));
    });
  }
});
