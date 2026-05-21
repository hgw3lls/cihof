export type Inductee = {
  id: string;
  name: string;
  classYear: number | null;
  region: string;
  profileUrl: string;
  inductedBy: string;
  primaryImageUrl: string;
  imageUrls: string[];
  videoUrls: string[];
  youtubeVideoIds: string[];
  localVideoPaths: string[];
  localImagePaths: string[];
  bioText: string;
  searchText: string;
};

export type SortMode = 'year-asc' | 'year-desc' | 'name-asc' | 'region-asc';
