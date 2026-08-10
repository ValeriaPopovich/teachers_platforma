import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const view = read('src/modules/reports/reports.view.js');
const interactions = read('src/modules/reports/report-drag.js');
const css = read('styles/features/_reports.scss');

const countId = (id) => (html.match(new RegExp(`id=["']${id}["']`, 'g')) || []).length;

describe('reports final module contract', () => {
  it('keeps report data-binding ids exactly once', () => {
    [
      'reportStudent',
      'reportPeriod',
      'customPeriodFields',
      'reportDateFrom',
      'reportDateTo',
      'reportComment',
      'addReportTopic',
      'addReportTest',
      'addReportHw',
      'reportTopics',
      'reportTests',
      'reportHws',
      'reportNextPackagePreview',
      'reportCard',
      'paperTopics',
      'paperHws',
      'paperTests',
      'copyReportText',
      'saveReportPng',
    ].forEach((id) => expect(countId(id), id).toBe(1));
  });

  it('owns builder, preview, copy and PNG export in reports.view.js', () => {
    expect(view).toContain('function fillBuilder()');
    expect(view).toContain('function renderPaper()');
    expect(view).toContain('async function copyText()');
    expect(view).toContain('async function savePng()');
    expect(view).toContain("window.html2canvas($('#reportCard')");
  });

  it('creates final drag markup directly and handles reorder without MutationObserver', () => {
    expect(view).toContain('class="report-drag-handle"');
    expect(interactions).toContain("page.addEventListener('dragstart'");
    expect(interactions).toContain("page.addEventListener('drop'");
    expect(interactions).not.toContain('MutationObserver');
    expect(view).not.toContain('MutationObserver');
  });

  it('keeps report inclusion switches connected to preview sections', () => {
    ['general', 'topics', 'tests', 'hws', 'nextPackage'].forEach((block) =>
      expect(html).toContain(`data-report-block="${block}"`),
    );
    expect(view).toContain("$$('[data-report-block]').forEach");
    expect(view).toContain('checkbox.checked');
  });

  it('keeps next-month package text editable with generated default metadata', () => {
    expect(html).toContain('<textarea id="reportNextPackagePreview"');
    expect(view).toContain('nextEditor.dataset.autoValue = auto');
    expect(view).toContain('nextEditor.dataset.studentId = id');
    expect(view).toContain(
      "$('#reportNextPackagePreview')?.addEventListener('input', renderPaper)",
    );
  });

  it('keeps semantic accordion and fixed action-bar behavior', () => {
    expect(html).toContain('class="report-section-toggle"');
    expect(interactions).toContain("setAttribute('aria-expanded'");
    expect(interactions).toContain("tools.classList.add('is-fixed')");
    expect(interactions).toContain('ResizeObserver');
    expect(css).toContain('.report-tools.is-fixed');
  });

  it('uses module-owned CSS and no legacy report enhancer', () => {
    expect(html).toContain('assets/styles.css');
    expect(html).not.toContain('src/modules/reports/reports.css');
    expect(html).not.toContain('assets/reports-redesign.js');
    expect(html).not.toContain('assets/reports-redesign.css');
  });
});
