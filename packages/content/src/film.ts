import type { VisitorTarget } from './publication.ts';

/**
 * A film a visitor may be shown.
 *
 * Playing a film is the highest-stakes thing this exhibit does: it reproduces
 * someone's likeness and voice, at length, in public. So a film is not
 * published because a file exists. It is published when a reviewer has cleared
 * the rights, and when the things that make it usable by everyone — captions
 * and a transcript — have been cleared too.
 *
 * A film without captions is not a film some visitors can watch. Shipping one
 * and calling it published would mean deciding those visitors do not count.
 */
export type PublishedFilm = {
  readonly id: string;
  readonly src: string;
  readonly poster: string;
  readonly captions: string;
  readonly transcript: string;
  readonly durationSeconds: number | null;
};

export type FilmPrerequisite =
  | 'file'
  | 'poster'
  | 'captions'
  | 'transcript'
  | 'rights'
  | 'target';

/** Every reason a holding is not publishable, so a report can say what is missing. */
export function filmShortfalls(video: Record<string, unknown>, target: VisitorTarget): FilmPrerequisite[] {
  const missing: FilmPrerequisite[] = [];

  if (!text(video['runtimePath'])) missing.push('file');
  if (!text(video['posterRuntimePath'])) missing.push('poster');
  if (!text(video['captionRuntimePath']) || video['captionStatus'] !== 'approved') missing.push('captions');
  if (!text(video['transcriptRuntimePath']) || video['transcriptStatus'] !== 'approved') missing.push('transcript');
  if (video['rightsStatus'] !== 'approved') missing.push('rights');

  const approvedForTarget = target === 'public' ? video['approvedForPublicWeb'] : video['approvedForKiosk'];
  if (approvedForTarget !== true) missing.push('target');

  return missing;
}

export function publishableFilms(videos: readonly unknown[], target: VisitorTarget): PublishedFilm[] {
  return videos.flatMap((value) => {
    if (!value || typeof value !== 'object') return [];
    const video = value as Record<string, unknown>;
    if (filmShortfalls(video, target).length > 0) return [];

    const duration = video['durationSeconds'];
    return [{
      id: text(video['youtubeVideoId']) || text(video['runtimePath']),
      src: text(video['runtimePath']),
      poster: text(video['posterRuntimePath']),
      captions: text(video['captionRuntimePath']),
      transcript: text(video['transcriptRuntimePath']),
      durationSeconds: typeof duration === 'number' && Number.isFinite(duration) ? duration : null,
    }];
  });
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
