import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const read = (file) => fs.readFileSync(path.join(repo, file), 'utf8');
const html = read('index.html');
const bootstrap = read('src/app/bootstrap.js');
const modal = read('src/shared/modal.js');
const auth = read('assets/auth.js');

describe('accessibility — сохраняющие инварианты', () => {
  it('нет inline event handlers в HTML', () => {
    const hits = [...html.matchAll(/\s(on[a-z]+)\s*=\s*['"]/gi)].map((match) => match[1]);
    expect(hits).toEqual([]);
  });

  it('toast и cloud status используют live region', () => {
    expect(html).toMatch(/<div[^>]*id=["']toast["'][^>]*aria-live=/);
    expect(html).toMatch(/<div[^>]*id=["']cloudStatus["'][^>]*aria-live=/);
  });

  it('focus trap принадлежит shared modal manager', () => {
    expect(modal).toMatch(/addEventListener\(['"]keydown['"]/);
    expect(modal).toMatch(/event\.key !== ['"]Tab['"]/);
    expect(modal).toMatch(/modal-wrap\.open/);
  });

  it('Escape закрывает открытую модалку через modal manager', () => {
    expect(bootstrap).toMatch(/event\.key===['"]Escape['"]/);
    expect(bootstrap).toMatch(/modal\.requestClose\(\)/);
  });

  it('модалки имеют dialog semantics', () => {
    expect(html).toMatch(/class=["'][^"']*\bmodal-wrap\b[^>]*role=["']dialog["']/);
  });

  it('не переопределяет системные Notification/alert', () => {
    for (const source of [auth, bootstrap, modal]) {
      expect(source).not.toMatch(/(?:window\.)?(Notification|alert)\s*=\s*function/);
    }
  });
});
