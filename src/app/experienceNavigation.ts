import type { ViewMode } from '../data/types';

export type VisitorExperienceMode = Exclude<ViewMode, 'review'>;
export type ExperienceTransition = 'forward' | 'back' | 'switch' | 'reset';

export type ExperienceNavItem = {
  mode: VisitorExperienceMode;
  label: string;
  sublabel: string;
  ariaLabel: string;
  icon: string;
  risoIcon: string;
};

export const visitorExperienceOrder: VisitorExperienceMode[] = [
  'living-hall',
  'person',
  'connections',
  'world',
  'time',
];

export const visitorExperienceNavItems: ExperienceNavItem[] = [
  {
    mode: 'living-hall',
    label: 'People',
    sublabel: 'All People',
    ariaLabel: 'Switch to Living Hall',
    icon: 'people',
    risoIcon: 'community',
  },
  {
    mode: 'world',
    label: 'Routes',
    sublabel: 'Places & Connections',
    ariaLabel: 'Switch to World',
    icon: 'world',
    risoIcon: 'map-pin',
  },
  {
    mode: 'time',
    label: 'Time',
    sublabel: 'Years & Classes',
    ariaLabel: 'Switch to Time',
    icon: 'time',
    risoIcon: 'clock',
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
  places: 'world',
  'region-map': 'world',
  time: 'time',
  timeline: 'time',
};

export function normalizeViewMode(value: string, allowReview: boolean): ViewMode | null {
  if (allowReview && value === 'review') return 'review';
  return legacyViewMap[value] ?? null;
}

export function isVisitorExperienceMode(mode: ViewMode): mode is VisitorExperienceMode {
  return mode !== 'review';
}
