import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECKS, FIXTURES, applyEdit, runChecks } from '../public/repo.mjs';

const checkById = (checks, id) => checks.find((c) => c.id === id);

test('baseline repo (no discount) is internally consistent', () => {
  const baseline = applyEdit({ scope: 'totals', math: 'cents', line: true });
  // sanity: fixtures exercise both sides of the $100 threshold
  assert.equal(FIXTURES.filter((f) => f.expectDiscount).length, 2);
  assert.ok(baseline.cartTotal(FIXTURES[0].lines) === 3998);
});

test('naive prompt-first edit passes "feature works" but fails three hidden checks', () => {
  const repo = applyEdit({ scope: 'cart-only', math: 'float', line: false });
  const checks = runChecks(repo);
  assert.equal(checkById(checks, 'feature-works').pass, true);
  assert.equal(checkById(checks, 'consistent-totals').pass, false);
  assert.equal(checkById(checks, 'integer-arithmetic').pass, false);
  assert.equal(checkById(checks, 'audit-trail').pass, false);
});

test('the cart/invoice divergence is concrete: $90 in cart, $100 on invoice', () => {
  const repo = applyEdit({ scope: 'cart-only', math: 'float', line: false });
  const order = FIXTURES[1].lines; // exactly $100.00
  assert.ok(Math.abs(repo.cartTotal(order) - 9000) < 1);
  assert.equal(repo.invoice(order).total, 10000);
});

test('full-knowledge edit passes all four checks', () => {
  const repo = applyEdit({ scope: 'totals', math: 'cents', line: true });
  const checks = runChecks(repo);
  assert.equal(checks.length, CHECKS.length);
  assert.ok(checks.every((c) => c.pass));
  const invoice = repo.invoice(FIXTURES[2].lines); // $120.05 → 10% = $12.01 (rounds to cent)
  assert.equal(invoice.total, 10804);
  assert.ok(invoice.lines.some((l) => l.kind === 'discount' && l.amount === -1201));
});

test('partial facts produce partial failures', () => {
  // knows integer cents only: right math, wrong place, no line
  const centsOnly = runChecks(applyEdit({ scope: 'cart-only', math: 'cents', line: false }));
  assert.equal(checkById(centsOnly, 'integer-arithmetic').pass, true);
  assert.equal(checkById(centsOnly, 'consistent-totals').pass, false);
  assert.equal(checkById(centsOnly, 'audit-trail').pass, false);

  // knows shared totals only: consistent, but floats and no line
  const totalsOnly = runChecks(applyEdit({ scope: 'totals', math: 'float', line: false }));
  assert.equal(checkById(totalsOnly, 'consistent-totals').pass, true);
  assert.equal(checkById(totalsOnly, 'integer-arithmetic').pass, false);
  assert.equal(checkById(totalsOnly, 'audit-trail').pass, false);

  // knows the line convention but not where totals live: still fails audit
  const lineOnly = runChecks(applyEdit({ scope: 'cart-only', math: 'cents', line: true }));
  assert.equal(checkById(lineOnly, 'audit-trail').pass, false);
});
