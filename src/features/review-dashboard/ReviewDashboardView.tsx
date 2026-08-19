import { ChangeEvent, MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import { countryOrRegionLabel } from '../../data/inducteeLabels';
import type { Inductee, StoryLensConfig, StoryLensDocument } from '../../data/types';

type CountEntry = {
  [key: string]: string | number;
  count: number;
};

type CurationReport = {
  generatedAt?: string;
  validation?: {
    errors?: string[];
    warnings?: string[];
  };
  approvalStatus?: CountEntry[];
  reviewPriority?: CountEntry[];
  summaries?: {
    approved?: number;
    draftOnly?: string[];
    truncatedDrafts?: string[];
  };
  themes?: {
    approved?: number;
    candidateOnly?: string[];
  };
  countries?: {
    detected?: number;
    approved?: number;
    inferred?: number;
    generatedOnly?: string[];
    missing?: string[];
    sources?: CountEntry[];
  };
  communities?: {
    approved?: number;
    candidateOnly?: string[];
  };
  featured?: {
    approved?: string[];
    candidates?: string[];
    candidateNotFeatured?: string[];
  };
  media?: {
    captionTranscriptReviewNeeded?: string[];
    videoRightsReviewNeeded?: string[];
    imageRightsReviewNeeded?: string[];
    noVideoLinked?: string[];
  };
  accessibility?: {
    plainLanguageReviewNeeded?: string[];
    sensitiveContentReviewNeeded?: string[];
    imageDescriptionReviewNeeded?: string[];
  };
  priorities?: {
    high?: string[];
    medium?: string[];
    standard?: string[];
  };
};

type MediaReport = {
  generatedAt?: string;
  validation?: {
    errors?: string[];
    warnings?: string[];
  };
  strictFailures?: string[];
  summary?: {
    primaryImages?: number;
    primaryImagesReady?: number;
    galleryImages?: number;
    galleryImagesReady?: number;
    videoItems?: number;
    videosReady?: number;
    missingPrimaryLocalFiles?: string[];
    missingVideoLocalFiles?: string[];
    missingVideoPosters?: string[];
    missingCaptions?: string[];
    missingTranscripts?: string[];
    imageRightsNeedsReview?: string[];
    videoRightsNeedsReview?: string[];
  };
};

type MediaAsset = {
  sourceUrl?: string;
  filePath?: string;
  runtimePath?: string;
  checksumSha256?: string;
  width?: number | null;
  height?: number | null;
  altText?: string;
  rightsStatus?: string;
  approvedForKiosk?: boolean;
};

type VideoAsset = {
  sourceUrl?: string;
  youtubeVideoId?: string;
  filePath?: string;
  runtimePath?: string;
  posterFilePath?: string;
  posterRuntimePath?: string;
  captionFilePath?: string;
  captionRuntimePath?: string;
  transcriptFilePath?: string;
  transcriptRuntimePath?: string;
  checksumSha256?: string;
  durationSeconds?: number | null;
  codec?: string;
  rightsStatus?: string;
  captionStatus?: string;
  transcriptStatus?: string;
  audioDescriptionStatus?: string;
  approvedForKiosk?: boolean;
};

type MediaManifest = {
  assets?: Record<string, {
    images?: {
      primary?: MediaAsset;
      gallery?: MediaAsset[];
    };
    videos?: VideoAsset[];
    notes?: string[];
  }>;
};
type MediaManifestRecord = NonNullable<MediaManifest['assets']>[string];

type ReportState = {
  curation: CurationReport | null;
  media: MediaReport | null;
  manifest: MediaManifest | null;
  loading: boolean;
  error: string;
};

type QueueMode =
  | 'all'
  | 'edited'
  | 'high'
  | 'country'
  | 'summary'
  | 'themes'
  | 'image-rights'
  | 'video-captions'
  | 'accessibility'
  | 'featured';
type PortalTab = 'workbench' | 'lenses' | 'readiness' | 'exports';

type ReviewDraft = {
  id: string;
  updatedAt: string;
  approvalStatus?: string;
  reviewPriority?: string;
  approvedSummary?: string;
  approvedThemeTags?: string[];
  approvedCountryTags?: string[];
  countryNotes?: string;
  approvedCommunityTags?: string[];
  featured?: boolean;
  featuredCandidate?: boolean;
  attractPriority?: number;
  approveProfile?: boolean;
  summaryApproved?: boolean;
  themeTagsApproved?: boolean;
  countryTagsApproved?: boolean;
  communityTagsApproved?: boolean;
  primaryImageAltText?: string;
  imageRightsStatus?: string;
  imageRightsApproved?: boolean;
  videoRightsStatus?: string;
  videoRightsApproved?: boolean;
  captionStatus?: string;
  captionsApproved?: boolean;
  transcriptStatus?: string;
  transcriptApproved?: boolean;
  accessibilityApproved?: boolean;
  plainLanguageReview?: string;
  sensitiveContentReview?: string;
  imageDescriptionReview?: string;
  curatorNotes?: string[];
  mediaNotes?: string[];
};

type DraftMap = Record<string, ReviewDraft>;
type DraftPatch = Partial<Omit<ReviewDraft, 'id' | 'updatedAt'>>;
type CsvValue = string | number | boolean | null | undefined;
type DraftIssue = {
  id: string;
  name: string;
  message: string;
  severity: 'warning' | 'error';
};
type DraftStorageResult = {
  ok: boolean;
  message: string;
  savedAt?: string;
};
type RunnerScript = {
  id: string;
  label: string;
  description: string;
  mutates?: boolean;
  destructive?: boolean;
  strict?: boolean;
};
type RunnerJob = {
  id: string;
  label: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number | null;
  output?: string;
  currentStep?: string;
  steps?: Array<{
    label: string;
    status: 'queued' | 'running' | 'success' | 'failed';
    startedAt?: string;
    finishedAt?: string;
    exitCode?: number | null;
  }>;
};
type RunnerState = {
  available: boolean;
  checking: boolean;
  error: string;
  token: string;
  scripts: RunnerScript[];
  jobs: RunnerJob[];
  activeJob: RunnerJob | null;
  setToken: (token: string) => void;
  refresh: () => Promise<void>;
  runScript: (scriptId: string) => Promise<RunnerJob | null>;
  applyDecisions: (csv: string, dryRun: boolean) => Promise<RunnerJob | null>;
  saveStoryLenses: (document: StoryLensDocument) => Promise<StoryLensDocument | null>;
};

type StoryLensEditorState = {
  document: StoryLensDocument | null;
  draft: StoryLensDocument | null;
  loading: boolean;
  error: string;
  isDirty: boolean;
  setDraft: (document: StoryLensDocument) => void;
  refresh: () => Promise<void>;
  acceptSavedDocument: (document: StoryLensDocument) => void;
};

type ReviewDashboardViewProps = {
  inductees: Inductee[];
  onSelect: (inductee: Inductee) => void;
};

const draftStorageKey = 'cihof.portal.reviewDrafts.v1';

const reportUrls = {
  curation: `${import.meta.env.BASE_URL}data/curation-report.json`,
  media: `${import.meta.env.BASE_URL}data/media-report.json`,
  manifest: `${import.meta.env.BASE_URL}data/media-manifest.json`,
  storyLenses: `${import.meta.env.BASE_URL}data/story-lenses.json`,
};
const portalRunnerBaseUrl = 'http://127.0.0.1:5174';

export function ReviewDashboardView({ inductees, onSelect }: ReviewDashboardViewProps) {
  const reports = useReviewReports();
  const runner = usePortalRunner();
  const storyLensState = useStoryLensDocument();
  const [query, setQuery] = useState('');
  const [queue, setQueue] = useState<QueueMode>('high');
  const [tab, setTab] = useState<PortalTab>('workbench');
  const [selectedId, setSelectedId] = useState('');
  const [drafts, setDrafts] = useState<DraftMap>(() => loadStoredDrafts());
  const [portalNotice, setPortalNotice] = useState('');
  const [storageState, setStorageState] = useState<DraftStorageResult>({ ok: true, message: 'No local drafts' });
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const draftCount = Object.keys(drafts).length;
  const summary = useMemo(() => buildDashboardSummary(inductees, reports.curation, reports.media, drafts), [drafts, inductees, reports.curation, reports.media]);
  const queueOptions = useMemo(() => buildQueueOptions(inductees, reports.curation, reports.media, drafts), [drafts, inductees, reports.curation, reports.media]);
  const actionItems = useMemo(() => buildActionItems(summary, draftCount), [draftCount, summary]);
  const visibleRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return inductees
      .filter((inductee) => matchesQueue(inductee, queue, reports.curation, reports.media, drafts))
      .filter((inductee) => !search || matchesSearch(inductee, drafts[inductee.id], search))
      .sort((a, b) => {
        const edited = Number(Boolean(drafts[b.id])) - Number(Boolean(drafts[a.id]));
        if (queue === 'edited' && edited !== 0) return edited;
        const priority = priorityRank(a.reviewPriority) - priorityRank(b.reviewPriority);
        if (priority !== 0) return priority;
        const featured = Number(b.featuredCandidate) - Number(a.featuredCandidate);
        if (featured !== 0) return featured;
        return (b.classYear ?? 0) - (a.classYear ?? 0) || a.name.localeCompare(b.name);
      });
  }, [drafts, inductees, query, queue, reports.curation, reports.media]);
  const selected = useMemo(() => {
    return inductees.find((item) => item.id === selectedId) ?? visibleRows[0] ?? inductees[0] ?? null;
  }, [inductees, selectedId, visibleRows]);
  const selectedDraft = selected ? drafts[selected.id] : undefined;
  const selectedNeeds = selected ? getReviewNeeds(selected, reports.curation, reports.media, selectedDraft) : [];
  const selectedDraftIssues = selected ? getDraftIssues(selected, selectedDraft, reports.manifest?.assets?.[selected.id]) : [];
  const editedRows = useMemo(() => inductees.filter((item) => Boolean(drafts[item.id])), [drafts, inductees]);
  const draftIssues = useMemo(() => {
    return editedRows.flatMap((inductee) => getDraftIssues(inductee, drafts[inductee.id], reports.manifest?.assets?.[inductee.id]));
  }, [drafts, editedRows, reports.manifest]);
  const storyLensCount = storyLensState.draft?.lenses.length ?? storyLensState.document?.lenses.length ?? 0;

  useEffect(() => {
    setStorageState(persistDrafts(drafts));
  }, [drafts]);

  useEffect(() => {
    if (draftCount === 0) return undefined;

    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [draftCount]);

  useEffect(() => {
    if (visibleRows.length === 0) return;
    if (!selectedId || !visibleRows.some((item) => item.id === selectedId)) {
      setSelectedId(visibleRows[0].id);
    }
  }, [selectedId, visibleRows]);

  function patchDraft(id: string, patch: DraftPatch) {
    setDrafts((current) => {
      const nextDraft: ReviewDraft = {
        ...(current[id] ?? { id }),
        ...patch,
        id,
        updatedAt: new Date().toISOString(),
      };
      const next = { ...current };
      if (isMeaningfulDraft(nextDraft)) next[id] = nextDraft;
      else delete next[id];
      return next;
    });
  }

  function clearDraft(id: string) {
    if (drafts[id] && !window.confirm('Clear the local draft for this profile?')) return;
    setDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setPortalNotice('Local draft cleared.');
  }

  function clearAllDrafts() {
    if (draftCount > 0 && !window.confirm(`Clear ${draftCount} local portal drafts? Export first if you need to keep them.`)) return;
    setDrafts({});
    setPortalNotice('All local drafts cleared.');
  }

  function exportDraftJson() {
    if (draftCount === 0) {
      window.alert('There are no local drafts to export.');
      return;
    }
    downloadJson({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      source: 'CIHOF staff portal browser drafts',
      drafts,
    }, `cihof-portal-drafts-${dateStamp()}.json`);
    setPortalNotice(`Exported ${draftCount} draft records as JSON.`);
  }

  function importDraftJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result ?? ''));
        const source = getDraftRecordSource(payload);
        const sourceCount = source ? Object.keys(source).length : 0;
        const imported = normalizeDraftPayload(payload, inductees);
        const importedCount = Object.keys(imported).length;
        setDrafts((current) => ({ ...current, ...imported }));
        setPortalNotice(`Imported ${importedCount} draft records${sourceCount > importedCount ? `; skipped ${sourceCount - importedCount} invalid or unknown records` : ''}.`);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Could not import draft JSON.');
      }
    };
    reader.readAsText(file);
  }

  async function runPortalScript(script: RunnerScript) {
    if (!runner.available) {
      window.alert('Start the local portal runner first: npm run portal:server');
      return;
    }
    if ((script.mutates || script.destructive || script.strict) && !window.confirm(`Run "${script.label}" from the local portal runner?`)) return;
    const job = await runner.runScript(script.id);
    if (job) {
      setPortalNotice(`Started ${script.label}.`);
      setTab('exports');
    }
  }

  async function applyPortalDrafts(dryRun: boolean) {
    if (!runner.available) {
      window.alert('Start the local portal runner first: npm run portal:server');
      return;
    }
    if (editedRows.length === 0) {
      window.alert('There are no local draft edits to apply.');
      return;
    }

    const blockingIssues = draftIssues.filter((issue) => issue.severity === 'error');
    if (blockingIssues.length > 0 && !dryRun) {
      window.alert(`Fix ${blockingIssues.length} blocking draft issue${blockingIssues.length === 1 ? '' : 's'} before applying for real. Dry run is still available.`);
      return;
    }

    if (!dryRun && !window.confirm(`Apply ${editedRows.length} portal draft records to repo data files and regenerate reports?`)) return;

    const csv = buildReviewCsv(editedRows, reports.curation, reports.media, reports.manifest, drafts);
    const job = await runner.applyDecisions(csv, dryRun);
    if (job) {
      setPortalNotice(`${dryRun ? 'Started dry run for' : 'Started applying'} ${editedRows.length} portal draft records.`);
      setTab('exports');
    }
  }

  return (
    <section className="review-dashboard portal-dashboard" aria-label="Staff portal dashboard">
      <div className="review-dashboard__header portal-dashboard__header">
        <div>
          <p className="eyebrow">Staff Portal</p>
          <h2>Review & Edit</h2>
        </div>
        <div className="review-dashboard__status">
          <StatusPill label="Curation" value={statusLabel(reports.curation?.validation?.errors?.length ?? 0, reports.curation?.validation?.warnings?.length ?? 0)} tone={(reports.curation?.validation?.errors?.length ?? 0) > 0 ? 'bad' : 'ok'} />
          <StatusPill label="Media" value={statusLabel(reports.media?.validation?.errors?.length ?? 0, reports.media?.validation?.warnings?.length ?? 0)} tone={(reports.media?.validation?.errors?.length ?? 0) > 0 ? 'bad' : 'warn'} />
          <StatusPill label="Drafts" value={`${draftCount}`} tone={draftCount > 0 ? 'warn' : 'ok'} />
          <StatusPill label="Lenses" value={`${storyLensCount}`} tone={storyLensState.isDirty ? 'warn' : storyLensState.error ? 'bad' : 'ok'} />
          <StatusPill label="Kiosk Ready" value={summary.kioskReady ? 'Yes' : 'No'} tone={summary.kioskReady ? 'ok' : 'bad'} />
        </div>
      </div>

      {reports.error && <div className="review-dashboard__alert">Report load error: {reports.error}</div>}
      {storyLensState.error && <div className="review-dashboard__alert">Story lens load warning: {storyLensState.error}</div>}
      {reports.loading && <div className="review-dashboard__alert">Loading review reports...</div>}
      {!storageState.ok && <div className="review-dashboard__alert">Draft save warning: {storageState.message}</div>}
      {portalNotice && (
        <div className="portal-notice">
          <span>{portalNotice}</span>
          <button type="button" onClick={() => setPortalNotice('')}>Dismiss</button>
        </div>
      )}

      <div className="portal-tabs" aria-label="Portal sections">
        <button className={tab === 'workbench' ? 'portal-tab portal-tab--active' : 'portal-tab'} type="button" onClick={() => setTab('workbench')}>Workbench</button>
        <button className={tab === 'lenses' ? 'portal-tab portal-tab--active' : 'portal-tab'} type="button" onClick={() => setTab('lenses')}>Story Lenses {storyLensState.isDirty ? '*' : ''}</button>
        <button className={tab === 'readiness' ? 'portal-tab portal-tab--active' : 'portal-tab'} type="button" onClick={() => setTab('readiness')}>Readiness</button>
        <button className={tab === 'exports' ? 'portal-tab portal-tab--active' : 'portal-tab'} type="button" onClick={() => setTab('exports')}>Exports {draftCount > 0 ? `(${draftCount})` : ''}</button>
      </div>

      <div className="review-metrics" aria-label="Review metrics">
        <MetricCard label="Profiles" value={summary.totalProfiles} detail={`${summary.approvedProfiles} approved / ${summary.draftProfiles} draft`} />
        <MetricCard label="Open Drafts" value={draftCount} detail={`${summary.draftApprovedProfiles} profile approvals staged`} />
        <MetricCard label="Countries" value={summary.countryNeedsReview} detail={`${summary.inferredCountries} inferred / ${summary.approvedCountries} approved`} />
        <MetricCard label="Summaries" value={summary.approvedSummaries} detail={`${summary.summaryDrafts} draft / ${summary.draftApprovedSummaries} staged`} />
        <MetricCard label="Primary Images" value={summary.localPrimaryImages} detail={`${summary.primaryImagesReady} kiosk-ready / ${summary.totalProfiles} local`} />
        <MetricCard label="Videos" value={summary.videosReady} detail={`${summary.videoItems} items / ${summary.missingCaptions} captions needed`} />
      </div>

      <div className="portal-action-strip" aria-label="Recommended actions">
        {actionItems.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              setQueue(item.queue);
              setTab('workbench');
            }}
          >
            <strong>{item.label}</strong>
            <span>{item.detail}</span>
          </button>
        ))}
      </div>

      {tab === 'workbench' && (
        <div className="portal-layout">
          <aside className="portal-queue" aria-label="Review queue">
            <div className="review-controls portal-controls" aria-label="Review filters">
              <label className="field field--search">
                <span>Search</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, id, country, year, story, tag" type="search" />
              </label>
              <label className="field">
                <span>Queue</span>
                <select value={queue} onChange={(event) => setQueue(event.target.value as QueueMode)}>
                  {queueOptions.map((option) => (
                    <option key={option.mode} value={option.mode}>{option.label} ({option.count})</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="review-dashboard__generated portal-generated">
              <span>Curation: {formatDate(reports.curation?.generatedAt)}</span>
              <span>Media: {formatDate(reports.media?.generatedAt)}</span>
              <span>{visibleRows.length} shown</span>
            </div>

            <div className="portal-queue__list" aria-label="Profile review queue">
              {visibleRows.map((inductee) => (
                <button
                  className={selected?.id === inductee.id ? 'portal-queue-row portal-queue-row--active' : 'portal-queue-row'}
                  key={inductee.id}
                  type="button"
                  onClick={() => setSelectedId(inductee.id)}
                >
                  <span className="portal-queue-row__title">
                    <strong>{inductee.name}</strong>
                    {drafts[inductee.id] && <em>Edited</em>}
                  </span>
                  <small>{inductee.classYear ?? 'Year unknown'} / {countryOrRegionLabel(inductee)}</small>
                  <span className="portal-queue-row__needs">{formatNeeds(getReviewNeeds(inductee, reports.curation, reports.media, drafts[inductee.id]))}</span>
                </button>
              ))}
            </div>

            {visibleRows.length === 0 && <div className="review-dashboard__alert">No profiles match this queue.</div>}
          </aside>

          <section className="portal-editor-shell" aria-label="Selected profile editor">
            {selected ? (
              <ProfileEditor
                draft={selectedDraft}
                inductee={selected}
                mediaRecord={reports.manifest?.assets?.[selected.id]}
                needs={selectedNeeds}
                draftIssues={selectedDraftIssues}
                saveState={storageState}
                onClear={() => clearDraft(selected.id)}
                onOpenProfile={() => onSelect(selected)}
                onPatch={(patch) => patchDraft(selected.id, patch)}
              />
            ) : (
              <div className="review-dashboard__alert">No profile selected.</div>
            )}
          </section>
        </div>
      )}

      {tab === 'lenses' && (
        <StoryLensEditor
          runner={runner}
          state={storyLensState}
          onNotice={setPortalNotice}
        />
      )}

      {tab === 'readiness' && (
        <ReadinessPanel
          drafts={drafts}
          inductees={inductees}
          media={reports.media}
          curation={reports.curation}
          summary={summary}
          onQueueChange={(nextQueue) => {
            setQueue(nextQueue);
            setTab('workbench');
          }}
        />
      )}

      {tab === 'exports' && (
        <ExportPanel
          draftCount={draftCount}
          editedRows={editedRows}
          reports={reports}
          runner={runner}
          drafts={drafts}
          draftIssues={draftIssues}
          importInputRef={importInputRef}
          onClearDrafts={clearAllDrafts}
          onExportDraftJson={exportDraftJson}
          onImportDraftJson={importDraftJson}
          onRunScript={runPortalScript}
          onApplyDrafts={applyPortalDrafts}
          onExportDecisionCsv={() => downloadReviewQueue(editedRows, reports.curation, reports.media, reports.manifest, drafts, 'portal-decisions')}
          onExportVisibleCsv={() => downloadReviewQueue(visibleRows, reports.curation, reports.media, reports.manifest, drafts, queue)}
        />
      )}
    </section>
  );
}

function StoryLensEditor({
  state,
  runner,
  onNotice,
}: {
  state: StoryLensEditorState;
  runner: RunnerState;
  onNotice: (message: string) => void;
}) {
  const draft = state.draft ?? emptyStoryLensDocument();
  const issues = getStoryLensDraftIssues(draft);
  const blockingIssues = issues.filter((issue) => issue.severity === 'error');

  function patchLens(index: number, patch: Partial<StoryLensConfig>) {
    state.setDraft(normalizeStoryLensDocument({
      ...draft,
      lenses: draft.lenses.map((lens, lensIndex) => lensIndex === index ? { ...lens, ...patch } : lens),
    }));
  }

  function addLens() {
    state.setDraft(normalizeStoryLensDocument({
      ...draft,
      lenses: [
        ...draft.lenses,
        {
          id: uniqueLensId(draft.lenses, 'new-story-lens'),
          label: 'New Story Lens',
          prompt: 'Who Should Visitors Meet?',
          description: 'Curator-written prompt description for this interpretive grouping.',
          terms: ['community'],
          themes: [],
          maxPortraits: 36,
          enabled: false,
        },
      ],
    }));
  }

  function duplicateLens(index: number) {
    const source = draft.lenses[index];
    if (!source) return;
    state.setDraft(normalizeStoryLensDocument({
      ...draft,
      lenses: [
        ...draft.lenses.slice(0, index + 1),
        {
          ...source,
          id: uniqueLensId(draft.lenses, `${source.id}-copy`),
          label: `${source.label} Copy`,
          enabled: false,
        },
        ...draft.lenses.slice(index + 1),
      ],
    }));
  }

  function removeLens(index: number) {
    const lens = draft.lenses[index];
    if (!lens) return;
    if (!window.confirm(`Remove "${lens.label}" from the Story Lens draft?`)) return;
    state.setDraft(normalizeStoryLensDocument({
      ...draft,
      lenses: draft.lenses.filter((_, lensIndex) => lensIndex !== index),
    }));
  }

  function moveLens(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.lenses.length) return;
    const lenses = [...draft.lenses];
    const [lens] = lenses.splice(index, 1);
    lenses.splice(nextIndex, 0, lens);
    state.setDraft({ ...draft, lenses });
  }

  async function saveStoryLenses() {
    if (!runner.available) {
      window.alert('Start the local portal runner first: npm run portal:server');
      return;
    }
    if (blockingIssues.length > 0) {
      window.alert(`Fix ${blockingIssues.length} Story Lens issue${blockingIssues.length === 1 ? '' : 's'} before saving.`);
      return;
    }
    if (!window.confirm(`Save ${draft.lenses.length} Story Lens records to the repo and runtime data?`)) return;
    const savedDocument = await runner.saveStoryLenses(draft);
    if (savedDocument) {
      state.acceptSavedDocument(savedDocument);
      onNotice(`Saved ${savedDocument.lenses.length} Story Lens records.`);
    }
  }

  function exportStoryLenses() {
    downloadJson(draft, `cihof-story-lenses-${dateStamp()}.json`);
    onNotice(`Exported ${draft.lenses.length} Story Lens records as JSON.`);
  }

  return (
    <section className="portal-lenses" aria-label="Story Lens editor">
      <div className="portal-readiness__intro portal-lenses__intro">
        <div>
          <p className="eyebrow">Story Lenses</p>
          <h3>Curate the portrait wall questions</h3>
          <p>These records control the large interpretive prompts on All People.</p>
        </div>
        <div className="portal-lenses__actions">
          <button type="button" onClick={addLens}>Add Lens</button>
          <button disabled={!state.isDirty} type="button" onClick={() => state.setDraft(state.document ?? emptyStoryLensDocument())}>Reset Draft</button>
          <button type="button" onClick={() => void state.refresh()}>{state.loading ? 'Loading' : 'Reload JSON'}</button>
          <button type="button" onClick={exportStoryLenses}>Export JSON</button>
          <button disabled={!runner.available || !state.isDirty || blockingIssues.length > 0} type="button" onClick={() => void saveStoryLenses()}>Save To Repo</button>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="portal-validation" aria-label="Story Lens validation">
          <strong>Story Lens validation</strong>
          {issues.map((issue) => (
            <span className={`portal-validation__item portal-validation__item--${issue.severity}`} key={issue.message}>
              {issue.message}
            </span>
          ))}
        </div>
      )}

      {!runner.available && (
        <div className="portal-runner-access">
          <label className="field">
            <span>Runner token</span>
            <input
              autoComplete="off"
              type="password"
              value={runner.token}
              onChange={(event) => runner.setToken(event.target.value)}
              placeholder="Required only for approved external portal origins"
            />
          </label>
          <button type="button" onClick={() => void runner.refresh()}>{runner.checking ? 'Checking' : 'Connect Runner'}</button>
        </div>
      )}

      <div className="portal-lenses__summary">
        <MetricCard label="Lens Records" value={draft.lenses.length} detail={`${draft.lenses.filter((lens) => lens.enabled !== false).length} enabled`} />
        <MetricCard label="Terms" value={draft.lenses.reduce((count, lens) => count + lens.terms.length, 0)} detail="keyword signals" />
        <MetricCard label="Themes" value={draft.lenses.reduce((count, lens) => count + lens.themes.length, 0)} detail="metadata signals" />
        <MetricCard label="Warnings" value={issues.length} detail={`${blockingIssues.length} blocking`} />
      </div>

      <div className="portal-lens-list" aria-label="Editable Story Lenses">
        {draft.lenses.map((lens, index) => (
          <article className={lens.enabled === false ? 'portal-lens-card portal-lens-card--disabled' : 'portal-lens-card'} key={`${lens.id}-${index}`}>
            <header className="portal-lens-card__header">
              <div>
                <span>Lens {index + 1}</span>
                <strong>{lens.prompt || 'Untitled lens'}</strong>
              </div>
              <label className="portal-check portal-check--compact">
                <input checked={lens.enabled !== false} onChange={(event) => patchLens(index, { enabled: event.target.checked })} type="checkbox" />
                <span>Enabled</span>
              </label>
            </header>

            <div className="portal-lens-card__grid">
              <label className="field">
                <span>ID</span>
                <input value={lens.id} onChange={(event) => patchLens(index, { id: slugifyLensId(event.target.value) })} />
              </label>
              <label className="field">
                <span>Short label</span>
                <input value={lens.label} onChange={(event) => patchLens(index, { label: event.target.value })} />
              </label>
              <label className="field">
                <span>Max portraits</span>
                <input min="12" max="96" type="number" value={lens.maxPortraits ?? 48} onChange={(event) => patchLens(index, { maxPortraits: Number(event.target.value) })} />
              </label>
              <label className="field portal-lens-card__wide">
                <span>Prompt</span>
                <input value={lens.prompt} onChange={(event) => patchLens(index, { prompt: event.target.value })} />
              </label>
              <label className="field portal-lens-card__wide">
                <span>Description</span>
                <textarea value={lens.description} onChange={(event) => patchLens(index, { description: event.target.value })} rows={3} />
              </label>
              <label className="field">
                <span>Keyword terms</span>
                <textarea value={joinList(lens.terms)} onChange={(event) => patchLens(index, { terms: parseListInput(event.target.value) })} rows={7} />
              </label>
              <label className="field">
                <span>Theme signals</span>
                <textarea value={joinList(lens.themes)} onChange={(event) => patchLens(index, { themes: parseListInput(event.target.value) })} rows={7} />
              </label>
            </div>

            <footer className="portal-lens-card__actions">
              <button disabled={index === 0} type="button" onClick={() => moveLens(index, -1)}>Move Up</button>
              <button disabled={index === draft.lenses.length - 1} type="button" onClick={() => moveLens(index, 1)}>Move Down</button>
              <button type="button" onClick={() => duplicateLens(index)}>Duplicate</button>
              <button type="button" onClick={() => removeLens(index)}>Remove</button>
            </footer>
          </article>
        ))}
        {draft.lenses.length === 0 && <div className="portal-empty-state">No Story Lenses are defined.</div>}
      </div>
    </section>
  );
}

