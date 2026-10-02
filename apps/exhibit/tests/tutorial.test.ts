import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPeople, buildRuntimeBundle } from '@cihof/pipeline';
import { duration, tutorialSteps, type TutorialFacts, type TutorialStepId } from '../src/app/tutorial.ts';
import { inductionClasses } from '../src/state/selectors.ts';
import { normaliseTiming } from '../src/state/session.ts';

// The display's own timing (config.ts's defaults), after the floors the session applies.
const timing = normaliseTiming({ idleMs: 80_000, warningMs: 20_000 }, false);

const everything: TutorialFacts = {
  lenses: ['people', 'years', 'links'], people: 111, classes: 30, peopleWithFilms: 64, places: 13, tours: 6, share: true, installed: true, timing,
};

const ids = (facts: TutorialFacts) => tutorialSteps(facts).map((step) => step.id);
const text = (facts: TutorialFacts) => tutorialSteps(facts).map((step) => `${step.title} ${step.body}`).join('\n');
const step = (facts: TutorialFacts, id: TutorialStepId) => {
  const found = tutorialSteps(facts).find((each) => each.id === id);
  assert.ok(found, `a step for ${id}`);
  return found;
};

test('with everything offered, it goes the way a visit does: the ways in, a person, each lens, the bar, the end', () => {
  assert.deepEqual(ids(everything), [
    'welcome', 'people', 'arrange', 'choose', 'compare', 'story', 'films', 'share',
    'years', 'links', 'thread', 'layers', 'search', 'tour', 'theme', 'finish',
  ]);
});

test('the welcome names each way in, and the three ways on from any step', () => {
  const welcome = step(everything, 'welcome').body;
  assert.match(welcome, /3 ways in.*People, Years and Connections/);
  assert.match(welcome, /Next skips ahead/);
  assert.match(welcome, /Start again/);
  assert.match(welcome, /Stop closes/);
});

test('each lens says what it is for and how to move inside it', () => {
  assert.match(step(everything, 'people').body, /111 faces.*Pinch.*drag.*double tap/s);
  assert.match(step(everything, 'arrange').body, /A to Z, By community and By contribution.*letter/);
  assert.match(step(everything, 'years').body, /30 classes.*Touch a year/);
  assert.match(step(everything, 'links').body, /documented ties.*step on.*Drag.*pinch/s);
  assert.match(step(everything, 'thread').body, /Your thread.*earlier face.*Save this thread/s);
});

test('a person: choosing, comparing, their record, and the ways back to where you were', () => {
  assert.match(step(everything, 'choose').body, /Touch a face.*×.*whole wall.*Hold.*pull it down/s);
  assert.match(step(everything, 'compare').body, /two faces.*side by side.*Close/s);
  const story = step(everything, 'story').body;
  assert.match(story, /Read their story/);
  assert.match(story, /turn the pages/);
  assert.match(story, /Next story/);
  assert.match(story, /Back to the wall returns you to where you were/);
  assert.match(step(everything, 'films').body, /64 of the 111.*Watch the film.*Pause.*Transcript.*Close film returns you/s);
  assert.match(step(everything, 'share').body, /Take it with you.*code.*phone.*Close goes back to the story/s);
});

test('each step points at its control, the lens keys by their lens', () => {
  assert.equal(step(everything, 'people').target, '.lensbar__lens[data-lens="people"]');
  assert.equal(step(everything, 'years').target, '.lensbar__lens[data-lens="years"]');
  assert.equal(step(everything, 'links').target, '.lensbar__lens[data-lens="links"]');
  assert.equal(step(everything, 'search').target, '.lensbar__search');
  assert.equal(step(everything, 'tour').target, '.lensbar__tour');
  assert.equal(step(everything, 'finish').target, '.lensbar__help');
  // With one lens the bar has no lens keys, so People points at the wall itself.
  assert.equal(step({ ...everything, lenses: ['people'] }, 'people').target, '.field');
});

test('a lens the gate closed gets no step and is never mentioned', () => {
  const peopleOnly = { ...everything, lenses: ['people'], tours: 0 };
  assert.deepEqual(ids(peopleOnly), ['welcome', 'people', 'arrange', 'choose', 'compare', 'story', 'films', 'share', 'search', 'theme', 'finish']);
  assert.doesNotMatch(text(peopleOnly), /Connections|Years|induction class|thread|Tour|ways in/);
  assert.doesNotMatch(text({ ...everything, lenses: ['people', 'links'] }), /Years|induction class/);
  const noLinks = text({ ...everything, lenses: ['people', 'years'] });
  assert.doesNotMatch(noLinks, /Connections|thread|ties|map/);
});

