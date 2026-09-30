import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { decisionsFormat, decisionsFormatVersion, listExports, readDecisionsFile } from '../server/export.mjs';

const folder = () => mkdtempSync(join(tmpdir(), 'cihof-export-'));
const decisions = (overrides = {}) => ({
  format: decisionsFormat, formatVersion: decisionsFormatVersion, reviewer: 'Jane Smith', day: '2026-10-01',
  exportedAt: '2026-10-01T14:00:00.000Z', audience: 'kiosk', counts: { tours: 1 }, draft: { reviewer: 'Jane Smith', tours: { t: { decision: 'withdraw' } } }, sheets: {},
  ...overrides,
});

test('a decisions file the app wrote is read back, and anything else is refused with a reason', () => {
  const dir = folder();
  const write = (name, value) => { const path = join(dir, name); writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value)); return path; };
  assert.equal(readDecisionsFile(write('good.json', decisions())).document.reviewer, 'Jane Smith');
  assert.match(readDecisionsFile(write('text.json', 'not json')).problem, /not a decisions file/);
  assert.match(readDecisionsFile(write('other.json', { format: 'something-else' })).problem, /not a decisions file/);
  assert.match(readDecisionsFile(write('newer.json', decisions({ formatVersion: 99 }))).problem, /different version/);
  assert.match(readDecisionsFile(write('nobody.json', decisions({ reviewer: '' }))).problem, /who reviewed/);
  assert.match(readDecisionsFile(write('when.json', decisions({ day: 'Tuesday' }))).problem, /which day/);
});

test('the history lists the files exported from this computer, newest first', () => {
  const dir = folder();
  writeFileSync(join(dir, 'cihof-decisions-jane-smith-2026-10-01-090000.json'), JSON.stringify(decisions({ exportedAt: '2026-10-01T09:00:00.000Z' })));
  writeFileSync(join(dir, 'cihof-decisions-jane-smith-2026-10-02-090000.json'), JSON.stringify(decisions({ exportedAt: '2026-10-02T09:00:00.000Z', counts: { tours: 2, profiles: 3 } })));
  writeFileSync(join(dir, 'notes.txt'), 'not a decisions file');
  const listed = listExports(dir);
  assert.deepEqual(listed.map((entry) => [entry.exportedAt.slice(0, 10), entry.total]), [['2026-10-02', 5], ['2026-10-01', 1]]);
  assert.deepEqual(listExports(join(dir, 'missing')), []);
});
