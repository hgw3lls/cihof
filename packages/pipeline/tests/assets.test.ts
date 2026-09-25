import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { displayablePortrait } from '@cihof/content';
import { buildPeople } from '../src/build/people.ts';
import { publishFilms, publishPortraits, visitorTranscript } from '../src/build/assets.ts';
import { buildRuntimeBundle } from '../src/build/emit.ts';

test('publishing portraits does not delete anything else in the target', () => {
  const target = mkdtempSync(join(tmpdir(), 'cihof-assets-'));
  mkdirSync(join(target, 'data'), { recursive: true });
  writeFileSync(join(target, 'data', 'exhibit.json'), '{"kept":true}');

  const result = publishPortraits(buildPeople(), target);

  assert.equal(existsSync(join(target, 'data', 'exhibit.json')), true,
    'a sibling published into the same directory must survive');
  assert.equal(readFileSync(join(target, 'data', 'exhibit.json'), 'utf8'), '{"kept":true}');
  assert.equal(result.copied, buildPeople().filter((person) => displayablePortrait(person.portrait)).length,
    'one per portrait whose rights are approved');
  assert.equal(existsSync(join(target, 'media', 'images', 'alex-machaskee-2010', 'primary.png')), true);
});

test('a public bundle is refused before a single film file is staged', () => {
  const target = mkdtempSync(join(tmpdir(), 'cihof-films-'));
  const bundle = buildRuntimeBundle(buildPeople(), 'public');

  assert.throws(() => publishFilms(bundle, target), /kiosk only/);
  assert.equal(existsSync(join(target, 'media')), false);
});

test('a kiosk build stages every published film, with its words, beside the portraits', () => {
  const target = mkdtempSync(join(tmpdir(), 'cihof-films-'));
  const people = buildPeople();
  const bundle = buildRuntimeBundle(people, 'kiosk', { filmDelivery: 'local-file' });
  const films = bundle.people.flatMap((person) => person.films);

  publishPortraits(people, target);
  const result = publishFilms(bundle, target);

  assert.equal(result.films, films.length);
  assert.ok(films.length > 0, 'the kiosk publishes films today');
  for (const film of films) {
    for (const src of [film.poster, film.captions, film.transcript]) {
      assert.equal(existsSync(join(target, src)), true, `${src} is staged`);
    }
  }
  // The MP4s are not in the repository, so how many are here depends on the
  // machine. Every film is either staged or counted, never silently dropped.
  const staged = films.filter((film) => film.source.kind === 'local-file' && existsSync(join(target, film.source.src)));
  assert.equal(staged.length + result.videosMissing, films.length);
  assert.equal(existsSync(join(target, 'media', 'images', 'alex-machaskee-2010', 'primary.png')), true,
    'staging films leaves the portraits in place');
});

test('a staged transcript leaves out the generator\'s note to staff, and nothing else', () => {
  const target = mkdtempSync(join(tmpdir(), 'cihof-films-'));
  const bundle = buildRuntimeBundle(buildPeople(), 'kiosk', { filmDelivery: 'local-file' });
  publishFilms(bundle, target);
  for (const film of bundle.people.flatMap((person) => person.films)) {
    const source = readFileSync(join(import.meta.dirname, '../../..', film.transcript.replace(/^\//, 'public/')), 'utf8');
    const staged = readFileSync(join(target, film.transcript), 'utf8');
    assert.doesNotMatch(staged, /Draft transcript generated|Review required before kiosk approval/, `${film.transcript} reaches a visitor clean`);
    assert.ok(source.endsWith(staged), 'the words themselves are unchanged');
    assert.ok(staged.trim().length > 0, 'a transcript is never emptied');
  }
});

test('a transcript with no note passes through exactly', () => {
  assert.equal(visitorTranscript('What was said.\n'), 'What was said.\n');
  assert.equal(
    visitorTranscript('Draft transcript generated from x.vtt.\nGenerated: 2026-09-14T00:00:00Z.\nReview required before kiosk approval.\n\nWhat was said.\n'),
    'What was said.\n',
  );
  // Only a note at the very start is the generator's; the same words later are somebody's.
  const quoted = 'She said: Review required before kiosk approval.\n';
  assert.equal(visitorTranscript(quoted), quoted);
});
