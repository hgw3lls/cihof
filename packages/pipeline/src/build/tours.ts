import { readFileSync } from 'node:fs';
import { dataFile } from '../paths.ts';

/**
 * Curated tours: a theme a curator names ("Newcomer Support") and the people
 * it walks a visitor through, one at a time.
 *
 * A tour is visitor text like any other. It reaches a display only once a
 * curator has approved it (`reviewStatus: "approved"` in
 * data/cihof_story_lenses.json); an editor's preview also shows the drafts,
 * each marked. Its people are chosen here, at build time, from the published
 * biographies and honours by the terms and themes the curator set, with the
 * people they pinned first and the people they excluded left out, so every
 * display of a release walks the same tour.
 */
export type RuntimeTour = {
  readonly id: string;
  readonly label: string;
  readonly prompt: string;
  readonly description: string;
  /** In the order the tour visits them. */
  readonly personIds: readonly string[];
  /** Only in an editor's preview: shown although nobody has approved it. */
  readonly unreviewed?: true;
};

type StoredLens = {
  readonly id?: unknown;
  readonly label?: unknown;
  readonly prompt?: unknown;
  readonly description?: unknown;
  readonly terms?: unknown;
  readonly themes?: unknown;
  readonly pinnedPersonIds?: unknown;
  readonly excludedPersonIds?: unknown;
  readonly reviewStatus?: unknown;
  readonly maxPortraits?: unknown;
  readonly enabled?: unknown;
};

export type StoredTours = { readonly lenses?: readonly StoredLens[] };

type TourPerson = {
  readonly id: string;
  readonly sortName: string;
  readonly biography: string;
  readonly contributions: readonly string[];
};

export function readTours(): StoredTours {
  return JSON.parse(readFileSync(dataFile('cihof_story_lenses.json'), 'utf8')) as StoredTours;
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((each): each is string => typeof each === 'string') : []);
const fold = (value: string) => value.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').trim();

export function publishedTours(
  people: readonly TourPerson[],
  { preview = false, stored = readTours() }: { preview?: boolean; stored?: StoredTours } = {},
): RuntimeTour[] {
  const tours: RuntimeTour[] = [];
  for (const lens of stored.lenses ?? []) {
    if (lens.enabled === false || typeof lens.id !== 'string' || typeof lens.label !== 'string') continue;
    const approved = lens.reviewStatus === 'approved';
    if (!approved && !preview) continue;
    const personIds = tourPeople(people, lens);
    if (personIds.length === 0) continue;
    tours.push({
      id: lens.id,
      label: lens.label,
      prompt: typeof lens.prompt === 'string' ? lens.prompt : '',
      description: typeof lens.description === 'string' ? lens.description : '',
      personIds,
      ...(approved ? {} : { unreviewed: true as const }),
    });
  }
  return tours;
}

/**
 * Who a tour visits: people whose biography uses the tour's terms (each term
 * counting up to six times) or whose honours match its themes (eight each),
 * scoring six or more, highest first. Pinned people lead in the curator's
 * order; excluded people never appear.
 */
export function tourPeople(people: readonly TourPerson[], lens: StoredLens): string[] {
  const terms = strings(lens.terms).map(fold).filter(Boolean);
  const themes = strings(lens.themes).map(fold).filter(Boolean);
  const excluded = new Set(strings(lens.excludedPersonIds));
  const known = new Set(people.map((person) => person.id));
  const pinned = strings(lens.pinnedPersonIds).filter((id) => known.has(id) && !excluded.has(id));
  const scored = people
    .map((person) => {
      const biography = fold(person.biography);
      const honours = person.contributions.map(fold);
      let score = 0;
      for (const term of terms) score += Math.min(biography.split(term).length - 1, 6);
      for (const theme of themes) if (honours.some((each) => each.includes(theme) || theme.includes(each))) score += 8;
      return { person, score };
    })
    .filter((entry) => entry.score >= 6 && !excluded.has(entry.person.id) && !pinned.includes(entry.person.id))
    .sort((a, b) => b.score - a.score || a.person.sortName.localeCompare(b.person.sortName));
  const limit = typeof lens.maxPortraits === 'number' && lens.maxPortraits > 0 ? lens.maxPortraits : 48;
  return [...pinned, ...scored.map((entry) => entry.person.id)].slice(0, limit);
}
