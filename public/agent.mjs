// The Loop Lab — a scripted agent that runs the task through the
// explore → plan → implement → verify loop (or skips parts of it).
//
// This is a deterministic model of the workflow, not an LLM: each phase
// contributes something concrete, and removing phases removes capabilities.

import { ALL_PATHS, FACTS, REPO_FILES, TASK, applyEdit, runChecks } from './repo.mjs';

export const PHASES = ['explore', 'plan', 'implement', 'verify'];

export const PRESETS = {
  'prompt-first': {
    label: 'Prompt-first (skip the loop)',
    explore: false,
    plan: false,
    verify: false,
    reads: [],
  },
  'verify-only': {
    label: 'Prompt-first + a check',
    explore: false,
    plan: false,
    verify: true,
    reads: [],
  },
  'full-loop': {
    label: 'Explore → plan → code → verify',
    explore: true,
    plan: true,
    verify: true,
    reads: ALL_PATHS,
  },
};

function buildPlan(task, known, planEnabled) {
  if (!planEnabled) {
    return [{ step: 'Implement the obvious change', usesFact: null }];
  }
  const steps = [{ step: `Locate where order totals are computed`, usesFact: 'shared-totals' }];
  steps.push({
    step: known.has('shared-totals')
      ? 'Apply the discount inside src/totals.mjs (single source of truth)'
      : 'Apply the discount where the total appears',
    usesFact: 'shared-totals',
  });
  steps.push({
    step: known.has('integer-cents')
      ? 'Use money.pct() integer-cents math — never floats'
      : 'Multiply the total by 0.9',
    usesFact: 'integer-cents',
  });
  steps.push({
    step: known.has('discount-as-line')
      ? 'Emit the discount as an invoice line item (audit trail)'
      : 'Return the discounted total',
    usesFact: 'discount-as-line',
  });
  steps.push({
    step: known.has('has-tests')
      ? 'Run npm test and iterate until green'
      : 'Report done when the change is written',
    usesFact: 'has-tests',
  });
  return steps;
}

function chooseEdit(known) {
  return {
    scope: known.has('shared-totals') ? 'totals' : 'cart-only',
    math: known.has('integer-cents') ? 'cents' : 'float',
    line: known.has('discount-as-line'),
  };
}

function describeEdit(edit) {
  const where = edit.scope === 'totals' ? 'src/totals.mjs (shared)' : 'src/cart.mjs (duplicated)';
  const how = edit.math === 'cents' ? 'integer-cents math' : 'float math (total * 0.9)';
  const line = edit.line ? 'discount added as a line item' : 'total mutated silently';
  return { files: [edit.scope === 'totals' ? 'src/totals.mjs' : 'src/cart.mjs'], summary: `${where} · ${how} · ${line}` };
}

export function runTask({ explore = true, plan = true, verify = true, reads = ALL_PATHS } = {}) {
  const known = new Set();
  const trace = [];

  // Phase 1 — explore: each file read yields its facts. Skipped → zero facts.
  const filesRead = explore ? reads.filter((p) => ALL_PATHS.includes(p)) : [];
  for (const file of REPO_FILES) {
    if (!filesRead.includes(file.path)) continue;
    for (const fact of file.facts) known.add(fact);
  }
  trace.push({
    phase: 'explore',
    skipped: !explore,
    detail: explore
      ? `read ${filesRead.length}/${REPO_FILES.length} files → ${known.size} fact(s) learned`
      : 'skipped — the agent codes from the task text alone',
    facts: [...known],
  });

  // Phase 2 — plan: steps can only reference facts that were discovered.
  const planSteps = buildPlan(TASK, known, plan);
  const grounded = planSteps.filter((s) => !s.usesFact || known.has(s.usesFact)).length;
  trace.push({
    phase: 'plan',
    skipped: !plan,
    detail: plan
      ? `${planSteps.length} steps · ${grounded} grounded in discovered facts`
      : 'skipped — no artifact to review or approve',
    steps: planSteps.map((s) => s.step),
  });

  // Phase 3 — implement: the variant is a direct function of what is known.
  const edit = chooseEdit(known);
  const repo = applyEdit(edit);
  const editDesc = describeEdit(edit);
  trace.push({
    phase: 'implement',
    skipped: false,
    detail: editDesc.summary,
    files: editDesc.files,
  });

  // Ground truth: the repo's checks exist whether or not anyone runs them.
  const checks = runChecks(repo);
  const failing = checks.filter((c) => !c.pass);

  // Phase 4 — verify: the agent runs the suite only if a check was wired in.
  trace.push({
    phase: 'verify',
    skipped: !verify,
    detail: verify
      ? failing.length === 0
        ? `ran the suite — all ${checks.length} checks pass; evidence attached`
        : `ran the suite — ${failing.length}/${checks.length} checks FAIL: ${failing.map((c) => c.name).join('; ')}`
      : `skipped — "looks done" is the only signal; ${failing.length} failure(s) ship latent`,
  });

  let verdict;
  if (verify && failing.length === 0) verdict = 'verified-pass';
  else if (verify) verdict = 'caught-late';
  else if (failing.length === 0) verdict = 'unverified-pass';
  else verdict = 'shipped-broken';

  return {
    task: TASK.title,
    config: { explore, plan, verify, reads: filesRead },
    known: [...known],
    plan: planSteps,
    edit,
    editDesc,
    checks,
    verified: verify,
    failing: failing.map((c) => c.id),
    verdict,
    trace,
  };
}

export const VERDICTS = {
  'verified-pass': { label: 'VERIFIED PASS', tone: 'pass', note: 'check run, evidence shown, done' },
  'caught-late': { label: 'CAUGHT LATE', tone: 'warn', note: 'failures found — but only after the wrong work' },
  'unverified-pass': { label: 'PASS (unverified)', tone: 'info', note: 'correct by luck; nothing proved it' },
  'shipped-broken': { label: 'SHIPPED BROKEN', tone: 'fail', note: 'looks done, latent failures merged' },
};
