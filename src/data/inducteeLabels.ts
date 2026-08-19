import type { Inductee } from './types';

export function countryLabel(inductee: Inductee, limit = 2) {
  return inductee.countryTags.slice(0, limit).join(' / ');
}

export function countryOrRegionLabel(inductee: Inductee, limit = 2) {
  return countryLabel(inductee, limit) || inductee.region || '';
}

export function countryCommunityOrRegionLabel(inductee: Inductee, limit = 2) {
  return countryLabel(inductee, limit) || inductee.communityTags[0] || inductee.region || '';
}
