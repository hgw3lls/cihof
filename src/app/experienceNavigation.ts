import type { HallLens, ViewMode } from '../data/types';

export type VisitorExperienceMode = Exclude<ViewMode, 'review'>;
export type ExperienceTransition = 'forward' | 'back' | 'switch' | 'reset';

export type ExperienceNavItem = {
  lens: HallLens;
  label: string;
  sublabel: string;
  ariaLabel: string;
};

export const hallLensOrder: HallLens[] = [
  'portraits',
  'traces',
  'journeys',
  'legacies',
];

export const visitorExperienceNavItems: ExperienceNavItem[] = [
  {
    lens: 'portraits',
    label: 'PEOPLE',
    sublabel: 'ALL PEOPLE',
    ariaLabel: 'Arrange Hall by portraits',
  },
  {
    lens: 'traces',
    label: 'ROUTES',
    sublabel: 'PLACES & CONNECTIONS',
    ariaLabel: 'Arrange Hall by heritage and connections',
  },
  {
    lens: 'legacies',
    label: 'TIME',
    sublabel: 'YEARS & CLASSES',
    ariaLabel: 'Arrange Hall by induction history',
  },
];

const legacyViewMap: Record<string, VisitorExperienceMode> = {
  'all-people': 'living-hall',
  people: 'living-hall',
  explore: 'living-hall',
  search: 'living-hall',
  hall: 'living-hall',
  'living-hall': 'living-hall',
  person: 'person',
  connections: 'connections',
  connection: 'connections',
  journeys: 'connections',
  journey: 'connections',
  world: 'world',
  route: 'world',
  routes: 'world',
  places: 'world',
  'region-map': 'world',
  time: 'time',
  timeline: 'time',
};

export function normalizeViewMode(value: string, allowReview: boolean): ViewMode | null {
  if (allowReview && value === 'review') return 'review';
  return legacyViewMap[value] ?? null;
}

export function normalizeHallLens(value: string): HallLens | null {
  if (value === 'portraits' || value === 'portrait') return 'portraits';
  if (value === 'traces' || value === 'trace') return 'traces';
  if (value === 'journeys' || value === 'journey') return 'journeys';
  if (value === 'legacies' || value === 'legacy') return 'legacies';
  return null;
}

export function hallLensForViewMode(mode: ViewMode | null | undefined): HallLens {
  if (mode === 'world' || mode === 'connections') return 'traces';
  if (mode === 'time') return 'legacies';
  return 'portraits';
}

export function viewModeForHallLens(_lens: HallLens): VisitorExperienceMode {
  return 'living-hall';
}

export function isVisitorExperienceMode(mode: ViewMode): mode is VisitorExperienceMode {
  return mode !== 'review';
}
