// Regression guard: следит, что точечные фиксы в inline assets/app.js не откатили.
// Как только полный extract backup-модуля будет интегрирован в app.js — тест снимается.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appJs = fs.readFileSync(path.resolve(here, '../assets/app.js'), 'utf8');

describe('assets/app.js — фиксы Этапа 4.3 присутствуют', () => {
  it('mergeImported мапит payment.lessonId (fix §2.4)', () => {
    // Ищем в теле функции упоминание lessonMap.get(x.lessonId) рядом с payments.push.
    expect(appJs).toMatch(/lessonId:\s*x\.lessonId\s*\?\s*lessonMap\.get\(\s*x\.lessonId\s*\)/);
  });

  it('replace-import сохраняет recovery copy до замены', () => {
    expect(appJs).toMatch(/tutorCabinet_recovery/);
    expect(appJs).toMatch(/before-replace-import/);
  });
});
