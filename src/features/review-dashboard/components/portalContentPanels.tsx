import type { Inductee } from '../../../data/types';
import type {
  DashboardSummary,
  QueueMode,
} from '../models/portalReviewModel';
import { MetricCard } from './portalUi';
import {
  buildContentAccessSummary,
  compareArchiveAccessRows,
  compareStoryAccessRows,
  contentAccessDetail,
  contentSectionStatusLabel,
  type ContentAccessRow,
  type SourceQueueMode,
} from '../models/portalSourceModel';

export function StartHerePanel({
  contentRows,
  draftCount,
  relationshipDraftCount,
  sourceLeadCount,
  summary,
  onOpenContent,
  onOpenExports,
  onOpenReadiness,
  onOpenRelationships,
  onOpenSource,
  onOpenWorkbench,
}: {
  contentRows: ContentAccessRow[];
  draftCount: number;
  relationshipDraftCount: number;
  sourceLeadCount: number;
  summary: DashboardSummary;
  onOpenContent: () => void;
  onOpenExports: () => void;
  onOpenReadiness: () => void;
  onOpenRelationships: () => void;
  onOpenSource: (mode: SourceQueueMode) => void;
  onOpenWorkbench: (queue: QueueMode) => void;
}) {
  const storyProfiles = contentRows.filter((row) => row.storyBeatCount > 0).length;
  const archiveLeads = contentRows.reduce((total, row) => total + row.archiveRows.length, 0);
  const archiveProfiles = contentRows.filter((row) => row.archiveRows.length > 0).length;
  const sourceProfiles = contentRows.filter((row) => row.sourceCount > 0).length;
  const pendingVideoLeads = contentRows.reduce((total, row) => total + row.pendingVideoCount + row.videoLeadRows.length, 0);

  return (
    <section className="portal-start" aria-label="Start here">
      <div className="portal-start__hero">
        <div>
          <p className="eyebrow">Start Here</p>
          <h3>One clear pass at a time</h3>
        </div>
        <p>The portal is strongest when it is treated like a set of short passes: look at the best current material, decide what needs curator work, then export only after review.</p>
      </div>

      <div className="portal-start__grid">
        <button className="portal-start-card portal-start-card--primary" type="button" onClick={onOpenContent}>
          <span>Best Current Content</span>
          <strong>{storyProfiles} story profiles</strong>
          <small>{archiveLeads} WRHS archive leads and {sourceProfiles} source-backed profiles are gathered into one review surface.</small>
        </button>
        <button className="portal-start-card" type="button" onClick={() => onOpenWorkbench('high')}>
          <span>Profile Workbench</span>
          <strong>{summary.totalProfiles} profiles</strong>
          <small>{summary.highPriority} high-priority records are ready for one-at-a-time review.</small>
        </button>
        <button className="portal-start-card" type="button" onClick={() => onOpenSource('archives')}>
          <span>Archive & Source Leads</span>
          <strong>{archiveProfiles} archive profiles</strong>
          <small>Open the WRHS queue first, then move through story, image, and video source leads as needed.</small>
        </button>
        <button className="portal-start-card" type="button" onClick={draftCount > 0 || relationshipDraftCount > 0 ? onOpenExports : onOpenReadiness}>
          <span>{draftCount > 0 || relationshipDraftCount > 0 ? 'Finish Drafts' : 'Readiness Snapshot'}</span>
          <strong>{draftCount + relationshipDraftCount} local drafts</strong>
          <small>{pendingVideoLeads} media items still need rights, captions, transcripts, local files, or source review.</small>
        </button>
      </div>

      <details className="portal-start__more">
        <summary>Specialist Tools</summary>
        <div>
          <button type="button" onClick={() => onOpenSource('profiles')}>All Source Data</button>
          <button type="button" onClick={() => onOpenSource('video')}>Video Leads</button>
          <button type="button" onClick={onOpenRelationships}>Relationships</button>
          <button type="button" onClick={onOpenReadiness}>Readiness</button>
          <button type="button" onClick={onOpenExports}>Exports</button>
        </div>
        <span>{sourceLeadCount} source rows are available; use these tools when you are doing focused cleanup instead of a first-pass review.</span>
      </details>
    </section>
  );
}

