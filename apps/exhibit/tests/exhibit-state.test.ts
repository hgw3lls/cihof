import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  exhibitReducer, hasDiscovery, historyLimit, initialState, maxQueryLength,
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

test('discovery is held apart from selection and never clears it', () => {
  const state = run(initialState(),
    { type: 'select', personId: 'alex' },
    { type: 'query', query: 'weld' },
    { type: 'facet', dimension: 'communities', value: 'Serbian' },
    { type: 'year', year: 2010 },
  );
  assert.equal(state.selectedId, 'alex', 'filtering must not deselect the person being read');
  assert.equal(hasDiscovery(state.discovery), true);
  assert.deepEqual(state.discovery.communities, ['Serbian']);
  assert.deepEqual(state.discovery.years, [2010]);

  const cleared = exhibitReducer(state, { type: 'clear-discovery' });
  assert.equal(hasDiscovery(cleared.discovery), false);
  assert.equal(cleared.selectedId, 'alex');
});

test('facets toggle and years stay ordered', () => {
  let state = run(initialState(),
    { type: 'facet', dimension: 'contributions', value: 'Press' },
    { type: 'facet', dimension: 'contributions', value: 'Service' },
  );
  assert.deepEqual(state.discovery.contributions, ['Press', 'Service']);
  state = exhibitReducer(state, { type: 'facet', dimension: 'contributions', value: 'Press' });
  assert.deepEqual(state.discovery.contributions, ['Service'], 'selecting a set facet again removes it');

  state = run(state, { type: 'year', year: 2015 }, { type: 'year', year: 2010 });
  assert.deepEqual(state.discovery.years, [2010, 2015]);
});

test('an over-long query is truncated rather than carried', () => {
  const state = exhibitReducer(initialState(), { type: 'query', query: 'x'.repeat(500) });
  assert.equal(state.discovery.query.length, maxQueryLength);
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
    deep = exhibitReducer(deep, { type: 'query', query: `q${index}` });
  }
  assert.equal(deep.history.length, historyLimit);

  const start = initialState();
  assert.equal(exhibitReducer(start, { type: 'back' }), start, 'back at the start returns the same state');
});

test('reset returns every visitor-owned field to its start', () => {
  const busy = run(initialState(),
    { type: 'lens', lens: 'links' },
    { type: 'select', personId: 'alex' },
    { type: 'query', query: 'weld' },
    { type: 'facet', dimension: 'communities', value: 'Serbian' },
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
    { type: 'query', query: 'weld' },
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
