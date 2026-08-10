import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bootstrap = fs.readFileSync(path.resolve(here, '../src/app/bootstrap.js'), 'utf8');

describe('bootstrap — backup application orchestration', () => {
  it('merge delegates ID remapping to the tested backup module', () => {
    expect(bootstrap).toMatch(/import \{[^}]*mergeImported[^}]*\} from ['"]\.\.\/domain\/backup\.js['"]/s);
    expect(bootstrap).toContain("store.replace(mergeImported(store.getState(), pendingImport, uid), 'backup:merge')");
  });

  it('replace saves recovery before replacing store data', () => {
    expect(bootstrap).toContain('const result = replaceImported(store.getState(), pendingImport)');
    expect(bootstrap).toContain('persistence.saveRecovery(result.recovery)');
    expect(bootstrap).toContain("store.replace(result.nextData, 'backup:replace')");
  });
});
