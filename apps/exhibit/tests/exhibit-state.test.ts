import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  exhibitReducer, historyLimit, initialState,
  type ExhibitAction, type ExhibitState,
} from '../src/state/exhibit.ts';

const run = (state: ExhibitState, ...actions: ExhibitAction[]) => actions.reduce(exhibitReducer, state);

test('a record opens over a playing film and closing it leaves the film playing', () => {
  let state = run(initialState(),
    { type: 'play-film', personId: 'alex', filmId: 'alex:1' },
    { type: 'open-record', personId: 'alex' },
  );
  assert.deepEqual(state.media, { kind: 'film', personId: 'alex', filmId: 'alex:1' });
  assert.equal(state.detail.kind, 'record');

  state = exhibitReducer(state, { type: 'close-detail' });
  assert.deepEqual(state.media, { kind: 'film', personId: 'alex', filmId: 'alex:1' },
    'closing a panel must not discard what is playing underneath it');

  state = exhibitReducer(state, { type: 'stop-film' });
  assert.equal(state.media.kind, 'none');
});

test('leaving a lens or a person ends what is playing', () => {
  const playing = run(initialState(), { type: 'play-film', personId: 'alex', filmId: 'alex:1' });
  assert.equal(exhibitReducer(playing, { type: 'lens', lens: 'years' }).media.kind, 'none');
  assert.equal(exhibitReducer(playing, { type: 'select', personId: 'beta' }).media.kind, 'none');
  assert.equal(exhibitReducer(playing, { type: 'clear-selection' }).media.kind, 'none');
  assert.equal(exhibitReducer(playing, { type: 'reset' }).media.kind, 'none');
});

test('a detail panel cannot exist without its subject', () => {
  const state = run(initialState(), { type: 'open-record', personId: 'alex' });
  assert.equal(state.detail.kind, 'record');
  // The type carries the subject, so the blank-screen state is unrepresentable:
  // there is no way to construct { kind: 'record' } with nobody selected.
  assert.equal(state.detail.kind === 'record' && state.detail.personId, 'alex');
  assert.equal(state.selectedId, 'alex', 'opening a record selects that person');
});

test('arranging the wall never chooses or unchooses anybody', () => {
  const state = run(initialState(),
    { type: 'select', personId: 'alex' },
    { type: 'arrange', arrangement: 'community' },
  );
  assert.equal(state.selectedId, 'alex', 'rearranging must not deselect the person being read');
  assert.equal(state.arrangement, 'community');
});

test('a letter belongs to A to Z: arranging another way lets it go', () => {
  let state = run(initialState(), { type: 'letter', letter: 'M' });
  assert.equal(state.letter, 'M');
  state = exhibitReducer(state, { type: 'arrange', arrangement: 'contribution' });
  assert.equal(state.letter, null);
  state = run(state, { type: 'arrange', arrangement: 'name' }, { type: 'letter', letter: 'K' }, { type: 'lens', lens: 'years' });
  assert.equal(state.letter, null, 'leaving the lens lets it go too');
});

test('two people side by side replace one, and one replaces two', () => {
  let state = run(initialState(), { type: 'select', personId: 'alex' }, { type: 'pair', personIds: ['alex', 'beta'] });
  assert.deepEqual(state.pair, ['alex', 'beta']);
  assert.equal(state.selectedId, null, 'a pair is never shown with a single person as well');
  state = exhibitReducer(state, { type: 'select', personId: 'gamma' });
  assert.equal(state.pair, null);
  assert.equal(state.selectedId, 'gamma');
  assert.equal(exhibitReducer(state, { type: 'pair', personIds: ['gamma', 'gamma'] }), state, 'nobody is paired with themselves');
  state = run(state, { type: 'pair', personIds: ['alex', 'beta'] }, { type: 'clear-selection' });
  assert.equal(state.pair, null);
});

test('back restores the previous state and history is bounded', () => {
  let state = run(initialState(),
    { type: 'select', personId: 'alex' },
    { type: 'lens', lens: 'years' },
    { type: 'select', personId: 'beta' },
  );
  state = exhibitReducer(state, { type: 'back' });
  assert.equal(state.selectedId, 'alex');
  assert.equal(state.lens, 'years', 'back restores the whole view, not just the person');

  let deep = initialState();
  for (let index = 0; index < historyLimit + 10; index += 1) {
    deep = exhibitReducer(deep, { type: 'select', personId: `p${index}` });
  }
  assert.equal(deep.history.length, historyLimit);

  const start = initialState();
  assert.equal(exhibitReducer(start, { type: 'back' }), start, 'back at the start returns the same state');
});

test('reset returns every visitor-owned field to its start', () => {
  const busy = run(initialState(),
    { type: 'lens', lens: 'links' },
    { type: 'select', personId: 'alex' },
    { type: 'arrange', arrangement: 'community' },
    { type: 'letter', letter: 'M' },
    { type: 'play-film', personId: 'alex', filmId: 'alex:1' },
    { type: 'open-record', personId: 'alex' },
  );
  assert.deepEqual(exhibitReducer(busy, { type: 'reset' }), initialState());
});

test('an installed display starts on its attract screen and every reset returns there', () => {
  const idle = initialState('attract');
  assert.equal(idle.mode, 'attract');

  const visiting = run(idle,
    { type: 'begin' },
    { type: 'lens', lens: 'years' },
    { type: 'select', personId: 'alex' },
    { type: 'arrange', arrangement: 'contribution' },
  );
  assert.equal(visiting.mode, 'explore');
  assert.deepEqual(exhibitReducer(visiting, { type: 'reset' }), idle);
});

test('touching a face on the attract screen starts on People with that person chosen', () => {
  const state = run(initialState('attract'), { type: 'begin-with', personId: 'alex' });
  assert.equal(state.mode, 'explore');
  assert.equal(state.lens, 'people');
  assert.equal(state.selectedId, 'alex');
  assert.equal(state.history.length, 0, 'a new visit carries nothing from the last');
});

test('going back never returns a visitor to the attract screen', () => {
  const state = run(initialState('attract'), { type: 'begin' }, { type: 'select', personId: 'alex' }, { type: 'back' });
  assert.equal(state.mode, 'explore');
  assert.equal(state.selectedId, null);
});

test('a website has no attract screen', () => {
  const state = initialState();
  assert.equal(state.mode, 'explore');
  assert.equal(exhibitReducer(run(state, { type: 'select', personId: 'alex' }), { type: 'reset' }).mode, 'explore');
});