function ProfileEditor({
  inductee,
  draft,
  mediaRecord,
  needs,
  draftIssues,
  saveState,
  onPatch,
  onClear,
  onOpenProfile,
}: {
  inductee: Inductee;
  draft?: ReviewDraft;
  mediaRecord?: MediaManifestRecord;
  needs: string[];
  draftIssues: DraftIssue[];
  saveState: DraftStorageResult;
  onPatch: (patch: DraftPatch) => void;
  onClear: () => void;
  onOpenProfile: () => void;
}) {
  const approvedSummary = draft?.approvedSummary ?? inductee.storySummary;
  const approvedThemeTags = draft?.approvedThemeTags ?? inductee.themeTags;
  const approvedCountryTags = draft?.approvedCountryTags ?? inductee.countryTags;
  const countryNotes = draft?.countryNotes ?? inductee.countryTagsNote;
  const approvedCommunityTags = draft?.approvedCommunityTags ?? inductee.communityTags;
  const primaryImage = mediaRecord?.images?.primary;
  const firstVideo = mediaRecord?.videos?.[0];

  return (
    <div className="portal-editor">
      <div className="portal-editor__hero">
        <div className="portal-editor__identity">
          <span className="portal-editor__eyebrow">Selected Profile</span>
          <h3>{inductee.name}</h3>
          <p>{inductee.classYear ?? 'Year unknown'} / {countryOrRegionLabel(inductee)}</p>
        </div>
        <div className="portal-editor__actions">
          <span className={saveState.ok ? 'portal-save-state portal-save-state--ok' : 'portal-save-state portal-save-state--bad'}>
            {saveState.message}
          </span>
          <button type="button" onClick={onOpenProfile}>Preview</button>
          <button type="button" onClick={onClear} disabled={!draft}>Clear Draft</button>
        </div>
      </div>

      <div className="portal-editor__needs">
        {needs.length > 0 ? needs.slice(0, 6).map((need) => <Chip key={need} label={need} tone="warn" />) : <Chip label="No open review flags" tone="ok" />}
      </div>

      {draftIssues.length > 0 && (
        <div className="portal-validation" aria-label="Draft validation">
          <strong>Before export</strong>
          {draftIssues.map((issue) => (
            <span className={`portal-validation__item portal-validation__item--${issue.severity}`} key={`${issue.id}-${issue.message}`}>
              {issue.message}
            </span>
          ))}
        </div>
      )}

      <div className="portal-quick-actions" aria-label="Quick decisions">
        <button type="button" onClick={() => onPatch({ approvedSummary, summaryApproved: true })}>Approve Summary</button>
        <button type="button" onClick={() => onPatch({ approvedThemeTags, approvedCountryTags, countryNotes, themeTagsApproved: true, countryTagsApproved: true })}>Approve Metadata</button>
        <button type="button" onClick={() => onPatch({ primaryImageAltText: primaryImage?.altText ?? inductee.imageAltText, imageRightsStatus: 'approved', imageRightsApproved: true })}>Approve Image</button>
        <button type="button" onClick={() => onPatch({ plainLanguageReview: 'approved', sensitiveContentReview: 'approved', imageDescriptionReview: 'approved', accessibilityApproved: true })}>Approve Accessibility</button>
        <button type="button" onClick={() => onPatch({ approvalStatus: 'approved', approveProfile: true })}>Approve Profile</button>
      </div>

      <div className="portal-form-grid">
        <fieldset className="portal-fieldset">
          <legend>Profile Status</legend>
          <label className="field">
            <span>Approval status</span>
            <select value={draft?.approvalStatus ?? inductee.approvalStatus} onChange={(event) => onPatch({ approvalStatus: event.target.value })}>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="needs-revision">Needs revision</option>
            </select>
          </label>
          <label className="field">
            <span>Review priority</span>
            <select value={draft?.reviewPriority ?? inductee.reviewPriority} onChange={(event) => onPatch({ reviewPriority: event.target.value })}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="standard">Standard</option>
            </select>
          </label>
          <label className="portal-check">
            <input checked={Boolean(draft?.approveProfile)} onChange={(event) => onPatch({ approveProfile: event.target.checked })} type="checkbox" />
            <span>Mark profile approved on import</span>
          </label>
          <label className="portal-check">
            <input checked={draft?.featured ?? inductee.featured} onChange={(event) => onPatch({ featured: event.target.checked })} type="checkbox" />
            <span>Feature this person</span>
          </label>
          <label className="portal-check">
            <input checked={draft?.featuredCandidate ?? inductee.featuredCandidate} onChange={(event) => onPatch({ featuredCandidate: event.target.checked })} type="checkbox" />
            <span>Keep as featured candidate</span>
          </label>
          <label className="field">
            <span>Attract priority</span>
            <input
              min="0"
              type="number"
              value={draft?.attractPriority ?? inductee.attractPriority}
              onChange={(event) => onPatch({ attractPriority: Number(event.target.value) })}
            />
          </label>
        </fieldset>

        <fieldset className="portal-fieldset portal-fieldset--wide">
          <legend>Story Summary</legend>
          <label className="field">
            <span>Approved summary</span>
            <textarea value={approvedSummary} onChange={(event) => onPatch({ approvedSummary: event.target.value })} rows={5} />
          </label>
          <label className="portal-check">
            <input checked={Boolean(draft?.summaryApproved)} onChange={(event) => onPatch({ summaryApproved: event.target.checked })} type="checkbox" />
            <span>Use this as the approved summary</span>
          </label>
        </fieldset>

        <fieldset className="portal-fieldset">
          <legend>Metadata</legend>
          <label className="field">
            <span>Approved themes</span>
            <textarea value={joinList(approvedThemeTags)} onChange={(event) => onPatch({ approvedThemeTags: parseListInput(event.target.value) })} rows={4} />
          </label>
          <label className="field">
            <span>Approved countries</span>
            <textarea value={joinList(approvedCountryTags)} onChange={(event) => onPatch({ approvedCountryTags: parseListInput(event.target.value) })} rows={3} />
          </label>
          <label className="field">
            <span>Country note</span>
            <textarea value={countryNotes} onChange={(event) => onPatch({ countryNotes: event.target.value })} rows={3} />
          </label>
          <label className="field">
            <span>Approved communities</span>
            <textarea value={joinList(approvedCommunityTags)} onChange={(event) => onPatch({ approvedCommunityTags: parseListInput(event.target.value) })} rows={3} />
          </label>
          <div className="portal-check-grid">
            <label className="portal-check">
              <input checked={Boolean(draft?.themeTagsApproved)} onChange={(event) => onPatch({ themeTagsApproved: event.target.checked })} type="checkbox" />
              <span>Approve themes</span>
            </label>
            <label className="portal-check">
              <input checked={Boolean(draft?.countryTagsApproved)} onChange={(event) => onPatch({ countryTagsApproved: event.target.checked })} type="checkbox" />
              <span>Approve countries</span>
            </label>
            <label className="portal-check">
              <input checked={Boolean(draft?.communityTagsApproved)} onChange={(event) => onPatch({ communityTagsApproved: event.target.checked })} type="checkbox" />
              <span>Approve communities</span>
            </label>
          </div>
        </fieldset>

        <fieldset className="portal-fieldset">
          <legend>Media</legend>
          <label className="field">
            <span>Primary image alt text</span>
            <textarea value={draft?.primaryImageAltText ?? primaryImage?.altText ?? inductee.imageAltText} onChange={(event) => onPatch({ primaryImageAltText: event.target.value })} rows={3} />
          </label>
          <label className="field">
            <span>Image rights</span>
            <select value={draft?.imageRightsStatus ?? primaryImage?.rightsStatus ?? inductee.imageRightsStatus} onChange={(event) => onPatch({ imageRightsStatus: event.target.value })}>
              <option value="needs-review">Needs review</option>
              <option value="approved">Approved</option>
              <option value="restricted">Restricted</option>
              <option value="not-applicable">Not applicable</option>
            </select>
          </label>
          <label className="portal-check">
            <input checked={Boolean(draft?.imageRightsApproved)} onChange={(event) => onPatch({ imageRightsApproved: event.target.checked })} type="checkbox" />
            <span>Approve image rights</span>
          </label>

          {inductee.hasVideo ? (
            <>
              <label className="field">
                <span>Video rights</span>
                <select value={draft?.videoRightsStatus ?? firstVideo?.rightsStatus ?? inductee.videoRightsStatus} onChange={(event) => onPatch({ videoRightsStatus: event.target.value })}>
                  <option value="needs-review">Needs review</option>
                  <option value="approved">Approved</option>
                  <option value="restricted">Restricted</option>
                  <option value="not-applicable">Not applicable</option>
                </select>
              </label>
              <label className="field">
                <span>Caption status</span>
                <select value={draft?.captionStatus ?? firstVideo?.captionStatus ?? 'review-needed'} onChange={(event) => onPatch({ captionStatus: event.target.value })}>
                  <option value="review-needed">Review needed</option>
                  <option value="approved">Approved</option>
                  <option value="missing">Missing</option>
                  <option value="not-applicable">Not applicable</option>
                </select>
              </label>
              <label className="field">
                <span>Transcript status</span>
                <select value={draft?.transcriptStatus ?? firstVideo?.transcriptStatus ?? 'review-needed'} onChange={(event) => onPatch({ transcriptStatus: event.target.value })}>
                  <option value="review-needed">Review needed</option>
                  <option value="approved">Approved</option>
                  <option value="missing">Missing</option>
                  <option value="not-applicable">Not applicable</option>
                </select>
              </label>
              <div className="portal-check-grid">
                <label className="portal-check">
                  <input checked={Boolean(draft?.videoRightsApproved)} onChange={(event) => onPatch({ videoRightsApproved: event.target.checked })} type="checkbox" />
                  <span>Approve video rights</span>
                </label>
                <label className="portal-check">
                  <input checked={Boolean(draft?.captionsApproved)} onChange={(event) => onPatch({ captionsApproved: event.target.checked })} type="checkbox" />
                  <span>Approve captions</span>
                </label>
                <label className="portal-check">
                  <input checked={Boolean(draft?.transcriptApproved)} onChange={(event) => onPatch({ transcriptApproved: event.target.checked })} type="checkbox" />
                  <span>Approve transcript</span>
                </label>
              </div>
            </>
          ) : (
            <div className="portal-empty-state">No video linked for this profile.</div>
          )}

          <label className="field">
            <span>Media notes</span>
            <textarea value={joinList(draft?.mediaNotes ?? mediaRecord?.notes ?? [])} onChange={(event) => onPatch({ mediaNotes: parseListInput(event.target.value) })} rows={3} />
          </label>
        </fieldset>

        <fieldset className="portal-fieldset">
          <legend>Accessibility</legend>
          <label className="field">
            <span>Plain language</span>
            <select value={draft?.plainLanguageReview ?? 'needed'} onChange={(event) => onPatch({ plainLanguageReview: event.target.value })}>
              <option value="needed">Needed</option>
              <option value="approved">Approved</option>
              <option value="needs-revision">Needs revision</option>
            </select>
          </label>
          <label className="field">
            <span>Sensitive content</span>
            <select value={draft?.sensitiveContentReview ?? 'needed'} onChange={(event) => onPatch({ sensitiveContentReview: event.target.value })}>
              <option value="needed">Needed</option>
              <option value="approved">Approved</option>
              <option value="needs-revision">Needs revision</option>
            </select>
          </label>
          <label className="field">
            <span>Image description</span>
            <select value={draft?.imageDescriptionReview ?? 'needed'} onChange={(event) => onPatch({ imageDescriptionReview: event.target.value })}>
              <option value="needed">Needed</option>
              <option value="approved">Approved</option>
              <option value="needs-revision">Needs revision</option>
            </select>
          </label>
          <label className="portal-check">
            <input checked={Boolean(draft?.accessibilityApproved)} onChange={(event) => onPatch({ accessibilityApproved: event.target.checked })} type="checkbox" />
            <span>Mark accessibility approved</span>
          </label>
        </fieldset>

        <fieldset className="portal-fieldset portal-fieldset--wide">
          <legend>Curator Notes</legend>
          <label className="field">
            <span>Notes, one per line</span>
            <textarea value={joinList(draft?.curatorNotes ?? [])} onChange={(event) => onPatch({ curatorNotes: parseListInput(event.target.value) })} rows={4} />
          </label>
        </fieldset>
      </div>
    </div>
  );
}

