import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectStatus } from '../../../scripts/working-tree.js';
import { attractCsv, biosCsv, decisionReference, placeTiesCsv, placesCsv, profilesCsv, splitTieKey, tiesCsv } from './sheets.mjs';

/**
 * Checking and saving a reviewer's decisions, with the tools a developer runs.
 *
 * Each kind of review is applied by its own tool and becomes its own commit:
 * the tools refuse to run on a working tree with changes in it, so that each
 * decision arrives as its own diff, and the app keeps to that. Before anything
 * is applied the tree must be clean; if a tool or a check fails, that step is
 * undone and nothing of it is kept. Nothing is ever pushed: a developer looks
 * the commits over and pushes them.
 */

const steps = [
  {
    task: 'ties', title: 'Connections', script: 'ties:apply', csv: tiesCsv,
    refresh: ['review:ties'], checks: ['review:ties:check'],
    keys: (draft) => Object.keys(draft.ties ?? {}),
  },
  {
    task: 'places', title: 'Places', script: 'places:apply', csv: placesCsv,
    refresh: ['review:places'], checks: ['review:places:check'],
    keys: (draft) => Object.entries(draft.places ?? {}).filter(([, value]) => value.approve === true).map(([key]) => key),
  },
  {
    task: 'placeTies', title: 'What people did at places', script: 'places:apply', csv: placeTiesCsv,
    refresh: ['review:places'], checks: ['review:places:check'],
    keys: (draft) => Object.keys(draft.placeTies ?? {}),
  },
  // Before biographies: an approval covers the profile as the reviewer saw it,
  // and the app will not approve a profile whose biography correction is
  // still waiting to be saved.
  {
    task: 'profiles', title: 'Profiles', script: 'profiles:apply', csv: profilesCsv,
    refresh: [], checks: [],
    keys: (draft) => Object.keys(draft.profiles ?? {}),
  },
  {
    task: 'attract', title: 'Attract screen words', script: 'text:apply', csv: attractCsv,
    refresh: [], checks: [],
    keys: (draft) => Object.keys(draft.attract ?? {}),
  },
  {
    task: 'bios', title: 'Biographies', script: 'bios:apply', csv: biosCsv,
    // bios:apply refreshes the contribution worksheet itself; this proves it.
    refresh: [], checks: ['parity:report', 'crosswalk:check'],
    keys: (draft) => Object.keys(draft.bios ?? {}),
  },
];

/** Who may see the ties a reviewer kept. Asked at save time; never assumed wider. */
export const audiences = { kiosk: 'kiosk', 'kiosk-and-web': 'kiosk,public-web' };

