import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublishedPerson } from '@cihof/content';
import {
  applyBiographyDecisions, biographyDecisions, biographySheetCsv, buildBiographySheet,
} from '../src/build/biographies.ts';

const person = (id: string, text: string, provenance: 'source' | 'curated') => ({
  id, name: id, sortName: id, classYear: 2020,
  biography: { text, provenance },
}) as unknown as PublishedPerson;

const people = [person('a-2020', 'The institution wrote this.', 'source'), person('b-2020', 'A curator wrote this.', 'curated')];
const sheet = (edit: (row: Record<string, string>) => void) => {
  const header = ['id', 'name', 'classYear', 'provenance', 'currentText', 'correctedText', 'useSourceText', 'decisionReference', 'note'];
  const rows = buildBiographySheet(people).map((row) => {
    const record: Record<string, string> = { ...row, correctedText: '', useSourceText: '', decisionReference: '', note: '' };
    edit(record);
    return header.map((column) => `"${(record[column] ?? '').replace(/"/g, '""')}"`).join(',');
  });
  return [header.join(','), ...rows].join('\n');
};

test('a blank sheet decides nothing', () => {
  const { decisions, errors, blank } = biographyDecisions(biographySheetCsv(buildBiographySheet(people)), people);
  assert.deepEqual([decisions.length, errors.length, blank], [0, 0, 2]);
});

test('a correction needs a decision reference', () => {
  const { errors } = biographyDecisions(sheet((row) => { if (row.id === 'a-2020') row.correctedText = 'Fixed.'; }), people);
  assert.match(errors[0] ?? '', /no decisionReference/);
});

test('a correction is a curated biography, with its decision beside it', () => {
  const { decisions, errors } = biographyDecisions(sheet((row) => {
    if (row.id === 'a-2020') { row.correctedText = 'The institution wrote this, corrected.'; row.decisionReference = 'bios-2026-10-01'; }
  }), people);
  assert.deepEqual(errors, []);
  const next = applyBiographyDecisions({ inductees: { 'a-2020': { curatorNotes: [] } } }, decisions, '2026-10-01T12:00:00Z');
  assert.equal(next.inductees['a-2020']!['bioTextOverride'], 'The institution wrote this, corrected.');
  assert.deepEqual(next.inductees['a-2020']!['bioTextDecision'], { decisionReference: 'bios-2026-10-01', action: 'correct', appliedAt: '2026-10-01T12:00:00Z' });
});

test('useSourceText removes a curated biography, and only a curated one', () => {
  const ok = biographyDecisions(sheet((row) => { if (row.id === 'b-2020') { row.useSourceText = 'yes'; row.decisionReference = 'r'; } }), people);
  assert.equal(ok.decisions[0]?.action, 'use-source');
  const next = applyBiographyDecisions({ inductees: { 'b-2020': { bioTextOverride: 'x' } } }, ok.decisions, '2026-10-01T12:00:00Z');
  assert.equal('bioTextOverride' in next.inductees['b-2020']!, false);

  const refused = biographyDecisions(sheet((row) => { if (row.id === 'a-2020') { row.useSourceText = 'yes'; row.decisionReference = 'r'; } }), people);
  assert.match(refused.errors[0] ?? '', /already shows the institution's text/);
});

test('an unchanged or unknown row is refused rather than written', () => {
  const same = biographyDecisions(sheet((row) => { if (row.id === 'a-2020') { row.correctedText = row.currentText!; row.decisionReference = 'r'; } }), people);
  assert.match(same.errors[0] ?? '', /same as the current text/);
  const unknown = biographyDecisions(sheet((row) => { row.id = `${row.id}-x`; row.correctedText = 'y'; row.decisionReference = 'r'; }), people);
  assert.match(unknown.errors[0] ?? '', /not a person the exhibit builds/);
});
