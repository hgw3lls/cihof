import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import type { ConnectionNode } from '../../data/connectionGraph';
import { countryCommunityOrRegionLabel } from '../../data/inducteeLabels';
import { rankStoryLensMatches, type StoryLensMatch } from '../../data/storyLenses';
import type {
  Inductee,
  RelationshipProvenance,
  RelationshipType,
  StoryLensConfig,
} from '../../data/types';
import { useRelationships } from '../../data/useRelationships';
import { useStorySections } from '../../data/useStorySections';
import {
  getDraftRecordSource,
  getRelationshipDraftRecordSource,
  isMeaningfulDraft,
  isMeaningfulRelationshipDraft,
  loadStoredDrafts,
  loadStoredRelationshipDrafts,
  normalizeDraftPayload,
  normalizeRelationshipDraftPayload,
  persistDrafts,
  persistRelationshipDrafts,
  relationshipTypeOptions,
} from './services/portalDrafts';
import type {
  DraftMap,
  DraftPatch,
  DraftStorageResult,
  RelationshipDraft,
  RelationshipDraftMap,
  RelationshipDraftPatch,
  ReviewDraft,
} from './services/portalDrafts';
import { usePortalRunner } from './services/portalRunner';
import type {
  RunnerScript,
  RunnerState,
} from './services/portalRunner';
import { ExportPanel } from './components/portalExportPanels';
import {
  ContentAccessPanel,
  StartHerePanel,
} from './components/portalContentPanels';
import {
  downloadJson,
  downloadReviewQueue,
} from './services/portalDownloads';
import {
  useReviewReports,
  useSourceCurationPacket,
} from './services/portalReports';
import type {
  CurationReport,
  MediaManifest,
  MediaManifestRecord,
  MediaReport,
} from './services/portalReports';
import {
  buildActionItems,
  buildDashboardSummary,
  buildPortalCurationPackage,
  buildProfileReadinessChecklist,
  buildQueueOptions,
  buildReviewCsv,
  dateStamp,
  formatNeeds,
  getDraftIssues,
  getReviewNeeds,
  matchesQueue,
  matchesSearch,
  priorityRank,
  readinessStatusLabel,
} from './models/portalReviewModel';
import {
  Chip,
  MetricCard,
  ReadinessCard,
  StatusPill,
  formatDate,
  statusLabel,
} from './components/portalUi';
import type {
  DraftIssue,
  ProfileReadinessItem,
  QueueMode,
} from './models/portalReviewModel';
import {
  addListValue,
  joinList,
  parseListInput,
  removeListValue,
} from './utils/portalFormUtils';
import {
  emptyStoryLensDocument,
  getStoryLensDraftIssues,
  normalizeStoryLensDocument,
  slugifyLensId,
  uniqueLensId,
  useStoryLensDocument,
} from './models/portalStoryLensModel';
import type {
  StoryLensEditorState,
} from './models/portalStoryLensModel';
import {
  buildRelationshipQueueOptions,
  buildRelationshipReviewRows,
  entityInitials,
  materializeApprovedRelationshipRecords,
  matchesRelationshipQueue,
  nodeKindLabel,
  relationshipPriorityRank,
  relationshipProvenanceLabel,
  relationshipSourceLabel,
  relationshipStatusValue,
  relationshipTypeLabel,
} from './models/portalRelationshipModel';
import type {
  RelationshipQueueMode,
  RelationshipReviewRow,
} from './models/portalRelationshipModel';
import {
  buildBulkSourceDrafts,
  buildContentAccessRows,
  buildFocusedCopyPatch,
  buildFocusedCopySuggestion,
  buildSourceBulkRows,
  buildSourceCandidateRows,
  buildSourceQueueOptions,
  formatConfidence,
  getProfileSourceRows,
  groupProfileSourceRows,
  matchesSourceCandidate,
  patchHasEditableField,
  sourceDraftPatchForRow,
  sourceGuardrailLabel,
  sourcePrimaryActionLabel,
  sourceQueueLabels,
  sourceReviewNotePatchForRow,
  sourceStageLabel,
} from './models/portalSourceModel';
import type {
  BulkSourceStageMode,
  FocusedCopySuggestion,
  SourceCandidateRow,
  SourceQueueMode,
} from './models/portalSourceModel';
import {
  emptySourceCurationPacket,
} from './models/portalSourcePacket';
import type {
  SourceCurationPacket,
} from './models/portalSourcePacket';
import type { ColorMode } from '../../app/useColorMode';

type PortalTab = 'home' | 'workbench' | 'content' | 'source' | 'lenses' | 'relationships' | 'readiness' | 'exports';

type ReviewDashboardViewProps = {
  inductees: Inductee[];
  onSelect: (inductee: Inductee) => void;
  colorMode: ColorMode;
  onToggleColorMode: () => void;
};

