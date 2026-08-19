import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { FallbackImage, initials } from '../../components/FallbackImage';
import type { Inductee, RuntimeAudioAsset, RuntimeMediaRecord, RuntimeVideoAsset } from '../../data/types';

type MediaExperienceProps = {
  inductee: Inductee;
  gallery: string[];
  kioskMode: boolean;
  mediaRecord?: RuntimeMediaRecord;
  onOpenImage: (index: number) => void;
};

type MediaItem = {
  id: string;
  sourceType: 'local-video' | 'local-audio' | 'youtube';
  category: 'Ceremony Footage' | 'Oral History' | 'Audio' | 'YouTube Fallback';
  title: string;
  description: string;
  runtimePath?: string;
  youtubeVideoId?: string;
  posterPath?: string;
  captionPath?: string;
  captionStatus?: string;
  transcriptPath?: string;
  transcriptText?: string;
  transcriptStatus?: string;
  rightsStatus?: string;
  approvedForKiosk?: boolean;
};

export function MediaExperience({ inductee, gallery, kioskMode, mediaRecord, onOpenImage }: MediaExperienceProps) {
  const allItems = useMemo(() => buildMediaItems(inductee, mediaRecord), [inductee, mediaRecord]);
  const playableItems = useMemo(
    () => allItems.filter((item) => !kioskMode || item.sourceType !== 'youtube'),
    [allItems, kioskMode],
  );
  const [selectedId, setSelectedId] = useState('');
  const activeItem = playableItems.find((item) => item.id === selectedId) ?? playableItems[0] ?? null;
  const hiddenExternalCount = kioskMode ? allItems.filter((item) => item.sourceType === 'youtube').length : 0;

  useEffect(() => {
    setSelectedId(playableItems[0]?.id ?? '');
  }, [inductee.id, playableItems]);

  return (
    <section className="media-experience" aria-label={`${inductee.name} media`}>
      <header className="media-experience__header">
        <div>
          <p className="museum-kicker">Watch / Listen</p>
          <h3>Media</h3>
        </div>
        <div className="media-experience__summary" aria-label="Available media summary">
          <span>{playableItems.filter((item) => item.sourceType === 'local-video').length} local video</span>
          <span>{playableItems.filter((item) => item.sourceType === 'local-audio').length} audio</span>
          <span>{gallery.length} images</span>
        </div>
      </header>

      <div className="media-experience__layout">
        <MediaStage item={activeItem} kioskMode={kioskMode} personName={inductee.name} />

        <aside className="media-playlist" aria-label="Media playlist">
          {playableItems.length > 0 ? (
            playableItems.map((item) => (
              <button
                aria-current={activeItem?.id === item.id ? 'true' : undefined}
                className={activeItem?.id === item.id ? 'media-playlist__item media-playlist__item--active' : 'media-playlist__item'}
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
              >
                <span>{item.category}</span>
                <strong>{item.title}</strong>
                <small>{item.sourceType === 'youtube' ? 'Fallback stream' : 'Local file preferred'}</small>
              </button>
            ))
          ) : (
            <div className="media-empty media-empty--compact">NO VIDEO AVAILABLE YET</div>
          )}
          {hiddenExternalCount > 0 && (
            <div className="media-playlist__notice">
              YouTube fallback is hidden in kiosk mode.
            </div>
          )}
        </aside>
      </div>

      <section className="media-gallery" aria-label={`${inductee.name} image gallery`}>
        <div className="media-gallery__header">
          <p className="museum-kicker">Image Gallery</p>
          <span>{gallery.length > 0 ? `${gallery.length} images` : 'No images linked'}</span>
        </div>
        {gallery.length > 0 ? (
          <div className="media-gallery__grid">
            {gallery.map((url, index) => (
              <button className="media-gallery__button" key={`${url}-${index}`} type="button" onClick={() => onOpenImage(index)}>
                <FallbackImage
                  alt={`${inductee.imageAltText} Gallery image ${index + 1}.`}
                  className="media-gallery__image"
                  fallbackClassName="media-gallery__fallback"
                  fallbackLabel={initials(inductee.name)}
                  src={url}
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="media-empty media-empty--compact">NO IMAGE GALLERY AVAILABLE YET</div>
        )}
      </section>
    </section>
  );
}

function MediaStage({ item, kioskMode, personName }: { item: MediaItem | null; kioskMode: boolean; personName: string }) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [broken, setBroken] = useState(false);
  const [youtubeLoaded, setYoutubeLoaded] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    setBroken(false);
    setYoutubeLoaded(false);

    return () => {
      stopElement(mediaRef.current);
    };
  }, [item?.id]);

  useEffect(() => {
    function stopMedia() {
      stopElement(mediaRef.current);
      setIsPlaying(false);
      setYoutubeLoaded(false);
    }

    window.addEventListener('cihof:stop-media', stopMedia);
    return () => window.removeEventListener('cihof:stop-media', stopMedia);
  }, []);

  if (!item) {
    return (
      <section className="media-stage media-stage--empty" aria-label="No available video">
        <div className="media-empty">
          <strong>NO VIDEO AVAILABLE YET</strong>
          <span>Local video, oral history audio, or approved fallback media can be added to the media manifest.</span>
        </div>
      </section>
    );
  }

  function play() {
    const media = mediaRef.current;
    if (!media) return;
    media.play()
      .then(() => setIsPlaying(true))
      .catch(() => setBroken(true));
  }

  function pause() {
    const media = mediaRef.current;
    if (!media) return;
    media.pause();
    setIsPlaying(false);
  }

  function restart() {
    const media = mediaRef.current;
    if (!media) return;
    media.currentTime = 0;
    media.play()
      .then(() => setIsPlaying(true))
      .catch(() => setBroken(true));
  }

  return (
    <section className="media-stage" aria-label={item.title}>
      <div className="media-stage__screen">
        {broken ? (
          <div className="media-empty">
            <strong>MEDIA COULD NOT BE LOADED</strong>
            <span>Try another item from the media list.</span>
          </div>
        ) : item.sourceType === 'local-video' ? (
          <video
            ref={mediaRef as RefObject<HTMLVideoElement>}
            poster={item.posterPath ? assetUrl(item.posterPath) : undefined}
            preload="metadata"
            src={item.runtimePath ? assetUrl(item.runtimePath) : undefined}
            onEnded={() => setIsPlaying(false)}
            onError={() => setBroken(true)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
          >
            {item.captionPath && <track kind="captions" src={assetUrl(item.captionPath)} srcLang="en" label="Captions" default />}
          </video>
        ) : item.sourceType === 'local-audio' ? (
          <div className="media-audio">
            <span className="media-audio__mark" aria-hidden="true">{initials(personName)}</span>
            <div>
              <span>{item.category}</span>
              <strong>{item.title}</strong>
            </div>
            <audio
              ref={mediaRef as RefObject<HTMLAudioElement>}
              preload="metadata"
              src={item.runtimePath ? assetUrl(item.runtimePath) : undefined}
              onEnded={() => setIsPlaying(false)}
              onError={() => setBroken(true)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
            >
              {item.captionPath && <track kind="captions" src={assetUrl(item.captionPath)} srcLang="en" label="Captions" default />}
            </audio>
          </div>
        ) : (
          <div className="media-youtube">
            {!youtubeLoaded ? (
              <button type="button" disabled={kioskMode} onClick={() => setYoutubeLoaded(true)}>
                Load YouTube Fallback
              </button>
            ) : (
              <iframe
                title={`${personName} ${item.title}`}
                src={`https://www.youtube.com/embed/${item.youtubeVideoId}`}
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            )}
          </div>
        )}
      </div>

      <div className="media-stage__body">
        <div>
          <p className="museum-kicker">{item.category}</p>
          <h4>{item.title}</h4>
          <p>{item.description}</p>
        </div>
        {item.sourceType !== 'youtube' && (
          <div className="media-controls" aria-label="Playback controls">
            <button type="button" onClick={isPlaying ? pause : play}>{isPlaying ? 'Pause' : 'Play'}</button>
            <button type="button" onClick={restart}>Restart</button>
          </div>
        )}
      </div>

      <MediaTranscript item={item} />
    </section>
  );
}

function MediaTranscript({ item }: { item: MediaItem }) {
  const [loadedTranscript, setLoadedTranscript] = useState('');
  const [loadError, setLoadError] = useState('');
  const transcriptPath = item.transcriptPath;

  useEffect(() => {
    setLoadedTranscript('');
    setLoadError('');
    if (item.transcriptText || !transcriptPath) return;

    let cancelled = false;
    fetch(assetUrl(transcriptPath))
      .then((response) => {
        if (!response.ok) throw new Error(`Transcript request failed: ${response.status}`);
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setLoadedTranscript(text.trim());
      })
      .catch(() => {
        if (!cancelled) setLoadError('Transcript file is listed but could not be loaded.');
      });

    return () => {
      cancelled = true;
    };
  }, [item.id, item.transcriptText, transcriptPath]);

  const transcriptText = item.transcriptText || loadedTranscript;
  const hasTranscript = Boolean(transcriptText || transcriptPath || item.transcriptStatus);
  const hasCaptions = Boolean(item.captionPath || item.captionStatus);

  if (!hasTranscript && !hasCaptions) return null;

  return (
    <div className="media-transcript" aria-label="Captions and transcript status">
      <div>
        <span>Captions</span>
        <strong>{item.captionPath ? 'Available' : statusLabel(item.captionStatus)}</strong>
      </div>
      <div>
        <span>Transcript</span>
        <strong>{transcriptText ? 'Available' : statusLabel(item.transcriptStatus)}</strong>
      </div>
      {transcriptText && <p>{transcriptText}</p>}
      {loadError && <p>{loadError}</p>}
    </div>
  );
}

function buildMediaItems(inductee: Inductee, mediaRecord?: RuntimeMediaRecord) {
  const items: MediaItem[] = [];
  const seenLocalPaths = new Set<string>();
  const seenYoutubeIds = new Set<string>();

  (mediaRecord?.videos ?? []).forEach((video, index) => {
    if (!video.runtimePath || seenLocalPaths.has(video.runtimePath)) return;
    seenLocalPaths.add(video.runtimePath);
    items.push(videoToItem(video, index));
  });

  inductee.localVideoPaths.forEach((path, index) => {
    const runtimePath = path.startsWith('/') ? path : `/${path}`;
    if (seenLocalPaths.has(runtimePath)) return;
    seenLocalPaths.add(runtimePath);
    items.push({
      id: `local-video-${index + 1}-${runtimePath}`,
      sourceType: 'local-video',
      category: 'Ceremony Footage',
      title: `Ceremony Footage ${index + 1}`,
      description: `Local ceremony footage for ${inductee.name}.`,
      runtimePath,
      captionStatus: inductee.videoRightsStatus ? 'review-needed' : undefined,
      transcriptStatus: 'needed',
      rightsStatus: inductee.videoRightsStatus,
    });
  });

  (mediaRecord?.oralHistories ?? []).forEach((audio, index) => {
    const item = audioToItem(audio, index, 'Oral History');
    if (!item || seenLocalPaths.has(item.runtimePath ?? '')) return;
    seenLocalPaths.add(item.runtimePath ?? '');
    items.push(item);
  });

  (mediaRecord?.audio ?? []).forEach((audio, index) => {
    const item = audioToItem(audio, index, 'Audio');
    if (!item || seenLocalPaths.has(item.runtimePath ?? '')) return;
    seenLocalPaths.add(item.runtimePath ?? '');
    items.push(item);
  });

  (mediaRecord?.videos ?? []).forEach((video, index) => {
    if (!video.youtubeVideoId || seenYoutubeIds.has(video.youtubeVideoId)) return;
    seenYoutubeIds.add(video.youtubeVideoId);
    items.push(youtubeToItem(video.youtubeVideoId, video, index));
  });

  inductee.youtubeVideoIds.forEach((youtubeVideoId, index) => {
    if (seenYoutubeIds.has(youtubeVideoId)) return;
    seenYoutubeIds.add(youtubeVideoId);
    items.push({
      id: `youtube-${youtubeVideoId}`,
      sourceType: 'youtube',
      category: 'YouTube Fallback',
      title: `Fallback Video ${index + 1}`,
      description: `Streaming fallback for ${inductee.name}. Local media should be preferred for museum installation.`,
      youtubeVideoId,
    });
  });

  return items;
}

function videoToItem(video: RuntimeVideoAsset, index: number): MediaItem {
  return {
    id: `local-video-${index + 1}-${video.runtimePath}`,
    sourceType: 'local-video',
    category: 'Ceremony Footage',
    title: video.title || `Ceremony Footage ${index + 1}`,
    description: video.description || 'Local ceremony footage.',
    runtimePath: video.runtimePath,
    posterPath: video.posterRuntimePath,
    captionPath: video.captionRuntimePath,
    captionStatus: video.captionStatus,
    transcriptPath: video.transcriptRuntimePath || video.transcript?.runtimePath,
    transcriptText: video.transcript?.text,
    transcriptStatus: video.transcriptStatus || video.transcript?.status,
    rightsStatus: video.rightsStatus,
    approvedForKiosk: video.approvedForKiosk,
  };
}

function audioToItem(audio: RuntimeAudioAsset, index: number, category: 'Oral History' | 'Audio'): MediaItem | null {
  if (!audio.runtimePath) return null;
  return {
    id: `${category.toLowerCase().replace(/\s+/g, '-')}-${index + 1}-${audio.runtimePath}`,
    sourceType: 'local-audio',
    category,
    title: audio.title || `${category} ${index + 1}`,
    description: audio.description || (category === 'Oral History' ? 'Local oral history audio.' : 'Local audio.'),
    runtimePath: audio.runtimePath,
    posterPath: audio.posterRuntimePath,
    captionPath: audio.captionRuntimePath,
    captionStatus: audio.captionStatus,
    transcriptPath: audio.transcriptRuntimePath || audio.transcript?.runtimePath,
    transcriptText: audio.transcript?.text,
    transcriptStatus: audio.transcriptStatus || audio.transcript?.status,
    rightsStatus: audio.rightsStatus,
    approvedForKiosk: audio.approvedForKiosk,
  };
}

function youtubeToItem(youtubeVideoId: string, video: RuntimeVideoAsset, index: number): MediaItem {
  return {
    id: `youtube-${youtubeVideoId}`,
    sourceType: 'youtube',
    category: 'YouTube Fallback',
    title: video.title || `Fallback Video ${index + 1}`,
    description: video.description || 'Streaming fallback. Local media should be preferred for museum installation.',
    youtubeVideoId,
    captionStatus: video.captionStatus,
    transcriptStatus: video.transcriptStatus,
    rightsStatus: video.rightsStatus,
  };
}

function stopElement(media: HTMLVideoElement | HTMLAudioElement | null) {
  if (!media) return;
  media.pause();
  media.currentTime = 0;
}

function statusLabel(status?: string) {
  if (!status) return 'Not available yet';
  return status.replace(/-/g, ' ');
}

function assetUrl(path: string) {
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  if (!path.startsWith('/')) return `${import.meta.env.BASE_URL}${path}`;
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
