import { useEffect, useMemo, useState } from 'react';
import type { Inductee } from '../../data/types';

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

type ReportState = {
  curation: CurationReport | null;
  media: MediaReport | null;
  manifest: MediaManifest | null;
  loading: boolean;
  error: string;
};

type QueueMode = 'all' | 'high' | 'featured' | 'summary' | 'themes' | 'image-rights' | 'video-captions' | 'accessibility';

type ReviewDashboardViewProps = {
  inductees: Inductee[];
  onSelect: (inductee: Inductee) => void;
};

type CsvValue = string | number | boolean | null | undefined;

const reportUrls = {
  curation: `${import.meta.env.BASE_URL}data/curation-report.json`,
  media: `${import.meta.env.BASE_URL}data/media-report.json`,
  manifest: `${import.meta.env.BASE_URL}data/media_manifest.json`,
};

export function ReviewDashboardView({ inductees, onSelect }: ReviewDashboardViewProps) {
  const reports = useReviewReports();
  const [query, setQuery] = useState('');
  const [queue, setQueue] = useState<QueueMode>('high');
  const summary = useMemo(() => buildDashboardSummary(inductees, reports.curation, reports.media), [inductees, reports.curation, reports.media]);
  const visibleRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return inductees
      .filter((inductee) => matchesQueue(inductee, queue, reports.curation))
      .filter((inductee) => !search || inductee.searchText.includes(search) || inductee.id.includes(search))
      .sort((a, b) => {
        const priority = priorityRank(a.reviewPriority) - priorityRank(b.reviewPriority);
        if (priority !== 0) return priority;
        const featured = Number(b.featuredCandidate) - Number(a.featuredCandidate);
        if (featured !== 0) return featured;
        return (b.classYear ?? 0) - (a.classYear ?? 0) || a.name.localeCompare(b.name);
      });
  }, [inductees, query, queue, reports.curation]);

  return (
    <section className="review-dashboard" aria-label="Staff review dashboard">
      <div className="review-dashboard__header">
        <div>
          <p className="eyebrow">Staff Review</p>
          <h2>Dashboard</h2>
        </div>
        <div className="review-dashboard__status">
          <StatusPill label="Curation" value={statusLabel(reports.curation?.validation?.errors?.length ?? 0, reports.curation?.validation?.warnings?.length ?? 0)} tone={(reports.curation?.validation?.errors?.length ?? 0) > 0 ? 'bad' : 'ok'} />
          <StatusPill label="Media" value={statusLabel(reports.media?.validation?.errors?.length ?? 0, reports.media?.validation?.warnings?.length ?? 0)} tone={(reports.media?.validation?.errors?.length ?? 0) > 0 ? 'bad' : 'warn'} />
          <StatusPill label="Kiosk Ready" value={summary.kioskReady ? 'Yes' : 'No'} tone={summary.kioskReady ? 'ok' : 'bad'} />
        </div>
      </div>

      {reports.error && <div className="review-dashboard__alert">Report load error: {reports.error}</div>}
      {reports.loading && <div className="review-dashboard__alert">Loading review reports...</div>}

      <div className="review-metrics" aria-label="Review metrics">
        <MetricCard label="Profiles" value={summary.totalProfiles} detail={`${summary.approvedProfiles} approved / ${summary.draftProfiles} draft`} />
        <MetricCard label="High Priority" value={summary.highPriority} detail={`${summary.mediumPriority} medium / ${summary.standardPriority} standard`} />
        <MetricCard label="Summaries" value={summary.approvedSummaries} detail={`${summary.summaryDrafts} draft / ${summary.truncatedDrafts} truncated`} />
        <MetricCard label="Themes" value={summary.approvedThemes} detail={`${summary.themeCandidates} candidate-only`} />
        <MetricCard label="Primary Images" value={summary.localPrimaryImages} detail={`${summary.primaryImagesReady} kiosk-ready / ${summary.totalProfiles} local`} />
        <MetricCard label="Videos" value={summary.videosReady} detail={`${summary.videoItems} items / ${summary.missingCaptions} captions needed`} />
      </div>

      <div className="review-controls controls" aria-label="Review filters">
        <label className="field field--search">
          <span>Search</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, id, region, year, story, tag" type="search" />
        </label>
        <label className="field">
          <span>Queue</span>
          <select value={queue} onChange={(event) => setQueue(event.target.value as QueueMode)}>
            <option value="all">All profiles</option>
            <option value="high">High priority</option>
            <option value="featured">Featured candidates</option>
            <option value="summary">Summary drafts</option>
            <option value="themes">Theme candidates</option>
            <option value="image-rights">Image rights</option>
            <option value="video-captions">Video captions</option>
            <option value="accessibility">Accessibility</option>
          </select>
        </label>
        <div className="review-controls__actions">
          <button
            className="review-export-button"
            disabled={visibleRows.length === 0}
            type="button"
            onClick={() => downloadReviewQueue(visibleRows, reports.curation, reports.media, reports.manifest, queue)}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="review-dashboard__generated">
        <span>Curation report: {formatDate(reports.curation?.generatedAt)}</span>
        <span>Media report: {formatDate(reports.media?.generatedAt)}</span>
        <span>{visibleRows.length} shown</span>
      </div>

      <div className="review-table" aria-label="Profile review queue">
        <div className="review-table__head">
          <span>Profile</span>
          <span>Status</span>
          <span>Content</span>
          <span>Media</span>
          <span>Action</span>
        </div>
        {visibleRows.map((inductee) => (
          <div className="review-row" key={inductee.id}>
            <div className="review-row__profile">
              <strong>{inductee.name}</strong>
              <span>{inductee.id}</span>
              <small>{inductee.classYear ?? 'Year unknown'} / {inductee.region}</small>
            </div>
            <div className="review-row__chips">
              <Chip label={inductee.approvalStatus} tone={inductee.approvalStatus === 'approved' ? 'ok' : 'warn'} />
              <Chip label={inductee.reviewPriority} tone={inductee.reviewPriority === 'high' ? 'bad' : inductee.reviewPriority === 'medium' ? 'warn' : 'ok'} />
              {inductee.featuredCandidate && <Chip label="featured candidate" tone="accent" />}
              <small className="review-row__next">{formatNeeds(getReviewNeeds(inductee, reports.curation, reports.media))}</small>
            </div>
            <div className="review-row__chips">
              <Chip label={inductee.storySummarySource === 'curated' ? 'summary approved' : 'summary draft'} tone={inductee.storySummarySource === 'curated' ? 'ok' : 'warn'} />
              <Chip label={inductee.themeTagsSource === 'curated' ? 'themes approved' : 'theme candidates'} tone={inductee.themeTagsSource === 'curated' ? 'ok' : 'warn'} />
              {inductee.communityTags.length > 0 && <Chip label={`${inductee.communityTags.length} communities`} tone="ok" />}
            </div>
            <div className="review-row__chips">
              <Chip label={inductee.primaryImageUrl.startsWith('/media/') ? 'local image' : 'external image'} tone={inductee.primaryImageUrl.startsWith('/media/') ? 'ok' : 'bad'} />
              <Chip label={inductee.imageRightsStatus} tone={inductee.imageRightsStatus === 'approved' ? 'ok' : 'warn'} />
              {inductee.hasVideo && <Chip label="video review" tone={inductee.videoRightsStatus === 'approved' ? 'ok' : 'bad'} />}
            </div>
            <div className="review-row__action">
              <button type="button" onClick={() => onSelect(inductee)}>Open</button>
            </div>
          </div>
        ))}
      </div>

      {visibleRows.length === 0 && <div className="review-dashboard__alert">No profiles match this queue.</div>}
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

function fetchJson<T>(url: string): Promise<T> {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${url} failed with ${response.status}`);
    return response.json() as Promise<T>;
  });
}

function buildDashboardSummary(inductees: Inductee[], curation: CurationReport | null, media: MediaReport | null) {
  const totalProfiles = inductees.length;
  const approvedProfiles = inductees.filter((item) => item.approvalStatus === 'approved').length;
  const highPriority = inductees.filter((item) => item.reviewPriority === 'high').length;
  const mediumPriority = inductees.filter((item) => item.reviewPriority === 'medium').length;
  const standardPriority = inductees.filter((item) => item.reviewPriority === 'standard').length;
  const localPrimaryImages = inductees.filter((item) => item.primaryImageUrl.startsWith('/media/')).length;
  const primaryImagesReady = media?.summary?.primaryImagesReady ?? 0;
  const videosReady = media?.summary?.videosReady ?? 0;
  const videoItems = media?.summary?.videoItems ?? 0;
  const missingCaptions = media?.summary?.missingCaptions?.length ?? 0;

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
    localPrimaryImages,
    primaryImagesReady,
    videosReady,
    videoItems,
    missingCaptions,
    kioskReady: primaryImagesReady === totalProfiles && videoItems === videosReady && (media?.validation?.errors?.length ?? 0) === 0,
  };
}

function matchesQueue(inductee: Inductee, queue: QueueMode, curation: CurationReport | null) {
  if (queue === 'all') return true;
  if (queue === 'high') return inductee.reviewPriority === 'high';
  if (queue === 'featured') return inductee.featuredCandidate && !inductee.featured;
  if (queue === 'summary') return inductee.storySummarySource !== 'curated';
  if (queue === 'themes') return inductee.themeTagsSource !== 'curated';
  if (queue === 'image-rights') return inductee.imageRightsStatus !== 'approved';
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

function getReviewNeeds(inductee: Inductee, curation: CurationReport | null, media: MediaReport | null) {
  const needs: string[] = [];

  if (inductee.approvalStatus !== 'approved') needs.push('Approve profile metadata');
  if (inductee.storySummarySource !== 'curated') needs.push('Approve or rewrite story summary');
  if (inductee.themeTagsSource !== 'curated') needs.push('Approve theme tags');
  if (inductee.featuredCandidate && !inductee.featured) needs.push('Featured story decision');
  if (inductee.imageRightsStatus !== 'approved' || hasId(curation?.media?.imageRightsReviewNeeded, inductee.id) || hasId(media?.summary?.imageRightsNeedsReview, inductee.id)) {
    needs.push('Approve primary image rights');
  }
  if (hasId(media?.summary?.missingPrimaryLocalFiles, inductee.id)) needs.push('Localize primary image');

  if (inductee.hasVideo) {
    if (inductee.videoRightsStatus !== 'approved' || hasId(curation?.media?.videoRightsReviewNeeded, inductee.id) || hasId(media?.summary?.videoRightsNeedsReview, inductee.id)) {
      needs.push('Approve video rights');
    }
    if (hasId(curation?.media?.captionTranscriptReviewNeeded, inductee.id) || hasId(media?.summary?.missingCaptions, inductee.id)) needs.push('Add captions');
    if (hasId(media?.summary?.missingTranscripts, inductee.id)) needs.push('Add transcript');
    if (hasId(media?.summary?.missingVideoLocalFiles, inductee.id)) needs.push('Localize video file');
    if (hasId(media?.summary?.missingVideoPosters, inductee.id)) needs.push('Add video poster');
  }

  if (hasId(curation?.accessibility?.plainLanguageReviewNeeded, inductee.id)) needs.push('Plain-language review');
  if (hasId(curation?.accessibility?.sensitiveContentReviewNeeded, inductee.id)) needs.push('Sensitive-content review');
  if (hasId(curation?.accessibility?.imageDescriptionReviewNeeded, inductee.id)) needs.push('Image description review');

  return Array.from(new Set(needs));
}

function hasId(values: string[] | undefined, id: string) {
  return Boolean(values?.includes(id));
}

function formatNeeds(needs: string[]) {
  if (needs.length === 0) return 'No open review flags';
  return needs.slice(0, 3).join(' / ') + (needs.length > 3 ? ` / +${needs.length - 3}` : '');
}

function downloadReviewQueue(inductees: Inductee[], curation: CurationReport | null, media: MediaReport | null, manifest: MediaManifest | null, queue: QueueMode) {
  const headers = [
    'id',
    'name',
    'class_year',
    'region',
    'profile_url',
    'approval_status',
    'review_priority',
    'approve_profile',
    'featured_candidate',
    'featured',
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
    'curator_notes',
    'media_notes',
    'review_needs',
  ];
  const rows = inductees.map((inductee) => {
    const mediaRecord = manifest?.assets?.[inductee.id];
    const primaryImage = mediaRecord?.images?.primary;
    const videos = mediaRecord?.videos ?? [];
    const firstVideo = videos[0];

    return [
      inductee.id,
      inductee.name,
      inductee.classYear ?? '',
      inductee.region,
      inductee.profileUrl,
      inductee.approvalStatus,
      inductee.reviewPriority,
      '',
      inductee.featuredCandidate ? 'yes' : 'no',
      inductee.featured ? 'yes' : 'no',
      inductee.storySummary,
      inductee.storySummarySource === 'curated' ? inductee.storySummary : '',
      '',
      inductee.storySummarySource,
      inductee.themeTags.join('; '),
      inductee.themeTagsSource === 'curated' ? inductee.themeTags.join('; ') : '',
      '',
      inductee.themeTagsSource,
      inductee.communityTags.join('; '),
      inductee.communityTags.join('; '),
      '',
      primaryImage?.sourceUrl ?? '',
      primaryImage?.filePath ?? '',
      primaryImage?.runtimePath ?? '',
      primaryImage?.checksumSha256 ?? '',
      primaryImage?.width ?? '',
      primaryImage?.height ?? '',
      primaryImage?.runtimePath?.startsWith('/media/') ? 'yes' : inductee.primaryImageUrl.startsWith('/media/') ? 'yes' : 'no',
      primaryImage?.altText ?? inductee.imageAltText,
      primaryImage?.rightsStatus ?? inductee.imageRightsStatus,
      '',
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
      firstVideo?.rightsStatus ?? inductee.videoRightsStatus,
      '',
      firstVideo?.captionStatus ?? '',
      '',
      firstVideo?.transcriptStatus ?? '',
      '',
      firstVideo?.audioDescriptionStatus ?? '',
      videos.length > 0 && videos.every((video) => video.approvedForKiosk) ? 'yes' : videos.length > 0 ? 'no' : '',
      '',
      '',
      mediaRecord?.notes?.join('; ') ?? '',
      getReviewNeeds(inductee, curation, media).join('; '),
    ];
  });
  const csv = [headers, ...rows].map((row) => row.map(toCsvCell).join(',')).join('\n');
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `cihof-${queue}-review-queue-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function toCsvCell(value: CsvValue) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function priorityRank(priority: string) {
  if (priority === 'high') return 0;
  if (priority === 'medium') return 1;
  return 2;
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'bad' }) {
  return (
    <span className={`review-status review-status--${tone}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
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
