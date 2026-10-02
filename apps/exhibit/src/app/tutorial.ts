/**
 * How this works: the steps a visitor is shown round.
 *
 * Built from what this release actually carries, never from a fixed list. A
 * lens the content gate closed, films a target does not carry, a way to take a
 * record away that has no address to go to: none of them gets a step, and no
 * other step mentions them. A step describing something the visitor cannot
 * find is worse than no step.
 *
 * It goes in the order a visit does: the ways in, then choosing somebody and
 * everything their record offers, then each other lens and how to move inside
 * it, then the keys on the bar, then how a visit ends.
 *
 * Each step names the control it is about by a selector, so the tour can
 * point at it when it is on screen; null where there is no one control to
 * point at. A selector that matches nothing leaves the step unlit, never wrong.
 */
export type TutorialStepId =
  | 'welcome' | 'people' | 'arrange' | 'choose' | 'compare' | 'story' | 'films' | 'share'
  | 'years' | 'links' | 'thread' | 'layers' | 'search' | 'tour' | 'theme' | 'finish';

export type TutorialStep = {
  readonly id: TutorialStepId;
  readonly title: string;
  readonly body: string;
  readonly target: string | null;
};

export type TutorialFacts = {
  /** The lenses the navigation offers, as the shell filtered them. */
  readonly lenses: readonly string[];
  readonly people: number;
  /** How many induction classes Years steps through. */
  readonly classes: number;
  /** How many people have at least one film. None at the public target. */
  readonly peopleWithFilms: number;
  readonly places: number;
  readonly tours: number;
  /** Whether a record offers to continue on a visitor's own phone. */
  readonly share: boolean;
  /** An installed display starts over for the next visitor; a website starts over for this one. */
  readonly installed: boolean;
  /** The session's timing as it runs (config.ts, after its floors), so the words match the display. */
  readonly timing: { readonly idleMs: number; readonly warningMs: number };
};

const lensNames: Record<string, string> = { people: 'People', years: 'Years', links: 'Connections' };