function ReadinessPanel({
  summary,
  curation,
  media,
  inductees,
  drafts,
  onQueueChange,
}: {
  summary: ReturnType<typeof buildDashboardSummary>;
  curation: CurationReport | null;
  media: MediaReport | null;
  inductees: Inductee[];
  drafts: DraftMap;
  onQueueChange: (queue: QueueMode) => void;
}) {
  const countryIds = inductees.filter((item) => item.countryTagsSource !== 'curated').map((item) => item.id);
  const imageIds = media?.summary?.imageRightsNeedsReview ?? curation?.media?.imageRightsReviewNeeded ?? [];
  const videoIds = Array.from(new Set([...(media?.summary?.missingCaptions ?? []), ...(media?.summary?.missingTranscripts ?? []), ...(curation?.media?.captionTranscriptReviewNeeded ?? [])]));
  const accessibilityIds = Array.from(new Set([
    ...(curation?.accessibility?.plainLanguageReviewNeeded ?? []),
    ...(curation?.accessibility?.sensitiveContentReviewNeeded ?? []),
    ...(curation?.accessibility?.imageDescriptionReviewNeeded ?? []),
  ]));

  return (
    <section className="portal-readiness" aria-label="Kiosk readiness">
      <div className="portal-readiness__intro">
        <p className="eyebrow">Museum Readiness</p>
        <h3>{summary.kioskReady ? 'Ready for kiosk validation' : 'Still needs staff decisions'}</h3>
        <p>Use these queues to move profiles from generated/imported metadata to curator-approved installation data.</p>
      </div>
      <div className="portal-readiness__grid">
        <ReadinessCard title="Profile approval" ready={summary.approvedProfiles + summary.draftApprovedProfiles} total={summary.totalProfiles} action="Open high priority" onClick={() => onQueueChange('high')} />
        <ReadinessCard title="Country labels" ready={summary.approvedCountries + summary.draftApprovedCountries} total={summary.totalProfiles} action="Review countries" onClick={() => onQueueChange('country')} ids={countryIds} />
        <ReadinessCard title="Summaries" ready={summary.approvedSummaries + summary.draftApprovedSummaries} total={summary.totalProfiles} action="Review summaries" onClick={() => onQueueChange('summary')} />
        <ReadinessCard title="Primary image rights" ready={summary.primaryImagesReady + summary.draftApprovedImages} total={summary.totalProfiles} action="Review images" onClick={() => onQueueChange('image-rights')} ids={imageIds} />
        <ReadinessCard title="Video captions" ready={summary.videosReady + summary.draftApprovedVideos} total={Math.max(summary.videoItems, 1)} action="Review videos" onClick={() => onQueueChange('video-captions')} ids={videoIds} />
        <ReadinessCard title="Accessibility" ready={summary.draftApprovedAccessibility} total={summary.totalProfiles} action="Review accessibility" onClick={() => onQueueChange('accessibility')} ids={accessibilityIds} />
      </div>
      <div className="portal-readiness__notes">
        <strong>{Object.keys(drafts).length} local draft records staged</strong>
        <span>Drafts are browser-local until exported and applied through the project scripts.</span>
      </div>
    </section>
  );
}

