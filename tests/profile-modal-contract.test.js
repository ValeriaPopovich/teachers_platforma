import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const js = readFileSync(new URL('../assets/profile-modal.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../assets/profile-modal.css', import.meta.url), 'utf8');

describe('student profile responsive UI contract', () => {
  test('keeps original profile hooks so app.js actions continue to work', () => {
    expect(js).toContain("const PROFILE_ID = 'profileModal'");
    expect(js).toContain("const BODY_ID = 'profileBody'");
    expect(js).toContain("historyTable.querySelector('tbody')");
  });

  test('preserves content placed after the lesson history table', () => {
    expect(js).toContain('const historyExtras = []');
    expect(js).toContain('historyExtras.forEach((extra) => historyPanel.append(extra))');
  });

  test('escapes text reinserted into generated markup', () => {
    expect(js).toContain('function escapeHtml');
    expect(js).toContain("escapeHtml(textOrDash(learningData['Цели']");
  });

  test('has desktop, tablet and mobile responsive modes', () => {
    expect(css).toContain('@media (max-width: 980px)');
    expect(css).toContain('@media (max-width: 720px)');
    expect(css).toContain('@media (max-width: 460px)');
    expect(css).toContain('height: 100dvh');
  });

  test('uses accessible tabs rather than fake visual tabs', () => {
    expect(js).toContain("tabs.setAttribute('role', 'tablist')");
    expect(js).toContain("button.setAttribute('role', 'tab')");
    expect(js).toContain("button.setAttribute('aria-selected'");
  });
});
