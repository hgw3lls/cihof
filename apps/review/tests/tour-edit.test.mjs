import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moved, withAdded, withLeftOut, withMove, withPutBack, withWord } from '../src/tour-edit.ts';

const tour = { label: 'T', prompt: 'P', description: 'D', terms: ['refugee'], themes: [], pinnedPersonIds: [], excludedPersonIds: [], maxPortraits: 3 };

test('moving someone puts them, and everyone above them, first in that order; below them the rules still choose', () => {
  // A, B, C, D chosen by the rules; D moved to second place.
  assert.deepEqual(moved(['a', 'b', 'c', 'd'], [], 3, 1), ['a', 'd']);
  // Moving the first down to third keeps the two that now lead it.
  assert.deepEqual(moved(['a', 'b', 'c', 'd'], [], 0, 2), ['b', 'c', 'a']);
  // People already put first stay first, even when the move is above them.
  assert.deepEqual(moved(['a', 'b', 'c', 'd'], ['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
  // Nowhere to go: nothing changes.
  assert.deepEqual(moved(['a', 'b'], ['a'], 1, 1), ['a']);
});

test('a move never lets the length cut off somebody placed by hand', () => {
  assert.equal(withMove(tour, ['a', 'b', 'c'], 0, 2).maxPortraits, 3);
  assert.equal(withMove({ ...tour, maxPortraits: 2 }, ['a', 'b', 'c'], 0, 2).maxPortraits, 3);
});

test('adding someone puts them after the others placed by hand, and takes them off the left-out list', () => {
  const added = withAdded({ ...tour, pinnedPersonIds: ['a'], excludedPersonIds: ['z'] }, 'z');
  assert.deepEqual(added.pinnedPersonIds, ['a', 'z']);
  assert.deepEqual(added.excludedPersonIds, []);
  assert.equal(withAdded({ ...tour, pinnedPersonIds: ['a', 'b', 'c'] }, 'd').maxPortraits, 4);
});

test('leaving someone out is for good, and putting them back lets the rules choose them again', () => {
  const out = withLeftOut({ ...tour, pinnedPersonIds: ['a', 'b'] }, 'a');
  assert.deepEqual(out.pinnedPersonIds, ['b']);
  assert.deepEqual(out.excludedPersonIds, ['a']);
  assert.deepEqual(withLeftOut(out, 'a').excludedPersonIds, ['a']);
  assert.deepEqual(withPutBack(out, 'a').excludedPersonIds, []);
});

test('a word to look for is added once, as typed', () => {
  assert.deepEqual(withWord(['refugee'], '  Citizenship '), ['refugee', 'Citizenship']);
  assert.deepEqual(withWord(['refugee'], 'REFUGEE'), ['refugee']);
  assert.deepEqual(withWord(['refugee'], '  '), ['refugee']);
});