function ExportPanel({
  draftCount,
  editedRows,
  reports,
  runner,
  drafts,
  draftIssues,
  importInputRef,
  onClearDrafts,
  onExportDraftJson,
  onExportDecisionCsv,
  onExportVisibleCsv,
  onImportDraftJson,
  onRunScript,
  onApplyDrafts,
}: {
  draftCount: number;
  editedRows: Inductee[];
  reports: ReportState;
  runner: RunnerState;
  drafts: DraftMap;
  draftIssues: DraftIssue[];
  importInputRef: MutableRefObject<HTMLInputElement | null>;
  onClearDrafts: () => void;
  onExportDraftJson: () => void;
  onExportDecisionCsv: () => void;
  onExportVisibleCsv: () => void;
  onImportDraftJson: (event: ChangeEvent<HTMLInputElement>) => void;
  onRunScript: (script: RunnerScript) => void;
  onApplyDrafts: (dryRun: boolean) => void;
}) {
  return (
    <section className="portal-exports" aria-label="Decision exports">
      <div className="portal-readiness__intro">
        <p className="eyebrow">Exports</p>
        <h3>Move portal decisions into the repo</h3>
        <p>Export the edited decision CSV, apply it with the existing scripts, regenerate data, and rebuild the kiosk.</p>
      </div>

      <div className="portal-export-actions">
        <button disabled={!runner.available || draftCount === 0} type="button" onClick={() => onApplyDrafts(true)}>Dry Run Portal Edits</button>
        <button disabled={!runner.available || draftCount === 0 || draftIssues.some((issue) => issue.severity === 'error')} type="button" onClick={() => onApplyDrafts(false)}>Apply Portal Edits</button>
        <button disabled={draftCount === 0} type="button" onClick={onExportDecisionCsv}>Export Edited Decisions CSV</button>
        <button disabled={draftCount === 0} type="button" onClick={onExportDraftJson}>Export Draft JSON</button>
        <button type="button" onClick={onExportVisibleCsv}>Export Current Queue CSV</button>
        <button type="button" onClick={() => importInputRef.current?.click()}>Import Draft JSON</button>
        <button disabled={draftCount === 0} type="button" onClick={onClearDrafts}>Clear Local Drafts</button>
      </div>
      <input ref={importInputRef} className="portal-file-input" accept="application/json,.json" type="file" onChange={onImportDraftJson} />

      <div className="portal-export-summary">
        <MetricCard label="Edited Records" value={editedRows.length} detail={`${draftCount} browser draft entries`} />
        <MetricCard label="Draft Warnings" value={draftIssues.length} detail={`${draftIssues.filter((issue) => issue.severity === 'error').length} blocking issues`} />
        <MetricCard label="Curation Errors" value={reports.curation?.validation?.errors?.length ?? 0} detail={statusLabel(reports.curation?.validation?.errors?.length ?? 0, reports.curation?.validation?.warnings?.length ?? 0)} />
        <MetricCard label="Media Errors" value={reports.media?.validation?.errors?.length ?? 0} detail={statusLabel(reports.media?.validation?.errors?.length ?? 0, reports.media?.validation?.warnings?.length ?? 0)} />
      </div>

      <PortalRunnerPanel runner={runner} onRunScript={onRunScript} />

      {draftIssues.length > 0 && (
        <div className="portal-validation portal-validation--exports" aria-label="Draft export warnings">
          <strong>Review before applying</strong>
          {draftIssues.slice(0, 12).map((issue) => (
            <span className={`portal-validation__item portal-validation__item--${issue.severity}`} key={`${issue.id}-${issue.message}`}>
              {issue.name}: {issue.message}
            </span>
          ))}
          {draftIssues.length > 12 && <span className="portal-validation__more">+{draftIssues.length - 12} more issues</span>}
        </div>
      )}

      <div className="portal-command-box">
        <strong>Apply flow</strong>
        <code>npm run curate:apply -- --input=/path/to/cihof-portal-decisions-YYYY-MM-DD.csv --dry-run</code>
        <code>npm run media:apply -- --input=/path/to/cihof-portal-decisions-YYYY-MM-DD.csv --dry-run</code>
        <code>npm run build</code>
      </div>

      <div className="portal-draft-list">
        {editedRows.map((inductee) => (
          <div key={inductee.id}>
            <strong>{inductee.name}</strong>
            <span>{Object.keys(drafts[inductee.id] ?? {}).filter((key) => key !== 'id' && key !== 'updatedAt').length} edited fields</span>
          </div>
        ))}
        {editedRows.length === 0 && <div className="portal-empty-state">No local edits yet.</div>}
      </div>
    </section>
  );
}

