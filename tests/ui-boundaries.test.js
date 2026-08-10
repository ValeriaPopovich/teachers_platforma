import { describe, expect, it } from 'vitest';
import { readSource } from './helpers/read-source.js';

const html = readSource('index.html');
const scheduleView = readSource('src/modules/schedule/schedule.view.js');
const lessonForm = readSource('src/modules/schedule/lesson-form.view.js');
const modal = readSource('src/shared/modal.js');
const bootstrap = readSource('src/app/bootstrap.js');

describe('UI ownership and interaction boundaries', () => {
  it('calendar views are ordered day, week, month and week is the default', () => {
    const switchMarkup = html.match(/<div class="calendar-view-switch"[\s\S]*?<\/div>/)?.[0] || '';
    expect(switchMarkup).toMatch(
      /data-calendar-view="day"[\s\S]*data-calendar-view="week"[\s\S]*data-calendar-view="month"/,
    );
    expect(scheduleView).toContain("let calendarView = 'week'");
  });

  it('calendar clicks are owned by schedule view, not bootstrap feature handlers', () => {
    expect(scheduleView).toContain("$('#calendar')?.addEventListener('click'");
    expect(scheduleView).toContain("$('#calendarViewSwitch')?.addEventListener('click'");
    expect(bootstrap).not.toContain("$('#calendar')");
  });

  it('editing a lesson cannot silently transfer it to another owner', () => {
    expect(lessonForm).toContain('form.elements.targetId.disabled = false');
    expect(lessonForm).toContain('form.elements.targetId.disabled = true');
    expect(lessonForm).toContain('const targetId = form.elements.targetId.value');
    expect(lessonForm).toContain('input.targetId = targetId');
  });

  it('dirty modal warning belongs to shared modal manager', () => {
    expect(modal).toContain("const form = wrap.querySelector('form')");
    expect(modal).toContain('formSnapshot(form) !== snapshots.get(wrap.id)');
    expect(modal).toContain('snapshots.clear()');
  });

  it('bootstrap keeps only application-level global click glue', () => {
    expect(bootstrap).toContain("event.target.closest('[data-page-go]')");
    expect(bootstrap).toContain("event.target.closest('[data-open]')");
    expect(bootstrap).not.toContain('renderStudents(');
    expect(bootstrap).not.toContain('renderPaymentsSimple(');
    expect(bootstrap).not.toContain('renderReportOptions(');
  });
});
