import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_PATHS } from '../public/repo.mjs';
import { PRESETS, runTask } from '../public/agent.mjs';

test('full loop verifies clean and learns all four facts', () => {
  const run = runTask(PRESETS['full-loop']);
  assert.equal(run.verdict, 'verified-pass');
  assert.equal(run.failing.length, 0);
  assert.equal(run.known.length, 4);
  assert.deepEqual(run.edit, { scope: 'totals', math: 'cents', line: true });
});

test('prompt-first ships broken: no facts, naive edit, latent failures', () => {
  const run = runTask(PRESETS['prompt-first']);
  assert.equal(run.verdict, 'shipped-broken');
  assert.equal(run.known.length, 0);
  assert.deepEqual(run.edit, { scope: 'cart-only', math: 'float', line: false });
  assert.deepEqual(run.failing.sort(), ['audit-trail', 'consistent-totals', 'integer-arithmetic']);
  // 'feature-works' still passes — plausible work, unverified
  assert.equal(run.checks.find((c) => c.id === 'feature-works').pass, true);
});

test('verify-only catches the same failures — late, not prevented', () => {
  const run = runTask(PRESETS['verify-only']);
  assert.equal(run.verdict, 'caught-late');
  assert.equal(run.verified, true);
  assert.equal(run.failing.length, 3);
});

test('unverified correct work is luck, not process', () => {
  const run = runTask({ explore: true, plan: true, verify: false, reads: ALL_PATHS });
  assert.equal(run.verdict, 'unverified-pass');
  assert.equal(run.failing.length, 0);
});

test('partial explore yields partial knowledge and partial failure', () => {
  const run = runTask({
    explore: true,
    plan: true,
    verify: true,
    reads: ['src/money.mjs', 'src/totals.mjs'], // never reads invoice.mjs
  });
  assert.deepEqual(run.known.sort(), ['integer-cents', 'shared-totals']);
  assert.equal(run.verdict, 'caught-late');
  assert.deepEqual(run.failing, ['audit-trail']);
});

test('plan steps can only reference discovered facts', () => {
  const shallow = runTask({ explore: true, plan: true, verify: true, reads: ['src/money.mjs'] });
  const groundedSteps = shallow.plan.filter((s) => s.usesFact && shallow.known.includes(s.usesFact));
  assert.equal(groundedSteps.length, 1); // only integer-cents was discovered
  // without shared-totals the plan falls back to the vague step
  assert.ok(shallow.plan.some((s) => s.step.includes('where the total appears')));
});

test('the trace narrates all four phases including skips', () => {
  const run = runTask(PRESETS['prompt-first']);
  assert.equal(run.trace.length, 4);
  assert.deepEqual(
    run.trace.map((t) => t.phase),
    ['explore', 'plan', 'implement', 'verify'],
  );
  assert.equal(run.trace[0].skipped, true);
  assert.equal(run.trace[3].skipped, true);
});