function PortalRunnerPanel({ runner, onRunScript }: { runner: RunnerState; onRunScript: (script: RunnerScript) => void }) {
  const latestJob = runner.activeJob ?? runner.jobs[0] ?? null;

  return (
    <section className={runner.available ? 'portal-runner portal-runner--online' : 'portal-runner'} aria-label="Local script runner">
      <div className="portal-runner__header">
        <div>
          <p className="eyebrow">Local Runner</p>
          <h4>{runner.available ? 'Connected to localhost runner' : 'Runner not connected'}</h4>
          <span>{runner.available ? 'Portal can run whitelisted repo scripts on this machine.' : 'Start it with npm run portal:server, then refresh this panel.'}</span>
        </div>
        <button type="button" onClick={() => void runner.refresh()}>{runner.checking ? 'Checking' : 'Refresh'}</button>
      </div>

      {runner.error && <div className="portal-runner__error">{runner.error}</div>}

      <div className="portal-runner-access portal-runner-access--embedded">
        <label className="field">
          <span>Runner token</span>
          <input
            autoComplete="off"
            type="password"
            value={runner.token}
            onChange={(event) => runner.setToken(event.target.value)}
            placeholder="Only needed from approved external portal origins"
          />
        </label>
        <button type="button" onClick={() => void runner.refresh()}>{runner.checking ? 'Checking' : 'Reconnect'}</button>
      </div>

      <div className="portal-runner__scripts" aria-label="Available scripts">
        {runner.scripts.map((script) => (
          <button
            className={script.destructive ? 'portal-runner-script portal-runner-script--danger' : 'portal-runner-script'}
            disabled={!runner.available || runner.activeJob?.status === 'running'}
            key={script.id}
            type="button"
            onClick={() => onRunScript(script)}
          >
            <strong>{script.label}</strong>
            <span>{script.description}</span>
            {script.strict && <em>Strict</em>}
            {script.destructive && <em>Careful</em>}
          </button>
        ))}
        {runner.scripts.length === 0 && <div className="portal-empty-state">No runner scripts loaded.</div>}
      </div>

      {latestJob && (
        <div className="portal-runner-job" aria-label="Latest runner job">
          <div className="portal-runner-job__summary">
            <strong>{latestJob.label}</strong>
            <span className={`portal-runner-job__status portal-runner-job__status--${latestJob.status}`}>{latestJob.status}</span>
            {latestJob.currentStep && <span>{latestJob.currentStep}</span>}
          </div>
          {latestJob.steps && latestJob.steps.length > 0 && (
            <div className="portal-runner-steps">
              {latestJob.steps.map((step) => (
                <span className={`portal-runner-step portal-runner-step--${step.status}`} key={`${latestJob.id}-${step.label}`}>
                  {step.label}: {step.status}
                </span>
              ))}
            </div>
          )}
          <pre>{latestJob.output || 'No output yet.'}</pre>
        </div>
      )}
    </section>
  );
}

