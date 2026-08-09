// Regression guard: the UI must call the tested backup module and persistence boundary.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appJs = fs.readFileSync(path.resolve(here, '../assets/app.js'), 'utf8');

describe('assets/app.js — backup module integration', () => {
  it('merge delegates to mergeImported, which owns all ID remapping', () => {
    expect(appJs).toMatch(
      /import \{[^}]*mergeImported[^}]*\} from ['"]\.\.\/src\/domain\/backup\.js['"]/s,
    );
    expect(appJs).toMatch(/data = mergeImported\(data, pendingImport, uid\)/);
  });

  it('replace saves recovery through the persistence boundary before applying data', () => {
    expect(appJs).toMatch(/replaceImported\(data, pendingImport\)/);
    expect(appJs).toMatch(/persistence\.saveRecovery\(replacement\.recovery\)/);
  });
});
