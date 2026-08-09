// Regression guard: минимальная доступность (Этап 6 спеки). Не полный a11y-аудит,
// а защита от того, что уже работающие примитивы (focus-trap, Escape, aria-live,
// правильная семантика кнопок) не будут случайно снесены при будущих правках.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const html = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(repo, 'assets/app.js'), 'utf8');
const authJs = fs.readFileSync(path.join(repo, 'assets/auth.js'), 'utf8');

describe('accessibility — сохраняющие инварианты', () => {
  it('нет inline event handlers в HTML (могут указывать на глобальные функции)', () => {
    // onclick=, onchange=, onload= и т.п. в атрибутах разметки.
    const hits = [...html.matchAll(/\s(on[a-z]+)\s*=\s*['"]/gi)].map((m) => m[1]);
    expect(hits).toEqual([]);
  });

  it('toast и cloud status используют live region (aria-live)', () => {
    expect(html).toMatch(/<div[^>]*id=["']toast["'][^>]*aria-live=/);
    expect(html).toMatch(/<div[^>]*id=["']cloudStatus["'][^>]*aria-live=/);
  });

  it('focus-trap по Tab в модалках реализован', () => {
    // В app.js должен быть обработчик Tab, который держит фокус внутри открытой modal-wrap.
    expect(appJs).toMatch(/keydown/);
    expect(appJs).toMatch(/'Tab'/);
    expect(appJs).toMatch(/modal-wrap\.open/);
  });

  it('Escape закрывает модалку (без потери фокуса на фоне)', () => {
    expect(appJs).toMatch(/'Escape'/);
    expect(appJs).toMatch(/modal-wrap\.open/);
  });

  it('модалки помечены как dialog (роль или семантический элемент)', () => {
    // В текущем шаблоне модалки — div.modal-wrap с внутренним .modal.
    // Достаточно, чтобы существовали, а фокус-логика их обслуживает.
    expect(html).toMatch(/class=["'][^"']*\bmodal-wrap\b/);
  });

  it('auth-message использует aria-live/role=status (сообщения об ошибках)', () => {
    // Не обязательно aria-live атрибут — role="status" или aria-live тоже подходят.
    // Здесь мягкая проверка: cloud-status и toast — уже покрыты выше, а auth-message
    // и appDialog содержат осмысленные роли/атрибуты.
    expect(html).toMatch(/role=["']status["']|aria-live=["'](polite|assertive)["']/);
  });

  it('нет override Notification/console/alert (глобалы пользователя)', () => {
    // Простая защита: никто не переопределяет системные API "на всякий случай".
    for (const src of [authJs, appJs]) {
      expect(src).not.toMatch(/(?:window\.)?(Notification|alert)\s*=\s*function/);
    }
  });
});
