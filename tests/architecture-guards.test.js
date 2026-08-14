import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function walk(relativeDir) {
  const absolute = path.join(root, relativeDir);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(relativeDir, entry.name);
    return entry.isDirectory() ? walk(relative) : [relative];
  });
}

const moduleFiles = walk('src/modules').filter((file) => file.endsWith('.js'));
const viewFiles = moduleFiles.filter((file) => file.endsWith('.view.js'));
const sharedFiles = walk('src/shared').filter((file) => file.endsWith('.js'));

describe('Lean Domain Modules architecture guards', () => {
  it('mounts the application navigation as a Vue component', () => {
    const html = read('index.html');
    const bootstrap = read('src/app/bootstrap.js');
    const navigation = read('src/app/components/app-navigation/index.vue');

    expect(html).toContain('<nav class="nav" id="nav"></nav>');
    expect(bootstrap).toContain("import './mount-vue-islands.js';");
    expect(navigation).toContain('v-for="page in pages"');
    expect(navigation).toContain(':data-page="page.name"');
  });

  it('legacy progressive-enhancement entry files stay deleted', () => {
    for (const file of [
      'assets/app.js',
      'assets/profile-modal.js',
      'assets/payments-redesign.js',
      'assets/reports-redesign.js',
    ]) {
      expect(fs.existsSync(path.join(root, file)), file).toBe(false);
    }
    const html = read('index.html');
    expect(html).toContain('<script type="module" src="src/app/bootstrap.js"></script>');
  });

  it('feature views never mutate persisted store directly', () => {
    for (const file of viewFiles) {
      expect(read(file), file).not.toMatch(/\bstore\.(?:update|replace)\s*\(/);
    }
  });

  it('feature views do not import/use Supabase adapter directly', () => {
    for (const file of viewFiles) {
      const source = read(file);
      expect(source, file).not.toMatch(/from\s+['"][^'"]*\/cloud\//);
      expect(source, file).not.toContain('supabase-adapter');
      expect(source, file).not.toMatch(/\.from\(\s*['"]|\.rpc\(\s*['"]/);
    }
  });

  it('shared UI stays independent from feature/business modules', () => {
    for (const file of sharedFiles) {
      const source = read(file);
      expect(source, file).not.toMatch(/from\s+['"][^'"]*\/modules\//);
      expect(source, file).not.toMatch(/from\s+['"][^'"]*\/domain\//);
    }
  });

  it('bootstrap remains composition/application glue instead of a feature God Object', () => {
    const bootstrap = read('src/app/bootstrap.js');
    expect(Buffer.byteLength(bootstrap, 'utf8')).toBeLessThan(18_000);
    for (const legacyOwner of [
      'renderStudents',
      'renderGroups',
      'renderCalendar',
      'renderPaymentsSimple',
      'renderReportOptions',
      'applySettings',
    ]) {
      expect(bootstrap).not.toMatch(new RegExp(`function\\s+${legacyOwner}\\b`));
    }
    expect(bootstrap).not.toMatch(/let\s+data\s*=\s*structuredClone\(store\.getState\(\)\)/);
    expect(bootstrap).not.toMatch(/function\s+commit\s*\(/);
  });

  it('modules do not reintroduce MutationObserver as a rendering architecture', () => {
    for (const file of moduleFiles) {
      expect(read(file), file).not.toContain('MutationObserver');
    }
  });

  it('SCSS remains the single style source with one deploy bundle and one feature root', () => {
    const html = read('index.html');
    const localStylesheets = [...html.matchAll(/href=["']([^"']+\.css)["']/g)].map(
      (match) => match[1],
    );
    expect(localStylesheets).toEqual(['assets/styles.css']);

    for (const file of [
      'assets/custom-select.css',
      'src/modules/payments/payments.css',
      'src/modules/reports/reports.css',
      'src/modules/schedule/schedule.css',
      'src/modules/settings/settings.css',
      'src/modules/students/students.css',
    ]) {
      expect(fs.existsSync(path.join(root, file)), file).toBe(false);
    }

    for (const [file, selector] of [
      ['styles/features/payments/_workbench.scss', '#page-payments'],
      ['styles/features/_reports.scss', '.reports-page {'],
      ['styles/features/students/_profile-modal.scss', '.ui-modal-wrap:has(.profile-modal-card) {'],
    ]) {
      expect(read(file).split(selector), file).toHaveLength(2);
    }
  });
});
