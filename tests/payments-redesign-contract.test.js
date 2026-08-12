import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const view = readFileSync('src/modules/payments/payments.view.js', 'utf8');
const form = readFileSync('src/modules/payments/payment-form.view.js', 'utf8');

describe('payments module contract', () => {
  it('mounts the payments page as a Vue island inside its legacy page shell', () => {
    expect(html).toContain('<section class="page payments-page" id="page-payments">');
    expect(html).toContain('id="paymentsPageRoot"');
    expect(html).not.toContain('id="packageAlerts"');
    expect(html).not.toContain('data-payment-view=');
  });

  it('keeps the payment modal and form reachable outside the page shell', () => {
    for (const id of ['paymentModal', 'paymentForm', 'paymentAmountHint']) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it('accepts an amount without manual date or lesson count', () => {
    const paymentForm = html.match(/<form id="paymentForm">[\s\S]*?<\/form>/)?.[0] || '';
    expect(paymentForm).toContain('name="studentId"');
    expect(paymentForm).toContain('name="amount"');
    expect(paymentForm).not.toContain('name="date"');
    expect(paymentForm).not.toContain('name="packageLessons"');
    expect(form).toContain('syncPaymentForm');
  });

  it('the view no longer writes payment markup by hand, it dispatches a model event', () => {
    expect(view).toContain("new CustomEvent('app:payments-change'");
    expect(view).toContain("new CustomEvent('app:payment-attention-change'");
    expect(view).not.toContain('.innerHTML =');
    expect(view).toContain('export function createPaymentsView');
    expect(view).toContain('return { render, openPayment: paymentForm.open }');
  });

  it('keeps the openPayment bridge used by dashboard and students', () => {
    expect(view).toContain('openPayment: paymentForm.open');
  });
});
