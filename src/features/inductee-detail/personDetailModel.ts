import type { Inductee, RuntimeAudioAsset, RuntimeMediaRecord, RuntimeVideoAsset } from '../../data/types';

export type WatchAvailability = {
  playable: boolean;
  status: string;
  message: string;
};

export function mediaAvailability(inductee: Inductee, mediaRecord: RuntimeMediaRecord | undefined, kioskMode: boolean): WatchAvailability {
  const approvedVideos = (mediaRecord?.videos ?? []).filter(isPublicReadyVideoAsset);
  const approvedAudio = [...(mediaRecord?.oralHistories ?? []), ...(mediaRecord?.audio ?? [])].filter(isPublicReadyAudioAsset);
  const legacyLocalVideos = !kioskMode && !mediaRecord ? inductee.localVideoPaths.filter(Boolean) : [];
  const youtubeIds = new Set([
    ...(mediaRecord?.videos ?? []).map((video) => video.youtubeVideoId).filter((id): id is string => Boolean(id)),
    ...inductee.youtubeVideoIds,
  ]);
  const playableCount = approvedVideos.length + approvedAudio.length + legacyLocalVideos.length + (!kioskMode ? youtubeIds.size : 0);

  if (playableCount > 0) {
    return {
      playable: true,
      status: approvedVideos.length + legacyLocalVideos.length > 0 ? 'Footage ready' : approvedAudio.length > 0 ? 'Audio ready' : 'Stream available',
      message: '',
    };
  }

  if (kioskMode && youtubeIds.size > 0) {
    return {
      playable: false,
      status: 'Needs local media',
      message: 'Streaming fallback media exists for this inductee, but it is hidden in museum kiosk mode until an approved local file is installed.',
    };
  }

  if ((mediaRecord?.videos?.length ?? 0) > 0 || inductee.hasVideo) {
    return {
      playable: false,
      status: 'Awaiting approval',
      message: 'Induction footage is referenced in the collection data, but no rights-approved local playback file is available for this installation yet.',
    };
  }

  return {
    playable: false,
    status: 'No media yet',
    message: 'No approved induction footage or oral history media is linked for this inductee yet. Their record remains available through life-and-work text and collection images.',
  };
}

export function canonicalContinuationUrl(inductee: Inductee) {
  const candidate = inductee.profileUrl.trim();
  if (!candidate) return '';

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.href;
  } catch {
    return '';
  }
}

export function buildPersonGallery(inductee: Inductee, mediaRecord: RuntimeMediaRecord | undefined) {
  const manifestImages = [
    mediaRecord?.images?.primary?.runtimePath,
    ...(mediaRecord?.images?.gallery ?? []).map((image) => image.runtimePath),
  ].filter((url): url is string => Boolean(url));
  return Array.from(new Set([inductee.primaryImageUrl, ...manifestImages, ...inductee.imageUrls].filter(Boolean))).slice(0, 12);
}

export function isApprovedPlayableMediaForDetail(asset: RuntimeVideoAsset | RuntimeAudioAsset) {
  if ('youtubeVideoId' in asset || 'posterRuntimePath' in asset) return isPublicReadyVideoAsset(asset as RuntimeVideoAsset);
  return isPublicReadyAudioAsset(asset as RuntimeAudioAsset);
}

export function isPublicReadyVideoAsset(asset: RuntimeVideoAsset) {
  const captionsReady = (asset.captionStatus === 'approved' && Boolean(asset.captionRuntimePath)) || asset.captionStatus === 'not-applicable';
  const transcriptReady = asset.transcriptStatus === 'approved'
    || asset.transcriptStatus === 'not-applicable'
    || Boolean(asset.transcript?.text || asset.transcriptRuntimePath || asset.transcript?.runtimePath);
  return Boolean(
    asset.approvedForKiosk
      && asset.rightsStatus === 'approved'
      && asset.runtimePath
      && asset.posterRuntimePath
      && captionsReady
      && transcriptReady,
  );
}

export function isPublicReadyAudioAsset(asset: RuntimeAudioAsset) {
  const transcriptReady = asset.transcriptStatus === 'approved'
    || asset.transcriptStatus === 'not-applicable'
    || Boolean(asset.transcript?.text || asset.transcriptRuntimePath || asset.transcript?.runtimePath);
  return Boolean(asset.approvedForKiosk && asset.rightsStatus === 'approved' && transcriptReady && asset.runtimePath);
}
