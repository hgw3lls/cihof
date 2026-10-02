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

test('a tour edit keeps only its own fields, and an audience only if it is one', () => {
  const path = join(folder, 'tour-edit.json');
  const changes = { label: 'A', prompt: 'B', description: 'C', terms: ['refugee'], themes: [], pinnedPersonIds: ['a'], excludedPersonIds: [], maxPortraits: 12 };
  writeFileSync(path, JSON.stringify({ reviewer: 'Jane Smith', tours: {
    kept: { decision: 'edit', seenVersion: 'tour-abc', changes: { ...changes, smuggled: 'x' }, audience: 'everyone', note: 'Fine.' },
    approved: { decision: 'edit', seenVersion: 'tour-def', changes, audience: 'kiosk-and-web' },
    left: { decision: 'edit', seenVersion: 'tour-jkl', changes, audience: 'nobody' },
    halfMade: { decision: 'edit', seenVersion: 'tour-ghi', changes: { label: 'Only a name' } },
    unversioned: { decision: 'edit', changes },
  } }));
  assert.deepEqual(readDraftFile(path).tours, {
    kept: { decision: 'edit', seenVersion: 'tour-abc', changes, audience: null, note: 'Fine.' },
    approved: { decision: 'edit', seenVersion: 'tour-def', changes, audience: 'kiosk-and-web', note: '' },
    left: { decision: 'edit', seenVersion: 'tour-jkl', changes, audience: 'nobody', note: '' },
  });
});

test('a new tour is kept only under a name a tour can have, with its own fields', () => {
  const path = join(folder, 'tour-create.json');
  const changes = { label: 'Painters', prompt: 'P', description: 'D', terms: ['painter'], themes: [], pinnedPersonIds: [], excludedPersonIds: [], maxPortraits: 48 };
  writeFileSync(path, JSON.stringify({ reviewer: 'Jane Smith', tours: {
    painters: { decision: 'create', changes, audience: 'nobody', seenVersion: 'ignored' },
    'Not A Name': { decision: 'create', changes, audience: 'kiosk' },
    blank: { decision: 'create', changes: { label: 'Only a name' } },
  } }));
  assert.deepEqual(readDraftFile(path).tours, { painters: { decision: 'create', changes, audience: 'nobody', note: '' } });
});
