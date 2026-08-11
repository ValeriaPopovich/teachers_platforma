import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const view = readFileSync('src/modules/payments/payments.view.js', 'utf8');
const form = readFileSync('src/modules/payments/payment-form.view.js', 'utf8');
const css = readFileSync('styles/features/_payments.scss', 'utf8');

function paymentSection() {
  const start = html.indexOf('<section class="page payments-page" id="page-payments"');
  const end = html.indexOf('<section class="page" id="page-schedule"', start);
  return start >= 0 && end > start ? html.slice(start, end) : '';
}

describe('payments final module contract', () => {
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

  it('loads module-owned stylesheet and no legacy enhancement script', () => {
    expect(html).toContain('assets/styles.css');
    expect(html).not.toContain('src/modules/payments/payments.css');
    expect(html).not.toContain('assets/payments-redesign.css');
    expect(html).not.toContain('assets/payments-redesign.js');
  });

  it('keeps accessible tabs and keyboard navigation in the owning view', () => {
    expect(html).toContain('role="tablist"');
    expect(html).toContain('id="paymentAttentionTab"');
    expect(html).toContain('id="paymentAllTab"');
    expect(view).toContain("['ArrowLeft', 'ArrowRight', 'Home', 'End']");
  });

  it('keeps payment rows aligned with the module-owned CSS contract', () => {
    expect(view).toContain('class="payment-balance-item"');
    expect(view).toContain('data-kind="${row.kind}"');
    expect(view).toContain('class="payment-history-item"');
    expect(css).toContain('.payment-balance-item');
    expect(css).toContain('.payment-history-item');
  });

  it('accepts an amount without manual date or lesson count', () => {
    const paymentForm = html.match(/<form id="paymentForm">[\s\S]*?<\/form>/)?.[0] || '';
    expect(paymentForm).toContain('name="studentId"');
    expect(paymentForm).toContain('name="amount"');
    expect(paymentForm).not.toContain('name="date"');
    expect(paymentForm).not.toContain('name="packageLessons"');
    expect(paymentForm).toContain('id="paymentAmountHint"');
    expect(form).toContain('syncPaymentForm');
  });

  it('keeps context payment actions and history filters', () => {
    expect(view).toContain('data-payment-for=');
    expect(view).toContain("event.target.closest('[data-payment-for]')");
    expect(view).toContain("$('#paymentHistoryPeriod')?.addEventListener('change', render)");
    expect(view).toContain("$('#paymentHistoryStudent')?.addEventListener('change', render)");
  });

  it('limits long lists and lets the user reveal the rest', () => {
    expect(view).toContain(
      'const LIST_LIMITS = { attention: 6, all: 8, packages: 6, history: 10 }',
    );
    expect(view).toContain('data-payment-expand=');
    expect(view).toContain('Object.hasOwn(expanded, expand)');
    expect(css).toContain('.payments-show-more');
  });

  it('does not introduce avatars on the payments page', () => {
    expect(paymentSection()).not.toMatch(/class=["'][^"']*avatar/);
  });

  it('keeps responsive payment layouts', () => {
    expect(css).toMatch(/@media \((?:max-width:\s*767px|width\s*<=\s*767px)\)/);
    expect(css).toMatch(/@media \((?:max-width:\s*479px|width\s*<=\s*479px)\)/);
    expect(css).toContain('.payments-primary-action');
    expect(css).toContain('position: fixed');
  });
});
