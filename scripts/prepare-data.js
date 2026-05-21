import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const sourcePath = resolve('data/cihof_kiosk_manifest.csv');
const outputPath = resolve('public/data/inductees.json');

const raw = readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, '');

function parseCsv(text) {
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

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function splitList(value) {
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isGenericImage(url) {
  const lower = url.toLowerCase();
  return [
    'facebook',
    'twitter',
    'youtube-fix',
    'youtube.png',
    'cle_int_hof-lo',
    'logo',
  ].some((token) => lower.includes(token));
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

const rows = parseCsv(raw);
const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, '').trim());

const records = rows.map((row) => {
  const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']));
  const name = record.name.trim();
  const classYear = Number.parseInt(record.class_year, 10);
  const region = record.region.trim() || 'Unknown Region';
  const rawImageUrls = splitList(record.image_urls);
  const imageUrls = Array.from(new Set(rawImageUrls.filter((url) => !isGenericImage(url))));
  const primaryImageUrl = !isGenericImage(record.primary_image_url) ? record.primary_image_url.trim() : imageUrls[0] ?? '';
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

const sorted = records.sort((a, b) => {
  const yearA = a.classYear ?? 9999;
  const yearB = b.classYear ?? 9999;
  return yearA - yearB || a.name.localeCompare(b.name);
});

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(sorted, null, 2)}\n`);

const regions = new Set(sorted.map((item) => item.region));
console.log(`Prepared ${sorted.length} inductees across ${regions.size} regions.`);
