import type { Inductee, ManifestEntry, ManifestMap } from '../types';

const VALID_STATUSES = new Set(['downloaded', 'reused_existing_download']);

const makeKey = (classYear: string, name: string) =>
  `${classYear.trim()}::${name.trim().toLowerCase()}`;

const normalizeSavedPath = (savedPath: string) => {
  const cleaned = savedPath.replace(/\\/g, '/');
  const idx = cleaned.indexOf('cihf_images/');
  if (idx >= 0) {
    return `/${cleaned.slice(idx)}`;
  }
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
};

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

const parseManifestCsv = (csvText: string): ManifestEntry[] => {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) {
    return [];
  }
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((row) => {
    const entry: Record<string, string> = {};
    headers.forEach((header, idx) => {
      entry[header] = row[idx] ?? '';
    });
    return {
      class_year: entry.class_year ?? '',
      name: entry.name ?? '',
      url: entry.url ?? '',
      saved_path: entry.saved_path ?? '',
      status: entry.status ?? '',
    };
  });
};

export const loadInductees = async (): Promise<Inductee[]> => {
  const response = await fetch('/cihf_inductees.json');
  if (!response.ok) {
    throw new Error('Failed to load inductees JSON');
  }
  return response.json();
};

export const loadManifest = async (): Promise<ManifestMap> => {
  const response = await fetch('/cihf_images/manifest.csv');
  if (!response.ok) {
    throw new Error('Failed to load manifest CSV');
  }
  const csvText = await response.text();
  const entries = parseManifestCsv(csvText);
  const map: ManifestMap = new Map();
  entries.forEach((entry) => {
    if (!VALID_STATUSES.has(entry.status)) {
      return;
    }
    const key = makeKey(entry.class_year, entry.name);
    const normalized = normalizeSavedPath(entry.saved_path);
    const list = map.get(key) ?? [];
    list.push(normalized);
    map.set(key, list);
  });
  return map;
};

export const getLocalImagesForInductee = (
  inductee: Inductee,
  manifest: ManifestMap
): string[] => {
  return manifest.get(makeKey(inductee.class_year, inductee.name)) ?? [];
};

export const getYearOptions = (inductees: Inductee[]) => {
  return Array.from(new Set(inductees.map((inductee) => inductee.class_year)))
    .map((year) => Number(year))
    .filter((year) => !Number.isNaN(year))
    .sort((a, b) => a - b)
    .map((year) => year.toString());
};

export const getRegionOptions = (inductees: Inductee[]) => {
  return Array.from(new Set(inductees.map((inductee) => inductee.region)))
    .filter((region) => region.trim().length > 0)
    .sort((a, b) => a.localeCompare(b));
};
