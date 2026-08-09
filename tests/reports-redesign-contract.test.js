import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const app = read('assets/app.js');
const css = read('assets/reports-redesign.css');
const enhancement = read('assets/reports-redesign.js');

const countId = (id) => (html.match(new RegExp(`id=["']${id}["']`, 'g')) || []).length;

describe('reports unified editor redesign contract', () => {
  it('keeps the existing report data-binding ids exactly once', () => {
    [
      'reportStudent',
      'reportPeriod',
      'customPeriodFields',
      'reportDateFrom',
      'reportDateTo',
      'reportHistoryHint',
      'reportPeriodName',
      'reportComment',
      'addReportTopic',
      'addReportTest',
      'addReportHw',
      'reportTopics',
      'reportTests',
      'reportHws',
      'reportNextPackageBuilder',
      'nextPackageBlockChoice',
      'reportNextPackagePreview',
      'reportCard',
      'paperPills',
      'paperComment',
      'paperRing',
      'paperRingValue',
      'paperPct',
      'paperTopics',
      'paperHws',
      'paperTests',
      'paperNextPackageSection',
      'paperNextPackage',
      'copyReportText',
      'saveReportPng',
    ].forEach((id) => expect(countId(id), id).toBe(1));
  });

  it('keeps app.js report handlers connected to the preserved nodes', () => {
    expect(app).toContain("$('#reportStudent')");
    expect(app).toContain("$('#reportPeriod')");
    expect(app).toContain("$('#reportPeriodName')");
    expect(app).toContain("$('#reportComment')");
    expect(app).toContain("$('#addReportTopic')");
    expect(app).toContain("$('#addReportTest')");
    expect(app).toContain("$('#addReportHw')");
    expect(app).toContain("reportRows('#reportTopics')");
    expect(app).toContain("reportRows('#reportTests')");
    expect(app).toContain("reportRows('#reportHws')");
    expect(app).toContain("$('#copyReportText')");
    expect(app).toContain("$('#saveReportPng')");
  });

  it('keeps the generated period value for business logic without a duplicate visible field', () => {
    expect(html).toContain('<input type="hidden" id="reportPeriodName"');
    expect(html).not.toContain('<label for="reportPeriodName">Название периода</label>');
    expect(app).toContain('function updateReportPeriodName()');
  });

  it('supports drag-and-drop ordering and centered remove controls', () => {
    expect(enhancement).toContain("handle.className = 'report-drag-handle'");
    expect(enhancement).toContain("page.addEventListener('dragstart'");
    expect(enhancement).toContain("page.addEventListener('drop'");
    expect(css).toContain('.report-drag-handle');
    expect(css).toContain('place-items: center');
  });

  it('keeps every report inclusion switch used by the existing visibility logic', () => {
    ['general', 'topics', 'tests', 'hws', 'nextPackage'].forEach((block) => {
      expect(html).toContain(`data-report-block="${block}"`);
    });
    expect(app).toContain("e.target.matches('[data-report-block]')");
  });

  it('makes next-month package information editable without losing the generated default', () => {
    expect(html).toContain('<textarea id="reportNextPackagePreview"');
    expect(html).not.toContain('id="resetNextPackageText"');
    expect(app).toContain('nextPackageEditor.dataset.autoValue');
    expect(app).toContain("$('#reportNextPackagePreview').addEventListener('input', updateReportCard)");
  });

  it('keeps the existing report preview and export targets', () => {
    expect(html).toContain('class="report-paper" id="reportCard"');
    expect(html).toContain('data-report-section="general"');
    expect(html).toContain('data-report-section="topics"');
    expect(html).toContain('data-report-section="hws"');
    expect(html).toContain('data-report-section="tests"');
    expect(html).toContain('data-report-section="nextPackage"');
    expect(app).toContain("html2canvas($('#reportCard')");
  });

  it('loads the redesign as progressive enhancement after the existing app module', () => {
    expect(html).toContain('href="assets/reports-redesign.css"');
    expect(html).toContain('src="assets/reports-redesign.js"');
    expect(html.indexOf('src="assets/app.js"')).toBeLessThan(html.indexOf('src="assets/reports-redesign.js"'));
    expect(enhancement).not.toContain('localStorage');
    expect(enhancement).not.toContain('supabase');
  });

  it('provides semantic accordion controls and fixed report actions', () => {
    expect(html).toContain('class="report-section-toggle"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-controls="reportTopicsPanel"');
    expect(html).toContain('role="group" aria-label="Действия с готовым отчётом"');
    expect(css).toContain('.report-tools.is-fixed');
    expect(css).toContain('position: fixed');
    expect(enhancement).toContain("setAttribute('aria-expanded'");
  });

  it('covers desktop, tablet, mobile and small-mobile layouts without page-level horizontal overflow', () => {
    expect(css).toContain('@media (max-width: 1199px)');
    expect(css).toContain('@media (max-width: 767px)');
    expect(css).toContain('@media (max-width: 479px)');
    expect(css).toContain('minmax(380px, 0.82fr)');
    expect(css).toContain('min-width: 0');
    expect(css).toContain('overflow-wrap: anywhere');
  });

  it('handles long lists and empty/student-reset UI without changing persisted data', () => {
    expect(enhancement).toContain('MutationObserver');
    expect(enhancement).toContain('syncListState');
    expect(enhancement).toContain('resetPreviewForEmptyStudent');
    expect(enhancement).toContain("list.innerHTML = ''");
    expect(enhancement).not.toContain('.save(');
    expect(enhancement).not.toContain('commit(');
  });
});
