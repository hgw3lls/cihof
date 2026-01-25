import type { Inductee, VideoSource } from './types';
import {
  dedupePreserveOrder,
  extractYouTubeId,
  parseListField,
  resolveMediaPath,
} from './media';

const LEGACY_INDUCTEES_PATH = '/cihf_inductees.json';
const LEGACY_IMAGE_MANIFEST = '/cihf_images/manifest.csv';
const MANIFEST_PATH = '/cihof_kiosk_manifest.csv';

const parseCsvRows = (text: string) => {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    current.push(field);
    field = '';
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      pushField();
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      pushField();
      if (current.length > 1 || current.some((value) => value.trim() !== '')) {
        rows.push(current);
      }
      current = [];
      continue;
    }

    field += char;
  }

  if (field.length > 0 || current.length > 0) {
    pushField();
    rows.push(current);
  }

  return rows;
};

type ManifestRow = Record<string, string>;

const parseManifestCsv = (csvText: string): ManifestRow[] => {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) {
    return [];
  }
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((row) => {
    const entry: ManifestRow = {};
    headers.forEach((header, idx) => {
      entry[header] = row[idx] ?? '';
    });
    return entry;
  });
};

const normalizeVideoSources = (sources: VideoSource[]) => {
  return sources.filter((source) => source.src.trim().length > 0);
};

const buildRemoteVideos = (urls: string[]) => {
  const videos: VideoSource[] = [];
  urls.forEach((url) => {
    const youtubeId = extractYouTubeId(url);
    if (youtubeId) {
      videos.push({ kind: 'youtube', src: youtubeId });
    } else {
      videos.push({ kind: 'remote', src: url });
    }
  });
  return videos;
};

const buildInductee = (row: ManifestRow): Inductee => {
  const localImages = parseListField(row.local_image_paths)
    .map(resolveMediaPath)
    .filter((value) => value.length > 0);
  const localVideos = parseListField(row.local_video_paths)
    .map(resolveMediaPath)
    .filter((value) => value.length > 0);
  const remoteImages = dedupePreserveOrder([
    ...parseListField(row.primary_image_url),
    ...parseListField(row.image_urls),
  ]);
  const remoteVideos = dedupePreserveOrder([
    ...parseListField(row.youtube_video_ids).map((id) => `https://youtu.be/${id}`),
    ...parseListField(row.video_urls),
  ]);
  const images = localImages.length > 0 ? localImages : remoteImages;
  const videos: VideoSource[] =
    localVideos.length > 0
      ? localVideos.map((src) => ({ kind: 'local', src }))
      : buildRemoteVideos(remoteVideos);

  return {
    name: row.name?.trim() ?? '',
    class_year: row.class_year?.trim() ?? '',
    region: row.region?.trim() ?? '',
    profile_url: row.profile_url?.trim() || undefined,
    inducted_by: row.inducted_by?.trim() || undefined,
    bio_text: row.bio_text?.trim() || undefined,
    images,
    videos: normalizeVideoSources(videos),
    primaryImage: images[0] ?? null,
  };
};

const legacyKey = (classYear: string, name: string) =>
  `${classYear.trim()}::${name.trim().toLowerCase()}`;

const loadLegacyImageManifest = async () => {
  const response = await fetch(LEGACY_IMAGE_MANIFEST);
  if (!response.ok) {
    return new Map<string, string[]>();
  }
  const text = await response.text();
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    return new Map<string, string[]>();
  }
  const headers = rows[0].map((header) => header.trim());
  const map = new Map<string, string[]>();
  rows.slice(1).forEach((row) => {
    const entry: Record<string, string> = {};
    headers.forEach((header, idx) => {
      entry[header] = row[idx] ?? '';
    });
    const status = entry.status ?? '';
    if (!['downloaded', 'reused_existing_download'].includes(status)) {
      return;
    }
    const key = legacyKey(entry.class_year ?? '', entry.name ?? '');
    const normalized = resolveMediaPath(entry.saved_path ?? '');
    if (!normalized) {
      return;
    }
    const list = map.get(key) ?? [];
    list.push(normalized);
    map.set(key, list);
  });
  return map;
};

const loadLegacyInductees = async (): Promise<Inductee[]> => {
  const response = await fetch(LEGACY_INDUCTEES_PATH);
  if (!response.ok) {
    throw new Error('Failed to load legacy inductees');
  }
  const [legacyInductees, legacyImages] = await Promise.all([
    response.json(),
    loadLegacyImageManifest(),
  ]);

  return (legacyInductees as Array<Record<string, string | string[]>>).map((record) => {
    const name = (record.name as string) ?? '';
    const classYear = (record.class_year as string) ?? '';
    const localImages = legacyImages.get(legacyKey(classYear, name)) ?? [];
    const remoteImages = Array.isArray(record.images)
      ? dedupePreserveOrder(record.images.map((item) => String(item)))
      : [];
    const images = localImages.length > 0 ? localImages : remoteImages;
    const remoteVideos = Array.isArray(record.videos)
      ? dedupePreserveOrder(record.videos.map((item) => String(item)))
      : [];
    return {
      name,
      class_year: classYear,
      region: (record.region as string) ?? '',
      profile_url: (record.profile_url as string) ?? undefined,
      inducted_by: (record.inducted_by as string) ?? undefined,
      bio_text: (record.bio_text as string) ?? undefined,
      images,
      videos: buildRemoteVideos(remoteVideos),
      primaryImage: images[0] ?? null,
    } satisfies Inductee;
  });
};

export const loadManifestCSV = async (): Promise<Inductee[]> => {
  const response = await fetch(MANIFEST_PATH);
  if (!response.ok) {
    return loadLegacyInductees();
  }
  const csvText = await response.text();
  const rows = parseManifestCsv(csvText);
  if (rows.length === 0) {
    return loadLegacyInductees();
  }
  return rows.map((row) => buildInductee(row));
};
