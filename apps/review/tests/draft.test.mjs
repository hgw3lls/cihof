import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyDraft, readDraftFile } from '../server/server.mjs';

const folder = mkdtempSync(join(tmpdir(), 'cihof-draft-'));

test('a draft kept before later reviews existed opens with those reviews empty', () => {
  const path = join(folder, 'old.json');
  const tie = { decision: 'context' };
  writeFileSync(path, JSON.stringify({ reviewer: 'Jane Smith', ties: { t1: tie }, places: {}, placeTies: {}, bios: {} }));
  assert.deepEqual(readDraftFile(path), { ...emptyDraft(), reviewer: 'Jane Smith', ties: { t1: tie } });
});

test('a signature recorded the old way is dropped, not turned into an acceptance', () => {
  const path = join(folder, 'recorded.json');
  const accepted = { action: 'accept', by: 'Jane Smith', date: '2026-09-27' };
  writeFileSync(path, JSON.stringify({ reviewer: 'Jane Smith', signoffs: {
    logo: { action: 'sign', by: 'Board chair', date: '2026-09-20', reference: 'Board minutes' },
    'signoff-touch': accepted,
  } }));
  assert.deepEqual(readDraftFile(path).signoffs, { 'signoff-touch': accepted });
});

test('a missing or unreadable draft opens empty', () => {
  const path = join(folder, 'broken.json');
  writeFileSync(path, '{ not json');
  assert.deepEqual(readDraftFile(path), emptyDraft());
  assert.deepEqual(readDraftFile(join(folder, 'missing.json')), emptyDraft());
});
