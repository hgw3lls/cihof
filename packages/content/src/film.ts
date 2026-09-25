import type { VisitorTarget } from './publication.ts';

/**
 * Where the moving picture comes from.
 *
 * The 93 films are 41 GB of MP4 and are deliberately not in the repository, so
 * a build from a fresh checkout has captions, posters and transcripts but no
 * video. `youtube` publishes the hall's own channel recording in its place.
 *
 * This is not a free swap. A YouTube film needs the network, so a kiosk set to
 * `youtube` shows nothing the moment the connection drops — which is most of
 * what the offline support in this exhibit exists to prevent. Keep kiosks on
 * `local-file` unless somebody has decided otherwise knowing that.
 */
export type FilmDelivery = 'local-file' | 'youtube';

export type FilmSource =
  | { readonly kind: 'local-file'; readonly src: string }
  | { readonly kind: 'youtube'; readonly videoId: string; readonly embedUrl: string };

/**
 * Privacy-preserving by default.
 *
 * `youtube-nocookie.com` is the same player without the tracking cookies a
 * visitor never agreed to. A hall of fame wall should not be quietly building
 * an advertising profile for whoever stops to watch.
 */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;
}

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
  readonly source: FilmSource;
  readonly poster: string;
  readonly captions: string;
  readonly transcript: string;
  readonly durationSeconds: number | null;
  /**
   * Where playback opens, in seconds, when the film is a ceremony standing
   * for several people and a curator approved this person's part of it.
   * Absent: from the beginning.
   */
  readonly startSeconds?: number;
};

export type FilmPrerequisite =
  | 'file'
  | 'poster'
  | 'captions'
  | 'transcript'
  | 'rights'
  | 'target';

/** Every reason a holding is not publishable, so a report can say what is missing. */
export function filmShortfalls(
  video: Record<string, unknown>,
  target: VisitorTarget,
  delivery: FilmDelivery = 'local-file',
): FilmPrerequisite[] {
  const missing: FilmPrerequisite[] = [];

  // Captions, transcript, poster and rights are required either way. Changing
  // where the picture is served from decides nothing about whether the film may
  // be shown, or whether everyone can follow it.
  if (delivery === 'youtube') {
    if (!text(video['youtubeVideoId'])) missing.push('file');
  } else if (!text(video['runtimePath'])) missing.push('file');
  if (!text(video['posterRuntimePath'])) missing.push('poster');
  if (!text(video['captionRuntimePath']) || video['captionStatus'] !== 'approved') missing.push('captions');
  if (!text(video['transcriptRuntimePath']) || video['transcriptStatus'] !== 'approved') missing.push('transcript');
  if (video['rightsStatus'] !== 'approved') missing.push('rights');

  const approvedForTarget = target === 'public' ? video['approvedForPublicWeb'] : video['approvedForKiosk'];
  if (approvedForTarget !== true) missing.push('target');

  return missing;
}

export function publishableFilms(
  videos: readonly unknown[],
  target: VisitorTarget,
  delivery: FilmDelivery = 'local-file',
): PublishedFilm[] {
  return videos.flatMap((value) => {
    if (!value || typeof value !== 'object') return [];
    const video = value as Record<string, unknown>;
    if (filmShortfalls(video, target, delivery).length > 0) return [];

    const duration = video['durationSeconds'];
    const videoId = text(video['youtubeVideoId']);
    return [{
      id: videoId || text(video['runtimePath']),
      source: delivery === 'youtube'
        ? { kind: 'youtube' as const, videoId, embedUrl: youtubeEmbedUrl(videoId) }
        : { kind: 'local-file' as const, src: text(video['runtimePath']) },
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
