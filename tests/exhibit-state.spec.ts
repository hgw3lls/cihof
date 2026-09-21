import { expect, test } from '@playwright/test';
import type { Inductee } from '../src/data/types';
import {
  createDefaultExhibitState,
  createInitialExhibitState,
  exhibitHistoryLimit,
  exhibitReducer,
  filterPeopleForExhibit,
  parseExhibitUrl,
  serializeExhibitUrl,
  type ExhibitState,
} from '../src/features/archive-exhibit/state/exhibitState';

function person(id: string, name: string, year: number | null, communities: string[], contributions: string[]) {
  return {
    id,
    name,
    sortName: name,
    pronunciation: '',
    classYear: year,
    communityTags: communities,
    communityTagsSource: 'curated',
    themeTags: contributions,
    themeTagsSource: 'curated',
    countryTags: [],
    countryTagsSource: 'curated',
  } as Inductee;
}

function reduce(state: ExhibitState, ...actions: Parameters<typeof exhibitReducer>[1][]) {
  return actions.reduce(exhibitReducer, state);
}

test('legacy aliases and versioned activity URLs remain unambiguous', () => {
  expect(parseExhibitUrl('?scene=years&timeMode=activity')).toMatchObject({
    lens: 'years',
    time: { mode: 'induction', from: null, to: null },
  });
  expect(parseExhibitUrl('?scene=timeline&v=1&timeMode=activity&from=1965&to=1960')).toMatchObject({
    lens: 'years',
    time: { mode: 'activity', from: 1960, to: 1965 },
  });
  expect(parseExhibitUrl('?scene=world')).toMatchObject({ lens: 'links' });
  expect(parseExhibitUrl('?scene=places')).toMatchObject({ lens: 'places' });
  expect(parseExhibitUrl('?person=%3Cscript%3E&v=1&compare=valid-person,%3Cbad%3E')).toMatchObject({
    selectedPersonId: '',
    comparePersonIds: ['valid-person'],
  });
});

test('facets use union within a dimension and intersection across dimensions', () => {
  const people = [
    person('alpha', 'Alpha Person', 2010, ['A'], ['Press']),
    person('beta', 'Beta Person', 2011, ['B'], ['Press']),
    person('gamma', 'Gamma Person', null, ['A'], ['Service']),
  ];
  const state = createDefaultExhibitState();
  state.facets.communityIds = ['A', 'B'];
  state.facets.contributionIds = ['Press'];
  expect(filterPeopleForExhibit(people, state).map((item) => item.id)).toEqual(['alpha', 'beta']);

  state.facets.inductionYears = ['2010'];
  expect(filterPeopleForExhibit(people, state).map((item) => item.id)).toEqual(['alpha']);

  state.facets.inductionYears = [];
  state.facets.contributionIds = [];
  state.facets.placeIds = ['place:one', 'place:two'];
  const placePeople = new Map([
    ['place:one', new Set(['alpha'])],
    ['place:two', new Set(['gamma'])],
  ]);
  expect(filterPeopleForExhibit(people, state, placePeople).map((item) => item.id)).toEqual(['alpha', 'gamma']);
});

test('grouping and discovery do not silently clear a selected person', () => {
  const state = reduce(
    createInitialExhibitState(),
    { type: 'select-person', personId: 'alpha' },
    { type: 'set-grouping', grouping: 'community' },
    { type: 'set-facet', dimension: 'communityIds', values: ['B'] },
  );
  expect(state.selectedPersonId).toBe('alpha');
  expect(state.grouping).toBe('community');
  expect(state.facets.communityIds).toEqual(['B']);
});

test('history restores full state and offers a prior-person transition', () => {
  let state = reduce(
    createInitialExhibitState(),
    { type: 'capture-viewport', lens: 'people', viewport: { scrollTop: 420, scrollLeft: 0, focusId: 'person-alpha' } },
    { type: 'select-person', personId: 'alpha' },
    { type: 'set-facet', dimension: 'communityIds', values: ['A'] },
    { type: 'set-lens', lens: 'years' },
    { type: 'capture-viewport', lens: 'years', viewport: { scrollTop: 0, scrollLeft: 640, focusId: 'year-alpha' } },
    { type: 'select-person', personId: 'beta' },
  );

  state = exhibitReducer(state, { type: 'back-selection' });
  expect(state).toMatchObject({
    lens: 'years',
    selectedPersonId: 'alpha',
    facets: { communityIds: ['A'] },
    viewports: { years: { scrollLeft: 640, focusId: 'year-alpha' } },
  });

  state = exhibitReducer(state, { type: 'back' });
  expect(state).toMatchObject({ lens: 'people', selectedPersonId: 'alpha', facets: { communityIds: ['A'] } });
  expect(state.viewports.people).toEqual({ scrollTop: 420, scrollLeft: 0, focusId: 'person-alpha' });
});

