import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isGenericImage, parseCsv } from './data-utils.js';

const manifestPath = resolve('data/cihof_kiosk_manifest.csv');

const pages = [
  {
    url: 'https://clevelandinternationalhalloffame.com/andy-chakalis/',
    inductedBy: 'Lou Frangos',
  },
  {
    url: 'https://clevelandinternationalhalloffame.com/aklilu-demessie/',
    inductedBy: 'Dr. Menna Demessie, Ph.D.',
  },
  {
    url: 'https://clevelandinternationalhalloffame.com/andy-fedynsky/',
    inductedBy: 'George E. Jaskiw, M.D.',
  },
  {
    url: 'https://clevelandinternationalhalloffame.com/catherine-jorgensen-mccutcheon/',
    inductedBy: 'Karin McCutcheon',
  },
  {
    url: 'https://clevelandinternationalhalloffame.com/le-nguyen-class-of-2026-vietnames-heritage-cleveland-international-hall-of-fame/',
    inductedBy: 'Former Mayor Frank G. Jackson; remarks by Valarie McCall and Matt Zone',
  },
  {
    url: 'https://clevelandinternationalhalloffame.com/lucy-torres/',
    inductedBy: 'Blaine Griffin',
  },
];

const regionByCategory = new Map([
  ['category-africa', 'Africa'],
  ['category-asia', 'Asia'],
  ['category-australia', 'Australia'],
  ['category-europe', 'Europe'],
  ['category-north-america', 'North America'],
  ['category-south-america', 'South America'],
]);

const raw = readFileSync(manifestPath, 'utf8');
const hasBom = raw.startsWith('\uFEFF');
const rows = parseCsv(raw.replace(/^\uFEFF/, ''));
const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, '').trim());
const existingRecords = rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
const pageUrls = new Set(pages.map((page) => page.url));

const importedRecords = [];
for (const page of pages) {
  importedRecords.push(await scrapeProfile(page));
}

const retainedRecords = existingRecords.filter(
  (record) => !(record.class_year === '2026' && pageUrls.has(record.profile_url)),
);
const records = [...retainedRecords, ...importedRecords];
const output = [
  `${hasBom ? '\uFEFF' : ''}${headers.map(csvCell).join(',')}`,
  ...records.map((record) => headers.map((header) => csvCell(record[header] ?? '')).join(',')),
].join('\n');

writeFileSync(manifestPath, `${output}\n`);
console.log(`Imported ${importedRecords.length} 2026 profiles into ${manifestPath}`);
importedRecords.forEach((record) => {
  const videoCount = record.youtube_video_ids ? record.youtube_video_ids.split('|').length : 0;
  const imageCount = record.image_urls ? record.image_urls.split('|').length : 0;
  console.log(`- ${record.name}: ${imageCount} images, ${videoCount} videos`);
});

async function scrapeProfile(page) {
  const html = await fetch(page.url).then((response) => {
    if (!response.ok) throw new Error(`Failed to fetch ${page.url}: ${response.status}`);
    return response.text();
  });
  const article = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html;
  const entry = article.match(/<div class="entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/article>/i)?.[1] ?? article;
  const className = article.match(/<article[^>]*class=["']([^"']+)/i)?.[1] ?? '';
  const title = textFromHtml(article.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
  const name = title.replace(/\s+[-–]\s+Class of 2026$/i, '').trim();
  const region = [...regionByCategory.entries()].find(([category]) => className.includes(category))?.[1] ?? '';
  const imageUrls = extractImages(entry, page.url);
  const primaryImageUrl = extractMetaImage(html) || imageUrls[0] || '';
  const videoUrls = unique(
    [...entry.matchAll(/<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
      .map((match) => absoluteUrl(match[1], page.url))
      .filter((url) => url.includes('youtube.com/embed/')),
  );
  const youtubeVideoIds = unique(videoUrls.map(extractYoutubeId).filter(Boolean));
  const bioText = extractBioText(entry);

  return {
    name,
    class_year: '2026',
    region,
    profile_url: page.url,
    inducted_by: page.inductedBy,
    primary_image_url: primaryImageUrl,
    image_urls: unique([primaryImageUrl, ...imageUrls]).join('|'),
    video_urls: videoUrls.join('|'),
    youtube_video_ids: youtubeVideoIds.join('|'),
    local_video_paths: '',
    local_image_paths: '',
    bio_text: bioText,
  };
}

function extractBioText(entry) {
  const blocks = [...entry.matchAll(/<(p|figcaption|li|h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => textFromHtml(match[2]))
    .filter((text) => text && !/^\*+$/.test(text));

  return unique(blocks).join(' ').replace(/\s+/g, ' ').trim();
}

function extractImages(entry, baseUrl) {
  const urls = [...entry.matchAll(/\b(?:src|href|data-src)=["']([^"']+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^"']*)?)["']/gi)]
    .map((match) => absoluteUrl(match[1], baseUrl))
    .filter((url) => url && !isGenericImage(url));

  return unique(urls);
}

function extractMetaImage(html) {
  const meta = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  return meta ? decodeEntities(meta[1]) : '';
}

function extractYoutubeId(url) {
  const match = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
  return match ? match[1] : '';
}

function textFromHtml(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function decodeEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCodePoint(Number.parseInt(number, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '-')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function absoluteUrl(value, baseUrl) {
  try {
    return new URL(decodeEntities(value), baseUrl).href;
  } catch {
    return '';
  }
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function csvCell(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