function useReviewReports(): ReportState {
  const [state, setState] = useState<ReportState>({ curation: null, media: null, manifest: null, loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchJson<CurationReport>(reportUrls.curation), fetchJson<MediaReport>(reportUrls.media), fetchJson<MediaManifest>(reportUrls.manifest)])
      .then(([curation, media, manifest]) => {
        if (!cancelled) setState({ curation, media, manifest, loading: false, error: '' });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ curation: null, media: null, manifest: null, loading: false, error: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

function useStoryLensDocument(): StoryLensEditorState {
  const [document, setDocument] = useState<StoryLensDocument | null>(null);
  const [draft, setDraft] = useState<StoryLensDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isDirty = useMemo(() => JSON.stringify(document) !== JSON.stringify(draft), [document, draft]);

  async function refresh() {
    setLoading(true);
    try {
      const payload = await fetchJson<StoryLensDocument>(reportUrls.storyLenses);
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

function usePortalRunner(): RunnerState {
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [scripts, setScripts] = useState<RunnerScript[]>([]);
  const [jobs, setJobs] = useState<RunnerJob[]>([]);

  const activeJob = jobs.find((job) => job.status === 'running' || job.status === 'queued') ?? null;

  async function refresh() {
    setChecking(true);
    try {
      const [health, scriptPayload, jobPayload] = await Promise.all([
        fetchRunner<{ ok: boolean }>('/api/health', token),
        fetchRunner<{ scripts: RunnerScript[] }>('/api/scripts', token),
        fetchRunner<{ jobs: RunnerJob[] }>('/api/jobs', token),
      ]);
      setAvailable(Boolean(health.ok));
      setScripts(scriptPayload.scripts ?? []);
      setJobs(jobPayload.jobs ?? []);
      setError('');
    } catch (errorValue) {
      setAvailable(false);
      setScripts([]);
      setJobs([]);
      setError(errorValue instanceof Error ? errorValue.message : 'Local portal runner is not available.');
    } finally {
      setChecking(false);
    }
  }

  async function runScript(scriptId: string) {
    try {
      const payload = await postRunner<{ job: RunnerJob }>('/api/run', { scriptId }, token);
      await refresh();
      return payload.job;
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : 'Could not start script.');
      return null;
    }
  }

  async function applyDecisions(csv: string, dryRun: boolean) {
    try {
      const payload = await postRunner<{ job: RunnerJob }>('/api/apply-decisions', { csv, dryRun, targets: ['curation', 'media'] }, token);
      await refresh();
      return payload.job;
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : 'Could not start portal decision apply.');
      return null;
    }
  }

  async function saveStoryLenses(document: StoryLensDocument) {
    try {
      const payload = await postRunner<{ document: StoryLensDocument }>('/api/story-lenses', { document }, token);
      await refresh();
      return normalizeStoryLensDocument(payload.document);
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : 'Could not save Story Lens JSON.');
      return null;
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refresh();
    }, activeJob ? 1500 : 6000);
    return () => window.clearInterval(interval);
  }, [activeJob?.id, activeJob?.status, token]);

  return { available, checking, error, token, scripts, jobs, activeJob, setToken, refresh, runScript, applyDecisions, saveStoryLenses };
}

function fetchJson<T>(url: string): Promise<T> {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${url} failed with ${response.status}`);
    return response.json() as Promise<T>;
  });
}

function fetchRunner<T>(path: string, token = ''): Promise<T> {
  return fetch(`${portalRunnerBaseUrl}${path}`, {
    cache: 'no-store',
    headers: runnerHeaders(token),
  }).then((response) => {
    if (!response.ok) throw new Error(`Portal runner ${path} failed with ${response.status}`);
    return response.json() as Promise<T>;
  });
}

function postRunner<T>(path: string, body: unknown, token = ''): Promise<T> {
  return fetch(`${portalRunnerBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...runnerHeaders(token) },
    body: JSON.stringify(body),
  }).then((response) => {
    if (!response.ok) {
      return response.json().catch(() => ({})).then((payload: { error?: string }) => {
        throw new Error(payload.error || `Portal runner ${path} failed with ${response.status}`);
      });
    }
    return response.json() as Promise<T>;
  });
}

function runnerHeaders(token: string): HeadersInit {
  return token ? { 'x-cihof-portal-token': token } : {};
}

function buildDashboardSummary(inductees: Inductee[], curation: CurationReport | null, media: MediaReport | null, drafts: DraftMap) {
  const totalProfiles = inductees.length;
  const draftValues = Object.values(drafts);
  const approvedProfiles = inductees.filter((item) => item.approvalStatus === 'approved').length;
  const highPriority = inductees.filter((item) => item.reviewPriority === 'high').length;
  const mediumPriority = inductees.filter((item) => item.reviewPriority === 'medium').length;
  const standardPriority = inductees.filter((item) => item.reviewPriority === 'standard').length;
  const localPrimaryImages = inductees.filter((item) => item.primaryImageUrl.startsWith('/media/')).length;
  const primaryImagesReady = media?.summary?.primaryImagesReady ?? 0;
  const videosReady = media?.summary?.videosReady ?? 0;
  const videoItems = media?.summary?.videoItems ?? 0;
  const missingCaptions = media?.summary?.missingCaptions?.length ?? 0;
  const approvedCountries = curation?.countries?.approved ?? inductees.filter((item) => item.countryTagsSource === 'curated').length;
  const inferredCountries = curation?.countries?.inferred ?? inductees.filter((item) => item.countryTagsSource === 'inferred').length;

  return {
    totalProfiles,
    approvedProfiles,
    draftProfiles: totalProfiles - approvedProfiles,
    highPriority,
    mediumPriority,
    standardPriority,
    approvedSummaries: curation?.summaries?.approved ?? 0,
    summaryDrafts: curation?.summaries?.draftOnly?.length ?? inductees.filter((item) => item.storySummarySource !== 'curated').length,
    truncatedDrafts: curation?.summaries?.truncatedDrafts?.length ?? 0,
    approvedThemes: curation?.themes?.approved ?? 0,
    themeCandidates: curation?.themes?.candidateOnly?.length ?? inductees.filter((item) => item.themeTagsSource !== 'curated').length,
    approvedCountries,
    inferredCountries,
    countryNeedsReview: inductees.filter((item) => item.countryTagsSource !== 'curated').length,
    localPrimaryImages,
    primaryImagesReady,
    videosReady,
    videoItems,
    missingCaptions,
    draftApprovedProfiles: draftValues.filter((draft) => draft.approveProfile || draft.approvalStatus === 'approved').length,
    draftApprovedSummaries: draftValues.filter((draft) => draft.summaryApproved || Boolean(draft.approvedSummary)).length,
    draftApprovedCountries: draftValues.filter((draft) => draft.countryTagsApproved || (draft.approvedCountryTags?.length ?? 0) > 0).length,
    draftApprovedImages: draftValues.filter((draft) => draft.imageRightsApproved || draft.imageRightsStatus === 'approved').length,
    draftApprovedVideos: draftValues.filter((draft) => draft.videoRightsApproved || draft.captionsApproved || draft.transcriptApproved).length,
    draftApprovedAccessibility: draftValues.filter((draft) => draft.accessibilityApproved).length,
    kioskReady: primaryImagesReady === totalProfiles && videoItems === videosReady && (media?.validation?.errors?.length ?? 0) === 0,
  };
}

function buildQueueOptions(inductees: Inductee[], curation: CurationReport | null, media: MediaReport | null, drafts: DraftMap) {
  const options: Array<{ mode: QueueMode; label: string }> = [
    { mode: 'high', label: 'High priority' },
    { mode: 'edited', label: 'Local draft edits' },
    { mode: 'country', label: 'Country review' },
    { mode: 'summary', label: 'Summary drafts' },
    { mode: 'themes', label: 'Theme candidates' },
    { mode: 'image-rights', label: 'Image rights' },
    { mode: 'video-captions', label: 'Video captions' },
    { mode: 'accessibility', label: 'Accessibility' },
    { mode: 'featured', label: 'Featured candidates' },
    { mode: 'all', label: 'All profiles' },
  ];

  return options.map((option) => ({
    ...option,
    count: inductees.filter((inductee) => matchesQueue(inductee, option.mode, curation, media, drafts)).length,
  }));
}

