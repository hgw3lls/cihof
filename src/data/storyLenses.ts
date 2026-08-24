import { useEffect, useMemo, useState } from 'react';
import { runtimeLogger } from '../app/runtimeLogger';
import { readCachedJson, writeCachedJson } from './localDataCache';
import { countryCommunityOrRegionLabel } from './inducteeLabels';
import type { Inductee, StoryLensConfig, StoryLensDocument } from './types';

type StoryLensState = {
  lenses: StoryLensConfig[];
  loading: boolean;
  error: string;
};

export type StoryLensMatch = {
  inductee: Inductee;
  score: number;
  reasons: string[];
};

const defaultMaxLensPortraits = 48;
const storyLensUrl = `${import.meta.env.BASE_URL}data/story-lenses.json`;
const storyLensCacheKey = 'story-lenses';

export const defaultStoryLenses: StoryLensConfig[] = [
  {
    id: 'built-cleveland',
    label: 'Built Cleveland',
    prompt: 'Who Built Cleveland?',
    description: 'Founders, civic builders, institution makers, entrepreneurs, and people who shaped public life.',
    terms: ['founder', 'founded', 'business', 'company', 'entrepreneur', 'institution', 'developer', 'board', 'foundation', 'philanthropy'],
    themes: ['business', 'entrepreneurship', 'civic leadership', 'philanthropy'],
    pinnedPersonIds: [],
    excludedPersonIds: [],
    curatorNotes: [],
    reviewStatus: 'draft',
    maxPortraits: 48,
    enabled: true,
  },
  {
    id: 'helped-arrive',
    label: 'Helped New Arrivals',
    prompt: 'Who Helped People Arrive?',
    description: 'People connected to immigration, resettlement, welcome work, citizenship, and services for new Clevelanders.',
    terms: ['immigrant', 'immigration', 'refugee', 'resettlement', 'new arrival', 'citizenship', 'english', 'liaison', 'welcoming', 'arrival'],
    themes: ['immigrant advocacy', 'social service'],
    pinnedPersonIds: [],
    excludedPersonIds: [],
    curatorNotes: [],
    reviewStatus: 'draft',
    maxPortraits: 48,
    enabled: true,
  },
  {
    id: 'kept-cultures',
    label: 'Kept Cultures Alive',
    prompt: 'Who Kept Cultures Alive?',
    description: 'Artists, organizers, educators, and cultural stewards who carried traditions forward.',
    terms: ['culture', 'cultural', 'heritage', 'language', 'festival', 'garden', 'tradition', 'folk', 'dance', 'music', 'arts'],
    themes: ['arts and culture', 'heritage'],
    pinnedPersonIds: [],
    excludedPersonIds: [],
    curatorNotes: [],
    reviewStatus: 'draft',
    maxPortraits: 48,
    enabled: true,
  },
  {
    id: 'changed-city',
    label: 'Changed The City',
    prompt: 'Who Changed The City?',
    description: 'Public servants, advocates, organizers, and leaders whose work changed civic life.',
    terms: ['justice', 'rights', 'advocate', 'advocacy', 'campaign', 'council', 'mayor', 'public service', 'reform', 'commission'],
    themes: ['civic leadership', 'justice', 'advocacy', 'public service'],
    pinnedPersonIds: [],
    excludedPersonIds: [],
    curatorNotes: [],
    reviewStatus: 'draft',
    maxPortraits: 48,
    enabled: true,
  },
  {
    id: 'made-art',
    label: 'Made Art',
    prompt: 'Who Made Art?',
    description: 'Artists, musicians, writers, performers, and storytellers across Cleveland communities.',
    terms: ['art', 'artist', 'music', 'musician', 'orchestra', 'opera', 'theater', 'theatre', 'dance', 'writer', 'poet', 'film', 'media'],
    themes: ['arts and culture', 'media', 'storytelling'],
    pinnedPersonIds: [],
    excludedPersonIds: [],
    curatorNotes: [],
    reviewStatus: 'draft',
    maxPortraits: 48,
    enabled: true,
  },
  {
    id: 'cared-for-city',
    label: 'Cared For Cleveland',
    prompt: 'Who Cared For Cleveland?',
    description: 'Doctors, nurses, health leaders, social-service organizers, and people whose work centered care.',
    terms: ['doctor', 'physician', 'hospital', 'clinic', 'health', 'medicine', 'medical', 'nurse', 'patient'],
    themes: ['medicine and health', 'social service', 'public safety'],
    pinnedPersonIds: [],
    excludedPersonIds: [],
    curatorNotes: [],
    reviewStatus: 'draft',
    maxPortraits: 48,
    enabled: true,
  },
];

export function rankStoryLensMatches(inductees: Inductee[], lens: StoryLensConfig): StoryLensMatch[] {
  const pinnedOrder = new Map((lens.pinnedPersonIds ?? []).map((id, index) => [id, index]));
  const excludedIds = new Set(lens.excludedPersonIds ?? []);

  return inductees
    .filter((inductee) => !excludedIds.has(inductee.id))
    .map((inductee) => scoreStoryLensMatch(inductee, lens, pinnedOrder.has(inductee.id)))
    .filter((match) => match.score >= 12 || pinnedOrder.has(match.inductee.id))
    .sort((a, b) => {
      const pinnedA = pinnedOrder.get(a.inductee.id);
      const pinnedB = pinnedOrder.get(b.inductee.id);
      if (pinnedA !== undefined || pinnedB !== undefined) {
        if (pinnedA === undefined) return 1;
        if (pinnedB === undefined) return -1;
        return pinnedA - pinnedB;
      }
      return b.score - a.score || discoveryDefaultSort(a.inductee, b.inductee) || a.inductee.name.localeCompare(b.inductee.name);
    })
    .slice(0, lens.maxPortraits ?? defaultMaxLensPortraits);
}

