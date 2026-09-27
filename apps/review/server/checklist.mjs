import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What a person confirms when they accept a section of the sign-off sheet,
 * read from docs/sign-off.md so the app and the printed sheet say the same.
 *
 * Returns the ticked lines of each numbered section ("1" to "6"), and the
 * words of the approval to open ("approval").
 */
export function signoffChecklists(root) {
  const path = join(root, 'docs', 'sign-off.md');
  if (!existsSync(path)) return {};
  return parseChecklists(readFileSync(path, 'utf8'));
}

export function parseChecklists(markdown) {
  const sections = {};
  for (const part of markdown.split(/^## /m).slice(1)) {
    const [heading, ...body] = part.split('\n');
    const number = /^(\d+)\./.exec(heading)?.[1];
    const text = body.join('\n');
    if (number) {
      const lines = [...text.matchAll(/^- \[ \] ([\s\S]*?)(?=^\S|^\s*$)/gm)].map((match) => plain(match[1]));
      if (lines.length > 0) sections[number] = lines;
    } else if (/^Approval to open/.test(heading)) {
      const first = text.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).find((paragraph) => paragraph && !/_{3,}/.test(paragraph));
      if (first) sections.approval = [plain(first)];
    }
  }
  return sections;
}

/** One line of the sheet as plain words: no markup, no blanks to write in. */
function plain(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/_{3,}/g, '')
    .replace(/\*\*?([^*]+)\*\*?/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s*:\s*$/, '')
    .trim();
}
