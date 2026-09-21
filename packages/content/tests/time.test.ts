import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  describeTimespan, matchesWindow, partitionByWindow, spanYears, startYearOrNull, undated,
  type Timespan,
} from '../src/index.ts';

test('an undated record is not a record outside the window', () => {
  // The distinction the whole time control rests on. With 111 people carrying
  // one date each, treating 'unknown' as 'outside' would assert that most of
  // the collection was absent from every decade.
  assert.equal(matchesWindow(undated, 1970, 1979), 'undated');
  assert.equal(matchesWindow({ precision: 'year', start: '1965' }, 1970, 1979), 'outside');
  assert.notEqual(matchesWindow(undated, 1970, 1979), matchesWindow({ precision: 'year', start: '1965' }, 1970, 1979));
});

test('a decade covers its ten years and a year covers one', () => {
  assert.deepEqual(spanYears({ precision: 'decade', start: '1970' }), [1970, 1979]);
  assert.deepEqual(spanYears({ precision: 'year', start: '1971' }), [1971, 1971]);
  assert.equal(matchesWindow({ precision: 'decade', start: '1970' }, 1978, 1978), 'inside');
  assert.equal(matchesWindow({ precision: 'year', start: '1970' }, 1978, 1978), 'outside');
});

test('a span overlapping the window at either edge is inside it', () => {
  const span: Timespan = { precision: 'range', start: '1968', end: '1974' };
  assert.equal(matchesWindow(span, 1970, 1979), 'inside', 'overlaps the start');
  assert.equal(matchesWindow(span, 1960, 1968), 'inside', 'touches the far edge');
  assert.equal(matchesWindow(span, 1975, 1979), 'outside');
});

test('a reversed window is read as the same window', () => {
  assert.equal(matchesWindow({ precision: 'year', start: '1971' }, 1979, 1970), 'inside');
});

test('partitioning keeps the undated visible to the caller', () => {
  const records = [
    { id: 'a', when: { precision: 'year', start: '1971' } as Timespan },
    { id: 'b', when: { precision: 'year', start: '1999' } as Timespan },
    { id: 'c', when: undefined },
  ];
  const split = partitionByWindow(records, (record) => record.when, 1970, 1979);
  assert.deepEqual(split.inside.map((r) => r.id), ['a']);
  assert.deepEqual(split.outside.map((r) => r.id), ['b']);
  assert.deepEqual(split.undated.map((r) => r.id), ['c']);
  assert.equal(split.inside.length + split.outside.length + split.undated.length, records.length,
    'nothing may be dropped on the floor');
});

test('a date describes itself in the source wording where there is any', () => {
  assert.equal(describeTimespan({ precision: 'decade', start: '1970', label: 'the early 1970s' }), 'the early 1970s');
  assert.equal(describeTimespan({ precision: 'decade', start: '1970' }), 'the 1970s');
  assert.equal(describeTimespan({ precision: 'year', start: '1971', approximate: true }), 'about 1971');
  assert.equal(describeTimespan({ precision: 'range', start: '1968', end: '1974' }), '1968–1974');
  assert.equal(describeTimespan(undated), null, 'an unknown date says nothing rather than guessing');
});

test('a malformed date is unknown rather than year zero', () => {
  assert.equal(spanYears({ precision: 'year', start: 'sometime' }), null);
  assert.equal(startYearOrNull({ precision: 'year', start: 'sometime' }), null);
  assert.equal(matchesWindow({ precision: 'year', start: '' }, 1970, 1979), 'undated');
});