export function ContentAccessPanel({
  loading,
  rows,
  onOpenProfile,
  onOpenSource,
  onPreviewProfile,
}: {
  loading: boolean;
  rows: ContentAccessRow[];
  onOpenProfile: (personId: string) => void;
  onOpenSource: (mode: SourceQueueMode) => void;
  onPreviewProfile: (inductee: Inductee) => void;
}) {
  const storyRows = rows
    .filter((row) => row.storyBeatCount > 0)
    .sort(compareStoryAccessRows)
    .slice(0, 8);
  const archiveRows = rows
    .filter((row) => row.archiveRows.length > 0)
    .sort(compareArchiveAccessRows)
    .slice(0, 8);
  const sourceDenseRows = rows
    .filter((row) => row.sourceCount > 0)
    .sort((a, b) => b.sourceCount - a.sourceCount || b.score - a.score || a.inductee.name.localeCompare(b.inductee.name))
    .slice(0, 10);
  const mediaLeadRows = rows
    .filter((row) => row.videoLeadRows.length > 0 || row.manifestVideos.length > 0)
    .sort((a, b) => (b.videoLeadRows.length + b.manifestVideos.length) - (a.videoLeadRows.length + a.manifestVideos.length) || a.inductee.name.localeCompare(b.inductee.name))
    .slice(0, 8);
  const summary = buildContentAccessSummary(rows);

  return (
    <section className="portal-content" aria-label="Best currently accessible content">
      <div className="portal-readiness__intro portal-content__intro">
        <div>
          <p className="eyebrow">Best Content</p>
          <h3>Make the strongest current material easy to find</h3>
          <p>Curated story copy is ready for visitor review. WRHS archive leads, source evidence, and video items are surfaced here as staff review paths until rights, captions, transcripts, and archival permissions are cleared.</p>
        </div>
        <div className="portal-source__stamp">
          <span>{loading ? 'Refreshing content audit' : 'Content audit ready'}</span>
          <span>{rows.length} profiles scanned</span>
        </div>
      </div>

      <div className="portal-lenses__summary portal-content__summary">
        <MetricCard label="Curated Stories" value={summary.storyProfiles} detail={`${summary.storyBeats} story beats on visitor profiles`} />
        <MetricCard label="WRHS Archive Paths" value={summary.archiveProfiles} detail={`${summary.archiveLeads} leads / ${summary.directArchiveLeads} direct`} />
        <MetricCard label="Source Evidence" value={summary.sourceProfiles} detail={`${summary.sourceRows} profile-linked source rows`} />
        <MetricCard label="Video Access" value={summary.approvedVideos} detail={`${summary.pendingManifestVideos} manifest videos / ${summary.videoLeadRows} source leads pending`} />
      </div>

      <div className="portal-content-grid">
        <ContentAccessSection
          actionLabel="Open Story Review"
          emptyText="No curated story profiles were loaded."
          rows={storyRows}
          sourceMode="stories"
          title="Visitor Story Copy"
          tone="ready"
          onOpenProfile={onOpenProfile}
          onOpenSource={onOpenSource}
          onPreviewProfile={onPreviewProfile}
        />
        <ContentAccessSection
          actionLabel="Open Archive Leads"
          emptyText="No WRHS archive leads were found in the current packet."
          rows={archiveRows}
          sourceMode="archives"
          title="WRHS Archive Leads"
          tone="review"
          onOpenProfile={onOpenProfile}
          onOpenSource={onOpenSource}
          onPreviewProfile={onPreviewProfile}
        />
      </div>

      <div className="portal-content-grid portal-content-grid--wide">
        <ContentAccessSection
          actionLabel="Open Source Evidence"
          emptyText="No profile-linked source evidence was loaded."
          rows={sourceDenseRows}
          sourceMode="profiles"
          title="Highest Source Density"
          tone="review"
          onOpenProfile={onOpenProfile}
          onOpenSource={onOpenSource}
          onPreviewProfile={onPreviewProfile}
        />
        <ContentAccessSection
          actionLabel="Open Video Leads"
          emptyText="No video leads or manifest videos were loaded."
          rows={mediaLeadRows}
          sourceMode="video"
          title="Media Access Pending"
          tone="pending"
          onOpenProfile={onOpenProfile}
          onOpenSource={onOpenSource}
          onPreviewProfile={onPreviewProfile}
        />
      </div>
    </section>
  );
}

function ContentAccessSection({
  title,
  rows,
  tone,
  sourceMode,
  actionLabel,
  emptyText,
  onOpenProfile,
  onOpenSource,
  onPreviewProfile,
}: {
  title: string;
  rows: ContentAccessRow[];
  tone: 'ready' | 'review' | 'pending';
  sourceMode: SourceQueueMode;
  actionLabel: string;
  emptyText: string;
  onOpenProfile: (personId: string) => void;
  onOpenSource: (mode: SourceQueueMode) => void;
  onPreviewProfile: (inductee: Inductee) => void;
}) {
  return (
    <section className={`portal-content-section portal-content-section--${tone}`}>
      <header className="portal-content-section__header">
        <div>
          <span>{contentSectionStatusLabel(tone)}</span>
          <h4>{title}</h4>
        </div>
        <strong>{rows.length}</strong>
      </header>

      <div className="portal-content-list">
        {rows.map((row) => (
          <article className="portal-content-card" key={`${title}-${row.inductee.id}`}>
            <div className="portal-content-card__top">
              <div>
                <span>{row.inductee.classYear ? `Class of ${row.inductee.classYear}` : 'Year review'}</span>
                <h5>{row.inductee.name}</h5>
              </div>
              <strong>{row.score}</strong>
            </div>
            <p>{contentAccessDetail(row, sourceMode)}</p>
            <div className="portal-content-card__chips" aria-label={`${row.inductee.name} content signals`}>
              {row.signals.slice(0, 5).map((signal) => (
                <span key={signal}>{signal}</span>
              ))}
            </div>
            <div className="portal-content-card__actions">
              <button type="button" onClick={() => onOpenProfile(row.inductee.id)}>Open Workbench</button>
              <button type="button" onClick={() => onOpenSource(sourceMode)}>{actionLabel}</button>
              {row.storyBeatCount > 0 && <button type="button" onClick={() => onPreviewProfile(row.inductee)}>Preview Profile</button>}
            </div>
          </article>
        ))}
        {rows.length === 0 && <div className="portal-empty-state">{emptyText}</div>}
      </div>
    </section>
  );
}
