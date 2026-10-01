import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPeople, buildRuntimeBundle } from '@cihof/pipeline';
import { tutorialSteps, type TutorialFacts } from '../src/app/tutorial.ts';

const everything: TutorialFacts = {
  lenses: ['people', 'years', 'links'], people: 111, peopleWithFilms: 80, places: 13, tours: 2, share: true, installed: true,
};

const ids = (facts: TutorialFacts) => tutorialSteps(facts).map((step) => step.id);
const text = (facts: TutorialFacts) => tutorialSteps(facts).map((step) => `${step.title} ${step.body}`).join('\n');

test('with everything offered, every control gets a step, in the order of the bar', () => {
  assert.deepEqual(ids(everything), ['wall', 'years', 'links', 'search', 'films', 'tour', 'finish']);
});

test('a lens the gate closed gets no step and is never mentioned', () => {
  const peopleOnly = { ...everything, lenses: ['people'], tours: 0 };
  assert.deepEqual(ids(peopleOnly), ['wall', 'search', 'films', 'finish']);
  assert.doesNotMatch(text(peopleOnly), /Connections|Years|thread|Tour/);
});

test('without films there is no film step, and search does not promise the films\' words', () => {
  const none = { ...everything, peopleWithFilms: 0 };
  assert.ok(!ids(none).includes('films'));
  assert.doesNotMatch(text(none), /film/i);
});

test('Same place is mentioned only when there are places to share', () => {
  assert.match(text(everything), /Same place/);
  assert.doesNotMatch(text({ ...everything, places: 0 }), /Same place/);
});

test('Tour is described by what it holds, and left out when it holds nothing', () => {
  assert.match(text({ ...everything, tours: 0 }), /Follow a thread someone saved/);
  assert.match(text({ ...everything, lenses: ['people', 'years'] }), /a tour the curators chose/);
  assert.ok(!ids({ ...everything, lenses: ['people', 'years'], tours: 0 }).includes('tour'));
});

test('taking a story home is offered only where a record offers it', () => {
  assert.match(text(everything), /on your phone/);
  assert.doesNotMatch(text({ ...everything, share: false }), /phone/);
});

test('the display says it starts over by itself; a website does not', () => {
  assert.match(text(everything), /by itself when left alone/);
  assert.doesNotMatch(text({ ...everything, installed: false }), /left alone/);
});

/**
 * The same, from the bundles the pipeline publishes today. Which lenses clear
 * their gates, and whether a target carries films, are content decisions; this
 * checks the steps follow them rather than restating them.
 */
for (const target of ['public', 'kiosk'] as const) {
  test(`the ${target} release gets steps for what it carries and nothing else`, () => {
    const bundle = buildRuntimeBundle(buildPeople(), target, { preview: false });
    const facts: TutorialFacts = {
      lenses: bundle.lenses,
      people: bundle.people.length,
      peopleWithFilms: bundle.people.filter((person) => person.films.length > 0).length,
      places: bundle.places.length,
      tours: bundle.tours.length,
      share: Boolean(bundle.continuationBase),
      installed: target === 'kiosk',
    };
    const steps = ids(facts);
    assert.equal(steps.includes('years'), bundle.lenses.includes('years'));
    assert.equal(steps.includes('links'), bundle.lenses.includes('links'));
    assert.equal(steps.includes('films'), facts.peopleWithFilms > 0);
    // Places is a layer of Connections in this app, never a lens of its own.
    assert.ok(!(steps as string[]).includes('places'));
    if (target === 'public') assert.ok(!steps.includes('films'), 'the public release carries no films');
  });
}