export function tutorialSteps(facts: TutorialFacts): TutorialStep[] {
  const years = facts.lenses.includes('years');
  const links = facts.lenses.includes('links');
  const films = facts.peopleWithFilms > 0;
  // The bar shows lens keys only when there is more than one lens to choose between.
  const lensKey = (lens: string) => (facts.lenses.length > 1 ? `.lensbar__lens[data-lens="${lens}"]` : null);
  const ways = facts.lenses.map((lens) => lensNames[lens]).filter((name): name is string => Boolean(name));

  const steps: TutorialStep[] = [{
    id: 'welcome',
    title: 'How to explore the Hall',
    body: (ways.length > 1
      ? `There are ${ways.length} ways in, along the bottom of the screen: ${list(ways)}. This walks you through each of them, and what you can do on the way.`
      : `This walks you through the ${facts.people} people of the Hall, and what you can do on the way.`)
      + ' Next skips ahead to the following step, Back goes back one, Start again comes back here, and Stop closes this guide whenever you like.',
    target: null,
  }, {
    id: 'people',
    title: 'People',
    body: `Every one of the ${facts.people} faces at once. Pinch, or spread two fingers, to zoom in, and drag to look around once you have. A double tap on an empty part of the wall shows the whole of it again.`,
    target: lensKey('people') ?? '.field',
  }, {
    id: 'arrange',
    title: 'Arrange the wall',
    body: 'A to Z, By community and By contribution, under the wall, set the same faces out another way. In A to Z, touch a letter at the side to go straight to the names that start with it.',
    target: '.shell[data-lens="people"] .chips',
  }, {
    id: 'choose',
    title: 'Choose someone',
    body: 'Touch a face, and their card opens: their name, what they were honoured for, and the start of their story. The × on the card closes it and leaves you on the whole wall. Hold a face to see whose it is without choosing them, or pull it down to open their story at once.',
    target: '.field',
  }, {
    id: 'compare',
    title: 'Two at once',
    body: 'Touch two faces at the same moment, a finger on each, to set them side by side and see what they share. Close puts them back.',
    target: '.field',
  }, {
    id: 'story',
    title: 'Their story',
    body: 'Read their story, on their card, opens the whole record: their portrait, who presented them, and their biography in pages. Swipe, or touch ‹ and ›, to turn the pages. Next story moves on to the next face on the wall as it is arranged now. Back to the wall returns you to where you were, with them still chosen.'
      + (links ? ' Where they have documented ties, the number of them takes you to their Connections.' : ''),
    target: '.sheet[data-open] .sheet__story',
  }];

  if (films) {
    steps.push({
      id: 'films',
      title: 'Films',
      body: `${facts.peopleWithFilms} of the ${facts.people} have a film. Watch the film, on their card or their story, plays it. Pause, Back 10 s and the Transcript are on the bar beneath it; where somebody has several films, the list beside it lets you choose. Close film returns you to where you were. While a film plays, the visit does not time out.`,
      target: '.sheet[data-open] .sheet__film',
    });
  }

  if (facts.share) {
    steps.push({
      id: 'share',
      title: 'Take it with you',
      body: 'On a story, Take it with you shows a code. Point a phone camera at it, or type the address beside it, to keep reading about that person on your own phone. Close goes back to the story.',
      target: null,
    });
  }

  if (years) {
    steps.push({
      id: 'years',
      title: 'Years',
      body: `The same faces, one induction class at a time: ${facts.classes} ${facts.classes === 1 ? 'class' : 'classes'}. Touch a year along the bottom to move between them. Touching a face works just as it does on People.`,
      target: lensKey('years'),
    });
  }

  if (links) {
    steps.push({
      id: 'links',
      title: 'Connections',
      body: 'How the people of the Hall are tied to one another, as a map, opening on whoever you had chosen. Choose someone and their card lists their documented ties; touch one to step on to that person, who comes to the middle. Drag to move round the map, and pinch to zoom.',
      target: lensKey('links'),
    }, {
      id: 'thread',
      title: 'Your thread',
      body: 'Each person you step to joins Your thread, along the top of the map. Touch an earlier face there to go back to them. '
        + (facts.installed
          ? 'Save this thread, and it stays under Tour on this display for anyone to follow.'
          : 'Save this thread, and it is kept under Tour on this device.'),
      target: '.trail',
    }, {
      id: 'layers',
      title: 'Kinds of tie',
      body: 'The keys under the map show or hide each kind of tie, and say how many there are.'
        + (facts.places > 0 ? ` Same place shows the ${facts.places} places people share; touch a place to see who is tied to it.` : ''),
      target: '.shell[data-lens="links"] .chips',
    });
  }

  steps.push({
    id: 'search',
    title: 'Search',
    body: (films
      ? 'Find anyone by name, a story by a word in it, a place, or something said in the films.'
      : 'Find anyone by name, a story by a word in it, or a place.')
      + ' Type, or touch one of the starting points under Try. Touch a person to go to them; the others it found stay lit on the wall until you clear them.'
      + (films ? ' Touch a film it found to play it from where the words are said.' : ''),
    target: '.lensbar__search',
  });

  // Without a curated tour or Connections to save a thread in, Tour has nothing to offer yet.
  if (facts.tours > 0 || links) {
    steps.push({
      id: 'tour',
      title: 'Tour',
      body: (facts.tours > 0 && links
        ? 'Be walked through the Hall one person at a time, on a curated tour or a thread someone saved.'
        : facts.tours > 0
          ? 'Be walked through the Hall one person at a time, on a tour the curators chose.'
          : 'Follow a thread someone saved in Connections, one person at a time.')
        + ' On the way, Previous and Next person move along it, and End tour lets you go your own way.'
        + (links ? ' A saved thread can be reordered or deleted with its Edit key.' : ''),
      target: '.lensbar__tour',
    });
  }

  steps.push({
    id: 'theme',
    title: 'Light or dark',
    body: 'This key turns the colours light or dark. '
      + (facts.installed ? 'The display goes back to its own colours for the next visitor.' : 'This device keeps your choice for next time.'),
    target: '.lensbar__theme',
  }, {
    id: 'finish',
    title: 'Start over, or see this again',
    body: 'How this works brings this guide back whenever you want it. '
      + (facts.installed
        ? 'Start over, beneath it, clears your visit for the next person.'
        : 'Start over, beneath it, takes you back to the beginning.')
      + ` If nobody touches the screen for ${duration(facts.timing.idleMs - facts.timing.warningMs)}, it asks whether you are still there, and starts over ${duration(facts.timing.warningMs)} later unless you answer.`,
    target: '.lensbar__help',
  });

  return steps;
}

function list(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/** A length of time as a visitor would say it: "a minute", "20 seconds". */
export function duration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds % 60 === 0) return seconds === 60 ? 'a minute' : `${seconds / 60} minutes`;
  return seconds === 1 ? 'a second' : `${seconds} seconds`;
}
