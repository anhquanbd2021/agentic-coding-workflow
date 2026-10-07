# The Loop Lab — companion demo

Interactive lab for the article on the agentic coding workflow — Anthropic's
**explore → plan → code → verify** loop. A scripted agent gets one task
(*10% off orders ≥ $100*) on a small codebase with hidden conventions. Run it
through the loop, or skip phases and watch which failures ship latent.

Zero dependencies — Node 20+ only. The fixture repo, the checks, and the
agent pipeline are plain ES modules shared by the browser UI, the CLI report,
and the test suite.

## What it proves

| Workflow | Result |
|---|---|
| **Prompt-first** (no explore, no plan, no verify) | Plausible work: `feature-works` passes while **three checks fail latent** — cart/invoice divergence, float money math, no audit line. |
| **Prompt-first + a check** (verify only) | The same failures — caught *after* the wrong work, not prevented. |
| **Full loop** | Explore learns the repo's facts, the plan grounds each step in them, the edit goes into the shared `totals.mjs` once — **all checks pass, verified**. |

Toggle phases and individual file reads in the lab: partial explores produce
partial failures (skip `invoice.mjs` and the audit line never appears).

## Run it

```text
npm start        # serve the lab on :3000
npm test         # repo checks + loop outcomes + server
npm run report   # side-by-side matrix of the three workflows
npm run check    # both (fails if the loop run doesn't verify clean)
```

## Files

- `public/repo.mjs` — the fixture codebase: files carry discoverable facts;
  `applyEdit` builds the code an agent *would* write given those facts;
  `runChecks` is the repo's own test suite.
- `public/agent.mjs` — `runTask()` pipeline: explore collects facts, plan
  emits grounded steps, implement picks a variant, verify runs the suite.
- `examples/task.md` — the task brief the lab executes.
- `scripts/report.mjs` — CLI matrix; non-zero exit if the claim breaks.

## Honest limits

- This is a **scripted model of the workflow**, not an LLM — it demonstrates
  what each phase contributes, not the internals of Claude Code or any agent.
- The four checks stand in for a real test suite; real projects must wire a
  real runnable check as the agent's stop condition.
- Facts are all-or-nothing here; real exploration yields degrees of
  understanding, and real agents need course-correction, not just a pipeline.

This is an educational demo, not production infrastructure.
