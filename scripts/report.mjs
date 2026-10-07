// Side-by-side CLI report: one task, three workflows.
// Exits non-zero if the full loop fails — the demo's central claim.
import { CHECKS } from '../public/repo.mjs';
import { PRESETS, VERDICTS, runTask } from '../public/agent.mjs';

const runs = Object.entries(PRESETS).map(([key, cfg]) => ({ key, ...cfg, run: runTask(cfg) }));

console.log(`\nThe Loop Lab — "${runs[0].run.task}"\n`);

const nameWidth = Math.max(...runs.map((r) => r.label.length));
const header = ['workflow'.padEnd(nameWidth), ...CHECKS.map((c) => c.name), 'verdict'];
console.log(header.join('  |  '));
console.log('-'.repeat(header.join('  |  ').length));
for (const r of runs) {
  const row = [r.label.padEnd(nameWidth)];
  r.run.checks.forEach((c, i) => row.push((c.pass ? 'pass' : 'FAIL').padEnd(CHECKS[i].name.length)));
  row.push(VERDICTS[r.run.verdict].label);
  console.log(row.join('  |  '));
}

console.log('');
for (const r of runs) {
  const fails = r.run.checks.filter((c) => !c.pass);
  console.log(`${r.label}: ${VERDICTS[r.run.verdict].note}`);
  for (const f of fails) console.log(`   - ${f.name}: ${f.note}`);
}
console.log('');

const loop = runs.find((r) => r.key === 'full-loop');
if (loop.run.verdict !== 'verified-pass') {
  console.error('FAIL: the full loop did not verify clean — the demo claim is broken.');
  process.exit(1);
}
const promptFirst = runs.find((r) => r.key === 'prompt-first');
if (promptFirst.run.verdict !== 'shipped-broken' || promptFirst.run.failing.length === 0) {
  console.error('FAIL: prompt-first was expected to ship latent failures.');
  process.exit(1);
}
console.log('OK: full loop verifies clean; prompt-first ships latent failures.');
