import type { Inductee } from './types';

export type PortraitImageVariant = 'wall' | 'profile' | 'thumbnail' | 'source';

export function portraitImageUrl(inductee: Inductee, variant: PortraitImageVariant = 'wall') {
  if (variant === 'profile') {
    return inductee.portraitProfileImageUrl || inductee.portraitWallImageUrl || inductee.primaryImageUrl;
  }

  if (variant === 'thumbnail') {
    return inductee.portraitThumbnailImageUrl || inductee.portraitWallImageUrl || inductee.primaryImageUrl;
  }

  if (variant === 'source') {
    return inductee.portraitSourceImageUrl || inductee.primaryImageUrl;
  }

  return inductee.portraitWallImageUrl || inductee.primaryImageUrl;
}
