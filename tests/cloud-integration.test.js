import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => fs.readFileSync(path.resolve(here, '..', file), 'utf8');
const auth = read('assets/auth.js');
const adapter = read('src/cloud/supabase-adapter.js');
const html = read('index.html');

describe('cloud CAS integration', () => {
  it('browser auth entry uses the tested CAS protocol and never upserts app_data', () => {
    expect(auth).toContain("from '../src/cloud/sync-protocol.js'");
    expect(auth).toContain('saveWithCas(cloudClient');
    expect(auth).not.toMatch(/from\(\s*['"]app_data['"]\s*\)\s*\.upsert/s);
    expect(adapter).toContain("client.rpc('save_app_data'");
  });

  it('conflict remains visible and offers both explicit resolution paths', () => {
    expect(auth).toMatch(/SYNC_STATUS\.CONFLICT/);
    expect(auth).toMatch(/kind !== 'conflict'/);
    expect(html).toMatch(/id="cloudLoadVersion"/);
    expect(html).toMatch(/id="cloudKeepLocal"/);
    expect(html).not.toMatch(/id="cloudDownloadBackup"/);
    expect(html).toContain('Выберите, какие данные оставить.');
    expect(html).toContain('Открыть данные с другого устройства');
    expect(html).toContain('Оставить данные с этого устройства');
    expect(auth).toContain('На другом устройстве есть более свежие изменения');
    expect(auth).toMatch(/window\.confirm\(/);
  });

  it('offline is distinct from a successful save', () => {
    expect(auth).toMatch(/SYNC_STATUS\.OFFLINE/);
    expect(auth).toMatch(/изменения сохранены на устройстве/);
  });

  it('pre-migration fallback loads legacy cloud data but never writes with upsert', () => {
    expect(auth).toMatch(/cloudLoad\.error\?\.code === '42703'/);
    expect(auth).toMatch(/casAvailable = false/);
    expect(auth).toMatch(/Изменения пока сохраняются только на этом устройстве/);
    expect(auth).not.toMatch(/\.upsert\s*\(/);
  });
});