export function useStoryLenses(): StoryLensState {
  const [state, setState] = useState<StoryLensState>({ lenses: defaultStoryLenses, loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch(storyLensUrl, { cache: 'no-store', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Story lens request failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        writeCachedJson(storyLensCacheKey, payload);
        const lenses = normalizeStoryLenses(payload);
        if (!cancelled) setState({ lenses: lenses.length > 0 ? lenses : defaultStoryLenses, loading: false, error: '' });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted || cancelled) return;
        const cached = readCachedJson(storyLensCacheKey);
        const cachedLenses = normalizeStoryLenses(cached);
        if (cachedLenses.length > 0) {
          runtimeLogger.warn('Using cached story lenses after load failure.', { error: error.message });
          setState({ lenses: cachedLenses, loading: false, error: '' });
          return;
        }
        setState({ lenses: defaultStoryLenses, loading: false, error: error.message });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return useMemo(() => state, [state]);
}

export function normalizeStoryLenses(document: StoryLensDocument | unknown): StoryLensConfig[] {
  if (!document || typeof document !== 'object' || Array.isArray(document)) return [];
  const lenses = (document as Partial<StoryLensDocument>).lenses;
  if (!Array.isArray(lenses)) return [];

  return lenses
    .map((lens) => normalizeStoryLens(lens))
    .filter((lens): lens is StoryLensConfig => Boolean(lens));
}

function normalizeStoryLens(lens: unknown): StoryLensConfig | null {
  if (!lens || typeof lens !== 'object' || Array.isArray(lens)) return null;
  const candidate = lens as Partial<StoryLensConfig>;
  const id = cleanString(candidate.id);
  const label = cleanString(candidate.label);
  const prompt = cleanString(candidate.prompt);
  const description = cleanString(candidate.description);
  const terms = cleanList(candidate.terms);
  const themes = cleanList(candidate.themes);
  const pinnedPersonIds = cleanList(candidate.pinnedPersonIds);
  const excludedPersonIds = cleanList(candidate.excludedPersonIds);
  const curatorNotes = cleanList(candidate.curatorNotes);
  const reviewStatus = candidate.reviewStatus === 'reviewed' || candidate.reviewStatus === 'approved' ? candidate.reviewStatus : 'draft';
  const maxPortraits = typeof candidate.maxPortraits === 'number' && Number.isFinite(candidate.maxPortraits)
    ? Math.min(96, Math.max(12, Math.round(candidate.maxPortraits)))
    : undefined;

  if (!id || !label || !prompt || !description || terms.length + themes.length === 0) return null;

  return {
    id,
    label,
    prompt,
    description,
    terms,
    themes,
    pinnedPersonIds,
    excludedPersonIds,
    curatorNotes,
    reviewStatus,
    maxPortraits,
    enabled: candidate.enabled !== false,
  };
}

function scoreStoryLensMatch(inductee: Inductee, lens: StoryLensConfig, pinned: boolean): StoryLensMatch {
  const text = [
    inductee.name,
    inductee.inductedBy,
    inductee.bioText,
    inductee.storySummary,
    inductee.storyHighlights.join(' '),
    inductee.themeTags.join(' '),
    inductee.communityTags.join(' '),
    inductee.countryTags.join(' '),
    inductee.searchText,
  ].join(' ').toLowerCase();
  const normalizedThemes = inductee.themeTags.map((theme) => theme.toLowerCase());
  const reasons: string[] = [];
  let score = pinned ? 1000 : 0;
  let themeHits = 0;
  let termHits = 0;

  if (pinned) reasons.push('Curator pinned');

  for (const themeTerm of lens.themes) {
    const matchedTheme = normalizedThemes.find((theme) => theme.includes(themeTerm.toLowerCase()));
    if (matchedTheme) {
      themeHits += 1;
      score += 28;
      const originalTheme = inductee.themeTags[normalizedThemes.indexOf(matchedTheme)];
      if (originalTheme && !reasons.includes(originalTheme)) reasons.push(originalTheme);
    }
  }

  for (const term of lens.terms) {
    if (text.includes(term.toLowerCase())) {
      termHits += 1;
      score += term.length > 8 ? 8 : 5;
    }
  }

  if (!pinned && themeHits === 0 && termHits < 2) score = 0;
  if (inductee.featured) score += 5;
  if (inductee.featuredCandidate) score += 3;
  if (inductee.hasVideo) score += 1;

  if (score > 0 && reasons.length === 0) {
    const label = countryCommunityOrRegionLabel(inductee);
    reasons.push(label ? `Story match: ${label}` : 'Story match');
  }

  return {
    inductee,
    score,
    reasons: reasons.slice(0, 2),
  };
}

function discoveryDefaultSort(a: Inductee, b: Inductee) {
  const priorityA = Number(a.featured) * 100 + Number(a.featuredCandidate) * 40 + a.attractPriority;
  const priorityB = Number(b.featured) * 100 + Number(b.featuredCandidate) * 40 + b.attractPriority;
  return priorityB - priorityA || a.name.localeCompare(b.name);
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanString(item)).filter(Boolean)));
}