export function ReviewDashboardView({ inductees, onSelect, colorMode, onToggleColorMode }: ReviewDashboardViewProps) {
  const reports = useReviewReports();
  const sourceCuration = useSourceCurationPacket();
  const relationshipState = useRelationships();
  const storySections = useStorySections();
  const runner = usePortalRunner();
  const storyLensState = useStoryLensDocument();
  const [query, setQuery] = useState('');
  const [queue, setQueue] = useState<QueueMode>('high');
  const [relationshipQuery, setRelationshipQuery] = useState('');
  const [relationshipQueue, setRelationshipQueue] = useState<RelationshipQueueMode>('needs-review');
  const [selectedRelationshipId, setSelectedRelationshipId] = useState('');
  const [tab, setTab] = useState<PortalTab>('workbench');
  const [sourceInitialQueue, setSourceInitialQueue] = useState<SourceQueueMode>('profiles');
  const [selectedId, setSelectedId] = useState('');
  const [drafts, setDrafts] = useState<DraftMap>(() => loadStoredDrafts());
  const [relationshipDrafts, setRelationshipDrafts] = useState<RelationshipDraftMap>(() => loadStoredRelationshipDrafts());
  const [portalNotice, setPortalNotice] = useState('');
  const [applyPreviewJobId, setApplyPreviewJobId] = useState('');
  const [applyPreviewCsv, setApplyPreviewCsv] = useState('');
  const [storageState, setStorageState] = useState<DraftStorageResult>({ ok: true, message: 'No local drafts' });
  const [relationshipStorageState, setRelationshipStorageState] = useState<DraftStorageResult>({ ok: true, message: 'No relationship drafts' });
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const draftCount = Object.keys(drafts).length;
  const relationshipDraftCount = Object.keys(relationshipDrafts).length;
  const summary = useMemo(() => buildDashboardSummary(inductees, reports.curation, reports.media, drafts), [drafts, inductees, reports.curation, reports.media]);
  const queueOptions = useMemo(() => buildQueueOptions(inductees, reports.curation, reports.media, drafts), [drafts, inductees, reports.curation, reports.media]);
  const actionItems = useMemo(() => buildActionItems(summary, draftCount), [draftCount, summary]);
  const sourceRows = useMemo(() => buildSourceCandidateRows(sourceCuration.packet ?? emptySourceCurationPacket()), [sourceCuration.packet]);
  const contentAccessRows = useMemo(
    () => buildContentAccessRows(inductees, storySections.records, sourceRows, reports.manifest),
    [inductees, reports.manifest, sourceRows, storySections.records],
  );
  const relationshipRows = useMemo(
    () => buildRelationshipReviewRows(inductees, relationshipState.relationships, relationshipDrafts, sourceCuration.packet?.relationshipReviewDrafts ?? []),
    [inductees, relationshipDrafts, relationshipState.relationships, sourceCuration.packet?.relationshipReviewDrafts],
  );
  const relationshipQueueOptions = useMemo(() => buildRelationshipQueueOptions(relationshipRows), [relationshipRows]);
  const visibleRelationshipRows = useMemo(
    () => relationshipRows
      .filter((row) => matchesRelationshipQueue(row, relationshipQueue))
      .filter((row) => !relationshipQuery.trim() || row.searchText.includes(relationshipQuery.trim().toLowerCase()))
      .sort((a, b) => relationshipPriorityRank(a) - relationshipPriorityRank(b) || a.sourceNode.label.localeCompare(b.sourceNode.label) || a.targetNode.label.localeCompare(b.targetNode.label)),
    [relationshipQuery, relationshipQueue, relationshipRows],
  );
  const selectedRelationship = useMemo(
    () => relationshipRows.find((row) => row.id === selectedRelationshipId) ?? visibleRelationshipRows[0] ?? relationshipRows[0] ?? null,
    [relationshipRows, selectedRelationshipId, visibleRelationshipRows],
  );
  const approvedRelationshipRecords = useMemo(
    () => materializeApprovedRelationshipRecords(relationshipRows, relationshipState.relationships),
    [relationshipRows, relationshipState.relationships],
  );
  const approvedRelationshipDraftCount = useMemo(
    () => relationshipRows.filter((row) => row.draft?.reviewStatus === 'approved').length,
    [relationshipRows],
  );
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
  const selectedReadinessItems = selected
    ? buildProfileReadinessChecklist(selected, selectedDraft, reports.curation, reports.media, reports.manifest?.assets?.[selected.id], selectedDraftIssues)
    : [];
  const selectedSourceRows = useMemo(
    () => selected ? getProfileSourceRows(sourceRows, selected.id) : [],
    [selected, sourceRows],
  );
  const editedRows = useMemo(() => inductees.filter((item) => Boolean(drafts[item.id])), [drafts, inductees]);
  const decisionCsv = useMemo(
    () => editedRows.length > 0 ? buildReviewCsv(editedRows, reports.curation, reports.media, reports.manifest, drafts) : '',
    [drafts, editedRows, reports.curation, reports.manifest, reports.media],
  );
  const draftIssues = useMemo(() => {
    return editedRows.flatMap((inductee) => getDraftIssues(inductee, drafts[inductee.id], reports.manifest?.assets?.[inductee.id]));
  }, [drafts, editedRows, reports.manifest]);
  const applyPreviewJob = useMemo(
    () => runner.jobs.find((job) => job.id === applyPreviewJobId) ?? (runner.activeJob?.id === applyPreviewJobId ? runner.activeJob : null),
    [applyPreviewJobId, runner.activeJob, runner.jobs],
  );
  const applyPreviewFresh = Boolean(
    applyPreviewJob
    && applyPreviewJob.status === 'success'
    && applyPreviewJob.meta?.dryRun
    && applyPreviewJob.meta?.csvHash
    && applyPreviewCsv
    && applyPreviewCsv === decisionCsv,
  );
  const storyLensCount = storyLensState.draft?.lenses.length ?? storyLensState.document?.lenses.length ?? 0;

  useEffect(() => {
    setStorageState(persistDrafts(drafts));
  }, [drafts]);

  useEffect(() => {
    setRelationshipStorageState(persistRelationshipDrafts(relationshipDrafts));
  }, [relationshipDrafts]);

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

  useEffect(() => {
    if (visibleRelationshipRows.length === 0) return;
    if (!selectedRelationshipId || !visibleRelationshipRows.some((row) => row.id === selectedRelationshipId)) {
      setSelectedRelationshipId(visibleRelationshipRows[0].id);
    }
  }, [selectedRelationshipId, visibleRelationshipRows]);

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

  function stageSourceDraft(id: string, patch: DraftPatch, notice: string) {
    patchDraft(id, patch);
    setSelectedId(id);
    setPortalNotice(notice);
  }

  function stageProfileSourceRow(row: SourceCandidateRow, stageMode: BulkSourceStageMode = 'primary') {
    if (!selected) return;
    const draft = drafts[selected.id];
    const mediaRecord = reports.manifest?.assets?.[selected.id];
    const patch = stageMode === 'review-note'
      ? sourceReviewNotePatchForRow(row, selected, draft)
      : sourceDraftPatchForRow(row, row.stageKind, selected, draft, mediaRecord);
    stageSourceDraft(selected.id, patch, `Staged ${stageMode === 'review-note' ? 'review note' : sourceStageLabel(row.stageKind)} from ${sourceQueueLabels[row.mode]} source evidence on ${selected.name}.`);
  }

  function stageBulkSourceDrafts(rows: SourceCandidateRow[], stageMode: BulkSourceStageMode, label: string) {
    if (rows.length === 0) {
      setPortalNotice(`No ${label} are available to stage.`);
      return;
    }
    const result = buildBulkSourceDrafts(drafts, rows, inductees, reports.manifest, stageMode);
    setDrafts(result.drafts);
    setPortalNotice(`Staged ${result.changed} ${label} across ${result.profileCount} profile${result.profileCount === 1 ? '' : 's'}. Review/export before applying to the repo.`);
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

  function patchRelationshipDraft(id: string, patch: RelationshipDraftPatch) {
    setRelationshipDrafts((current) => {
      const nextDraft: RelationshipDraft = {
        ...(current[id] ?? { id }),
        ...patch,
        id,
        updatedAt: new Date().toISOString(),
      };
      const next = { ...current };
      if (isMeaningfulRelationshipDraft(nextDraft)) next[id] = nextDraft;
      else delete next[id];
      return next;
    });
  }

  function clearRelationshipDraft(id: string) {
    setRelationshipDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setPortalNotice('Relationship review draft cleared.');
  }

  function clearAllRelationshipDrafts() {
    if (relationshipDraftCount > 0 && !window.confirm(`Clear ${relationshipDraftCount} relationship review drafts? Export first if you need to keep them.`)) return;
    setRelationshipDrafts({});
    setPortalNotice('All relationship review drafts cleared.');
  }

  function exportRelationshipDraftJson() {
    if (relationshipDraftCount === 0) {
      window.alert('There are no relationship review drafts to export.');
      return;
    }
    downloadJson({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      source: 'CIHOF staff portal relationship review drafts',
      drafts: relationshipDrafts,
    }, `cihof-relationship-review-${dateStamp()}.json`);
    setPortalNotice(`Exported ${relationshipDraftCount} relationship review drafts as JSON.`);
  }

  async function saveRelationshipReviews() {
    if (!runner.available) {
      window.alert('Start the local portal runner first: npm run portal:server');
      return;
    }
    const approvedDraftIds = relationshipRows
      .filter((row) => row.draft?.reviewStatus === 'approved')
      .map((row) => row.id);
    if (approvedDraftIds.length === 0) {
      window.alert('Approve at least one relationship review draft before saving.');
      return;
    }
    if (!window.confirm(`Save ${approvedRelationshipRecords.length} approved relationship record${approvedRelationshipRecords.length === 1 ? '' : 's'} to the repo?`)) return;

    const savedRecords = await runner.saveRelationships(approvedRelationshipRecords);
    if (!savedRecords) return;

    const savedIds = new Set(approvedDraftIds);
    setRelationshipDrafts((current) => {
      const next = { ...current };
      savedIds.forEach((id) => delete next[id]);
      return next;
    });
    await relationshipState.refresh();
    setPortalNotice(`Saved ${savedRecords.length} explicit relationship record${savedRecords.length === 1 ? '' : 's'} to the repo.`);
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

  function exportCurationPackage() {
    if (draftCount === 0 && relationshipDraftCount === 0) {
      window.alert('There are no local profile or relationship drafts to package.');
      return;
    }

    const packagePayload = buildPortalCurationPackage({
      inductees,
      drafts,
      relationshipDrafts,
      decisionCsv,
      draftIssues,
      sourceLeadCount: sourceCuration.packet?.curationIndex?.length ?? 0,
      curation: reports.curation,
      media: reports.media,
      runnerConnected: runner.available,
      runnerGitBranch: runner.health?.git?.branch,
      runnerGitCommit: runner.health?.git?.commit,
    });

    downloadJson(packagePayload, `cihof-curation-package-${dateStamp()}.json`);
    setPortalNotice(`Exported curation package with ${draftCount} profile draft${draftCount === 1 ? '' : 's'} and ${relationshipDraftCount} relationship draft${relationshipDraftCount === 1 ? '' : 's'}.`);
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
        const relationshipSource = getRelationshipDraftRecordSource(payload);
        const relationshipSourceCount = relationshipSource ? Object.keys(relationshipSource).length : 0;
        const importedRelationships = normalizeRelationshipDraftPayload(payload);
        const importedCount = Object.keys(imported).length;
        setDrafts((current) => ({ ...current, ...imported }));
        const importedRelationshipCount = Object.keys(importedRelationships).length;
        if (importedRelationshipCount > 0) setRelationshipDrafts((current) => ({ ...current, ...importedRelationships }));
        const skippedProfileMessage = sourceCount > importedCount ? `; skipped ${sourceCount - importedCount} invalid or unknown profile records` : '';
        const skippedRelationshipMessage = relationshipSourceCount > importedRelationshipCount
          ? `; skipped ${relationshipSourceCount - importedRelationshipCount} invalid relationship records`
          : '';
        setPortalNotice(`Imported ${importedCount} profile draft record${importedCount === 1 ? '' : 's'} and ${importedRelationshipCount} relationship draft${importedRelationshipCount === 1 ? '' : 's'}${skippedProfileMessage}${skippedRelationshipMessage}.`);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Could not import draft or curation package JSON.');
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

    const csv = decisionCsv;
    if (!dryRun && !applyPreviewFresh) {
      window.alert('Run a successful dry run for the current portal edits before applying them to the repo.');
      return;
    }

    if (!dryRun && !window.confirm(`Apply ${editedRows.length} portal draft records, regenerate runtime data, validate reports/entities, and build the public app?`)) return;

    const job = await runner.applyDecisions(csv, {
      dryRun,
      previewJobId: dryRun ? undefined : applyPreviewJob?.id,
      previewHash: dryRun ? undefined : applyPreviewJob?.meta?.csvHash,
    });
    if (job) {
      if (dryRun) {
        setApplyPreviewJobId(job.id);
        setApplyPreviewCsv(csv);
      }
      setPortalNotice(`${dryRun ? 'Started dry run for' : 'Started applying'} ${editedRows.length} portal draft records.`);
      setTab('exports');
    }
  }

  return (
    <section className="review-dashboard portal-dashboard" aria-label="Staff portal dashboard">
      <div className="review-dashboard__header portal-dashboard__header">
        <div className="portal-dashboard__title">
          <p className="eyebrow">Staff Portal</p>
          <h2>CIHOF / Review & Edit</h2>
          <span>Choose one queue, finish that pass, then move deeper only when needed.</span>
        </div>
        <div className="portal-dashboard__overview">
          <button className="portal-mode-toggle" type="button" onClick={onToggleColorMode} aria-label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}>{colorMode === 'light' ? 'Dark' : 'Light'}</button>
          <div className="portal-dashboard__quick-status" aria-label="Portal summary">
            <span>{draftCount} drafts</span>
            <span>{contentAccessRows.filter((row) => row.storyBeatCount > 0).length} story profiles</span>
            <span>{contentAccessRows.reduce((total, row) => total + row.archiveRows.length, 0)} archive leads</span>
          </div>
          <details className="portal-status-drawer">
            <summary>System Status</summary>
            <div className="review-dashboard__status">
              <StatusPill label="Curation" value={statusLabel(reports.curation?.validation?.errors?.length ?? 0, reports.curation?.validation?.warnings?.length ?? 0)} tone={(reports.curation?.validation?.errors?.length ?? 0) > 0 ? 'bad' : 'ok'} />
              <StatusPill label="Media" value={statusLabel(reports.media?.validation?.errors?.length ?? 0, reports.media?.validation?.warnings?.length ?? 0)} tone={(reports.media?.validation?.errors?.length ?? 0) > 0 ? 'bad' : 'warn'} />
              <StatusPill label="Drafts" value={`${draftCount}`} tone={draftCount > 0 ? 'warn' : 'ok'} />
              <StatusPill label="Sources" value={`${sourceCuration.packet?.curationIndex?.length ?? 0}`} tone={sourceCuration.error ? 'bad' : sourceCuration.loading ? 'warn' : 'ok'} />
              <StatusPill label="Lenses" value={`${storyLensCount}`} tone={storyLensState.isDirty ? 'warn' : storyLensState.error ? 'bad' : 'ok'} />
              <StatusPill label="Links" value={`${relationshipRows.length}`} tone={relationshipState.error ? 'bad' : relationshipDraftCount > 0 ? 'warn' : 'ok'} />
              <StatusPill label="Wall Build" value={summary.wallReady ? 'Yes' : 'No'} tone={summary.wallReady ? 'ok' : 'bad'} />
              <StatusPill label="Kiosk Ready" value={summary.kioskReady ? 'Yes' : 'No'} tone={summary.kioskReady ? 'ok' : 'bad'} />
            </div>
          </details>
        </div>
      </div>

      {reports.error && <div className="review-dashboard__alert">Report load error: {reports.error}</div>}
      {sourceCuration.error && <div className="review-dashboard__alert">Source data load warning: {sourceCuration.error}</div>}
      {storySections.error && <div className="review-dashboard__alert">Story section load warning: {storySections.error}</div>}
      {storyLensState.error && <div className="review-dashboard__alert">Story lens load warning: {storyLensState.error}</div>}
      {relationshipState.error && <div className="review-dashboard__alert">Relationship load warning: {relationshipState.error}</div>}
      {reports.loading && <div className="review-dashboard__alert">Loading review reports...</div>}
      {!storageState.ok && <div className="review-dashboard__alert">Draft save warning: {storageState.message}</div>}
      {!relationshipStorageState.ok && <div className="review-dashboard__alert">Relationship draft save warning: {relationshipStorageState.message}</div>}
      {portalNotice && (
        <div className="portal-notice">
          <span>{portalNotice}</span>
          <button type="button" onClick={() => setPortalNotice('')}>Dismiss</button>
        </div>
      )}

      <div className="portal-tabs" aria-label="Portal sections">
        <button className={tab === 'home' ? 'portal-tab portal-tab--active' : 'portal-tab'} type="button" onClick={() => setTab('home')}>Start Here</button>
        <button className={tab === 'content' ? 'portal-tab portal-tab--active' : 'portal-tab'} type="button" onClick={() => setTab('content')}>Best Content</button>
        <button className={tab === 'workbench' ? 'portal-tab portal-tab--active' : 'portal-tab'} type="button" onClick={() => setTab('workbench')}>Workbench</button>
        <button className={tab === 'source' ? 'portal-tab portal-tab--active' : 'portal-tab'} type="button" onClick={() => setTab('source')}>Source Data</button>
        <button className={tab === 'lenses' ? 'portal-tab portal-tab--active' : 'portal-tab'} type="button" onClick={() => setTab('lenses')}>Story Lenses {storyLensState.isDirty ? '*' : ''}</button>
        <button className={tab === 'relationships' ? 'portal-tab portal-tab--active' : 'portal-tab'} type="button" onClick={() => setTab('relationships')}>Relationships {relationshipDraftCount > 0 ? `(${relationshipDraftCount})` : ''}</button>
        <button className={tab === 'readiness' ? 'portal-tab portal-tab--active' : 'portal-tab'} type="button" onClick={() => setTab('readiness')}>Readiness</button>
        <button className={tab === 'exports' ? 'portal-tab portal-tab--active' : 'portal-tab'} type="button" onClick={() => setTab('exports')}>Exports {draftCount > 0 ? `(${draftCount})` : ''}</button>
      </div>

      {tab === 'home' && (
        <StartHerePanel
          contentRows={contentAccessRows}
          draftCount={draftCount}
          relationshipDraftCount={relationshipDraftCount}
          sourceLeadCount={sourceRows.length}
          summary={summary}
          onOpenContent={() => setTab('content')}
          onOpenExports={() => setTab('exports')}
          onOpenReadiness={() => setTab('readiness')}
          onOpenRelationships={() => setTab('relationships')}
          onOpenSource={(mode) => {
            setSourceInitialQueue(mode);
            setTab('source');
          }}
          onOpenWorkbench={(nextQueue) => {
            setQueue(nextQueue);
            setTab('workbench');
          }}
        />
      )}

      {tab === 'workbench' && (
        <>
          <div className="review-metrics" aria-label="Review metrics">
            <MetricCard label="Profiles" value={summary.totalProfiles} detail={`${summary.approvedProfiles} approved / ${summary.draftProfiles} draft`} />
            <MetricCard label="Open Drafts" value={draftCount} detail={`${summary.draftApprovedProfiles} profile approvals staged`} />
            <MetricCard label="Nationality" value={summary.countryNeedsReview} detail={`${summary.inferredCountries} inferred / ${summary.approvedCountries} approved`} />
            <MetricCard label="Hall Copy" value={summary.focusedCopyReady} detail={`${summary.focusedCopyNeeded} profile panels need focused copy / ${summary.draftFocusedCopy} staged`} />
            <MetricCard label="Summaries" value={summary.approvedSummaries} detail={`${summary.summaryDrafts} draft / ${summary.draftApprovedSummaries} staged`} />
            <MetricCard label="Primary Images" value={summary.localPrimaryImages} detail={`${summary.primaryImagesWallReady} wall-ready / ${summary.primaryImagesReady} cleared`} />
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
        </>
      )}

      {tab === 'workbench' && (
        <div className="portal-layout">
          <aside className="portal-queue" aria-label="Review queue">
            <div className="review-controls portal-controls" aria-label="Review filters">
              <label className="field field--search">
                <span>Search</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, id, nationality, year, story, tag" type="search" />
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
                  <small>{inductee.classYear ?? 'Year unknown'} / {countryCommunityOrRegionLabel(inductee)}</small>
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
                readinessItems={selectedReadinessItems}
                sourceRows={selectedSourceRows}
                saveState={storageState}
                onClear={() => clearDraft(selected.id)}
                onOpenProfile={() => onSelect(selected)}
                onPatch={(patch) => patchDraft(selected.id, patch)}
                onStageSourceRow={stageProfileSourceRow}
              />
            ) : (
              <div className="review-dashboard__alert">No profile selected.</div>
            )}
          </section>
        </div>
      )}

      {tab === 'lenses' && (
        <StoryLensEditor
          inductees={inductees}
          runner={runner}
          state={storyLensState}
          onNotice={setPortalNotice}
        />
      )}

      {tab === 'content' && (
        <ContentAccessPanel
          loading={storySections.loading || sourceCuration.loading || reports.loading}
          rows={contentAccessRows}
          onOpenProfile={(personId) => {
            setSelectedId(personId);
            setTab('workbench');
          }}
          onOpenSource={(mode) => {
            setSourceInitialQueue(mode);
            setTab('source');
          }}
          onPreviewProfile={(inductee) => onSelect(inductee)}
        />
      )}

      {tab === 'source' && (
        <SourceCurationPanel
          drafts={drafts}
          inductees={inductees}
          initialQueue={sourceInitialQueue}
          manifest={reports.manifest}
          packet={sourceCuration.packet}
          loading={sourceCuration.loading}
          error={sourceCuration.error}
          onOpenProfile={(personId) => {
            setSelectedId(personId);
            setTab('workbench');
          }}
          onStageBulkDrafts={stageBulkSourceDrafts}
          onStageDraft={stageSourceDraft}
        />
      )}

      {tab === 'relationships' && (
        <RelationshipReviewPanel
          queue={relationshipQueue}
          query={relationshipQuery}
          rows={relationshipRows}
          visibleRows={visibleRelationshipRows}
          selectedRow={selectedRelationship}
          queueOptions={relationshipQueueOptions}
          storageState={relationshipStorageState}
          draftCount={relationshipDraftCount}
          onClearAll={clearAllRelationshipDrafts}
          onClearDraft={clearRelationshipDraft}
          onExportDrafts={exportRelationshipDraftJson}
          onPatchDraft={patchRelationshipDraft}
          onSaveApproved={saveRelationshipReviews}
          onQueueChange={setRelationshipQueue}
          onQueryChange={setRelationshipQuery}
          runnerAvailable={runner.available}
          approvedRecordCount={approvedRelationshipRecords.length}
          approvedDraftCount={approvedRelationshipDraftCount}
          onSelectRow={(rowId) => setSelectedRelationshipId(rowId)}
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
          relationshipDraftCount={relationshipDraftCount}
          sourceLeadCount={sourceCuration.packet?.curationIndex?.length ?? 0}
          editedRows={editedRows}
          reports={reports}
          runner={runner}
          drafts={drafts}
          draftIssues={draftIssues}
          applyPreviewJob={applyPreviewJob}
          applyPreviewFresh={applyPreviewFresh}
          importInputRef={importInputRef}
          onClearDrafts={clearAllDrafts}
          onExportCurationPackage={exportCurationPackage}
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

function SourceCurationPanel({
  packet,
  loading,
  error,
  inductees,
  drafts,
  initialQueue,
  manifest,
  onOpenProfile,
  onStageBulkDrafts,
  onStageDraft,
}: {
  packet: SourceCurationPacket | null;
  loading: boolean;
  error: string;
  inductees: Inductee[];
  drafts: DraftMap;
  initialQueue: SourceQueueMode;
  manifest: MediaManifest | null;
  onOpenProfile: (personId: string) => void;
  onStageBulkDrafts: (rows: SourceCandidateRow[], stageMode: BulkSourceStageMode, label: string) => void;
  onStageDraft: (personId: string, patch: DraftPatch, notice: string) => void;
}) {
  const [queue, setQueue] = useState<SourceQueueMode>(initialQueue);
  const [query, setQuery] = useState('');
  const [selectedRowId, setSelectedRowId] = useState('');
  const [targetProfileId, setTargetProfileId] = useState('');
  const normalizedPacket = packet ?? emptySourceCurationPacket();
  const peopleById = useMemo(() => new Map(inductees.map((inductee) => [inductee.id, inductee])), [inductees]);
  const rows = useMemo(() => buildSourceCandidateRows(normalizedPacket), [normalizedPacket]);
  const queueOptions = useMemo(() => buildSourceQueueOptions(rows), [rows]);
  const visibleRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows
      .filter((row) => row.mode === queue)
      .filter((row) => !search || matchesSourceCandidate(row, search))
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0) || a.label.localeCompare(b.label));
  }, [query, queue, rows]);
  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRowId) ?? visibleRows[0] ?? rows[0] ?? null,
    [rows, selectedRowId, visibleRows],
  );
  const defaultTargetId = selectedRow?.personId && peopleById.has(selectedRow.personId)
    ? selectedRow.personId
    : targetProfileId && peopleById.has(targetProfileId)
      ? targetProfileId
      : inductees[0]?.id ?? '';
  const selectedTargetId = targetProfileId && peopleById.has(targetProfileId) ? targetProfileId : defaultTargetId;
  const selectedTarget = selectedTargetId ? peopleById.get(selectedTargetId) ?? null : null;
  const sourceSummary = normalizedPacket.summary;
  const contextStarterRows = useMemo(() => buildSourceBulkRows(rows, peopleById, drafts, 'context'), [drafts, peopleById, rows]);
  const storyStarterRows = useMemo(() => buildSourceBulkRows(rows, peopleById, drafts, 'story'), [drafts, peopleById, rows]);
  const traceNoteRows = useMemo(() => buildSourceBulkRows(rows, peopleById, drafts, 'traces'), [drafts, peopleById, rows]);
  const archiveRows = useMemo(() => rows.filter((row) => row.mode === 'archives'), [rows]);

  useEffect(() => {
    setQueue(initialQueue);
    setSelectedRowId('');
  }, [initialQueue]);

  useEffect(() => {
    if (visibleRows.length === 0) return;
    if (!selectedRowId || !visibleRows.some((row) => row.id === selectedRowId)) {
      setSelectedRowId(visibleRows[0].id);
    }
  }, [selectedRowId, visibleRows]);

  useEffect(() => {
    if (selectedRow?.personId && peopleById.has(selectedRow.personId)) {
      setTargetProfileId(selectedRow.personId);
    }
  }, [peopleById, selectedRow?.id, selectedRow?.personId]);

  function stageSelected(stageKind: SourceCandidateRow['stageKind']) {
    if (!selectedRow || !selectedTarget) return;
    const draft = drafts[selectedTarget.id];
    const mediaRecord = manifest?.assets?.[selectedTarget.id];
    const patch = sourceDraftPatchForRow(selectedRow, stageKind, selectedTarget, draft, mediaRecord);
    onStageDraft(selectedTarget.id, patch, `Staged ${sourceStageLabel(stageKind)} from source data on ${selectedTarget.name}.`);
  }

  return (
    <section className="portal-source" aria-label="Source data curation">
      <div className="portal-readiness__intro portal-source__intro">
        <div>
          <p className="eyebrow">Source Data</p>
          <h3>Review source and archive leads</h3>
          <p>Source harvest and WRHS archive records are review aids. Staged edits remain local drafts until exported or applied through the existing portal runner.</p>
        </div>
        <div className="portal-source__stamp">
          <span>Generated: {formatDate(normalizedPacket.source?.generatedAt)}</span>
          <span>{loading ? 'Loading source packet' : `${rows.length} source leads`}</span>
        </div>
      </div>

      {error && <div className="review-dashboard__alert">Source packet warning: {error}</div>}

      <div className="portal-lenses__summary portal-source__summary">
        <MetricCard label="Profiles" value={sourceSummary?.sourceProfiles?.resolved ?? 0} detail={`${sourceSummary?.sourceProfiles?.unresolved ?? 0} unresolved / ${sourceSummary?.sourceProfiles?.duplicateGroups ?? 0} duplicate groups`} />
        <MetricCard label="Media Leads" value={sourceSummary?.mediaReviewDrafts?.total ?? 0} detail={`${sourceSummary?.mediaReviewDrafts?.newSources ?? 0} new / ${sourceSummary?.mediaReviewDrafts?.highConfidenceNewSources ?? 0} high confidence`} />
        <MetricCard label="Video Leads" value={sourceSummary?.videoReviewDrafts?.total ?? 0} detail={`${sourceSummary?.videoReviewDrafts?.newSources ?? 0} new source leads`} />
        <MetricCard label="Story Leads" value={sourceSummary?.storySectionReviewDrafts?.total ?? 0} detail={`${sourceSummary?.storySectionReviewDrafts?.primaryLeads ?? 0} primary rewrite leads`} />
        <MetricCard label="Archive Leads" value={archiveRows.length} detail={`${archiveRows.filter((row) => row.subtitle.toLowerCase().includes('direct')).length} direct / ${archiveRows.filter((row) => row.subtitle.toLowerCase().includes('contextual')).length} contextual`} />
      </div>

      <details className="portal-source-advanced">
        <summary>Guardrails & Bulk Tools</summary>
        <div className="portal-source-guardrails" aria-label="Source curation guardrails">
          {Object.entries(normalizedPacket.guardrails ?? {}).map(([key, value]) => (
            <span key={key}><strong>{sourceGuardrailLabel(key)}</strong>{value}</span>
          ))}
        </div>

        <div className="portal-source-bulk" aria-label="Bulk source staging">
          <div>
            <strong>Bulk staging</strong>
            <span>Creates browser-local drafts only. Source leads still require review before export/apply.</span>
          </div>
          <button disabled={contextStarterRows.length === 0} type="button" onClick={() => onStageBulkDrafts(contextStarterRows, 'primary', 'context starter drafts')}>
            Stage Context Starters ({contextStarterRows.length})
          </button>
          <button disabled={storyStarterRows.length === 0} type="button" onClick={() => onStageBulkDrafts(storyStarterRows, 'primary', 'story starter drafts')}>
            Stage Story Starters ({storyStarterRows.length})
          </button>
          <button disabled={traceNoteRows.length === 0} type="button" onClick={() => onStageBulkDrafts(traceNoteRows, 'review-note', 'trace/place review notes')}>
            Stage Trace/Place Notes ({traceNoteRows.length})
          </button>
        </div>
      </details>

      <div className="portal-source-layout">
        <aside className="portal-source-queue" aria-label="Source queue">
          <div className="review-controls portal-controls">
            <label className="field field--search">
              <span>Search</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, source, place, organization, URL" type="search" />
            </label>
            <label className="field">
              <span>Queue</span>
              <select value={queue} onChange={(event) => setQueue(event.target.value as SourceQueueMode)}>
                {queueOptions.map((option) => (
                  <option key={option.mode} value={option.mode}>{option.label} ({option.count})</option>
                ))}
              </select>
            </label>
          </div>

          <div className="portal-source-queue__list" aria-label="Source rows">
            {visibleRows.map((row) => (
              <button
                className={selectedRow?.id === row.id ? 'portal-source-row portal-source-row--active' : 'portal-source-row'}
                key={row.id}
                type="button"
                onClick={() => setSelectedRowId(row.id)}
              >
                <span>
                  <strong>{row.label}</strong>
                  {row.confidence !== undefined && <em>{formatConfidence(row.confidence)}</em>}
                </span>
                <small>{sourceQueueLabels[row.mode]} / {row.subtitle}</small>
                <span>{row.detail}</span>
              </button>
            ))}
            {visibleRows.length === 0 && <div className="portal-empty-state">No source leads match this queue.</div>}
          </div>
        </aside>

        <section className="portal-source-detail" aria-label="Selected source lead">
          {selectedRow ? (
            <>
              <div className="portal-source-detail__header">
                <div>
                  <span>{sourceQueueLabels[selectedRow.mode]}</span>
                  <h4>{selectedRow.label}</h4>
                  <p>{selectedRow.detail}</p>
                </div>
                <label className="field">
                  <span>Add to profile</span>
                  <select value={selectedTargetId} onChange={(event) => setTargetProfileId(event.target.value)}>
                    {inductees.map((inductee) => (
                      <option key={inductee.id} value={inductee.id}>{inductee.name} / {inductee.classYear ?? 'Year unknown'}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="portal-source-detail__actions">
                <button disabled={!selectedTarget} type="button" onClick={() => stageSelected(selectedRow.stageKind)}>{sourcePrimaryActionLabel(selectedRow)}</button>
                <button disabled={!selectedTarget} type="button" onClick={() => stageSelected('profile-note')}>Stage Review Note</button>
                <button disabled={!selectedTarget} type="button" onClick={() => selectedTarget && onOpenProfile(selectedTarget.id)}>Open Workbench Profile</button>
              </div>

              <div className="portal-source-detail__links">
                {selectedRow.sourceUrl && <a href={selectedRow.sourceUrl} rel="noreferrer" target="_blank">Source URL</a>}
                {selectedRow.sourcePageUrl && selectedRow.sourcePageUrl !== selectedRow.sourceUrl && <a href={selectedRow.sourcePageUrl} rel="noreferrer" target="_blank">Source Page</a>}
              </div>

              <div className="portal-source-data">
                {selectedRow.fields.map((field) => (
                  <div key={`${field.label}-${field.value}`}>
                    <span>{field.label}</span>
                    <strong>{field.value}</strong>
                  </div>
                ))}
              </div>

              <label className="field">
                <span>Note staged from this source</span>
                <textarea readOnly value={selectedRow.note} rows={5} />
              </label>
            </>
          ) : (
            <div className="portal-empty-state">No source lead selected.</div>
          )}
        </section>
      </div>
    </section>
  );
}

function StoryLensEditor({
  inductees,
  state,
  runner,
  onNotice,
}: {
  inductees: Inductee[];
  state: StoryLensEditorState;
  runner: RunnerState;
  onNotice: (message: string) => void;
}) {
  const draft = state.draft ?? emptyStoryLensDocument();
  const issues = getStoryLensDraftIssues(draft, inductees);
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
          pinnedPersonIds: [],
          excludedPersonIds: [],
          curatorNotes: [],
          reviewStatus: 'draft',
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
      const normalizedSavedDocument = normalizeStoryLensDocument(savedDocument);
      state.acceptSavedDocument(normalizedSavedDocument);
      onNotice(`Saved ${normalizedSavedDocument.lenses.length} Story Lens records.`);
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
        {draft.lenses.map((lens, index) => {
          const previewMatches = rankStoryLensMatches(inductees, lens);

          return (
            <article className={lens.enabled === false ? 'portal-lens-card portal-lens-card--disabled' : 'portal-lens-card'} key={`${lens.id}-${index}`}>
              <header className="portal-lens-card__header">
                <div>
                  <span>Lens {index + 1} / {lens.reviewStatus ?? 'draft'}</span>
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
                <label className="field">
                  <span>Review status</span>
                  <select value={lens.reviewStatus ?? 'draft'} onChange={(event) => patchLens(index, { reviewStatus: event.target.value as StoryLensConfig['reviewStatus'] })}>
                    <option value="draft">Draft</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="approved">Approved</option>
                  </select>
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
                <label className="field">
                  <span>Pinned person IDs</span>
                  <textarea value={joinList(lens.pinnedPersonIds ?? [])} onChange={(event) => patchLens(index, { pinnedPersonIds: parseListInput(event.target.value) })} rows={5} />
                </label>
                <label className="field">
                  <span>Hidden person IDs</span>
                  <textarea value={joinList(lens.excludedPersonIds ?? [])} onChange={(event) => patchLens(index, { excludedPersonIds: parseListInput(event.target.value) })} rows={5} />
                </label>
                <label className="field portal-lens-card__wide">
                  <span>Curator notes</span>
                  <textarea value={joinList(lens.curatorNotes ?? [])} onChange={(event) => patchLens(index, { curatorNotes: parseListInput(event.target.value) })} rows={3} />
                </label>
              </div>

              <StoryLensPreview
                inductees={inductees}
                lens={lens}
                matches={previewMatches}
                onExcludePerson={(personId) => patchLens(index, {
                  excludedPersonIds: addListValue(lens.excludedPersonIds ?? [], personId),
                  pinnedPersonIds: removeListValue(lens.pinnedPersonIds ?? [], personId),
                })}
                onPinPerson={(personId) => patchLens(index, {
                  pinnedPersonIds: addListValue(lens.pinnedPersonIds ?? [], personId),
                  excludedPersonIds: removeListValue(lens.excludedPersonIds ?? [], personId),
                })}
                onRestorePerson={(personId) => patchLens(index, {
                  excludedPersonIds: removeListValue(lens.excludedPersonIds ?? [], personId),
                })}
                onUnpinPerson={(personId) => patchLens(index, {
                  pinnedPersonIds: removeListValue(lens.pinnedPersonIds ?? [], personId),
                })}
              />

              <footer className="portal-lens-card__actions">
                <button disabled={index === 0} type="button" onClick={() => moveLens(index, -1)}>Move Up</button>
                <button disabled={index === draft.lenses.length - 1} type="button" onClick={() => moveLens(index, 1)}>Move Down</button>
                <button type="button" onClick={() => duplicateLens(index)}>Duplicate</button>
                <button type="button" onClick={() => removeLens(index)}>Remove</button>
              </footer>
            </article>
          );
        })}
        {draft.lenses.length === 0 && <div className="portal-empty-state">No Story Lenses are defined.</div>}
      </div>
    </section>
  );
}

function StoryLensPreview({
  inductees,
  lens,
  matches,
  onExcludePerson,
  onPinPerson,
  onRestorePerson,
  onUnpinPerson,
}: {
  inductees: Inductee[];
  lens: StoryLensConfig;
  matches: StoryLensMatch[];
  onExcludePerson: (personId: string) => void;
  onPinPerson: (personId: string) => void;
  onRestorePerson: (personId: string) => void;
  onUnpinPerson: (personId: string) => void;
}) {
  const peopleById = useMemo(() => new Map(inductees.map((inductee) => [inductee.id, inductee])), [inductees]);
  const pinnedIds = new Set(lens.pinnedPersonIds ?? []);
  const excludedIds = lens.excludedPersonIds ?? [];
  const excludedPeople = excludedIds.map((id) => peopleById.get(id)).filter((inductee): inductee is Inductee => Boolean(inductee));

  return (
    <section className="portal-lens-preview" aria-label={`${lens.label || lens.id} preview`}>
      <header className="portal-lens-preview__header">
        <div>
          <strong>Live preview</strong>
          <span>{matches.length} portraits / {pinnedIds.size} pinned / {excludedIds.length} hidden</span>
        </div>
      </header>

      <div className="portal-lens-preview__people">
        {matches.slice(0, 10).map((match) => {
          const isPinned = pinnedIds.has(match.inductee.id);
          return (
            <article className={isPinned ? 'portal-lens-preview-person portal-lens-preview-person--pinned' : 'portal-lens-preview-person'} key={match.inductee.id}>
              <FallbackImage
                alt={match.inductee.imageAltText}
                className="portal-lens-preview-person__image"
                fallbackClassName="portal-lens-preview-person__fallback"
                fallbackLabel={initials(match.inductee.name)}
                src={match.inductee.primaryImageUrl}
              />
              <div>
                <strong>{match.inductee.name}</strong>
                <span>{match.inductee.classYear ? `Class of ${match.inductee.classYear}` : 'Year unknown'} / {countryCommunityOrRegionLabel(match.inductee)}</span>
                <small>{match.reasons.join(' / ') || `Score ${match.score}`}</small>
              </div>
              <div className="portal-lens-preview-person__actions">
                {isPinned ? (
                  <button type="button" onClick={() => onUnpinPerson(match.inductee.id)}>Unpin</button>
                ) : (
                  <button type="button" onClick={() => onPinPerson(match.inductee.id)}>Pin</button>
                )}
                <button type="button" onClick={() => onExcludePerson(match.inductee.id)}>Hide</button>
              </div>
            </article>
          );
        })}
        {matches.length === 0 && <div className="portal-empty-state">No preview matches yet.</div>}
      </div>

      {excludedPeople.length > 0 && (
        <div className="portal-lens-preview__hidden" aria-label="Hidden people">
          <strong>Hidden from this lens</strong>
          {excludedPeople.map((inductee) => (
            <button key={inductee.id} type="button" onClick={() => onRestorePerson(inductee.id)}>
              Restore {inductee.name}
            </button>
          ))}
          {excludedIds.length > excludedPeople.length && <span>{excludedIds.length - excludedPeople.length} unknown hidden IDs</span>}
        </div>
      )}
    </section>
  );
}

function RelationshipReviewPanel({
  rows,
  visibleRows,
  selectedRow,
  query,
  queue,
  queueOptions,
  storageState,
  draftCount,
  approvedRecordCount,
  approvedDraftCount,
  runnerAvailable,
  onClearAll,
  onClearDraft,
  onExportDrafts,
  onPatchDraft,
  onSaveApproved,
  onQueryChange,
  onQueueChange,
  onSelectRow,
}: {
  rows: RelationshipReviewRow[];
  visibleRows: RelationshipReviewRow[];
  selectedRow: RelationshipReviewRow | null;
  query: string;
  queue: RelationshipQueueMode;
  queueOptions: Array<{ mode: RelationshipQueueMode; label: string; count: number }>;
  storageState: DraftStorageResult;
  draftCount: number;
  approvedRecordCount: number;
  approvedDraftCount: number;
  runnerAvailable: boolean;
  onClearAll: () => void;
  onClearDraft: (id: string) => void;
  onExportDrafts: () => void;
  onPatchDraft: (id: string, patch: RelationshipDraftPatch) => void;
  onSaveApproved: () => void;
  onQueryChange: (query: string) => void;
  onQueueChange: (queue: RelationshipQueueMode) => void;
  onSelectRow: (rowId: string) => void;
}) {
  const inferredCount = rows.filter((row) => row.edge.provenance === 'inferred').length;
  const sourceLeadCount = rows.filter((row) => row.edge.source === 'sourceCuration').length;
  const hiddenCount = rows.filter((row) => row.reviewStatus === 'hidden').length;
  const approvedCount = rows.filter((row) => row.reviewStatus === 'approved').length;
  const selectedDraft = selectedRow?.draft;
  const selectedProvenance = selectedDraft?.provenanceOverride ?? selectedRow?.edge.provenance ?? 'inferred';
  const selectedType = selectedDraft?.typeOverride ?? selectedRow?.edge.type ?? 'shared_theme';

  function patchSelected(patch: RelationshipDraftPatch) {
    if (!selectedRow) return;
    onPatchDraft(selectedRow.id, patch);
  }

  return (
    <section className="portal-relationships" aria-label="Relationship review">
      <div className="portal-readiness__intro portal-relationships__intro">
        <div>
          <p className="eyebrow">Relationships</p>
          <h3>Review connection evidence</h3>
          <p>Inferred links stay possible until staff approves or documents them.</p>
        </div>
        <div className="portal-relationship-actions">
          <button disabled={!runnerAvailable || approvedDraftCount === 0} type="button" onClick={onSaveApproved}>Save Approved Links</button>
          <button disabled={draftCount === 0} type="button" onClick={onExportDrafts}>Export Review JSON</button>
          <button disabled={draftCount === 0} type="button" onClick={onClearAll}>Clear Drafts</button>
        </div>
      </div>

      <div className="portal-lenses__summary">
        <MetricCard label="Connection Edges" value={rows.length} detail={`${visibleRows.length} shown`} />
        <MetricCard label="Source Leads" value={sourceLeadCount} detail="original-site resolved pairs" />
        <MetricCard label="Inferred" value={inferredCount} detail="possible until reviewed" />
        <MetricCard label="Approved" value={approvedCount} detail={`${hiddenCount} hidden`} />
        <MetricCard label="Local Drafts" value={draftCount} detail={`${approvedDraftCount} ready / ${approvedRecordCount} total / ${storageState.message}`} />
      </div>

      <div className="portal-relationship-layout">
        <aside className="portal-relationship-queue" aria-label="Relationship queue">
          <div className="review-controls portal-controls">
            <label className="field field--search">
              <span>Search</span>
              <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Person, target, reason, type, note" type="search" />
            </label>
            <label className="field">
              <span>Queue</span>
              <select value={queue} onChange={(event) => onQueueChange(event.target.value as RelationshipQueueMode)}>
                {queueOptions.map((option) => (
                  <option key={option.mode} value={option.mode}>{option.label} ({option.count})</option>
                ))}
              </select>
            </label>
          </div>

          <div className="portal-relationship-queue__list" aria-label="Relationship rows">
            {visibleRows.map((row) => (
              <button
                className={selectedRow?.id === row.id ? 'portal-relationship-row portal-relationship-row--active' : 'portal-relationship-row'}
                key={row.id}
                type="button"
                onClick={() => onSelectRow(row.id)}
              >
                <span>
                  <strong>{row.sourceNode.label} -&gt; {row.targetNode.label}</strong>
                  {row.draft && <em>Edited</em>}
                </span>
                <small>{relationshipProvenanceLabel(row.effectiveProvenance)} / {relationshipTypeLabel(row.effectiveType)} / {relationshipSourceLabel(row.edge.source)}</small>
                <span>{row.effectiveLabel}</span>
              </button>
            ))}
            {visibleRows.length === 0 && <div className="portal-empty-state">No relationships match this queue.</div>}
          </div>
        </aside>

        <section className="portal-relationship-editor" aria-label="Selected relationship">
          {selectedRow ? (
            <>
              <div className="portal-relationship-editor__hero">
                <RelationshipNodeCard node={selectedRow.sourceNode} label="Source" />
                <div className="portal-relationship-editor__link">
                  <span className={`portal-relationship-provenance portal-relationship-provenance--${selectedRow.effectiveProvenance}`}>
                    {relationshipProvenanceLabel(selectedRow.effectiveProvenance)}
                  </span>
                  <strong>{relationshipTypeLabel(selectedRow.effectiveType)}</strong>
                  <p>{selectedRow.effectiveLabel}</p>
                </div>
                <RelationshipNodeCard node={selectedRow.targetNode} label="Target" />
              </div>

              <div className="portal-relationship-warning">
                {selectedRow.edge.source === 'sourceCuration'
                  ? 'This relationship is a resolved original-site source lead. Approve only after confirming the source note; unresolved name targets remain in Source Evidence.'
                  : selectedRow.edge.provenance === 'inferred'
                  ? 'This relationship is inferred from prepared metadata and should remain possible until staff approves it.'
                  : 'This relationship already comes from curated or documented data; staff can still annotate it.'}
              </div>

              <div className="portal-quick-actions">
                <button
                  type="button"
                  onClick={() => patchSelected({
                    reviewStatus: 'approved',
                    provenanceOverride: selectedRow.edge.source === 'sourceCuration' ? 'documented' : 'curated',
                    displayLabel: selectedRow.effectiveLabel,
                    referenceNote: selectedRow.effectiveNote,
                  })}
                >
                  {selectedRow.edge.source === 'sourceCuration' ? 'Approve As Documented' : 'Approve As Curated'}
                </button>
                <button type="button" onClick={() => patchSelected({ reviewStatus: 'needs-research' })}>Needs Research</button>
                <button type="button" onClick={() => patchSelected({ reviewStatus: 'hidden' })}>Hide Link</button>
                <button disabled={!selectedDraft} type="button" onClick={() => onClearDraft(selectedRow.id)}>Clear Draft</button>
              </div>

              <div className="portal-form-grid">
                <fieldset className="portal-fieldset">
                  <legend>Review Decision</legend>
                  <label className="field">
                    <span>Status</span>
                    <select value={selectedDraft?.reviewStatus ?? ''} onChange={(event) => patchSelected({ reviewStatus: relationshipStatusValue(event.target.value) })}>
                      <option value="">Unreviewed</option>
                      <option value="approved">Approved</option>
                      <option value="needs-research">Needs research</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Provenance</span>
                    <select value={selectedProvenance} onChange={(event) => patchSelected({ provenanceOverride: event.target.value as RelationshipProvenance })}>
                      <option value="inferred">Inferred</option>
                      <option value="curated">Curated</option>
                      <option value="documented">Documented</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Relationship type</span>
                    <select value={selectedType} onChange={(event) => patchSelected({ typeOverride: event.target.value as RelationshipType })}>
                      {relationshipTypeOptions.map((type) => (
                        <option key={type} value={type}>{relationshipTypeLabel(type)}</option>
                      ))}
                    </select>
                  </label>
                </fieldset>

                <fieldset className="portal-fieldset portal-fieldset--wide">
                  <legend>Visitor Label</legend>
                  <label className="field">
                    <span>Display label</span>
                    <input value={selectedDraft?.displayLabel ?? selectedRow.edge.label} onChange={(event) => patchSelected({ displayLabel: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Reference note</span>
                    <textarea value={selectedDraft?.referenceNote ?? selectedRow.edge.referenceNote ?? ''} onChange={(event) => patchSelected({ referenceNote: event.target.value })} rows={3} />
                  </label>
                  <label className="field">
                    <span>Curator note</span>
                    <textarea value={selectedDraft?.curatorNote ?? ''} onChange={(event) => patchSelected({ curatorNote: event.target.value })} rows={3} />
                  </label>
                </fieldset>
              </div>
            </>
          ) : (
            <div className="portal-empty-state">No relationship selected.</div>
          )}
        </section>
      </div>
    </section>
  );
}

function RelationshipNodeCard({ node, label }: { node: ConnectionNode; label: string }) {
  return (
    <div className="portal-relationship-node">
      {node.inductee ? (
        <FallbackImage
          alt={node.inductee.imageAltText}
          className="portal-relationship-node__image"
          fallbackClassName="portal-relationship-node__fallback"
          fallbackLabel={initials(node.inductee.name)}
          src={node.inductee.primaryImageUrl}
        />
      ) : (
        <span className="portal-relationship-node__entity">{entityInitials(node.label)}</span>
      )}
      <span>{label} / {nodeKindLabel(node.kind)}</span>
      <strong>{node.label}</strong>
      {node.inductee && <small>{node.inductee.classYear ? `Class of ${node.inductee.classYear}` : 'Year unknown'} / {countryCommunityOrRegionLabel(node.inductee)}</small>}
    </div>
  );
}

function ProfileReadinessChecklist({ items }: { items: ProfileReadinessItem[] }) {
  const readyCount = items.filter((item) => item.status === 'ready' || item.status === 'optional').length;
  const blockedCount = items.filter((item) => item.status === 'blocked').length;
  const draftedCount = items.filter((item) => item.status === 'drafted').length;

  return (
    <section className="portal-profile-readiness" aria-label="Selected profile readiness checklist">
      <div className="portal-profile-readiness__header">
        <strong>Profile readiness</strong>
        <span>{readyCount} ready / {draftedCount} staged / {blockedCount} blocked</span>
      </div>
      <div className="portal-profile-readiness__grid">
        {items.map((item) => (
          <div className={`portal-profile-readiness__item portal-profile-readiness__item--${item.status}`} key={item.id}>
            <span>{readinessStatusLabel(item.status)}</span>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfileSourceEvidencePanel({
  rows,
  onStageSourceRow,
}: {
  rows: SourceCandidateRow[];
  onStageSourceRow: (row: SourceCandidateRow, stageMode?: BulkSourceStageMode) => void;
}) {
  const groups = useMemo(() => groupProfileSourceRows(rows), [rows]);
  const traceRows = rows.filter((row) => row.mode === 'relationships' || row.mode === 'places' || row.mode === 'organizations').length;

  return (
    <section className="portal-source-evidence" aria-label="Selected profile source evidence">
      <div className="portal-source-evidence__header">
        <div>
          <strong>Source evidence</strong>
          <span>{rows.length} source lead{rows.length === 1 ? '' : 's'} / {traceRows} trace or place lead{traceRows === 1 ? '' : 's'}</span>
        </div>
        <p>Evidence is staged into browser-local drafts. Archive, relationship, and place leads stay review notes until staff explicitly approves them elsewhere.</p>
      </div>

      {groups.length > 0 ? (
        <div className="portal-source-evidence__groups">
          {groups.map((group) => (
            <div className="portal-source-evidence-group" key={group.mode}>
              <h4>{sourceQueueLabels[group.mode]} <span>{group.rows.length}</span></h4>
              <div className="portal-source-evidence__list">
                {group.rows.map((row) => (
                  <article className={`portal-source-evidence-row portal-source-evidence-row--${row.mode}`} key={row.id}>
                    <div className="portal-source-evidence-row__main">
                      <span>{sourceQueueLabels[row.mode]}{row.confidence !== undefined ? ` / ${formatConfidence(row.confidence)}` : ''}</span>
                      <strong>{row.label}</strong>
                      <small>{row.subtitle}</small>
                      <p>{row.detail}</p>
                    </div>
                    {row.fields.length > 0 && (
                      <div className="portal-source-evidence-row__fields">
                        {row.fields.slice(0, 4).map((field) => (
                          <span key={`${row.id}-${field.label}-${field.value}`}>
                            <em>{field.label}</em>
                            {field.value}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="portal-source-evidence-row__actions">
                      <button type="button" onClick={() => onStageSourceRow(row, 'primary')}>{sourcePrimaryActionLabel(row)}</button>
                      <button type="button" onClick={() => onStageSourceRow(row, 'review-note')}>Stage Review Note</button>
                      {row.sourceUrl && <a href={row.sourceUrl} rel="noreferrer" target="_blank">Source</a>}
                      {row.sourcePageUrl && row.sourcePageUrl !== row.sourceUrl && <a href={row.sourcePageUrl} rel="noreferrer" target="_blank">Page</a>}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="portal-empty-state">No source or archive leads are linked to this profile yet.</div>
      )}
    </section>
  );
}

function FocusedCopyStarterPanel({
  suggestion,
  currentPatch,
  replacePatch,
  onPatch,
}: {
  suggestion: FocusedCopySuggestion | null;
  currentPatch: DraftPatch;
  replacePatch: DraftPatch;
  onPatch: (patch: DraftPatch) => void;
}) {
  const canStageMissing = patchHasEditableField(currentPatch);
  const canReplace = patchHasEditableField(replacePatch);

  if (!suggestion) {
    return (
      <div className="portal-focused-copy-starter portal-focused-copy-starter--empty">
        <strong>Focused Hall copy starters</strong>
        <span>No source-backed starter could be built for this profile yet.</span>
      </div>
    );
  }

  return (
    <section className="portal-focused-copy-starter" aria-label="Focused Hall copy starters">
      <div className="portal-focused-copy-starter__header">
        <div>
          <strong>Focused Hall copy starters</strong>
          <span>{suggestion.sourceCount} linked source lead{suggestion.sourceCount === 1 ? '' : 's'} used as review context</span>
        </div>
        <div className="portal-focused-copy-starter__actions">
          <button disabled={!canStageMissing} type="button" onClick={() => onPatch(currentPatch)}>Stage Missing Focused Copy</button>
          <button disabled={!canReplace} type="button" onClick={() => onPatch(replacePatch)}>Replace Focused Copy</button>
        </div>
      </div>
      <p>These are local starter drafts from existing CIHOF profile data and harvested source leads. Review or rewrite before approving the profile.</p>
      <div className="portal-focused-copy-starter__grid">
        <div>
          <span>Context</span>
          <strong>{suggestion.documentedContextLine || 'No starter available'}</strong>
        </div>
        <div>
          <span>HONORED FOR</span>
          <strong>{suggestion.honoredForSummary || 'No starter available'}</strong>
        </div>
        <div>
          <span>Life + Work</span>
          <strong>{suggestion.lifeWorkSummary || 'No starter available'}</strong>
        </div>
      </div>
      {suggestion.sourceLabels.length > 0 && (
        <div className="portal-focused-copy-starter__sources">
          {suggestion.sourceLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
        </div>
      )}
    </section>
  );
}

function ProfileEditor({
  inductee,
  draft,
  mediaRecord,
  needs,
  draftIssues,
  readinessItems,
  sourceRows,
  saveState,
  onPatch,
  onClear,
  onOpenProfile,
  onStageSourceRow,
}: {
  inductee: Inductee;
  draft?: ReviewDraft;
  mediaRecord?: MediaManifestRecord;
  needs: string[];
  draftIssues: DraftIssue[];
  readinessItems: ProfileReadinessItem[];
  sourceRows: SourceCandidateRow[];
  saveState: DraftStorageResult;
  onPatch: (patch: DraftPatch) => void;
  onClear: () => void;
  onOpenProfile: () => void;
  onStageSourceRow: (row: SourceCandidateRow, stageMode?: BulkSourceStageMode) => void;
}) {
  const displayName = draft?.displayName ?? inductee.name;
  const sortName = draft?.sortName ?? inductee.sortName;
  const pronunciation = draft?.pronunciation ?? inductee.pronunciation;
  const approvedSummary = draft?.approvedSummary ?? inductee.storySummary;
  const documentedContextLine = draft?.documentedContextLine ?? inductee.documentedContextLine;
  const honoredForText = draft?.honoredForSummary ?? inductee.honoredForSummary;
  const lifeWorkSummary = draft?.lifeWorkSummary ?? inductee.lifeWorkSummary;
  const approvedThemeTags = draft?.approvedThemeTags ?? inductee.themeTags;
  const approvedCountryTags = draft?.approvedCountryTags ?? inductee.countryTags;
  const countryNotes = draft?.countryNotes ?? inductee.countryTagsNote;
  const approvedCommunityTags = draft?.approvedCommunityTags ?? inductee.communityTags;
  const primaryImage = mediaRecord?.images?.primary;
  const imageSourceUrl = draft?.imageSourceUrl ?? primaryImage?.sourceUrl ?? '';
  const firstVideo = mediaRecord?.videos?.[0];
  const videoSourceUrls = draft?.videoSourceUrls ?? (mediaRecord?.videos ?? []).map((video) => video.sourceUrl ?? '').filter(Boolean);
  const youtubeVideoIds = draft?.youtubeVideoIds ?? (mediaRecord?.videos ?? []).map((video) => video.youtubeVideoId ?? '').filter(Boolean);
  const hasVideoReview = inductee.hasVideo || videoSourceUrls.length > 0 || youtubeVideoIds.length > 0;
  const focusedCopySuggestion = useMemo(() => buildFocusedCopySuggestion(inductee, sourceRows), [inductee, sourceRows]);
  const focusedCopyPatch = useMemo(
    () => buildFocusedCopyPatch(focusedCopySuggestion, inductee, draft, false),
    [draft, focusedCopySuggestion, inductee],
  );
  const focusedCopyReplacePatch = useMemo(
    () => buildFocusedCopyPatch(focusedCopySuggestion, inductee, draft, true),
    [draft, focusedCopySuggestion, inductee],
  );

  return (
    <div className="portal-editor">
      <div className="portal-editor__hero">
        <div className="portal-editor__identity">
          <span className="portal-editor__eyebrow">Selected Profile</span>
          <h3>{inductee.name}</h3>
          <p>{inductee.classYear ?? 'Year unknown'} / {countryCommunityOrRegionLabel(inductee)}</p>
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

      <ProfileReadinessChecklist items={readinessItems} />

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

      <ProfileSourceEvidencePanel rows={sourceRows} onStageSourceRow={onStageSourceRow} />

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

        <fieldset className="portal-fieldset">
          <legend>Identity</legend>
          <label className="field">
            <span>Display name</span>
            <input value={displayName} onChange={(event) => onPatch({ displayName: event.target.value })} />
          </label>
          <label className="field">
            <span>Sort name</span>
            <input value={sortName} onChange={(event) => onPatch({ sortName: event.target.value })} />
          </label>
          <label className="field">
            <span>Pronunciation</span>
            <input value={pronunciation} onChange={(event) => onPatch({ pronunciation: event.target.value })} />
          </label>
          <label className="field">
            <span>Source profile URL</span>
            <input value={inductee.profileUrl} readOnly />
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

        <fieldset className="portal-fieldset portal-fieldset--wide">
          <legend>Focused Hall Text</legend>
          <FocusedCopyStarterPanel
            currentPatch={focusedCopyPatch}
            replacePatch={focusedCopyReplacePatch}
            suggestion={focusedCopySuggestion}
            onPatch={onPatch}
          />
          <label className="field">
            <span>Documented context line</span>
            <input
              value={documentedContextLine}
              onChange={(event) => onPatch({ documentedContextLine: event.target.value })}
              placeholder="Concise sourced context shown beside the focused frame"
            />
          </label>
          <label className="field">
            <span>HONORED FOR summary</span>
            <textarea
              value={honoredForText}
              onChange={(event) => onPatch({ honoredForSummary: event.target.value })}
              rows={4}
              placeholder="Short curator-written reason for honor; falls back to biography summary when blank"
            />
          </label>
          <label className="field">
            <span>Life + Work overview</span>
            <textarea
              value={lifeWorkSummary}
              onChange={(event) => onPatch({ lifeWorkSummary: event.target.value })}
              rows={5}
              placeholder="Optional longer reading text for the anchored Life + Work panel"
            />
          </label>
        </fieldset>

        <fieldset className="portal-fieldset">
          <legend>Metadata</legend>
          <label className="field">
            <span>Approved themes</span>
            <textarea value={joinList(approvedThemeTags)} onChange={(event) => onPatch({ approvedThemeTags: parseListInput(event.target.value) })} rows={4} />
          </label>
          <label className="field">
            <span>Approved nationality / heritage</span>
            <textarea value={joinList(approvedCountryTags)} onChange={(event) => onPatch({ approvedCountryTags: parseListInput(event.target.value) })} rows={3} />
          </label>
          <label className="field">
            <span>Nationality note</span>
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
              <span>Approve nationality</span>
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
            <span>Primary image source URL</span>
            <input value={imageSourceUrl} onChange={(event) => onPatch({ imageSourceUrl: event.target.value })} />
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

          {hasVideoReview ? (
            <>
              <label className="field">
                <span>Video source URLs</span>
                <textarea value={joinList(videoSourceUrls)} onChange={(event) => onPatch({ videoSourceUrls: parseListInput(event.target.value) })} rows={3} />
              </label>
              <label className="field">
                <span>YouTube video IDs</span>
                <textarea value={joinList(youtubeVideoIds)} onChange={(event) => onPatch({ youtubeVideoIds: parseListInput(event.target.value) })} rows={2} />
              </label>
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
        <h3>{summary.wallReady ? 'Portrait wall build is runnable' : 'Portrait wall files need attention'}</h3>
        <p>Use these queues to move profiles from generated/imported metadata to curator-approved installation data. Wall readiness confirms local portrait files; kiosk readiness still requires rights and accessible media clearance.</p>
      </div>
      <div className="portal-readiness__grid">
        <ReadinessCard title="Profile approval" ready={summary.approvedProfiles + summary.draftApprovedProfiles} total={summary.totalProfiles} action="Open high priority" onClick={() => onQueueChange('high')} />
        <ReadinessCard title="Nationality labels" ready={summary.approvedCountries + summary.draftApprovedCountries} total={summary.totalProfiles} action="Review nationality" onClick={() => onQueueChange('country')} ids={countryIds} />
        <ReadinessCard title="Summaries" ready={summary.approvedSummaries + summary.draftApprovedSummaries} total={summary.totalProfiles} action="Review summaries" onClick={() => onQueueChange('summary')} />
        <ReadinessCard title="Portrait wall images" ready={summary.primaryImagesWallReady} total={summary.totalProfiles} action="Review images" onClick={() => onQueueChange('image-rights')} ids={imageIds} />
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
