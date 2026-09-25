import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPeople } from '../src/build/people.ts';
import { buildRuntimeBundle } from '../src/build/emit.ts';
import {
  applyFilmStartDecisions, approvedFilmStart, filmStartDecisions, filmStartVersion, nameTerms, parseClock,
  readCues, sharedFilms, suggestStart, suggestStarts, type Cue,
} from '../src/build/film-starts.ts';
import { readVideoHoldings } from '../src/sources/media.ts';

/**
 * A ceremony film opens at the part for the person a visitor chose, once a
 * curator approves where that is. A suggestion from the captions is only
 * ever a suggestion.
 */

const at = (minutes: number, words: string): Cue => ({ t: Math.round(minutes * 60), words });
const ceremony: Cue[] = [
  at(1, 'tonight we honor Ada Lovelace and Grace Hopper'),
  at(20, 'our first inductee tonight is'),
  at(20.1, 'Ada Lovelace'),
  at(21, 'Lovelace changed everything'),
  at(22, 'thank you Ada'),
  at(40, 'our next inductee is someone who'),
  at(40.2, 'is known to all of us, Grays Hoper'),
  at(60, 'thank you all, and goodnight Ada and everyone'),
];

test('rolled captions are read once each, without their timing tags', () => {
  const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello<00:00:01.500><c> there</c>\n\n00:00:02.000 --> 00:00:03.000\nHello there\nand welcome\n';
  assert.deepEqual(readCues(vtt), [{ t: 1, words: 'Hello there' }, { t: 2, words: 'and welcome' }]);
});

test('a name is looked for by given and family name, without titles', () => {
  assert.deepEqual(nameTerms('Ambassador Edward F. Crawford'), ['Edward', 'Crawford']);
  assert.deepEqual(nameTerms('Dr. Eugene Jordan'), ['Eugene', 'Jordan']);
  assert.deepEqual(nameTerms('Helen Karpinski (1899 – 2002)'), ['Helen', 'Karpinski']);
});

test('a suggestion starts at the announcement before the stretch that names the person', () => {
  const suggestion = suggestStart(ceremony, 'Ada Lovelace', 3900);
  assert.equal(suggestion?.seconds, 20 * 60 - 2);
  assert.match(suggestion?.reason ?? '', /our first inductee tonight is/);
  assert.ok(suggestion?.context.some((cue) => cue.words === 'Ada Lovelace'), 'what is said there comes with it');
});

test('the opening roll call and the closing thanks are not mistaken for a person\'s part', () => {
  const onlyRollCall = [at(1, 'we honor Ada Lovelace'), at(64, 'goodnight Ada')];
  assert.equal(suggestStart(onlyRollCall, 'Ada Lovelace', 3900), null);
});

test('a misheard name gets the one introduction nobody else was matched to, and says so', () => {
  const suggestions = suggestStarts(ceremony, [{ id: 'ada', name: 'Ada Lovelace' }, { id: 'grace', name: 'Grace Hopper' }], 3900);
  assert.equal(suggestions.get('ada')?.seconds, 20 * 60 - 2);
  assert.equal(suggestions.get('grace')?.seconds, 40 * 60 - 2);
  assert.match(suggestions.get('grace')?.reason ?? '', /never say this name clearly/);
});

test('times are read as a reviewer types them', () => {
  assert.equal(parseClock('1:17:42'), 4662);
  assert.equal(parseClock('40:04'), 2404);
  assert.equal(parseClock('90'), 90);
  assert.equal(parseClock('1:77'), null);
  assert.equal(parseClock('soon'), null);
});

test('only a start approved for exactly that second, inside the film, is used', () => {
  const approved = (seconds: number, contentVersion = filmStartVersion('F', seconds)) => ({
    starts: { 'p|F': { startSeconds: seconds, review: { status: 'approved', decisionReference: 'ref', contentVersion } } },
  });
  assert.equal(approvedFilmStart(approved(120), 'p', 'F', 600), 120);
  assert.equal(approvedFilmStart(approved(120, filmStartVersion('F', 90)), 'p', 'F', 600), null, 'approved for another second');
  assert.equal(approvedFilmStart(approved(700), 'p', 'F', 600), null, 'past the end');
  assert.equal(approvedFilmStart({ starts: { 'p|F': { startSeconds: 120, review: { status: 'needs-review' } } } }, 'p', 'F', 600), null);
  assert.equal(approvedFilmStart(approved(120), 'q', 'F', 600), null, 'somebody else');
});

test('the one shared film today is the 2024 ceremony, standing for six people', () => {
  const shared = sharedFilms(readVideoHoldings());
  assert.deepEqual(shared.map((film) => [film.filmId, film.people.length]), [['P34omi5XUiY', 6]]);
});

test('a start sheet is refused for a film the person does not share, a bad time, or no reference', () => {
  const shared = sharedFilms(readVideoHoldings());
  const sheet = [
    'personId,filmId,decision,startSeconds,decisionReference,note',
    'dona-brady-2024,P34omi5XUiY,start,40:04,film-starts-review-2026-09-26,',
    'raj-aggarwal-2025,DoZUzteeFMU,start,10,ref,',
    'johnny-k-wu-2024,P34omi5XUiY,start,3:00:00,ref,',
    'erika-puussaar-2024,P34omi5XUiY,start,1:17:42,,',
    'veronica-dahlberg-2024,P34omi5XUiY,beginning,,ref,',
  ].join('\n');
  const { decisions, errors } = filmStartDecisions(sheet, shared);
  assert.deepEqual(decisions.map((decision) => [decision.personId, decision.startSeconds]), [['dona-brady-2024', 2404], ['veronica-dahlberg-2024', null]]);
  assert.equal(errors.length, 3);
});

test('an approved start opens the film there, on both kinds of player; "from the beginning" removes it', () => {
  const stored = applyFilmStartDecisions({ starts: {} }, [
    { personId: 'dona-brady-2024', filmId: 'P34omi5XUiY', startSeconds: 2404, decisionReference: 'ref', note: '' },
  ], '2026-09-26T00:00:00Z');
  const people = buildPeople();
  const filmOf = (bundle: ReturnType<typeof buildRuntimeBundle>, id: string) => bundle.people.find((person) => person.id === id)?.films[0];

  const local = buildRuntimeBundle(people, 'kiosk', { filmDelivery: 'local-file', filmStarts: stored });
  assert.equal(filmOf(local, 'dona-brady-2024')?.startSeconds, 2404);
  assert.equal(filmOf(local, 'johnny-k-wu-2024')?.startSeconds, undefined, 'only the person it was approved for');

  const embedded = buildRuntimeBundle(people, 'kiosk', { filmDelivery: 'youtube', filmStarts: stored });
  const source = filmOf(embedded, 'dona-brady-2024')?.source;
  assert.ok(source?.kind === 'youtube' && source.embedUrl.endsWith('?start=2404'));

  const cleared = applyFilmStartDecisions(stored, [
    { personId: 'dona-brady-2024', filmId: 'P34omi5XUiY', startSeconds: null, decisionReference: 'ref', note: '' },
  ], '2026-09-26T00:00:00Z');
  assert.deepEqual(cleared.starts, {});
});
