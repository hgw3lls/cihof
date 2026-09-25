import { execFileSync } from 'node:child_process';

/**
 * `git status --porcelain`, less the leftovers that are not the project's.
 *
 * The apply tools refuse to run on a working tree with changes in it, so that
 * each decision arrives as its own diff. A changed tracked file always counts,
 * and so does a new file inside a folder the project keeps (data/, public/,
 * packages/ and the rest), since the pipeline may read it. A new folder or
 * file at the top of the project that git has never tracked, such as an old
 * build output left behind by an earlier layout, is nobody's change: nothing
 * reads it and nothing commits it, so it does not block a decision.
 *
 * Throws, as git does, when the folder is not a git repository.
 */
export function projectStatus(root) {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  let kept;
  try {
    kept = new Set(execFileSync('git', ['ls-tree', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' })
      .split('\n').filter(Boolean));
  } catch {
    // No commit yet: nothing is the project's yet either, so everything counts.
    return status;
  }
  return status.split('\n')
    .filter((line) => !(line.startsWith('?? ') && !kept.has(topLevel(line.slice(3)))))
    .join('\n');
}

function topLevel(path) {
  return path.replace(/^"/, '').split('/')[0];
}