test('without films there is no film step, and nothing else promises one', () => {
  const none = { ...everything, peopleWithFilms: 0 };
  assert.ok(!ids(none).includes('films'));
  assert.doesNotMatch(text(none), /film/i);
});

test('Same place is mentioned only when there are places to share', () => {
  assert.match(text(everything), /Same place shows the 13 places/);
  assert.doesNotMatch(text({ ...everything, places: 0 }), /Same place|place to see/);
});

test('Tour is described by what it holds, and left out when it holds nothing', () => {
  assert.match(text({ ...everything, tours: 0 }), /Follow a thread someone saved/);
  assert.match(step(everything, 'tour').body, /Previous and Next person.*End tour/);
  const curatedOnly = step({ ...everything, lenses: ['people', 'years'] }, 'tour').body;
  assert.match(curatedOnly, /a tour the curators chose/);
  assert.doesNotMatch(curatedOnly, /thread|Edit/);
  assert.ok(!ids({ ...everything, lenses: ['people', 'years'], tours: 0 }).includes('tour'));
});

test('taking a story home is offered only where a record offers it', () => {
  assert.match(text(everything), /on your own phone/);
  assert.ok(!ids({ ...everything, share: false }).includes('share'));
  assert.doesNotMatch(text({ ...everything, share: false }), /phone|Take it with you/);
});

test('the display says it starts over for the next visitor; a website does not', () => {
  assert.match(step(everything, 'finish').body, /clears your visit for the next person/);
  assert.match(step(everything, 'theme').body, /next visitor/);
  assert.match(step(everything, 'thread').body, /on this display/);
  const site = { ...everything, installed: false };
  assert.doesNotMatch(text(site), /next (person|visitor)|this display/);
  assert.match(step(site, 'theme').body, /keeps your choice/);
});

test('the end of a visit is told in the session\'s own timing, not a number of its own', () => {
  assert.match(step(everything, 'finish').body, /for a minute, it asks whether you are still there, and starts over 20 seconds later/);
  const other = { ...everything, timing: { idleMs: 150_000, warningMs: 30_000 } };
  assert.match(step(other, 'finish').body, /for 2 minutes,.*30 seconds later/);
  assert.equal(duration(1_000), 'a second');
  assert.equal(duration(90_000), '90 seconds');
});

/**
 * The same, from the bundles the pipeline publishes today. Which lenses clear
 * their gates, and whether a target carries films, are content decisions; this
 * checks the steps follow them rather than restating them.
 */
for (const target of ['public', 'kiosk'] as const) {
  test(`the ${target} release gets steps for what it carries and nothing else`, () => {
    const bundle = buildRuntimeBundle(buildPeople(), target, { preview: false });
    // As the shell offers them: Places is a layer of Connections, never a lens.
    const lenses = bundle.lenses.filter((lens) => lens !== 'places');
    const facts: TutorialFacts = {
      lenses,
      people: bundle.people.length,
      classes: inductionClasses(bundle.people).length,
      peopleWithFilms: bundle.people.filter((person) => person.films.length > 0).length,
      places: bundle.places.length,
      tours: bundle.tours.length,
      share: Boolean(bundle.continuationBase),
      installed: target === 'kiosk',
      timing,
    };
    const steps = ids(facts);
    assert.equal(steps.includes('years'), lenses.includes('years'));
    assert.equal(steps.includes('links'), lenses.includes('links'));
    assert.equal(steps.includes('thread'), lenses.includes('links'));
    assert.equal(steps.includes('films'), facts.peopleWithFilms > 0);
    assert.equal(steps.includes('share'), facts.share);
    assert.ok(!(steps as string[]).includes('places'));
    assert.doesNotMatch(text(facts), /Places\b/, 'Places is never named as a way in');
    if (facts.places === 0) assert.doesNotMatch(text(facts), /Same place/);
    if (target === 'public') {
      assert.ok(!steps.includes('films'), 'the public release carries no films');
      assert.doesNotMatch(text(facts), /film/i);
    } else {
      assert.ok(steps.includes('films'), 'the display carries films');
    }
  });
}
