export type Inductee = {
  name: string;
  profile_url: string;
  inducted_by: string;
  class_year: string;
  region: string;
  bio_text: string;
  images: string[];
  videos: string[];
};

export type ManifestEntry = {
  class_year: string;
  name: string;
  url: string;
  saved_path: string;
  status: string;
};

export type ManifestMap = Map<string, string[]>;