test('history is bounded and reset clears every visitor-owned field', () => {
  let state = createInitialExhibitState();
  for (let index = 0; index < exhibitHistoryLimit + 10; index += 1) {
    state = exhibitReducer(state, { type: 'set-query', query: `query-${index}` });
  }
  expect(state.history).toHaveLength(exhibitHistoryLimit);

  state = reduce(
    state,
    { type: 'set-lens', lens: 'places' },
    { type: 'set-comparison', personIds: ['alpha', 'beta'] },
    { type: 'set-place', placeId: 'place:one' },
    { type: 'set-time-mode', mode: 'activity' },
    { type: 'set-time-range', from: 1950, to: 1970 },
    { type: 'open-detail', detail: { kind: 'comparison' } },
  );
  const reset = exhibitReducer(state, { type: 'reset' });
  expect(reset).toMatchObject(createDefaultExhibitState());
  expect(reset.history).toEqual([]);
  // serializeExhibitUrl preserves whatever is already in the URL. Scrubbing the
  // staff admin flag is the controller's reset, which rewrites the URL first.
  expect(serializeExhibitUrl(reset, '?kiosk=1&reach=1&admin=1&ignored=1')).toBe('kiosk=1&reach=1&admin=1');
  expect(serializeExhibitUrl(reset, '?kiosk=1&reach=1&ignored=1')).toBe('kiosk=1&reach=1');
});

test('structured URLs round-trip stable visitor state', () => {
  const state = createDefaultExhibitState();
  state.lens = 'years';
  state.selectedPersonId = 'alpha';
  state.query = 'service';
  state.facets.communityIds = ['Community A'];
  state.comparePersonIds = ['alpha', 'beta'];
  state.time = { mode: 'activity', from: 1960, to: 1980 };
  state.detail = { kind: 'comparison' };
  const serialized = serializeExhibitUrl(state, '?kiosk=1');
  expect(parseExhibitUrl(`?${serialized}`)).toMatchObject(state);
});

test('a record opens over an active film and closing it returns to that film', () => {
  let state = reduce(
    createInitialExhibitState(),
    { type: 'select-person', personId: 'alpha', media: { kind: 'film', id: 'alpha:1' } },
    { type: 'open-detail', detail: { kind: 'record' } },
  );
  expect(state.detail).toEqual({ kind: 'record' });
  expect(state.media).toEqual({ kind: 'film', id: 'alpha:1' });

  state = exhibitReducer(state, { type: 'set-detail', detail: { kind: 'none' } });
  expect(state.media).toEqual({ kind: 'film', id: 'alpha:1' });

  state = exhibitReducer(state, { type: 'select-person', personId: 'beta', detail: { kind: 'record' } });
  expect(state.media).toEqual({ kind: 'none' });
});

test('changing lens, clearing a selection or resetting stops an active film', () => {
  const playing = reduce(
    createInitialExhibitState(),
    { type: 'select-person', personId: 'alpha', media: { kind: 'film', id: 'alpha:1' } },
  );
  expect(exhibitReducer(playing, { type: 'set-lens', lens: 'people' }).media).toEqual({ kind: 'none' });
  expect(exhibitReducer(playing, { type: 'clear-selection' }).media).toEqual({ kind: 'none' });
  expect(exhibitReducer(playing, { type: 'reset' }).media).toEqual({ kind: 'none' });
});

test('a facet does not claim a person whose tags were never curated or documented', () => {
  const curated = person('alpha', 'Alpha Person', 2010, ['A'], ['Press']);
  const inferred = {
    ...person('beta', 'Beta Person', 2011, ['A'], ['Press']),
    communityTagsSource: 'inferred',
    themeTagsSource: 'inferred',
  } as Inductee;

  const state = createDefaultExhibitState();
  state.facets.communityIds = ['A'];
  expect(filterPeopleForExhibit([curated, inferred], state).map((item) => item.id)).toEqual(['alpha']);

  state.facets.communityIds = [];
  state.facets.contributionIds = ['Press'];
  expect(filterPeopleForExhibit([curated, inferred], state).map((item) => item.id)).toEqual(['alpha']);

  state.facets.contributionIds = [];
  expect(filterPeopleForExhibit([curated, inferred], state).map((item) => item.id)).toEqual(['alpha', 'beta']);
});

test('a person-scoped detail cannot open without its subject', () => {
  expect(parseExhibitUrl('?v=1&detail=record')).toMatchObject({ selectedPersonId: '', detail: { kind: 'none' } });
  expect(parseExhibitUrl('?v=1&detail=record&person=alpha')).toMatchObject({ detail: { kind: 'record' } });
  expect(parseExhibitUrl('?v=1&detail=comparison')).toMatchObject({ detail: { kind: 'none' } });
  expect(parseExhibitUrl('?v=1&detail=comparison&compare=alpha,beta')).toMatchObject({ detail: { kind: 'comparison' } });
});
