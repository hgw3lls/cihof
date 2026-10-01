/**
 * How this works: the steps a visitor is shown round.
 *
 * Built from what this release actually carries, never from a fixed list. A
 * lens the content gate closed, films a target does not carry, a way to take a
 * record away that has no address to go to: none of them gets a step. A step
 * describing something the visitor cannot find is worse than no step.
 *
 * Each step names the control it is about by a selector, so the tour can
 * point at it; null where there is no one control to point at.
 */
export type TutorialStep = {
  readonly id: 'wall' | 'years' | 'links' | 'search' | 'films' | 'tour' | 'finish';
  readonly title: string;
  readonly body: string;
  readonly target: string | null;
};

export type TutorialFacts = {
  /** The lenses the navigation offers, as the shell filtered them. */
  readonly lenses: readonly string[];
  readonly people: number;
  /** How many people have at least one film. None at the public target. */
  readonly peopleWithFilms: number;
  readonly places: number;
  readonly tours: number;
  /** Whether a record offers to continue on a visitor's own phone. */
  readonly share: boolean;
  /** An installed display starts over for the next visitor; a website starts over for this one. */
  readonly installed: boolean;
};

export function tutorialSteps(facts: TutorialFacts): TutorialStep[] {
  const links = facts.lenses.includes('links');
  const steps: TutorialStep[] = [{
    id: 'wall',
    title: `${facts.people} faces, one wall`,
    body: 'Touch a face to see who they are, then Read their story for the rest.'
      + (facts.share ? ' A story can go home with you on your phone.' : '')
      + ' Pinch to zoom. Pull a face down to open it straight away, or touch two faces at once to compare them.',
    target: '.field',
  }];

  if (facts.lenses.includes('years')) {
    steps.push({
      id: 'years',
      title: 'Years',
      body: 'The same faces, one induction class at a time. Touch a year along the bottom to move between them.',
      target: '.lensbar__lens[data-lens="years"]',
    });
  }

  if (links) {
    steps.push({
      id: 'links',
      title: 'Connections',
      body: 'Follow the documented ties from one person to the next. Your path is kept along the top; save it, and it becomes a thread anyone can follow.'
        + (facts.places > 0 ? ' Turn on Same place to see the places people share.' : ''),
      target: '.lensbar__lens[data-lens="links"]',
    });
  }

  steps.push({
    id: 'search',
    title: 'Search',
    body: facts.peopleWithFilms > 0
      ? 'Find anyone by name, a story by a word in it, a place, or something said in the films.'
      : 'Find anyone by name, a story by a word in it, or a place.',
    target: '.lensbar__search',
  });

  if (facts.peopleWithFilms > 0) {
    steps.push({
      id: 'films',
      title: 'Films',
      body: `${facts.peopleWithFilms} of the ${facts.people} have a film. When you choose one of them, Watch the film appears above their name.`,
      target: null,
    });
  }

  // Without a curated tour or Connections to save a thread in, Tour has nothing to offer yet.
  if (facts.tours > 0 || links) {
    steps.push({
      id: 'tour',
      title: 'Tour',
      body: facts.tours > 0 && links
        ? 'Be walked through the Hall one person at a time, on a curated tour or a thread someone saved.'
        : facts.tours > 0
          ? 'Be walked through the Hall one person at a time, on a tour the curators chose.'
          : 'Follow a thread someone saved in Connections, one person at a time.',
      target: '.lensbar__tour',
    });
  }

  steps.push({
    id: 'finish',
    title: 'Start over, or see this again',
    body: 'How this works brings this back whenever you want it. '
      + (facts.installed
        ? 'Start over, next to it, clears your visit for the next person; the display also does that by itself when left alone.'
        : 'Start over, next to it, takes you back to the beginning.'),
    target: '.lensbar__help',
  });

  return steps;
}
