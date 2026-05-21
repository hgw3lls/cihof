import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const sourcePath = resolve('data/cihof_kiosk_manifest.csv');
const outputPath = resolve('public/data/inductees.json');
const reportPath = resolve('public/data/data-report.json');

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

const sorted = records.sort((a, b) => {
  const yearA = a.classYear ?? 9999;
  const yearB = b.classYear ?? 9999;
  return yearA - yearB || a.name.localeCompare(b.name);
});

const regions = Array.from(new Set(sorted.map((item) => item.region))).sort((a, b) => a.localeCompare(b));
const years = sorted.map((item) => item.classYear).filter((year) => typeof year === 'number');
const report = {
  generatedAt: new Date().toISOString(),
  source: 'data/cihof_kiosk_manifest.csv',
  totalInductees: sorted.length,
  regions: regions.map((region) => ({
    region,
    count: sorted.filter((item) => item.region === region).length,
  })),
  yearRange: {
    min: Math.min(...years),
    max: Math.max(...years),
  },
  missing: {
    classYear: sorted.filter((item) => item.classYear === null).map((item) => item.id),
    primaryImage: sorted.filter((item) => !item.primaryImageUrl).map((item) => item.id),
    bioText: sorted.filter((item) => !item.bioText).map((item) => item.id),
  },
  media: {
    withPrimaryImage: sorted.filter((item) => item.primaryImageUrl).length,
    withGalleryImages: sorted.filter((item) => item.imageUrls.length > 0).length,
    withVideo: sorted.filter((item) => item.youtubeVideoIds.length > 0 || item.localVideoPaths.length > 0).length,
  },
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(sorted, null, 2)}\n`);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(
  `Prepared ${report.totalInductees} inductees across ${regions.length} regions. ` +
    `${report.media.withPrimaryImage} have primary images, ${report.media.withVideo} have videos.`,
);
if (report.missing.primaryImage.length > 0) {
  console.log(`Missing primary images: ${report.missing.primaryImage.length}`);
}
