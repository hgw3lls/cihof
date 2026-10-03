import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { publishableFilms } from '@cihof/content';
import { buildPeople } from '../src/build/people.ts';
import {
  applyFilmChanges, applyPortraits, filmChangeColumns, filmChangeDecisions, filmIdOf, kindOf, portraitColumns, portraitDecisions, videoHoldingsFrom,
} from '../src/build/media-changes.ts';
import { readFilmTitles } from '../src/build/film-titles.ts';
import { filmTitlesByPerson } from '../src/build/parity.ts';
import { profileContentVersion, readPortraitChecksums } from '../src/build/profiles.ts';
import { dataFile } from '../src/paths.ts';

// The real collection, read once; nothing here writes into it.
const curated = JSON.parse(readFileSync(dataFile('cihof_curated_metadata.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(dataFile('media_manifest.json'), 'utf8'));
const people = buildPeople();
const checksums = readPortraitChecksums();
const person = people.find((each) => each.id === 'alex-machaskee-2010')!;
const version = profileContentVersion(person, checksums.get(person.id) ?? '');

// Uploads as the portal keeps them: named by their checksum.
const uploads = mkdtempSync(join(tmpdir(), 'cihof-uploads-'));
const keep = (bytes: Uint8Array | string, kind: string) => {
  const data = typeof bytes === 'string' ? Buffer.from(bytes) : Buffer.from(bytes);
  const name = `${createHash('sha256').update(data).digest('hex')}.${kind}`;
  writeFileSync(join(uploads, name), data);
  return name;
};
/** The start of a JPEG of this size: all imageSize reads. */
const jpeg = (width: number, height: number, salt = 0) => Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 3, salt, 0, 0, 0, 0, 0, 0]);
const picture = keep(jpeg(400, 500), 'jpg');
const tiny = keep(jpeg(120, 120), 'jpg');
const film = keep(Uint8Array.from([0, 0, 0, 0x18, ...Buffer.from('ftypisom'), 1, 2, 3, 4]), 'mp4');
const poster = keep(jpeg(640, 360, 7), 'jpg');
const captions = keep('WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nWelcome to the Hall of Fame.\n', 'vtt');
const transcript = keep('Welcome to the Hall of Fame.\n', 'txt');

const quote = (cell: string) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
const portraitSheet = (row: Partial<Record<(typeof portraitColumns)[number], string>>) => [
  portraitColumns.join(','),
  portraitColumns.map((column) => quote({
    id: person.id, contentVersion: version, upload: picture, portraitAlt: 'Alex Machaskee at his desk.', focalPoint: 'center',
    rightsConfirmed: 'yes', decisionReference: 'portraits-review-2026-10-03', note: 'Given by the family.', ...row,
  }[column] ?? '')).join(','),
].join('\n');
const filmSheet = (...rows: Partial<Record<(typeof filmChangeColumns)[number], string>>[]) => [
  filmChangeColumns.join(','),
  ...rows.map((row) => filmChangeColumns.map((column) => quote({
    personId: person.id, decision: 'add', filmId: '', film, poster, captions, transcript, durationSeconds: '95', title: 'The 2026 ceremony',
    rightsConfirmed: 'yes', captionsChecked: 'yes', transcriptChecked: 'yes', decisionReference: 'film-changes-review-2026-10-03', note: '', ...row,
  }[column] ?? '')).join(',')),
].join('\n');

test('an upload is the kind of file its name says', () => {
  assert.equal(kindOf(jpeg(10, 10)), 'jpg');
  assert.equal(kindOf(Uint8Array.from([0, 0, 0, 0x18, ...Buffer.from('ftypmp42')])), 'mp4');
  assert.equal(kindOf(new TextEncoder().encode('﻿WEBVTT\n')), 'vtt');
  assert.equal(kindOf(new TextEncoder().encode('Just words.')), null);
});

test('a new portrait replaces the picture, approved, with its description, and the old file is noted', () => {
  const { decisions, errors } = portraitDecisions(portraitSheet({}), { people, curated, manifest, checksums, uploadsDir: uploads });
  assert.deepEqual(errors, []);
  const next = applyPortraits(manifest, curated, decisions, '2026-10-03T10:00:00.000Z');
  assert.deepEqual(next.placements, [{ from: picture, to: `public/media/images/${person.id}/portrait-${picture.slice(0, 12)}.jpg` }]);
  const rebuilt = buildPeople({ media: next.manifest, curated: next.curated }).find((each) => each.id === person.id)!;
  assert.equal(rebuilt.portrait?.src, `/media/images/${person.id}/portrait-${picture.slice(0, 12)}.jpg`);
  assert.equal(rebuilt.portrait?.rights, 'approved');
  assert.equal(rebuilt.portrait?.alt, 'Alex Machaskee at his desk.');
  assert.match(String((next.manifest.assets[person.id]!['notes'] as string[]).at(-1)), /Portrait replaced under portraits-review-2026-10-03 .* it was public\/media\/images/);
  assert.equal(manifest.assets[person.id].images.primary.filePath, `public/media/images/${person.id}/primary.png`, 'the manifest read in is untouched');
});

test('a portrait is refused without the rights confirmed, a description, a big enough picture, or the profile as it was', () => {
  const read = (row: Parameters<typeof portraitSheet>[0]) => portraitDecisions(portraitSheet(row), { people, curated, manifest, checksums, uploadsDir: uploads }).errors.join(' ');
  assert.match(read({ rightsConfirmed: '' }), /confirms the museum may show it/);
  assert.match(read({ portraitAlt: '' }), /describe the new picture/);
  assert.match(read({ upload: tiny }), /too small/);
  assert.match(read({ contentVersion: 'profile-000000000000' }), /changed since/);
  assert.match(read({ upload: `${'0'.repeat(64)}.jpg` }), /not on this computer/);
  assert.match(read({ upload: '../../etc/passwd' }), /not an upload/);
  assert.match(read({ upload: film }), /not a \.jpg or a \.png file/);
});

test('a film is added with its poster, captions, transcript and title, and shown on the display', () => {
  const { decisions, errors } = filmChangeDecisions(filmSheet({}), { people, manifest, uploadsDir: uploads });
  assert.deepEqual(errors, []);
  const next = applyFilmChanges(manifest, readFilmTitles(), decisions, '2026-10-03T10:00:00.000Z');
  const base = `public/media/videos/${person.id}/${person.id}_${film.slice(0, 12)}`;
  assert.deepEqual(next.placements.map((placement) => placement.to), [`${base}.mp4`, `${base}.jpg`, `${base}.en.vtt`, `${base}.transcript.txt`]);
  const videos = videoHoldingsFrom(next.manifest).get(person.id)!;
  const shown = publishableFilms(videos, 'kiosk');
  assert.equal(shown.length, 1);
  assert.equal(shown[0]!.source.kind, 'local-file');
  assert.equal(filmIdOf(videos.at(-1)), `/${base.slice('public/'.length)}.mp4`);
  assert.equal(publishableFilms(videos, 'public').length, 0, 'films are for the display only');
  assert.deepEqual(filmTitlesByPerson(next.titles, videoHoldingsFrom(next.manifest)).get(person.id), ['The 2026 ceremony']);
});

test('a film is refused without each confirmation, or with files that are not what they say', () => {
  const read = (row: Parameters<typeof filmSheet>[0]) => filmChangeDecisions(filmSheet(row), { people, manifest, uploadsDir: uploads }).errors.join(' ');
  assert.match(read({ rightsConfirmed: '' }), /confirms the museum may show it/);
  assert.match(read({ captionsChecked: '' }), /captions somebody checked/);
  assert.match(read({ transcriptChecked: '' }), /transcript somebody checked/);
  assert.match(read({ durationSeconds: '' }), /length is not known/);
  assert.match(read({ captions: transcript }), /not a \.vtt file/);
  assert.match(read({ film: poster }), /not a \.mp4 file/);
  assert.match(read({ title: 'x'.repeat(200) }), /title is longer/);
});

test('a film taken off the display keeps its record, and its title stops counting as shown', () => {
  const withFilms = people.find((each) => (manifest.assets[each.id]?.videos ?? []).some((video: { approvedForKiosk?: boolean }) => video.approvedForKiosk))!;
  const video = manifest.assets[withFilms.id].videos.find((each: { approvedForKiosk?: boolean }) => each.approvedForKiosk);
  const { decisions, errors } = filmChangeDecisions(filmSheet({ personId: withFilms.id, decision: 'withdraw', filmId: filmIdOf(video) }), { people, manifest, uploadsDir: uploads });
  assert.deepEqual(errors, []);
  const next = applyFilmChanges(manifest, readFilmTitles(), decisions, '2026-10-03T10:00:00.000Z');
  const after = videoHoldingsFrom(next.manifest).get(withFilms.id)!;
  assert.equal(after.length, manifest.assets[withFilms.id].videos.length);
  assert.equal(publishableFilms(after, 'kiosk').length, publishableFilms(manifest.assets[withFilms.id].videos, 'kiosk').length - 1);
  assert.match(filmChangeDecisions(filmSheet({ decision: 'withdraw', filmId: 'nothing-by-this-id' }), { people, manifest, uploadsDir: uploads }).errors.join(' '), /has no film/);
});
