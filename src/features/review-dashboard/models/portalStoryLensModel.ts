import { useEffect, useMemo, useState } from 'react';
import type {
  Inductee,
  StoryLensConfig,
  StoryLensDocument,
} from '../../../data/types';
import {
  fetchJson,
  portalReportUrls,
} from '../services/portalReports';
import type { DraftIssue } from './portalReviewModel';
import {
  cleanPortalList,
  cleanPortalString,
} from '../utils/portalFormUtils';

export type StoryLensEditorState = {
  document: StoryLensDocument | null;
  draft: StoryLensDocument | null;
  loading: boolean;
  error: string;
  isDirty: boolean;
  setDraft: (document: StoryLensDocument) => void;
  refresh: () => Promise<void>;
  acceptSavedDocument: (document: StoryLensDocument) => void;
};

export function useStoryLensDocument(): StoryLensEditorState {
  const [document, setDocument] = useState<StoryLensDocument | null>(null);
  const [draft, setDraft] = useState<StoryLensDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isDirty = useMemo(() => JSON.stringify(document) !== JSON.stringify(draft), [document, draft]);

  async function refresh() {
    setLoading(true);
    try {
      const payload = await fetchJson<StoryLensDocument>(portalReportUrls.storyLenses);
      const normalized = normalizeStoryLensDocument(payload);
      setDocument(normalized);
      setDraft(normalized);
      setError('');
    } catch (errorValue) {
      const fallback = emptyStoryLensDocument();
      setDocument(fallback);
      setDraft(fallback);
      setError(errorValue instanceof Error ? errorValue.message : 'Could not load Story Lens JSON.');
    } finally {
      setLoading(false);
    }
  }

  function acceptSavedDocument(savedDocument: StoryLensDocument) {
    const normalized = normalizeStoryLensDocument(savedDocument);
    setDocument(normalized);
    setDraft(normalized);
    setError('');
  }

  useEffect(() => {
    void refresh();
  }, []);

  return { document, draft, loading, error, isDirty, setDraft, refresh, acceptSavedDocument };
}

export function emptyStoryLensDocument(): StoryLensDocument {
  return {
    schemaVersion: 1,
    source: {
      name: 'CIHOF trace themes',
      note: 'Curator-editable interpretive prompts for arranging portrait traces.',
    },
    lenses: [],
  };
}

export function normalizeStoryLensDocument(input: unknown): StoryLensDocument {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input as Partial<StoryLensDocument> : {};
  const sourceInfo = source.source && typeof source.source === 'object'
    ? {
        name: typeof source.source.name === 'string' ? source.source.name.trim() : 'CIHOF trace themes',
        note: typeof source.source.note === 'string' ? source.source.note.trim() : '',
      }
    : emptyStoryLensDocument().source;
  const lenses = Array.isArray(source.lenses) ? source.lenses.map(normalizeStoryLens).filter((lens): lens is StoryLensConfig => Boolean(lens)) : [];

  return {
    schemaVersion: typeof source.schemaVersion === 'number' ? source.schemaVersion : 1,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
    source: sourceInfo,
    lenses,
  };
}

export function getStoryLensDraftIssues(document: StoryLensDocument, inductees: Inductee[] = []): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const ids = new Set<string>();
  const validPersonIds = new Set(inductees.map((inductee) => inductee.id));
  const add = (message: string, severity: DraftIssue['severity'] = 'warning') => {
    issues.push({ id: 'story-lenses', name: 'Story Lenses', message, severity });
  };

  document.lenses.forEach((lens, index) => {
    const label = lens.label || lens.id || `Lens ${index + 1}`;
    if (!lens.id) add(`${label}: ID is required.`, 'error');
    if (lens.id && ids.has(lens.id)) add(`${label}: ID duplicates another lens.`, 'error');
    ids.add(lens.id);
    if (!lens.label) add(`${label}: short label is required.`, 'error');
    if (!lens.prompt) add(`${label}: prompt is required.`, 'error');
    if (!lens.description) add(`${label}: description is required.`, 'error');
    if (lens.terms.length + lens.themes.length === 0) add(`${label}: add at least one keyword term or theme signal.`, 'error');
    if (!Number.isFinite(lens.maxPortraits) || (lens.maxPortraits ?? 0) < 12 || (lens.maxPortraits ?? 0) > 96) {
      add(`${label}: max portraits must be from 12 to 96.`, 'error');
    }
    if (lens.terms.length < 3 && lens.themes.length === 0) add(`${label}: add more matching signals for reliable results.`);
    if (lens.prompt.length > 42) add(`${label}: prompt may be too long for the museum button.`);
    if (lens.description.length > 180) add(`${label}: description may be too long for the wall focus panel.`);
    if (lens.reviewStatus !== 'approved') add(`${label}: review status is ${lens.reviewStatus ?? 'draft'}.`);
    for (const personId of lens.pinnedPersonIds ?? []) {
      if (validPersonIds.size > 0 && !validPersonIds.has(personId)) add(`${label}: pinned person id ${personId} is not in the current inductee data.`, 'error');
    }
    for (const personId of lens.excludedPersonIds ?? []) {
      if (validPersonIds.size > 0 && !validPersonIds.has(personId)) add(`${label}: hidden person id ${personId} is not in the current inductee data.`, 'error');
    }
    const excludedIds = new Set(lens.excludedPersonIds ?? []);
    for (const personId of lens.pinnedPersonIds ?? []) {
      if (excludedIds.has(personId)) add(`${label}: ${personId} cannot be both pinned and hidden.`, 'error');
    }
  });

  if (document.lenses.filter((lens) => lens.enabled !== false).length === 0) add('At least one Story Lens should be enabled.', 'error');
  return issues;
}

export function slugifyLensId(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function uniqueLensId(lenses: StoryLensConfig[], baseId: string) {
  const normalizedBase = slugifyLensId(baseId) || 'story-lens';
  const ids = new Set(lenses.map((lens) => lens.id));
  if (!ids.has(normalizedBase)) return normalizedBase;
  let index = 2;
  while (ids.has(`${normalizedBase}-${index}`)) index += 1;
  return `${normalizedBase}-${index}`;
}

function normalizeStoryLens(input: unknown): StoryLensConfig | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const lens = input as Partial<StoryLensConfig>;
  return {
    id: slugifyLensId(lens.id ?? ''),
    label: cleanPortalString(lens.label),
    prompt: cleanPortalString(lens.prompt),
    description: cleanPortalString(lens.description),
    terms: cleanPortalList(lens.terms),
    themes: cleanPortalList(lens.themes),
    pinnedPersonIds: cleanPortalList(lens.pinnedPersonIds),
    excludedPersonIds: cleanPortalList(lens.excludedPersonIds),
    curatorNotes: cleanPortalList(lens.curatorNotes),
    reviewStatus: lens.reviewStatus === 'reviewed' || lens.reviewStatus === 'approved' ? lens.reviewStatus : 'draft',
    maxPortraits: typeof lens.maxPortraits === 'number' && Number.isFinite(lens.maxPortraits) ? Math.round(lens.maxPortraits) : 48,
    enabled: lens.enabled !== false,
  };
}