function buildActionItems(summary: ReturnType<typeof buildDashboardSummary>, draftCount: number) {
  const items: Array<{ label: string; detail: string; queue: QueueMode; priority: number }> = [];

  if (draftCount > 0) {
    items.push({
      label: 'Review Staged Edits',
      detail: `${draftCount} local drafts should be exported or cleared`,
      queue: 'edited',
      priority: 0,
    });
  }
  if (summary.countryNeedsReview > summary.draftApprovedCountries) {
    items.push({
      label: 'Approve Countries',
      detail: `${summary.countryNeedsReview - summary.draftApprovedCountries} country labels still need review`,
      queue: 'country',
      priority: 1,
    });
  }
  if (summary.summaryDrafts > summary.draftApprovedSummaries) {
    items.push({
      label: 'Tighten Summaries',
      detail: `${summary.summaryDrafts - summary.draftApprovedSummaries} generated summaries need curator approval`,
      queue: 'summary',
      priority: 2,
    });
  }
  if (summary.missingCaptions > 0) {
    items.push({
      label: 'Fix Video Access',
      detail: `${summary.missingCaptions} caption files are still missing`,
      queue: 'video-captions',
      priority: 3,
    });
  }
  if (summary.primaryImagesReady < summary.totalProfiles) {
    items.push({
      label: 'Approve Images',
      detail: `${summary.totalProfiles - summary.primaryImagesReady} primary images are not kiosk-ready`,
      queue: 'image-rights',
      priority: 4,
    });
  }
  if (items.length === 0) {
    items.push({
      label: 'Audit All Profiles',
      detail: 'No urgent queue is currently above threshold',
      queue: 'all',
      priority: 9,
    });
  }

  return items.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

function matchesQueue(inductee: Inductee, queue: QueueMode, curation: CurationReport | null, media: MediaReport | null, drafts: DraftMap) {
  if (queue === 'all') return true;
  if (queue === 'edited') return Boolean(drafts[inductee.id]);
  if (queue === 'high') return inductee.reviewPriority === 'high';
  if (queue === 'country') return inductee.countryTagsSource !== 'curated' || Boolean(drafts[inductee.id]?.countryTagsApproved);
  if (queue === 'featured') return inductee.featuredCandidate && !inductee.featured;
  if (queue === 'summary') return inductee.storySummarySource !== 'curated';
  if (queue === 'themes') return inductee.themeTagsSource !== 'curated';
  if (queue === 'image-rights') return inductee.imageRightsStatus !== 'approved' || hasId(media?.summary?.imageRightsNeedsReview, inductee.id);
  if (queue === 'video-captions') return Boolean(curation?.media?.captionTranscriptReviewNeeded?.includes(inductee.id)) || (inductee.hasVideo && inductee.videoRightsStatus !== 'approved');
  if (queue === 'accessibility') {
    return Boolean(
      curation?.accessibility?.plainLanguageReviewNeeded?.includes(inductee.id) ||
        curation?.accessibility?.sensitiveContentReviewNeeded?.includes(inductee.id) ||
        curation?.accessibility?.imageDescriptionReviewNeeded?.includes(inductee.id),
    );
  }
  return true;
}

function getDraftIssues(inductee: Inductee, draft: ReviewDraft | undefined, mediaRecord?: MediaManifestRecord): DraftIssue[] {
  if (!draft) return [];
  const issues: DraftIssue[] = [];
  const add = (message: string, severity: DraftIssue['severity'] = 'warning') => {
    issues.push({ id: inductee.id, name: inductee.name, message, severity });
  };
  const firstVideo = mediaRecord?.videos?.[0];
  const approvedSummary = draft.approvedSummary?.trim() ?? '';

  if (draft.summaryApproved && approvedSummary.length < 80) add('Approved summary is very short or empty.', 'error');
  if (draft.themeTagsApproved && (draft.approvedThemeTags?.length ?? 0) === 0) add('Theme approval is checked but no approved themes are staged.', 'error');
  if (draft.countryTagsApproved && (draft.approvedCountryTags?.length ?? 0) === 0) add('Country approval is checked but no approved countries are staged.', 'error');
  if (draft.communityTagsApproved && (draft.approvedCommunityTags?.length ?? 0) === 0) add('Community approval is checked but no approved communities are staged.');
  if (draft.approveProfile && !draft.summaryApproved && !draft.approvedSummary) add('Profile approval is staged before summary approval.');
  if (draft.approveProfile && !draft.countryTagsApproved && (draft.approvedCountryTags?.length ?? 0) === 0 && inductee.countryTagsSource !== 'curated') {
    add('Profile approval is staged before country metadata is curator-approved.');
  }
  if (draft.primaryImageAltText !== undefined && draft.primaryImageAltText.trim().length < 20) add('Primary image alt text is very short.');
  if (draft.imageRightsApproved && draft.imageRightsStatus && draft.imageRightsStatus !== 'approved') add('Image rights approval conflicts with a non-approved rights status.', 'error');
  if (draft.videoRightsApproved && draft.videoRightsStatus && draft.videoRightsStatus !== 'approved') add('Video rights approval conflicts with a non-approved rights status.', 'error');
  if (draft.captionsApproved && inductee.hasVideo && !firstVideo?.captionFilePath && !firstVideo?.captionRuntimePath) add('Captions are marked approved but no caption file is linked.');
  if (draft.transcriptApproved && inductee.hasVideo && !firstVideo?.transcriptFilePath && !firstVideo?.transcriptRuntimePath) {
    add('Transcript is marked approved but no transcript file is linked.');
  }
  if ((draft.videoRightsApproved || draft.captionsApproved || draft.transcriptApproved) && inductee.hasVideo && !mediaRecord?.videos?.length) {
    add('Video decisions are staged but no video record is loaded from the media manifest.', 'error');
  }
  if (draft.accessibilityApproved && (!draft.plainLanguageReview || !draft.sensitiveContentReview || !draft.imageDescriptionReview)) {
    add('Accessibility is marked approved without all three accessibility fields staged as approved.');
  }

  return issues;
}

function matchesSearch(inductee: Inductee, draft: ReviewDraft | undefined, search: string) {
  const draftText = draft
    ? [
        draft.approvedSummary,
        draft.countryNotes,
        ...(draft.approvedThemeTags ?? []),
        ...(draft.approvedCountryTags ?? []),
        ...(draft.approvedCommunityTags ?? []),
        ...(draft.curatorNotes ?? []),
      ].join(' ')
    : '';
  return [inductee.searchText, inductee.id, draftText].join(' ').toLowerCase().includes(search);
}

function getReviewNeeds(inductee: Inductee, curation: CurationReport | null, media: MediaReport | null, draft?: ReviewDraft) {
  const needs: string[] = [];
  const profileApproved = draft?.approveProfile || draft?.approvalStatus === 'approved' || inductee.approvalStatus === 'approved';
  const summaryApproved = draft?.summaryApproved || Boolean(draft?.approvedSummary) || inductee.storySummarySource === 'curated';
  const themesApproved = draft?.themeTagsApproved || (draft?.approvedThemeTags?.length ?? 0) > 0 || inductee.themeTagsSource === 'curated';
  const countriesApproved = draft?.countryTagsApproved || (draft?.approvedCountryTags?.length ?? 0) > 0 || inductee.countryTagsSource === 'curated';
  const imageApproved = draft?.imageRightsApproved || draft?.imageRightsStatus === 'approved' || inductee.imageRightsStatus === 'approved';
  const videoApproved = !inductee.hasVideo || draft?.videoRightsApproved || draft?.videoRightsStatus === 'approved' || inductee.videoRightsStatus === 'approved';
  const captionsApproved = !inductee.hasVideo || draft?.captionsApproved || draft?.captionStatus === 'approved';
  const transcriptApproved = !inductee.hasVideo || draft?.transcriptApproved || draft?.transcriptStatus === 'approved';
  const accessibilityApproved = draft?.accessibilityApproved;

  if (!profileApproved) needs.push('Approve profile metadata');
  if (!summaryApproved) needs.push('Approve or rewrite story summary');
  if (!themesApproved) needs.push('Approve theme tags');
  if (!countriesApproved) needs.push('Approve country tags');
  if (inductee.featuredCandidate && !inductee.featured && draft?.featured !== true) needs.push('Featured story decision');
  if (!imageApproved || hasId(curation?.media?.imageRightsReviewNeeded, inductee.id) || hasId(media?.summary?.imageRightsNeedsReview, inductee.id)) {
    needs.push('Approve primary image rights');
  }
  if (hasId(media?.summary?.missingPrimaryLocalFiles, inductee.id)) needs.push('Localize primary image');

  if (inductee.hasVideo) {
    if (!videoApproved || hasId(curation?.media?.videoRightsReviewNeeded, inductee.id) || hasId(media?.summary?.videoRightsNeedsReview, inductee.id)) {
      needs.push('Approve video rights');
    }
    if (!captionsApproved || hasId(curation?.media?.captionTranscriptReviewNeeded, inductee.id) || hasId(media?.summary?.missingCaptions, inductee.id)) needs.push('Add captions');
    if (!transcriptApproved || hasId(media?.summary?.missingTranscripts, inductee.id)) needs.push('Add transcript');
    if (hasId(media?.summary?.missingVideoLocalFiles, inductee.id)) needs.push('Localize video file');
    if (hasId(media?.summary?.missingVideoPosters, inductee.id)) needs.push('Add video poster');
  }

  if (!accessibilityApproved && hasId(curation?.accessibility?.plainLanguageReviewNeeded, inductee.id)) needs.push('Plain-language review');
  if (!accessibilityApproved && hasId(curation?.accessibility?.sensitiveContentReviewNeeded, inductee.id)) needs.push('Sensitive-content review');
  if (!accessibilityApproved && hasId(curation?.accessibility?.imageDescriptionReviewNeeded, inductee.id)) needs.push('Image description review');

  return Array.from(new Set(needs));
}

function emptyStoryLensDocument(): StoryLensDocument {
  return {
    schemaVersion: 1,
    source: {
      name: 'CIHOF story lenses',
      note: 'Curator-editable interpretive prompts for arranging the All People portrait wall.',
    },
    lenses: [],
  };
}

function normalizeStoryLensDocument(input: unknown): StoryLensDocument {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input as Partial<StoryLensDocument> : {};
  const sourceInfo = source.source && typeof source.source === 'object'
    ? {
        name: typeof source.source.name === 'string' ? source.source.name.trim() : 'CIHOF story lenses',
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
    maxPortraits: typeof lens.maxPortraits === 'number' && Number.isFinite(lens.maxPortraits) ? Math.round(lens.maxPortraits) : 48,
    enabled: lens.enabled !== false,
  };
}

function getStoryLensDraftIssues(document: StoryLensDocument): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const ids = new Set<string>();
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
  });

  if (document.lenses.filter((lens) => lens.enabled !== false).length === 0) add('At least one Story Lens should be enabled.', 'error');
  return issues;
}

function hasId(values: string[] | undefined, id: string) {
  return Boolean(values?.includes(id));
}

function formatNeeds(needs: string[]) {
  if (needs.length === 0) return 'No open review flags';
  return needs.slice(0, 3).join(' / ') + (needs.length > 3 ? ` / +${needs.length - 3}` : '');
}

