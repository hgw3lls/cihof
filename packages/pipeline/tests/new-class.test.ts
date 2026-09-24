import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  curatedRecord, mediaRecord, newClassColumns, newClassTemplateCsv, readNewClassSheet, rosterRow,
} from '../src/build/new-class.ts';

const known = { themes: new Set(['Education']), countries: new Set(['Hungarian']), communities: new Set<string>() };
const row = (over: Record<string, string> = {}) => {
  const values: Record<string, string> = {
    name: 'Ada Example', classYear: '2027', sortName: 'Example, Ada', region: 'Europe',
    inductedBy: 'Edith Lauer', biography: 'The institution’s text.', themeTags: 'Education',
    countryTags: 'Hungarian', portraitFile: 'ada.jpg', portraitRights: 'pending', decisionReference: 'class-of-2027',
    ...over,
  };
  return newClassColumns.map((column) => `"${(values[column] ?? '').replace(/"/g, '""')}"`).join(',');
};
const sheet = (...rows: string[]) => `${newClassTemplateCsv()}${rows.join('\n')}\n`;

test('a row becomes a person with the id every existing person was given', () => {
  const { people, errors } = readNewClassSheet(sheet(row()), new Set(), known);
  assert.deepEqual(errors, []);
  assert.equal(people[0]?.id, 'ada-example-2027');
});

test('a row with no decision reference, portrait, sort name or year is refused', () => {
  for (const [over, reason] of [
    [{ decisionReference: '' }, /decisionReference/],
    [{ portraitFile: '' }, /portrait/],
    [{ sortName: '' }, /sortName/],
    [{ classYear: '27' }, /classYear/],
    [{ region: 'Europa' }, /region/],
    [{ portraitRights: 'yes' }, /portraitRights/],
  ] as const) {
    const { errors } = readNewClassSheet(sheet(row(over)), new Set(), known);
    assert.match(errors[0] ?? '', reason);
  }
});

test('somebody already in the roster, or twice in the sheet, is refused', () => {
  assert.match(readNewClassSheet(sheet(row()), new Set(['ada-example-2027']), known).errors[0] ?? '', /already in the roster/);
  assert.match(readNewClassSheet(sheet(row(), row()), new Set(), known).errors[0] ?? '', /twice/);
});

test('a tag nobody has used is pointed out, not refused', () => {
  const { people, warnings } = readNewClassSheet(sheet(row({ themeTags: 'Educaton' })), new Set(), known);
  assert.equal(people.length, 1);
  assert.match(warnings[0] ?? '', /new theme tag/);
});

test('the records say only what the row says', () => {
  const [person] = readNewClassSheet(sheet(row({ themeTags: '' })), new Set(), known).people;
  const curated = curatedRecord(person!, '2027-06-01T00:00:00Z');
  assert.equal(curated.honoredForSummary, '', 'no contribution line composed from nothing');
  assert.equal(curated.image.rightsStatus, 'pending');
  assert.match(curated.documentedContextLine, /Class of 2027 honoree connected to Hungarian\. Inducted by Edith Lauer\./);

  const media = mediaRecord(person!, { checksumSha256: 'abc', width: 10, height: 20 });
  assert.equal(media.images.primary.approvedForKiosk, false, 'pending rights keep the portrait off screen');
  assert.equal(media.images.primary.approvedForPublicWeb, false, 'the web is its own decision');
  assert.equal(media.images.primary.filePath, 'public/media/images/ada-example-2027/primary.jpg');
});

test('the roster row fills the roster’s own columns, and quotes what needs it', () => {
  const [person] = readNewClassSheet(sheet(row({ biography: 'Born in Pécs, she "arrived" in 1956.' })), new Set(), known).people;
  const header = ['﻿name', 'class_year', 'region', 'profile_url', 'inducted_by', 'primary_image_url', 'image_urls', 'bio_text'];
  assert.equal(rosterRow(person!, header), 'Ada Example,2027,Europe,,Edith Lauer,,,"Born in Pécs, she ""arrived"" in 1956."');
});
