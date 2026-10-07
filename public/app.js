import { FACTS, REPO_FILES, TASK } from './repo.mjs';
import { PRESETS, VERDICTS, runTask } from './agent.mjs';

const $ = (sel) => document.querySelector(sel);

$('#task-brief').textContent = `Task: ${TASK.title}. ${TASK.brief}`;

const readsFieldset = $('#reads');
for (const file of REPO_FILES) {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = true;
  input.value = file.path;
  input.className = 'read-file';
  label.append(input, document.createTextNode(`${file.path} — ${file.summary}`));
  readsFieldset.append(label);
}

const exploreToggle = $('#do-explore');
function syncReads() {
  readsFieldset.classList.toggle('disabled', !exploreToggle.checked);
  for (const input of readsFieldset.querySelectorAll('input')) {
    input.disabled = !exploreToggle.checked;
  }
}
exploreToggle.addEventListener('change', syncReads);
syncReads();

function renderRun(run) {
  const verdict = $('#verdict');
  const v = VERDICTS[run.verdict];
  verdict.textContent = v.label;
  verdict.className = `badge ${v.tone}`;
  verdict.title = v.note;

  const ol = $('#phases');
  ol.innerHTML = '';
  run.trace.forEach((stage, i) => {
    const li = document.createElement('li');
    li.className = `phase ${stage.skipped ? 'skipped' : 'active'}`;
    const head = document.createElement('div');
    head.className = 'phase-head';
    head.innerHTML = `<span class="num">${i + 1}</span><strong>${stage.phase}</strong><span class="badge">${stage.skipped ? 'skipped' : 'ran'}</span>`;
    const p = document.createElement('p');
    p.textContent = stage.detail;
    li.append(head, p);
    if (stage.facts && stage.facts.length) {
      const ul = document.createElement('ul');
      for (const f of stage.facts) {
        const item = document.createElement('li');
        item.textContent = `${FACTS[f].label} (from ${FACTS[f].file})`;
        ul.append(item);
      }
      li.append(ul);
    }
    if (stage.steps && stage.steps.length) {
      const ul = document.createElement('ul');
      for (const s of stage.steps) {
        const item = document.createElement('li');
        item.textContent = s;
        ul.append(item);
      }
      li.append(ul);
    }
    ol.append(li);
  });

  const checks = $('#checks');
  checks.innerHTML = '';
  for (const c of run.checks) {
    const li = document.createElement('li');
    li.className = 'check';
    const seen = run.verified ? (c.pass ? 'PASS' : 'FAIL') : 'not run';
    li.innerHTML = `<strong>${c.name}</strong> <span class="badge ${run.verified ? (c.pass ? 'pass' : 'fail') : 'info'}">${seen}</span><span class="why">${c.note}</span>`;
    checks.append(li);
  }
}

function renderMatrix() {
  const tbody = $('#matrix tbody');
  tbody.innerHTML = '';
  for (const [key, cfg] of Object.entries(PRESETS)) {
    const run = runTask(cfg);
    const tr = document.createElement('tr');
    const cell = (text, cls) => {
      const td = document.createElement('td');
      td.innerHTML = `<span class="badge ${cls}">${text}</span>`;
      return td;
    };
    tr.append(Object.assign(document.createElement('td'), { textContent: cfg.label }));
    for (const c of run.checks) tr.append(cell(c.pass ? 'pass' : 'FAIL', c.pass ? 'pass' : 'fail'));
    const v = VERDICTS[run.verdict];
    tr.append(cell(v.label, v.tone));
    tbody.append(tr);
  }
}

$('#run').addEventListener('click', () => {
  const reads = [...readsFieldset.querySelectorAll('input:checked')].map((i) => i.value);
  renderRun(runTask({
    explore: exploreToggle.checked,
    plan: $('#do-plan').checked,
    verify: $('#do-verify').checked,
    reads,
  }));
});

renderRun(runTask(PRESETS['full-loop']));
renderMatrix();
