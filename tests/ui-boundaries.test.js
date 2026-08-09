import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appJs = fs.readFileSync(path.resolve(here, '../assets/app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.resolve(here, '../index.html'), 'utf8');

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

  it('calendar views are ordered day, week, month and week is the default', () => {
    const switchMarkup = indexHtml.match(/<div class="calendar-view-switch"[\s\S]*?<\/div>/)?.[0];
    expect(switchMarkup).toMatch(
      /data-calendar-view="day"[\s\S]*data-calendar-view="week"[\s\S]*data-calendar-view="month"/,
    );
    expect(switchMarkup).toMatch(/class="pill active" data-calendar-view="week"/);
    expect(appJs).toMatch(/calendarView = 'week'/);
  });

  it('calendar event clicks are not mistaken for calendar view switches', () => {
    expect(appJs).toContain(
      "closest('#calendarViewSwitch [data-calendar-view]')?.dataset.calendarView",
    );
    expect(appJs).not.toContain("e.target.closest('[data-calendar-view]')?.dataset.calendarView");
    expect(appJs).toMatch(/<button class="event event--\$\{l\.status\}"[^>]*data-edit-lesson=/);
    expect(appJs).toMatch(/<button class="event custom-event"[^>]*data-edit-event=/);
  });

  it('editing a lesson cannot silently transfer it to another student', () => {
    expect(appJs).toMatch(/function defaultLesson[\s\S]*?f\.elements\.id\.value = ''/);
    expect(appJs).toContain('f.elements.targetId.disabled = true');
    expect(appJs).toContain('f.elements.targetId.disabled = false');
    expect(appJs).toContain("$('#lessonModalTitle').textContent = 'Новое разовое занятие'");
    expect(appJs).toContain("$('#lessonModalTitle').textContent = 'Редактировать занятие'");
    expect(appJs).toMatch(/\(o\.targetId \|\| existingTarget\)\.split\(':'\)/);
  });

  it('individual calendar lessons are never collapsed into one session', () => {
    expect(appJs).toContain("`individual:${l.id || 'missing'}:${index}`");
    expect(appJs).toContain("'Статус не указан'");
  });

  it('warns about closing a modal only after an actual form change', () => {
    expect(appJs).toContain("const form = wrap.querySelector('form')");
    expect(appJs).toContain("if (form && id !== 'onboardingModal') modalInitial[id] = formSnapshot(form)");
    expect(appJs).not.toMatch(/setTimeout\(\(\) => \(modalInitial\[id\]/);
    expect(appJs).toContain('formSnapshot(form) !== modalInitial[wrap.id]');
    expect(appJs).toContain('control.name || control.id || String(index)');
    expect(appJs).toContain('Object.keys(modalInitial).forEach((id) => delete modalInitial[id])');
    expect(appJs).toMatch(/syncPaymentForm\(\);\s*open\('paymentModal'\)/);
    expect(appJs).not.toMatch(/setTimeout\(syncPaymentForm\)/);
  });
});
