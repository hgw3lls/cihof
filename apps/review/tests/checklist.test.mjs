import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { parseChecklists, signoffChecklists } from '../server/checklist.mjs';

const root = resolve(import.meta.dirname, '../../..');

test('each section of the sign-off sheet, and the approval to open, has lines to confirm', () => {
  const checklists = signoffChecklists(root);
  const sections = JSON.parse(readFileSync(resolve(root, 'data/cihof_opening_signoffs.json'), 'utf8')).items
    .filter((item) => item.section).map((item) => item.section);
  assert.deepEqual(sections, ['1', '2', '3', '4', '5', '6', 'approval']);
  for (const section of sections) {
    assert.ok(checklists[section]?.length > 0, `section ${section}`);
    for (const line of checklists[section]) assert.doesNotMatch(line, /_{3}|\*|`|\s{2}/, line);
  }
});

test('a ticked line reads as plain words, over however many lines it is written', () => {
  const sheet = [
    '## 1. The installation (team)', '', '| a | b |', '', '- [ ] One line.', '- [ ] Two lines, the second', '      *indented*.', '',
    'Accept in the review app.', '', '## Approval to open', '', 'All six sections are signed.', '', 'Name: _______',
  ].join('\n');
  assert.deepEqual(parseChecklists(sheet), { 1: ['One line.', 'Two lines, the second indented.'], approval: ['All six sections are signed.'] });
});
