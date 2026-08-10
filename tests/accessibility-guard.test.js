import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/read-source.js';

const html = readSource('index.html');
const bootstrap = readSource('src/app/bootstrap.js');
const modal = readSource('src/shared/modal.js');
const auth = readSource('assets/auth.js');

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
    expect(bootstrap).toMatch(/event\.key\s*===\s*['"]Escape['"]/);
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
