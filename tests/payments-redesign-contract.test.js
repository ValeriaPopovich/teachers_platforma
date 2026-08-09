import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const app = readFileSync('assets/app.js', 'utf8');
const css = readFileSync('assets/payments-redesign.css', 'utf8');
const enhancement = readFileSync('assets/payments-redesign.js', 'utf8');

function paymentSection() {
  const start = html.indexOf('<section class="page payments-page" id="page-payments"');
  const end = html.indexOf('<section class="page" id="page-schedule"', start);
  return start >= 0 && end > start ? html.slice(start, end) : '';
}

describe('payments action-first redesign contract', () => {
  it('preserves business-critical payment DOM ids', () => {
    for (const id of [
      'page-payments',
      'analyticsCard',
      'analyticsRangeLabel',
      'paymentStats',
      'packageAlerts',
      'packageMonthCard',
      'packageMonthLabel',
      'packageMonthGrid',
      'paymentBalances',
      'paymentHistoryStudent',
      'paymentHistory',
      'paymentModal',
      'paymentForm',
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it('connects the new page stylesheet and enhancement script', () => {
    expect(html).toContain('assets/payments-redesign.css');
    expect(html).toContain('assets/payments-redesign.js');
  });

  it('contains accessible attention/all tabs and both tab panels', () => {
    expect(html).toContain('role="tablist"');
    expect(html).toContain('id="paymentAttentionTab"');
    expect(html).toContain('aria-controls="paymentAttentionPanel"');
    expect(html).toContain('id="paymentAllTab"');
    expect(html).toContain('aria-controls="paymentAllPanel"');
    expect(enhancement).toContain("['ArrowLeft', 'ArrowRight', 'Home', 'End']");
  });

  it('does not introduce user avatars on the payments page', () => {
    const section = paymentSection();
    expect(section).not.toBe('');
    expect(section).not.toMatch(/class=["'][^"']*avatar/);
  });

  it('restores the package fields expected by the existing payment flow', () => {
    expect(html).toContain('id="paymentPackageField"');
    expect(html).toContain('name="packageLessons"');
    expect(html).toContain('id="paymentPackageMonthLabel"');
    expect(app).toContain("$('#paymentPackageField')");
    expect(app).toContain("field.querySelector('input').value = packageLessons");
    expect(app).toContain("#paymentForm [name=packageLessons]");
  });

  it('keeps context payment actions discoverable by existing delegated handlers', () => {
    expect(app).toContain('data-payment-student=');
    expect(app).toContain("e.target.closest('[data-payment-student]')");
  });

  it('supports current-month and 45-day payment history filters', () => {
    expect(html).toContain('id="paymentHistoryPeriod"');
    expect(html).toContain('<option value="month">Этот месяц</option>');
    expect(html).toContain('<option value="45">Последние 45 дней</option>');
    expect(app).toContain("['paymentHistoryStudent', 'paymentHistoryPeriod']");
  });

  it('has dedicated responsive layouts without whole-page horizontal scrolling', () => {
    expect(css).toContain('@media (max-width: 767px)');
    expect(css).toContain('@media (max-width: 479px)');
    expect(css).toContain('.payments-primary-action');
    expect(css).toContain('position: fixed');
    expect(css).not.toContain('#page-payments {\n  overflow-x: auto');
  });

  it('limits growing lists and reveals the remaining items on demand', () => {
    expect(app).toContain('paymentsExpanded =');
    expect(app).toContain('data-payment-expand=');
    expect(app).toContain('attentionLimit = 6');
    expect(app).toContain('allLimit = 8');
    expect(app).toContain('packageLimit = 6');
    expect(app).toContain('historyLimit = 10');
    expect(css).toContain('.payments-show-more');
  });

  it('keeps mobile filters side by side and uses compact KPI cards', () => {
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)');
    expect(css).toContain('min-height: 70px');
  });
});
