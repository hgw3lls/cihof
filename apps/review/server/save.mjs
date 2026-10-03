import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectStatus } from '../../../scripts/working-tree.js';
import { previewHash } from '../../../scripts/preview-hash.js';
import { recordChange, snapshot } from './portal.mjs';
import { attractCsv, filmChangesCsv, portraitsCsv, filmTitlesCsv, profileEditsCsv, toursCsv, biosCsv, decisionReference, filmFixesCsv, filmStartsCsv, signoffsCsv, placeTiesCsv, placesCsv, profilesCsv, splitTieKey, tiesCsv } from './sheets.mjs';

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

export const steps = [
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
  // First of the profile reviews: an edit names the profile as it began, so it
  // goes before anything else that changes a profile. Like a biography
  // correction it changes what visitors see, so it is checked the same way.
  {
    task: 'profileEdits', title: 'Profile edits', script: 'profiles:edit', csv: profileEditsCsv,
    refresh: [], checks: ['parity:report', 'crosswalk:check'],
    keys: (draft) => Object.keys(draft.profileEdits ?? {}),
  },
  // New pictures and films, chosen in the staff portal. A portrait names the
  // profile as it was, like an edit; both go before any approval.
  {
    task: 'portraits', title: 'Portraits', script: 'portraits:replace', csv: portraitsCsv,
    refresh: [], checks: ['parity:report'],
    keys: (draft) => Object.keys(draft.portraits ?? {}),
  },
  {
    task: 'films', title: 'Films', script: 'films:change', csv: filmChangesCsv,
    refresh: [], checks: ['parity:report', 'media:assert'],
    keys: (draft) => Object.keys(draft.films ?? {}),
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
    task: 'tours', title: 'Tours', script: 'tours:apply', csv: toursCsv,
    refresh: [], checks: [],
    keys: (draft) => Object.keys(draft.tours ?? {}),
  },
  {
    task: 'filmTitles', title: 'Film titles', script: 'films:titles:apply', csv: filmTitlesCsv,
    refresh: [], checks: [],
    keys: (draft) => Object.keys(draft.filmTitles ?? {}),
  },
  {
    task: 'filmStarts', title: 'Where ceremony films start', script: 'films:starts:apply', csv: filmStartsCsv,
    refresh: [], checks: [],
    keys: (draft) => Object.keys(draft.filmStarts ?? {}),
  },
  {
    task: 'filmFixes', title: 'Film captions and transcripts', script: 'films:captions:apply', csv: filmFixesCsv,
    refresh: [], checks: ['media:assert'],
    keys: (draft) => Object.keys(draft.filmFixes ?? {}),
  },
  {
    task: 'signoffs', title: 'Sign-offs', script: 'signoffs:apply', csv: signoffsCsv,
    refresh: [], checks: [],
    keys: (draft) => Object.keys(draft.signoffs ?? {}),
  },
  {
    task: 'bios', title: 'Biographies', script: 'bios:apply', csv: biosCsv,
    // bios:apply refreshes the contribution worksheet itself; this proves it.
    refresh: [], checks: ['parity:report', 'crosswalk:check'],
    keys: (draft) => Object.keys(draft.bios ?? {}),
  },
];

/** Who may see the ties and places a reviewer kept. Asked at save time; never assumed wider. */
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
    // As the tool will compute it: the sheet, and for a tool with an audience, the audience too.
    const targets = toolArgs(step, audience)[0]?.slice('--targets='.length);
    const hash = previewHash(readFileSync(input, 'utf8'), targets);
    const log = [];
    const run = (script, args = []) => {
      const result = runTool(root, script, args);
      log.push(`$ npm run ${script}\n${result.output}`);
      return result.ok;
    };

    const ok = run(step.script, [`--input=${input}`, ...toolArgs(step, audience), '--apply', `--expect-hash=${hash}`, '--no-backup'])
      && stageNewMedia(root, step)
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
    git(root, ['add', '-A', '--', 'data', 'public/media/images']);
    // Captions and transcripts are tracked inside the ignored media folder:
    // only changes to files already tracked there are staged.
    git(root, ['add', '-u', '--', 'public/media/videos']);
    if (workingTreeChanges(root).length === 0) {
      // Every decision matched what was already recorded.
      results.push({ task: step.task, title: step.title, ok: true, commit: null, count, output: log.join('\n') });
      remaining = withoutStep(remaining, step);
      continue;
    }
    commit(root, message, draft.reviewer.trim());
    forgetUploads(root, step, draft);
    const sha = git(root, ['rev-parse', '--short', 'HEAD']).trim();
    results.push({ task: step.task, title: step.title, ok: true, commit: sha, count, output: log.join('\n') });
    remaining = withoutStep(remaining, step);
  }

  return { results, draft: remaining };
}

