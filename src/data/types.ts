export type VideoSource = {
  kind: 'local' | 'youtube' | 'remote';
  src: string;
  label?: string;
};

export type Inductee = {
  name: string;
  class_year: string;
  region: string;
  profile_url?: string;
  inducted_by?: string;
  bio_text?: string;
  images: string[];
  videos: VideoSource[];
  primaryImage: string | null;
};
