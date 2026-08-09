// The UI must use the characterized domain implementation, not keep a drifting copy.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { finances as moduleFinances } from '../src/domain/finances.js';
import baseline from './fixtures/baseline.json';

const here = path.dirname(fileURLToPath(import.meta.url));
const appJs = fs.readFileSync(path.resolve(here, '../assets/app.js'), 'utf8');

describe('finances UI integration', () => {
  it('assets/app.js imports and delegates to the domain module', () => {
    expect(appJs).toMatch(/import \{ finances as calculateFinances \}/);
    expect(appJs).toMatch(/return calculateFinances\(data, id\)/);
  });

  const ids = baseline.students.map((s) => s.id);
  for (const id of ids) {
    it(`baseline remains calculable for ${id}`, () => {
      expect(moduleFinances(baseline, id)).toEqual(
        expect.objectContaining({ debt: expect.any(Number) }),
      );
    });
  }
});
