import { useEffect, useState } from 'react';
import {
  emptySourceCurationPacket,
  normalizeSourceCurationPacket,
} from '../models/portalSourcePacket';
import type {
  SourceCurationPacket,
  SourceCurationState,
} from '../models/portalSourcePacket';

export type CountEntry = {
  [key: string]: string | number;
  count: number;
};

export type CurationReport = {
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

export type MediaReport = {
  generatedAt?: string;
  strictProfile?: string;
  validation?: {
    errors?: string[];
    warnings?: string[];
  };
  strictFailures?: string[];
  summary?: {
    primaryImages?: number;
    primaryImagesWallReady?: number;
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

export type MediaAsset = {
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

export type VideoAsset = {
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

export type MediaManifest = {
  assets?: Record<string, {
    images?: {
      primary?: MediaAsset;
      gallery?: MediaAsset[];
    };
    videos?: VideoAsset[];
    notes?: string[];
  }>;
};

export type MediaManifestRecord = NonNullable<MediaManifest['assets']>[string];

export type ReportState = {
  curation: CurationReport | null;
  media: MediaReport | null;
  manifest: MediaManifest | null;
  loading: boolean;
  error: string;
};

export const portalReportUrls = {
  curation: `${import.meta.env.BASE_URL}data/curation-report.json`,
  media: `${import.meta.env.BASE_URL}data/media-report.json`,
  manifest: `${import.meta.env.BASE_URL}data/media-manifest.json`,
  storyLenses: `${import.meta.env.BASE_URL}data/story-lenses.json`,
  sourceCuration: `${import.meta.env.BASE_URL}data/source-curation-packet.json`,
};

export function useReviewReports(): ReportState {
  const [state, setState] = useState<ReportState>({ curation: null, media: null, manifest: null, loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchJson<CurationReport>(portalReportUrls.curation),
      fetchJson<MediaReport>(portalReportUrls.media),
      fetchJson<MediaManifest>(portalReportUrls.manifest),
    ])
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

export function useSourceCurationPacket(): SourceCurationState {
  const [state, setState] = useState<SourceCurationState>({ packet: null, loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;

    fetchJson<SourceCurationPacket>(portalReportUrls.sourceCuration)
      .then((packet) => {
        if (!cancelled) setState({ packet: normalizeSourceCurationPacket(packet), loading: false, error: '' });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ packet: emptySourceCurationPacket(), loading: false, error: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function fetchJson<T>(url: string): Promise<T> {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${url} failed with ${response.status}`);
    return response.json() as Promise<T>;
  });
}
