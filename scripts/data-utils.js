import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const sourcePath = resolve('data/cihof_kiosk_manifest.csv');

export function loadInductees() {
  const raw = readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseCsv(raw);
  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, '').trim());

  const records = rows.map((row) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']));
    const name = record.name.trim();
    const classYear = Number.parseInt(record.class_year, 10);
    const region = normalizeRegion(record.region);
    const imageUrls = Array.from(new Set(splitList(record.image_urls).filter((url) => !isGenericImage(url))))
      .sort((a, b) => imageScore(b, name) - imageScore(a, name));
    const rawPrimary = record.primary_image_url.trim();
    const primaryImageUrl = rawPrimary && !isGenericImage(rawPrimary) ? rawPrimary : imageUrls[0] ?? '';
    const videoUrls = Array.from(new Set(splitList(record.video_urls).filter((url) => !url.includes('/results?'))));
    const youtubeVideoIds = Array.from(
      new Set([...splitList(record.youtube_video_ids), ...videoUrls.map(extractYoutubeId)].filter(Boolean)),
    );
    const bioText = record.bio_text.trim().replace(/\s+/g, ' ');

    return {
      id: `${slugify(name)}-${Number.isFinite(classYear) ? classYear : 'unknown'}`,
      name,
      classYear: Number.isFinite(classYear) ? classYear : null,
      region,
      profileUrl: record.profile_url.trim(),
      inductedBy: record.inducted_by.trim(),
      primaryImageUrl,
      imageUrls,
      videoUrls,
      youtubeVideoIds,
      localVideoPaths: splitList(record.local_video_paths),
      localImagePaths: splitList(record.local_image_paths),
      bioText,
      searchText: [name, classYear, region, record.inducted_by, bioText].filter(Boolean).join(' ').toLowerCase(),
    };
  });

  return records.sort((a, b) => {
    const yearA = a.classYear ?? 9999;
    const yearB = b.classYear ?? 9999;
    return yearA - yearB || a.name.localeCompare(b.name);
  });
}

export function buildReport(inductees) {
  const regions = Array.from(new Set(inductees.map((item) => item.region))).sort((a, b) => a.localeCompare(b));
  const years = inductees.map((item) => item.classYear).filter((year) => typeof year === 'number');
  const duplicateIds = Array.from(
    inductees.reduce((counts, item) => counts.set(item.id, (counts.get(item.id) ?? 0) + 1), new Map()),
  )
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  return {
    source: 'data/cihof_kiosk_manifest.csv',
    totalInductees: inductees.length,
    regions: regions.map((region) => ({
      region,
      count: inductees.filter((item) => item.region === region).length,
    })),
    years: Array.from(new Set(years)).sort((a, b) => a - b).map((year) => ({
      year,
      count: inductees.filter((item) => item.classYear === year).length,
    })),
    yearRange: {
      min: Math.min(...years),
      max: Math.max(...years),
    },
    missing: {
      classYear: inductees.filter((item) => item.classYear === null).map((item) => item.id),
      primaryImage: inductees.filter((item) => !item.primaryImageUrl).map((item) => item.id),
      bioText: inductees.filter((item) => !item.bioText).map((item) => item.id),
      video: inductees.filter((item) => item.youtubeVideoIds.length === 0 && item.localVideoPaths.length === 0).map((item) => item.id),
    },
    media: {
      withPrimaryImage: inductees.filter((item) => item.primaryImageUrl).length,
      withGalleryImages: inductees.filter((item) => item.imageUrls.length > 0).length,
      withVideo: inductees.filter((item) => item.youtubeVideoIds.length > 0 || item.localVideoPaths.length > 0).length,
    },
    duplicateIds,
    suspicious: {
      genericImageCandidates: inductees.flatMap((item) => [item.primaryImageUrl, ...item.imageUrls].filter(isGenericImage).map((url) => ({ id: item.id, url }))),
      emptyProfileUrl: inductees.filter((item) => !item.profileUrl).map((item) => item.id),
      emptyUrlFields: inductees.filter((item) => [item.primaryImageUrl, item.profileUrl].some((url) => url.includes(' '))).map((item) => item.id),
    },
  };
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  }

  return rows;
}

export function splitList(value) {
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isGenericImage(url) {
  const lower = url.toLowerCase();
  const file = lower.split('/').pop() ?? lower;
  return [
    'facebook',
    'twitter',
    'youtube-fix',
    'youtube.png',
    'cle_int_hof-lo',
    'cle-int-hof',
    'logo',
    'icon',
    'button',
    'share',
    'rss',
    'linkedin',
    'instagram',
  ].some((token) => lower.includes(token)) || /^\d+x\d+\./.test(file);
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeRegion(value) {
  const region = value.trim().replace(/\s+/g, ' ');
  if (!region) return 'Unknown Region';
  if (region.toLowerCase() === 'n america') return 'North America';
  return region;
}

function imageScore(url, name) {
  const lower = url.toLowerCase();
  const nameTokens = slugify(name).split('-').filter((token) => token.length > 2);
  let score = 0;

  if (lower.includes('wp-content/uploads')) score += 5;
  if (lower.includes('clevelandpeople.com/images/hof')) score += 4;
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) score += 3;
  if (lower.endsWith('.png')) score += 1;
  if (lower.includes('-500') || lower.includes('/s-') || lower.includes('/p-')) score += 2;
  if (nameTokens.some((token) => lower.includes(token))) score += 6;
  if (lower.includes('ambassador') || lower.includes('award') || lower.includes('table')) score -= 1;

  return score;
}

function extractYoutubeId(url) {
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes('/results?')) return '';

  const patterns = [
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/,
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }

  return '';
}
