import { describe, expect, it } from 'vitest';
import { readSource } from './helpers/read-source.js';

const scheduleCalendar = readSource('src/modules/schedule/components/schedule-calendar/index.vue');
const schedulePageScript = readSource(
  'src/modules/schedule/components/schedule-page/scripts/index.js',
);
const modal = readSource('src/shared/modal.js');
const vueModal = readSource('packages/ui/modal/index.vue');
const bootstrap = readSource('src/app/bootstrap.js');
const modalForms = [
  'src/modules/students/components/student-form/index.vue',
  'src/modules/students/components/group-form/index.vue',
  'src/modules/payments/components/payment-form/index.vue',
  'src/modules/schedule/components/lesson-form/index.vue',
].map(readSource);

describe('UI ownership and interaction boundaries', () => {
  it('calendar views include day, week and month, and week is the default', () => {
    expect(scheduleCalendar).toContain(':data-calendar-view="view"');
    expect(schedulePageScript).toContain("VALID_VIEWS = ['day', 'week', 'month']");
    expect(schedulePageScript).toContain("VALID_VIEWS.includes(saved) ? saved : 'week'");
  });

  it('calendar clicks are owned by the schedule Vue components, not bootstrap', () => {
    expect(scheduleCalendar).toContain('@pointerdown="onColumnPointerDown($event, column)"');
    expect(bootstrap).not.toContain("$('#calendar')");
  });

  it('dirty modal warning belongs to shared modal manager', () => {
    expect(modal).toContain("const form = wrap.querySelector('form')");
    expect(modal).toContain('formSnapshot(form) !== snapshots.get(wrap.id)');
    expect(modal).toContain('snapshots.clear()');
  });

  it('Vue modal forms own their submit buttons without cross-form attributes', () => {
    expect(vueModal).toContain(":is=\"formId ? 'form' : 'div'\"");
    expect(vueModal).toContain('@submit.prevent="$emit(\'submit\', $event)"');
    for (const source of modalForms) {
      expect(source).toContain('form-id=');
      expect(source).toContain('@submit="onFormSubmit"');
      expect(source).not.toMatch(/<form\b|\bform="[^"]+"/);
    }
  });

  it('bootstrap keeps only application-level global click glue', () => {
    expect(bootstrap).toContain("event.target.closest('[data-page-go]')");
    expect(bootstrap).toContain("event.target.closest('[data-close]')");
    expect(bootstrap).not.toContain('renderStudents(');
    expect(bootstrap).not.toContain('renderPaymentsSimple(');
    expect(bootstrap).not.toContain('renderReportOptions(');
    expect(bootstrap).not.toContain('renderAll(');
  });
});
