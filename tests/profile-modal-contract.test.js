import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const view = readFileSync(
  new URL('../src/modules/students/profile.view.js', import.meta.url),
  'utf8',
);
const css = readFileSync(new URL('../styles/features/_students.scss', import.meta.url), 'utf8');

describe('student profile final ownership contract', () => {
  test('profile is rendered directly by the students module', () => {
    expect(view).toContain("const body = document.querySelector('#profileBody')");
    expect(view).toContain('class="profile-redesign"');
    expect(view).toContain('profile-history-row');
  });

  test('preserves archived topics after lesson history', () => {
    expect(view).toContain('state.topicLog[id]?.length');
    expect(view).toContain('Ранее пройденные темы (архив)');
  });

  test('escapes generated user content through shared escapeHtml', () => {
    expect(view).toContain("import { escapeHtml, safeExternalUrl } from '../../shared/dom.js'");
    expect(view).toContain('escapeHtml(student.name)');
    expect(view).toContain("escapeHtml(student.goals || 'не указаны')");
  });

  test('has desktop/tablet/mobile responsive profile styles', () => {
    expect(css).toMatch(/@media \((?:max-width:\s*980px|width\s*<=\s*980px)\)/);
    expect(css).toMatch(/@media \((?:max-width:\s*720px|width\s*<=\s*720px)\)/);
    expect(css).toMatch(/@media \((?:max-width:\s*460px|width\s*<=\s*460px)\)/);
    expect(css).toContain('100dvh');
  });

  test('uses semantic tabs without a progressive enhancer', () => {
    expect(view).toContain('role="tablist"');
    expect(view).toContain('role="tab"');
    expect(view).toContain('aria-selected="true"');
    expect(view).toContain('function activateTab(name)');
  });
});