export function today(now = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The dry run of every tool: what each would do, and anything it refuses. */
export function check({ root, draft, audience = 'kiosk', day = today() }) {
  return plan(draft).map((step) => {
    const input = writeSheet(root, step, draft, day);
    const result = runTool(root, step.script, [`--input=${input}`, ...toolArgs(step, audience)]);
    return { task: step.task, title: step.title, count: step.keys(draft).length, ok: result.ok, output: result.output };
  });
}

/**
 * Applies and commits each review in turn. Stops at the first that fails,
 * leaving the ones before it committed and the rest in the draft.
 */
export function save({ root, draft, audience = 'kiosk', day = today() }) {
  if (!draft.reviewer?.trim()) throw new Error('Enter your name before saving.');
  const results = [];
  let remaining = structuredClone(draft);

  for (const step of plan(draft)) {
    const dirty = workingTreeChanges(root);
    if (dirty.length > 0) {
      results.push({
        task: step.task, title: step.title, ok: false,
        output: `The project has changes that are not from this app, so nothing more was saved:\n${dirty.join('\n')}\n\nAsk the developer to commit or remove them.`,
      });
      break;
    }

    const input = writeSheet(root, step, draft, day);
    const hash = createHash('sha256').update(readFileSync(input, 'utf8')).digest('hex');
    const log = [];
    const run = (script, args = []) => {
      const result = runTool(root, script, args);
      log.push(`$ npm run ${script}\n${result.output}`);
      return result.ok;
    };

    const ok = run(step.script, [`--input=${input}`, ...toolArgs(step, audience), '--apply', `--expect-hash=${hash}`, '--no-backup'])
      && step.refresh.every((script) => run(script))
      && step.checks.every((script) => run(script));

    if (!ok) {
      undo(root);
      results.push({ task: step.task, title: step.title, ok: false, output: log.join('\n') });
      break;
    }

    const count = step.keys(draft).length;
    const reference = decisionReference(step.task, day);
    const message = [
      `review: ${step.title.toLowerCase()}, ${count} decision${count === 1 ? '' : 's'} (${reference})`,
      '',
      `Decided in the staff review app by ${draft.reviewer.trim()}, applied with npm run ${step.script}.`,
      '',
      `Reviewed-by: ${draft.reviewer.trim()}`,
    ].join('\n');
    git(root, ['add', '-A', '--', 'data']);
    if (workingTreeChanges(root).length === 0) {
      // Every decision matched what was already recorded.
      results.push({ task: step.task, title: step.title, ok: true, commit: null, count, output: log.join('\n') });
      remaining = withoutStep(remaining, step);
      continue;
    }
    commit(root, message, draft.reviewer.trim());
    const sha = git(root, ['rev-parse', '--short', 'HEAD']).trim();
    results.push({ task: step.task, title: step.title, ok: true, commit: sha, count, output: log.join('\n') });
    remaining = withoutStep(remaining, step);
  }

  return { results, draft: remaining };
}

/** What the developer still has to push. */
export function gitStatus(root) {
  let unpushed = null;
  try {
    unpushed = Number(git(root, ['rev-list', '--count', '@{upstream}..HEAD']).trim());
  } catch { /* no upstream: say nothing rather than guess */ }
  return { clean: workingTreeChanges(root).length === 0, unpushed };
}

// ------------------------------------------------------------------ helpers

function plan(draft) {
  return steps.filter((step) => step.keys(draft).length > 0);
}

function toolArgs(step, audience) {
  if (step.task !== 'ties') return [];
  const targets = audiences[audience];
  if (!targets) throw new Error(`Unknown audience: ${audience}`);
  return [`--targets=${targets}`];
}

function writeSheet(root, step, draft, day) {
  const directory = join(root, '.review', 'sheets');
  mkdirSync(directory, { recursive: true });
  const path = join(directory, `${step.task}.csv`);
  writeFileSync(path, step.csv(draft, day));
  return path;
}

function withoutStep(draft, step) {
  const next = structuredClone(draft);
  if (step.task === 'places') {
    for (const key of step.keys(draft)) delete next.places[key];
  } else {
    next[step.task] = {};
  }
  return next;
}

/**
 * Runs a root package.json script the way npm would, but without a shell, so
 * a path with a space in it survives on Windows. Every script used here is a
 * plain `node …` command.
 */
function runTool(root, script, args) {
  const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts ?? {};
  const command = scripts[script];
  if (typeof command !== 'string' || !command.startsWith('node ')) {
    return { ok: false, output: `No usable "${script}" script in package.json.` };
  }
  const result = spawnSync(process.execPath, [...command.split(/\s+/).slice(1), ...args], {
    cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

/** Changes that are not this app's; old leftovers git never tracked do not count. */
export function workingTreeChanges(root) {
  return projectStatus(root).split('\n').filter((line) => line.trim().length > 0);
}

/**
 * Puts the tree back as the step found it. Safe only because a step starts
 * from a clean tree, which `save` checks first: everything here is the step's.
 */
function undo(root) {
  git(root, ['reset', '-q', '--hard', 'HEAD']);
  git(root, ['clean', '-fdq', '--', 'data']);
}

function commit(root, message, reviewer) {
  // The computer's own git identity when it has one; otherwise the reviewer's
  // name, so a staff PC never needs setting up for this.
  const configured = (key) => {
    try { return git(root, ['config', key]).trim(); } catch { return ''; }
  };
  const identity = [
    ...(configured('user.name') ? [] : ['-c', `user.name=${reviewer}`]),
    ...(configured('user.email') ? [] : ['-c', 'user.email=staff-review@cihof.invalid']),
  ];
  git(root, [...identity, 'commit', '-q', '-m', message]);
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

export { splitTieKey };
