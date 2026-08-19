import { useEffect, useMemo, useState } from 'react';
import type { StoryLensConfig, StoryLensDocument } from './types';

type StoryLensState = {
  lenses: StoryLensConfig[];
  loading: boolean;
  error: string;
};

export const defaultStoryLenses: StoryLensConfig[] = [
  {
    id: 'built-cleveland',
    label: 'Built Cleveland',
    prompt: 'Who Built Cleveland?',
    description: 'Founders, civic builders, institution makers, entrepreneurs, and people who shaped public life.',
    terms: ['founder', 'founded', 'business', 'company', 'entrepreneur', 'institution', 'developer', 'board', 'foundation', 'philanthropy'],
    themes: ['business', 'entrepreneurship', 'civic leadership', 'philanthropy'],
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
    maxPortraits: 48,
    enabled: true,
  },
];

export function useStoryLenses(): StoryLensState {
  const [state, setState] = useState<StoryLensState>({ lenses: defaultStoryLenses, loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;

    fetch(`${import.meta.env.BASE_URL}data/story-lenses.json`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Story lens request failed: ${response.status}`);
        return response.json() as Promise<StoryLensDocument>;
      })
      .then((payload) => {
        const lenses = normalizeStoryLenses(payload);
        if (!cancelled) setState({ lenses: lenses.length > 0 ? lenses : defaultStoryLenses, loading: false, error: '' });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ lenses: defaultStoryLenses, loading: false, error: error.message });
      });

    return () => {
      cancelled = true;
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
    maxPortraits,
    enabled: candidate.enabled !== false,
  };
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanString(item)).filter(Boolean)));
}