/**
 * Saves into the staff portal's working copy, which has no git: each kind of
 * review is applied by its own tool and checked as `save` does, and a copy of
 * the records taken first is put back if anything fails, so nothing of it is
 * kept. Each saved kind is recorded under the reviewer's name, for the next
 * display update to list. Stops at the first that fails.
 */
export function saveHere({ root, draft, audience = 'kiosk', day = today(), now = new Date() }) {
  if (!draft.reviewer?.trim()) throw new Error('Enter your name before saving.');
  const results = [];
  let remaining = structuredClone(draft);

  for (const step of plan(draft)) {
    const input = writeSheet(root, step, draft, day);
    const targets = toolArgs(step, audience)[0]?.slice('--targets='.length);
    const hash = previewHash(readFileSync(input, 'utf8'), targets);
    const log = [];
    const run = (script, args = []) => {
      const result = runTool(root, script, args);
      log.push(`$ npm run ${script}\n${result.output}`);
      return result.ok;
    };

    const before = snapshot(root);
    const ok = run(step.script, [`--input=${input}`, ...toolArgs(step, audience), '--apply', `--expect-hash=${hash}`, '--no-backup'])
      && step.refresh.every((script) => run(script))
      && step.checks.every((script) => run(script));
    if (!ok) {
      before.restore();
      results.push({ task: step.task, title: step.title, ok: false, output: log.join('\n') });
      break;
    }
    before.discard();
    forgetUploads(root, step, draft);

    const count = step.keys(draft).length;
    recordChange(root, { by: draft.reviewer.trim(), task: step.task, title: step.title, count, reference: decisionReference(step.task, day), now });
    results.push({ task: step.task, title: step.title, ok: true, commit: null, saved: true, count, output: log.join('\n') });
    remaining = withoutStep(remaining, step);
  }

  return { results, draft: remaining };
}

/**
 * A new film's poster, captions and transcript sit in the ignored video
 * folder, so git tracks them only when added deliberately, as media:assert
 * requires. The film itself is never added.
 */
function stageNewMedia(root, step) {
  if (step.task !== 'films') return true;
  const fresh = git(root, ['ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--', 'public/media/videos'])
    .split('\0').filter((path) => path && !/\.(mp4|m4v|mov|webm|mkv|avi|partial)$/i.test(path));
  if (fresh.length > 0) git(root, ['add', '-f', '--', ...fresh]);
  return true;
}

/** A saved picture or film is in the media folder now: its upload, perhaps gigabytes, is not needed. */
function forgetUploads(root, step, draft) {
  const names = step.task === 'portraits' ? Object.values(draft.portraits ?? {}).map((value) => value.upload)
    : step.task === 'films' ? Object.values(draft.films ?? {}).flatMap((value) => [value.film, value.poster, value.captions, value.transcript])
      : [];
  for (const name of names) if (typeof name === 'string' && /^[0-9a-f]{64}\.[a-z0-9]+$/.test(name)) rmSync(join(root, '.review', 'uploads', name), { force: true });
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

/** Who may see what is kept: asked once at save time for connections and places alike. */
function toolArgs(step, audience) {
  if (!['ties', 'places', 'placeTies'].includes(step.task)) return [];
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
  git(root, ['clean', '-fdq', '--', 'data', 'public/media/images']);
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
