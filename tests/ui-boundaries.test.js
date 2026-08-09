import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appJs = fs.readFileSync(path.resolve(here, '../assets/app.js'), 'utf8');

describe('UI ownership boundaries', () => {
  it('page code has no direct storage or Supabase writes', () => {
    expect(appJs).not.toMatch(/localStorage\.(?:setItem|removeItem|clear)\s*\(/);
    expect(appJs).not.toMatch(/\.from\(\s*['"]|\.rpc\(\s*['"]/);
    expect(appJs).toMatch(/createBrowserPersistence/);
  });

  it('unrelated clicks are scoped to pages instead of one document/app handler', () => {
    expect(appJs).not.toMatch(/document\.addEventListener\(\s*['"]click['"]/);
    expect(appJs).not.toMatch(/\$\(\s*['"]\.app['"]\s*\)\.addEventListener\(\s*['"]click['"]/);
    for (const page of ['dashboard', 'students', 'schedule', 'payments']) {
      expect(appJs).toContain(`$('#page-${page}').addEventListener('click'`);
    }
  });

  it('UI delegates critical rules to tested state/domain modules', () => {
    for (const source of [
      '../src/domain/backup.js',
      '../src/domain/finances.js',
      '../src/domain/schedule.js',
      '../src/state/maintenance.js',
      '../src/state/persistence.js',
      '../src/state/store.js',
    ]) {
      expect(appJs).toContain(`from '${source}'`);
    }
  });
});
