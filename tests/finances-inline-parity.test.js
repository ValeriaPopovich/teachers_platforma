import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { finances as compatibilityFinances } from '../src/domain/finances.js';
import baseline from './fixtures/baseline.json';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const compatibilitySource = fs.readFileSync(path.join(repo, 'src/domain/finances.js'), 'utf8');
const selectorSource = fs.readFileSync(
  path.join(repo, 'src/modules/payments/payments.selectors.js'),
  'utf8',
);

describe('finances final ownership', () => {
  it('compatibility domain path re-exports the owning payments implementation', () => {
    expect(compatibilitySource).toContain(
      "export { finances } from '../modules/payments/finances.js'",
    );
    expect(selectorSource).toContain("} from './finances.js'");
    expect(selectorSource).toContain('const finance = finances(state, student.id)');
  });

  for (const id of baseline.students.map((student) => student.id)) {
    it(`baseline remains calculable for ${id}`, () => {
      expect(compatibilityFinances(baseline, id)).toEqual(
        expect.objectContaining({ debt: expect.any(Number) }),
      );
    });
  }
});