function downloadReviewQueue(inductees: Inductee[], curation: CurationReport | null, media: MediaReport | null, manifest: MediaManifest | null, drafts: DraftMap, queue: string) {
  if (inductees.length === 0) {
    window.alert('There are no rows to export for this queue.');
    return;
  }
  const csv = buildReviewCsv(inductees, curation, media, manifest, drafts);
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `cihof-${queue}-review-queue-${dateStamp()}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildReviewCsv(inductees: Inductee[], curation: CurationReport | null, media: MediaReport | null, manifest: MediaManifest | null, drafts: DraftMap) {
  const headers = [
    'id',
    'name',
    'class_year',
    'country_tags',
    'country_source',
    'country_note',
    'approved_country_tags',
    'country_tags_approved',
    'region',
    'profile_url',
    'approval_status',
    'review_priority',
    'approve_profile',
    'featured_candidate',
    'featured',
    'attract_priority',
    'current_summary',
    'approved_summary',
    'summary_approved',
    'summary_source',
    'current_theme_tags',
    'approved_theme_tags',
    'theme_tags_approved',
    'theme_source',
    'current_community_tags',
    'approved_community_tags',
    'community_tags_approved',
    'primary_image_source_url',
    'primary_image_file_path',
    'primary_image_runtime_path',
    'primary_image_checksum_sha256',
    'primary_image_width',
    'primary_image_height',
    'primary_image_local',
    'primary_image_alt_text',
    'image_rights_status',
    'image_rights_approved',
    'primary_image_kiosk_approved',
    'has_video',
    'video_count',
    'video_index',
    'video_source_url',
    'youtube_video_id',
    'video_file_path',
    'video_runtime_path',
    'video_poster_file_path',
    'video_poster_runtime_path',
    'caption_file_path',
    'caption_runtime_path',
    'transcript_file_path',
    'transcript_runtime_path',
    'duration_seconds',
    'codec',
    'video_rights_status',
    'video_rights_approved',
    'caption_status',
    'captions_approved',
    'transcript_status',
    'transcript_approved',
    'audio_description_status',
    'video_kiosk_approved',
    'accessibility_approved',
    'plain_language_review',
    'sensitive_content_review',
    'image_description_review',
    'curator_notes',
    'media_notes',
    'review_needs',
  ];
  const rows = inductees.map((inductee) => {
    const draft = drafts[inductee.id];
    const mediaRecord = manifest?.assets?.[inductee.id];
    const primaryImage = mediaRecord?.images?.primary;
    const videos = mediaRecord?.videos ?? [];
    const firstVideo = videos[0];

    return [
      inductee.id,
      inductee.name,
      inductee.classYear ?? '',
      inductee.countryTags.join('; '),
      inductee.countryTagsSource,
      draft?.countryNotes ?? inductee.countryTagsNote,
      (draft?.approvedCountryTags ?? []).join('; '),
      toDecisionFlag(draft?.countryTagsApproved),
      inductee.region,
      inductee.profileUrl,
      draft?.approvalStatus ?? '',
      draft?.reviewPriority ?? '',
      toDecisionFlag(draft?.approveProfile),
      toDecisionFlag(draft?.featuredCandidate),
      toDecisionFlag(draft?.featured),
      draft?.attractPriority ?? '',
      inductee.storySummary,
      draft?.approvedSummary ?? '',
      toDecisionFlag(draft?.summaryApproved),
      inductee.storySummarySource,
      inductee.themeTags.join('; '),
      (draft?.approvedThemeTags ?? []).join('; '),
      toDecisionFlag(draft?.themeTagsApproved),
      inductee.themeTagsSource,
      inductee.communityTags.join('; '),
      (draft?.approvedCommunityTags ?? []).join('; '),
      toDecisionFlag(draft?.communityTagsApproved),
      primaryImage?.sourceUrl ?? '',
      primaryImage?.filePath ?? '',
      primaryImage?.runtimePath ?? '',
      primaryImage?.checksumSha256 ?? '',
      primaryImage?.width ?? '',
      primaryImage?.height ?? '',
      primaryImage?.runtimePath?.startsWith('/media/') ? 'yes' : inductee.primaryImageUrl.startsWith('/media/') ? 'yes' : 'no',
      draft?.primaryImageAltText ?? primaryImage?.altText ?? inductee.imageAltText,
      draft?.imageRightsStatus ?? primaryImage?.rightsStatus ?? '',
      toDecisionFlag(draft?.imageRightsApproved),
      primaryImage?.approvedForKiosk ? 'yes' : 'no',
      inductee.hasVideo ? 'yes' : 'no',
      videos.length,
      videos.length === 1 ? '1' : '',
      videos.length === 1 ? firstVideo?.sourceUrl ?? '' : '',
      videos.length === 1 ? firstVideo?.youtubeVideoId ?? '' : '',
      videos.length === 1 ? firstVideo?.filePath ?? '' : '',
      videos.length === 1 ? firstVideo?.runtimePath ?? '' : '',
      videos.length === 1 ? firstVideo?.posterFilePath ?? '' : '',
      videos.length === 1 ? firstVideo?.posterRuntimePath ?? '' : '',
      videos.length === 1 ? firstVideo?.captionFilePath ?? '' : '',
      videos.length === 1 ? firstVideo?.captionRuntimePath ?? '' : '',
      videos.length === 1 ? firstVideo?.transcriptFilePath ?? '' : '',
      videos.length === 1 ? firstVideo?.transcriptRuntimePath ?? '' : '',
      videos.length === 1 ? firstVideo?.durationSeconds ?? '' : '',
      videos.length === 1 ? firstVideo?.codec ?? '' : '',
      draft?.videoRightsStatus ?? firstVideo?.rightsStatus ?? inductee.videoRightsStatus,
      toDecisionFlag(draft?.videoRightsApproved),
      draft?.captionStatus ?? firstVideo?.captionStatus ?? '',
      toDecisionFlag(draft?.captionsApproved),
      draft?.transcriptStatus ?? firstVideo?.transcriptStatus ?? '',
      toDecisionFlag(draft?.transcriptApproved),
      firstVideo?.audioDescriptionStatus ?? '',
      videos.length > 0 && videos.every((video) => video.approvedForKiosk) ? 'yes' : videos.length > 0 ? 'no' : '',
      toDecisionFlag(draft?.accessibilityApproved),
      draft?.plainLanguageReview ?? '',
      draft?.sensitiveContentReview ?? '',
      draft?.imageDescriptionReview ?? '',
      (draft?.curatorNotes ?? []).join('; '),
      (draft?.mediaNotes ?? mediaRecord?.notes ?? []).join('; '),
      getReviewNeeds(inductee, curation, media, draft).join('; '),
    ];
  });
  return [headers, ...rows].map((row) => row.map(toCsvCell).join(',')).join('\n');
}

function loadStoredDrafts(): DraftMap {
  try {
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return {};
    return normalizeDraftPayload(JSON.parse(raw));
  } catch {
    return {};
  }
}

function persistDrafts(drafts: DraftMap) {
  const count = Object.keys(drafts).length;

  try {
    if (count === 0) {
      window.localStorage.removeItem(draftStorageKey);
      return { ok: true, message: 'No local drafts' };
    }

    window.localStorage.setItem(draftStorageKey, JSON.stringify(drafts));
    const savedAt = new Date().toISOString();
    return { ok: true, message: `Saved ${count} local draft${count === 1 ? '' : 's'} at ${formatClock(savedAt)}`, savedAt };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not save local portal drafts.',
    };
  }
}

function normalizeDraftPayload(payload: unknown, inductees: Inductee[] = []): DraftMap {
  const source = getDraftRecordSource(payload);
  if (!source) throw new Error('Draft JSON must contain a drafts or records object.');

  const validIds = inductees.length > 0 ? new Set(inductees.map((item) => item.id)) : null;
  return Object.fromEntries(
    Object.entries(source)
      .filter(([id, value]) => (!validIds || validIds.has(id)) && value && typeof value === 'object' && !Array.isArray(value))
      .map(([id, value]) => {
        const draft = value as Partial<ReviewDraft>;
        return [id, { ...draft, id, updatedAt: typeof draft.updatedAt === 'string' ? draft.updatedAt : new Date().toISOString() }];
      })
      .filter(([, draft]) => isMeaningfulDraft(draft as ReviewDraft)),
  );
}

function getDraftRecordSource(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const objectPayload = payload as { drafts?: unknown; records?: unknown };
  const source = objectPayload.drafts ?? objectPayload.records ?? payload;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  return source as Record<string, unknown>;
}

function isMeaningfulDraft(draft: ReviewDraft) {
  return Object.entries(draft).some(([key, value]) => {
    if (key === 'id' || key === 'updatedAt' || value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
}

function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function toCsvCell(value: CsvValue) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function toDecisionFlag(value?: boolean) {
  if (value === undefined) return '';
  return value ? 'yes' : 'no';
}

function parseListInput(value: string) {
  return Array.from(new Set(value.split(/[|;\n]/).map((item) => item.trim()).filter(Boolean)));
}

function joinList(values: string[]) {
  return values.join('\n');
}

function cleanPortalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanPortalList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanPortalString(item)).filter(Boolean)));
}

function slugifyLensId(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqueLensId(lenses: StoryLensConfig[], baseId: string) {
  const normalizedBase = slugifyLensId(baseId) || 'story-lens';
  const ids = new Set(lenses.map((lens) => lens.id));
  if (!ids.has(normalizedBase)) return normalizedBase;
  let index = 2;
  while (ids.has(`${normalizedBase}-${index}`)) index += 1;
  return `${normalizedBase}-${index}`;
}

function priorityRank(priority: string) {
  if (priority === 'high') return 0;
  if (priority === 'medium') return 1;
  return 2;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function ReadinessCard({ title, ready, total, action, ids, onClick }: { title: string; ready: number; total: number; action: string; ids?: string[]; onClick: () => void }) {
  const clampedTotal = Math.max(total, 1);
  const percent = Math.min(100, Math.round((ready / clampedTotal) * 100));
  return (
    <div className="portal-readiness-card">
      <span>{title}</span>
      <strong>{ready}/{total}</strong>
      <div className="portal-progress" aria-label={`${title} ${percent}% ready`}>
        <i style={{ width: `${percent}%` }} />
      </div>
      {ids && ids.length > 0 && <small>{ids.slice(0, 4).join(', ')}{ids.length > 4 ? `, +${ids.length - 4}` : ''}</small>}
      <button type="button" onClick={onClick}>{action}</button>
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="review-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'bad' | 'accent' }) {
  return <span className={`review-chip review-chip--${tone}`}>{label}</span>;
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'bad' }) {
  return (
    <span className={`review-status review-status--${tone}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function statusLabel(errors: number, warnings: number) {
  if (errors > 0) return `${errors} errors`;
  if (warnings > 0) return `${warnings} warnings`;
  return 'Clean';
}

function formatDate(value?: string) {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatClock(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
