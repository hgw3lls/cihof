export type Inductee = {
  id: string;
  name: string;
  classYear: number | null;
  decade: string;
  region: string;
  profileUrl: string;
  inductedBy: string;
  primaryImageUrl: string;
  imageUrls: string[];
  videoUrls: string[];
  youtubeVideoIds: string[];
  localVideoPaths: string[];
  localImagePaths: string[];
  hasVideo: boolean;
  hasGallery: boolean;
  bioText: string;
  storySummary: string;
  storyHighlights: string[];
  themeTags: string[];
  relatedIds: string[];
  searchText: string;
};

export type SortMode = 'year-asc' | 'year-desc' | 'name-asc' | 'region-asc';
export type MediaFilter = 'all' | 'with-video' | 'with-gallery';
export type ViewMode = 'explore' | 'timeline' | 'region-map' | 'journeys';

export type ExploreState = {
  query: string;
  region: string;
  year: string;
  theme: string;
  media: MediaFilter;
  sortMode: SortMode;
};
