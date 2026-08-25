import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isGenericImage, parseCsv } from './data-utils.js';

const sourceBaseUrl = 'https://clevelandinternationalhalloffame.com';
const apiBaseUrl = `${sourceBaseUrl}/wp-json/wp/v2`;
const manifestPath = resolve('data/cihof_kiosk_manifest.csv');
const outputDir = resolve('data/original-site-harvest');
const rawOutputPath = resolve(outputDir, 'cihof-original-site.raw.json');
const summaryOutputPath = resolve(outputDir, 'cihof-original-site.summary.json');
const requestDelayMs = Number.parseInt(process.env.CIHOF_SOURCE_DELAY_MS ?? '180', 10);

const regionNames = new Set(['Africa', 'Asia', 'Australia', 'Europe', 'North America', 'South America']);

const fetchedAt = new Date().toISOString();
const manifestRecords = readManifestRecords();
const manifestByUrl = new Map(
  manifestRecords
    .filter((record) => record.profile_url)
    .map((record) => [normalizeUrl(record.profile_url), record]),
);
const manifestByName = new Map(manifestRecords.map((record) => [normalizeName(record.name), record]));

const robotsText = await fetchText(`${sourceBaseUrl}/robots.txt`);
const [categories, tags, pages, posts, media, sitemaps] = await Promise.all([
  fetchWpCollection('categories', { per_page: '100' }),
  fetchWpCollection('tags', { per_page: '100' }),
  fetchWpCollection('pages', { per_page: '100' }),
  fetchWpCollection('posts', { per_page: '100' }),
  fetchWpCollection('media', { per_page: '100' }),
  fetchSitemaps(),
]);

const categoryById = new Map(categories.map((category) => [category.id, simplifyTerm(category)]));
const tagById = new Map(tags.map((tag) => [tag.id, simplifyTerm(tag)]));
const mediaByParent = groupMediaByParent(media);
const sourceRecords = [...pages.map((page) => normalizeContentRecord(page, 'page')), ...posts.map((post) => normalizeContentRecord(post, 'post'))];
const contentRecords = sourceRecords.map((record) => ({
  ...record,
  attachedMedia: mediaByParent.get(record.wpId) ?? [],
}));

const rawDocument = {
  schemaVersion: 1,
  source: {
    name: 'Cleveland International Hall of Fame original WordPress site',
    baseUrl: sourceBaseUrl,
    fetchedAt,
    robotsTxt: robotsText,
    note: 'Raw source harvest for curation and parsing. Do not overwrite approved kiosk metadata without curator review.',
  },
  sitemaps,
  categories: categories.map(simplifyTerm),
  tags: tags.map(simplifyTerm),
  media: media.map(normalizeMediaRecord),
  records: contentRecords,
};

const summaryDocument = buildSummary(rawDocument, manifestRecords);

mkdirSync(dirname(rawOutputPath), { recursive: true });
writeFileSync(rawOutputPath, `${JSON.stringify(rawDocument, null, 2)}\n`);
writeFileSync(summaryOutputPath, `${JSON.stringify(summaryDocument, null, 2)}\n`);

console.log(`Harvested ${contentRecords.length} content records, ${media.length} media assets, ${categories.length} categories, and ${tags.length} tags.`);
console.log(`Matched ${summaryDocument.coverage.profileUrlMatches} records by profile URL and ${summaryDocument.coverage.nameMatches} by name.`);
console.log(`Wrote ${rawOutputPath}`);
console.log(`Wrote ${summaryOutputPath}`);

function readManifestRecords() {
  const raw = readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseCsv(raw);
  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, '').trim());
  return rows
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])))
    .filter((record) => record.name);
}

async function fetchWpCollection(endpoint, params = {}) {
  const first = await fetchWpPage(endpoint, { ...params, page: '1' });
  const records = [...first.items];
  for (let page = 2; page <= first.totalPages; page += 1) {
    await delay(requestDelayMs);
    const next = await fetchWpPage(endpoint, { ...params, page: String(page) });
    records.push(...next.items);
  }
  return records;
}

async function fetchWpPage(endpoint, params = {}) {
  const url = new URL(`${apiBaseUrl}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'CIHOF exhibit source harvest',
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Failed ${url.href}: ${response.status} ${body.slice(0, 200)}`);
  }
  return {
    items: JSON.parse(body),
    total: Number(response.headers.get('x-wp-total') ?? '0'),
    totalPages: Math.max(1, Number(response.headers.get('x-wp-totalpages') ?? '1')),
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/plain,text/xml,text/html',
      'User-Agent': 'CIHOF exhibit source harvest',
    },
  });
  if (!response.ok) return '';
  return response.text();
}

async function fetchSitemaps() {
  const indexXml = await fetchText(`${sourceBaseUrl}/wp-sitemap.xml`);
  const sitemapUrls = extractXmlValues(indexXml, 'loc').filter((url) => url.includes('sitemap'));
  const maps = [];
  for (const sitemapUrl of sitemapUrls) {
    await delay(requestDelayMs);
    const xml = await fetchText(sitemapUrl);
    maps.push({
      url: sitemapUrl,
      entries: extractSitemapEntries(xml),
    });
  }
  return maps;
}

function normalizeContentRecord(record, wordpressType) {
  const title = cleanText(htmlToText(record.title?.rendered ?? ''));
  const html = record.content?.rendered ?? '';
  const excerptHtml = record.excerpt?.rendered ?? '';
  const plainText = cleanText(`${title} ${htmlToText(html)}`);
  const categoriesForRecord = (record.categories ?? []).map((id) => categoryById.get(id)).filter(Boolean);
  const tagsForRecord = (record.tags ?? []).map((id) => tagById.get(id)).filter(Boolean);
  const regionCategories = categoriesForRecord.filter((category) => regionNames.has(category.name)).map((category) => category.name);
  const titleClassYears = extractClassYears([title]);
  const slugClassYears = extractClassYears([record.slug]);
  const tagClassYears = extractClassYears(tagsForRecord.map((tag) => tag.name));
  const bodyClassYears = extractClassYears([plainText]);
  const primaryClassYearCandidates = uniqueNumbers([...titleClassYears, ...slugClassYears, ...tagClassYears]);
  const classYearCandidates = uniqueNumbers([...primaryClassYearCandidates, ...bodyClassYears]);
  const urlMatch = manifestByUrl.get(normalizeUrl(record.link));
  const titleName = cleanTitleName(title);
  const nameMatch = manifestByName.get(normalizeName(titleName));
  const manifestMatch = urlMatch ?? nameMatch ?? null;
  const links = extractLinks(html, record.link);
  const images = dedupeImages([...extractImages(html, record.link), ...extractLinkedImages(links)]);
  const youtubeVideoIds = extractYoutubeVideoIds(html);
  const blocks = extractTextBlocks(html);
  const sourceKind = classifyContentRecord({
    wordpressType,
    title,
    slug: record.slug,
    classYearCandidates,
    regionCategories,
    manifestMatch,
    plainText,
  });

  return {
    sourceKind,
    wpType: wordpressType,
    wpId: record.id,
    slug: record.slug,
    title,
    titleName,
    link: record.link,
    canonicalUrl: record.yoast_head_json?.canonical ?? record.link,
    date: record.date_gmt || record.date || '',
    modified: record.modified_gmt || record.modified || '',
    authorId: record.author ?? null,
    featuredMediaId: record.featured_media || null,
    categories: categoriesForRecord,
    tags: tagsForRecord,
    regionCandidates: regionCategories,
    primaryClassYearCandidates,
    classYearCandidates,
    classYearEvidence: {
      title: titleClassYears,
      slug: slugClassYears,
      tags: tagClassYears,
      body: bodyClassYears,
    },
    manifestMatch: manifestMatch
      ? {
          name: manifestMatch.name,
          classYear: manifestMatch.class_year,
          profileUrl: manifestMatch.profile_url,
          matchType: urlMatch ? 'profile-url' : 'title-name',
        }
      : null,
    seo: {
      title: cleanText(record.yoast_head_json?.title ?? ''),
      description: cleanText(record.yoast_head_json?.description ?? ''),
      ogImage: normalizeYoastImages(record.yoast_head_json?.og_image),
      schemaTypes: extractSchemaTypes(record.yoast_head_json?.schema),
    },
    excerptHtml,
    contentHtml: html,
    plainText,
    blocks,
    links,
    images,
    youtubeVideoIds,
    candidateSignals: buildCandidateSignals({ title, plainText, links, blocks, manifestMatch, youtubeVideoIds }),
  };
}

function classifyContentRecord({ wordpressType, title, slug, classYearCandidates, regionCategories, manifestMatch, plainText }) {
  if (wordpressType === 'post') return 'news-or-event-post';
  if (manifestMatch) return 'inductee-profile';
  if (/photo\s+page|photo[-\s]*gallery/i.test(`${title} ${slug}`)) return 'photo-gallery';
  if (/class\s+(and|&)\s+inductions|class\s+of\s+\d{4}|induction/i.test(`${title} ${slug}`) && !manifestMatch) return 'class-or-ceremony-page';
  if (classYearCandidates.length > 0 && regionCategories.length > 0 && plainText.length > 500) return 'probable-inductee-profile';
  return 'site-page';
}

function buildCandidateSignals({ title, plainText, links, blocks, manifestMatch, youtubeVideoIds }) {
  const inductedBy = extractInductedBy(blocks, plainText);
  const mentionedManifestPeople = extractManifestPeople(plainText, manifestMatch?.name);
  const organizationPhrases = extractOrganizationPhrases(plainText);
  const placePhrases = extractPlacePhrases(plainText);
  const sourceLinkDomains = Array.from(new Set(links.map((link) => safeHostname(link.href)).filter(Boolean))).sort();

  return {
    classYears: extractClassYears([title, plainText]),
    inductedBy,
    mentionedManifestPeople,
    organizationPhrases,
    placePhrases,
    sourceLinkDomains,
    embeddedVideoCount: youtubeVideoIds.length,
    likelyStoryBlockCount: blocks.filter((block) => block.kind === 'paragraph' && wordCount(block.text) >= 30).length,
  };
}

function buildSummary(rawDocument, manifest) {
  const records = rawDocument.records;
  const profileRecords = records.filter((record) => ['inductee-profile', 'probable-inductee-profile'].includes(record.sourceKind));
  const recordsMatchedByProfileUrl = records.filter((record) => record.manifestMatch?.matchType === 'profile-url');
  const recordsMatchedByName = records.filter((record) => record.manifestMatch?.matchType === 'title-name');
  const manifestUrls = new Set(manifest.map((record) => normalizeUrl(record.profile_url)).filter(Boolean));
  const sourceUrls = new Set(records.map((record) => normalizeUrl(record.link)).filter(Boolean));
  const missingManifestProfiles = manifest
    .filter((record) => record.profile_url && !sourceUrls.has(normalizeUrl(record.profile_url)))
    .map((record) => ({
      name: record.name,
      classYear: record.class_year,
      profileUrl: record.profile_url,
    }));
  const sourceOnlyProfiles = profileRecords
    .filter((record) => !record.manifestMatch && !manifestUrls.has(normalizeUrl(record.link)))
    .map((record) => ({
      title: record.title,
      link: record.link,
      sourceKind: record.sourceKind,
      classYearCandidates: record.classYearCandidates,
      regionCandidates: record.regionCandidates,
    }));

  return {
    schemaVersion: 1,
    source: rawDocument.source,
    counts: {
      manifestRecords: manifest.length,
      pages: rawDocument.records.filter((record) => record.wpType === 'page').length,
      posts: rawDocument.records.filter((record) => record.wpType === 'post').length,
      media: rawDocument.media.length,
      categories: rawDocument.categories.length,
      tags: rawDocument.tags.length,
      sitemapEntries: rawDocument.sitemaps.reduce((sum, sitemap) => sum + sitemap.entries.length, 0),
      profileRecords: profileRecords.length,
      classOrCeremonyPages: records.filter((record) => record.sourceKind === 'class-or-ceremony-page').length,
      photoGalleries: records.filter((record) => record.sourceKind === 'photo-gallery').length,
      newsOrEventPosts: records.filter((record) => record.sourceKind === 'news-or-event-post').length,
    },
    coverage: {
      profileUrlMatches: recordsMatchedByProfileUrl.length,
      nameMatches: recordsMatchedByName.length,
      missingManifestProfiles,
      sourceOnlyProfiles,
    },
    taxonomies: {
      categories: rawDocument.categories.map(({ id, name, slug, count }) => ({ id, name, slug, count })),
      yearTags: rawDocument.tags
        .filter((tag) => /^\d{4}/.test(tag.name))
        .map(({ id, name, slug, count }) => ({ id, name, slug, count })),
      nonYearTags: rawDocument.tags
        .filter((tag) => !/^\d{4}/.test(tag.name))
        .map(({ id, name, slug, count }) => ({ id, name, slug, count })),
    },
    media: {
      byMimeType: countBy(rawDocument.media, (item) => item.mimeType || 'unknown'),
      images: rawDocument.media.filter((item) => item.mediaType === 'image').length,
      attached: rawDocument.media.filter((item) => item.parentId).length,
      unattached: rawDocument.media.filter((item) => !item.parentId).length,
      largestImageCandidates: rawDocument.media
        .filter((item) => item.mediaType === 'image')
        .map((item) => ({
          id: item.wpId,
          title: item.title,
          sourceUrl: item.sourceUrl,
          width: item.width,
          height: item.height,
          parentId: item.parentId,
        }))
        .sort((a, b) => (b.width * b.height) - (a.width * a.height))
        .slice(0, 25),
    },
    relationshipInputs: {
      pagesWithInductedBy: records.filter((record) => record.candidateSignals.inductedBy.length > 0).length,
      pagesMentioningOtherInductees: records.filter((record) => record.candidateSignals.mentionedManifestPeople.length > 0).length,
      topMentionedInductees: topMentions(records.flatMap((record) => record.candidateSignals.mentionedManifestPeople)),
      sourceLinkDomains: topMentions(records.flatMap((record) => record.candidateSignals.sourceLinkDomains)),
    },
    parsingOpportunities: [
      'Use profile pages as source-of-truth snapshots for biography text, title, class year tags, region categories, canonical URLs, image references, and embedded YouTube IDs.',
      'Use class/ceremony pages and press posts for induction relationships, introducers, ceremony context, group photos, and class-level labels.',
      'Use media attachments as a secondary image inventory, grouped by parent page and filtered through current media approval rules.',
      'Use tags and categories as evidence candidates only; keep current curation safeguards for geography and relationship provenance.',
      'Use exact name mentions inside source text to propose relationship candidates for staff review, never as public documented ties without provenance approval.',
    ],
  };
}

function groupMediaByParent(media) {
  const grouped = new Map();
  media.map(normalizeMediaRecord).forEach((item) => {
    if (!item.parentId) return;
    if (!grouped.has(item.parentId)) grouped.set(item.parentId, []);
    grouped.get(item.parentId).push(item);
  });
  return grouped;
}

function normalizeMediaRecord(record) {
  return {
    wpId: record.id,
    parentId: record.post || null,
    date: record.date_gmt || record.date || '',
    modified: record.modified_gmt || record.modified || '',
    slug: record.slug,
    title: cleanText(htmlToText(record.title?.rendered ?? '')),
    caption: cleanText(htmlToText(record.caption?.rendered ?? '')),
    altText: cleanText(record.alt_text ?? ''),
    description: cleanText(htmlToText(record.description?.rendered ?? '')),
    mediaType: record.media_type ?? '',
    mimeType: record.mime_type ?? '',
    sourceUrl: record.source_url ?? '',
    link: record.link ?? '',
    width: record.media_details?.width ?? null,
    height: record.media_details?.height ?? null,
    sizes: Object.fromEntries(
      Object.entries(record.media_details?.sizes ?? {}).map(([key, size]) => [
        key,
        {
          sourceUrl: size.source_url ?? '',
          width: size.width ?? null,
          height: size.height ?? null,
          mimeType: size.mime_type ?? '',
        },
      ]),
    ),
  };
}

function simplifyTerm(term) {
  return {
    id: term.id,
    name: cleanText(htmlToText(term.name)),
    slug: term.slug,
    count: term.count ?? 0,
    link: term.link ?? '',
  };
}

function normalizeYoastImages(value) {
  if (!Array.isArray(value)) return [];
  return value.map((image) => image?.url).filter(Boolean);
}

function extractSchemaTypes(schema) {
  const graph = schema?.['@graph'];
  if (!Array.isArray(graph)) return [];
  return Array.from(new Set(graph.map((item) => item?.['@type']).filter(Boolean))).sort();
}

function extractSitemapEntries(xml) {
  const entries = [];
  for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const block = match[1];
    entries.push({
      loc: extractXmlValues(block, 'loc')[0] ?? '',
      lastmod: extractXmlValues(block, 'lastmod')[0] ?? '',
      images: extractXmlValues(block, 'image:loc'),
    });
  }
  return entries.filter((entry) => entry.loc);
}

function extractXmlValues(xml, tagName) {
  return [...xml.matchAll(new RegExp(`<${escapeRegExp(tagName)}>([\\s\\S]*?)<\\/${escapeRegExp(tagName)}>`, 'g'))]
    .map((match) => decodeEntities(match[1].trim()))
    .filter(Boolean);
}

function extractTextBlocks(html) {
  const blocks = [];
  for (const match of html.matchAll(/<(h[1-6]|p|li|figcaption|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = cleanText(htmlToText(match[2]));
    if (!text || /^\*+$/.test(text)) continue;
    blocks.push({
      kind: blockKind(match[1].toLowerCase()),
      text,
      wordCount: wordCount(text),
    });
  }
  return dedupeObjects(blocks, (block) => `${block.kind}:${block.text}`);
}

function blockKind(tag) {
  if (tag.startsWith('h')) return 'heading';
  if (tag === 'li') return 'list-item';
  if (tag === 'figcaption') return 'caption';
  if (tag === 'blockquote') return 'quote';
  return 'paragraph';
}

function extractLinks(html, baseUrl) {
  const links = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = parseAttributes(match[1]);
    const href = absoluteUrl(attrs.href, baseUrl);
    if (!href) continue;
    links.push({
      href,
      text: cleanText(htmlToText(match[2])),
      isExternal: safeHostname(href) !== safeHostname(sourceBaseUrl),
    });
  }
  return dedupeObjects(links, (link) => `${link.href}:${link.text}`);
}

function extractImages(html, baseUrl) {
  const images = [];
  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    const attrs = parseAttributes(match[1]);
    const src = absoluteUrl(attrs.src || attrs['data-src'], baseUrl);
    if (!src || isGenericImage(src)) continue;
    images.push({
      src,
      alt: cleanText(attrs.alt ?? ''),
      width: numberOrNull(attrs.width),
      height: numberOrNull(attrs.height),
      srcset: splitSrcset(attrs.srcset, baseUrl),
    });
  }
  return images;
}

function extractLinkedImages(links) {
  return links
    .filter((link) => /\.(?:jpg|jpeg|png|gif|webp)(?:\?|$)/i.test(link.href) && !isGenericImage(link.href))
    .map((link) => ({ src: link.href, alt: link.text, width: null, height: null, srcset: [] }));
}

function dedupeImages(images) {
  return dedupeObjects(images, (image) => image.src);
}

function splitSrcset(srcset = '', baseUrl) {
  return srcset
    .split(',')
    .map((item) => item.trim().split(/\s+/)[0])
    .map((src) => absoluteUrl(src, baseUrl))
    .filter((src) => src && !isGenericImage(src));
}

function extractYoutubeVideoIds(html) {
  const ids = new Set();
  const patterns = [
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/g,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/g,
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/g,
  ];
  patterns.forEach((pattern) => {
    for (const match of html.matchAll(pattern)) ids.add(match[1]);
  });
  return Array.from(ids);
}

function extractInductedBy(blocks, fallbackText) {
  const values = new Set();
  const sourceBlocks = blocks.length > 0 ? blocks.map((block) => block.text) : [fallbackText];
  const patterns = [/\binducted by\s+(.+)/i, /\binduction by\s+(.+)/i, /\bpresented by\s+(.+)/i];
  sourceBlocks.forEach((text) => {
    patterns.forEach((pattern) => {
      const match = text.match(pattern);
      if (!match) return;
      const value = cleanPresenterPhrase(match[1]);
      if (isUsefulPresenterPhrase(value)) values.add(value);
    });
  });
  return Array.from(values);
}

function cleanPresenterPhrase(value) {
  return cleanText(value)
    .replace(/\b(?:Here is|Watch|View|See|Photos?|Video|followed by|and then|then his|then her|then their|acceptance remarks?|induction speech|speeches)\b[\s\S]*$/i, '')
    .replace(/\s*;\s*(?:remarks|photos|video|watch|followed)\b[\s\S]*$/i, '')
    .replace(/\s+who\s+then\s+accepted\b[\s\S]*$/i, '')
    .replace(/\s+and\s+(?:his|her|their)\s+acceptance\b[\s\S]*$/i, '')
    .replace(/\s+and\s+(?:his|her|their)\b[\s\S]*$/i, '')
    .replace(/[.,:;\s]+$/g, '')
    .trim();
}

function isUsefulPresenterPhrase(value) {
  if (!value || value.length < 4 || value.length > 140) return false;
  if (/^(dr|mr|mrs|ms|rev|fr|hon|mayor|ambassador|bishop)\.?$/i.test(value)) return false;
  if (/\b(video|photo|speech|speeches|remarks|followed)\b/i.test(value)) return false;
  return true;
}

function extractManifestPeople(text, selfName = '') {
  const normalizedSelf = normalizeName(selfName);
  return manifestRecords
    .filter((record) => normalizeName(record.name) !== normalizedSelf)
    .filter((record) => new RegExp(`\\b${escapeRegExp(record.name)}\\b`, 'i').test(text))
    .map((record) => ({
      name: record.name,
      classYear: record.class_year,
      profileUrl: record.profile_url,
    }));
}

function extractOrganizationPhrases(text) {
  const phrases = new Set();
  const organizationPattern = /\b([A-Z][A-Za-z&'.-]+(?:\s+(?:of|for|and|the|[A-Z][A-Za-z&'.-]+)){1,8}\s+(?:Association|Center|Centre|Church|Clinic|Club|College|Committee|Community|Council|Foundation|Institute|Museum|Orchestra|Organization|Program|School|Society|University))\b/g;
  for (const match of text.matchAll(organizationPattern)) {
    const phrase = cleanText(match[1]);
    if (isUsefulOrganizationPhrase(phrase)) {
      phrases.add(phrase);
    }
  }
  return Array.from(phrases).slice(0, 40);
}

function isUsefulOrganizationPhrase(phrase) {
  if (phrase.length < 8 || phrase.length > 120) return false;
  if (/[.!?]\s+[A-Z]/.test(phrase)) return false;
  if (/^(The|A|An|In|At|From)\s+(President|Director|Member|Board|Committee)\b/.test(phrase)) return false;
  return true;
}

function extractPlacePhrases(text) {
  const places = new Set();
  const placePattern = /\b(?:born in|raised in|from|immigrated from|came from|native of|community of|heritage from)\s+([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){0,3})/gi;
  for (const match of text.matchAll(placePattern)) {
    const phrase = cleanText(match[1]).replace(/\s+(and|where|who|with)\b.*$/i, '').trim();
    if (isUsefulPlacePhrase(phrase)) places.add(phrase);
  }
  return Array.from(places).slice(0, 40);
}

function isUsefulPlacePhrase(phrase) {
  if (phrase.length < 3 || phrase.length > 80) return false;
  if (!/^[A-Z]/.test(phrase)) return false;
  if (/^(a|an|and|as|at|by|for|from|her|his|in|of|on|or|simple|that|the|their|there|these|this|those|to|within)\b/i.test(phrase)) return false;
  if (/\b(?:Association|Committee|Foundation|Program|School|Society|University|College|Council)\b/.test(phrase)) return false;
  return true;
}

function extractClassYears(values) {
  const years = new Set();
  values.filter(Boolean).forEach((value) => {
    for (const match of String(value).matchAll(/\b(?:Class of\s*)?(20[1-2][0-9])\b/gi)) {
      const year = Number.parseInt(match[1], 10);
      if (year >= 2010 && year <= 2026) years.add(year);
    }
  });
  return Array.from(years).sort((a, b) => a - b);
}

function uniqueNumbers(values) {
  return Array.from(new Set(values.filter(Number.isFinite))).sort((a, b) => a - b);
}

function cleanTitleName(title) {
  return cleanText(title)
    .replace(/\s+[-–]\s+Class of\s+\d{4}$/i, '')
    .replace(/\s+[-–]\s+\d{4}$/i, '')
    .replace(/\s+\|\s+Cleveland International Hall of Fame$/i, '')
    .trim();
}

function parseAttributes(value = '') {
  const attrs = {};
  for (const match of value.matchAll(/([:@\w-]+)(?:=(["'])([\s\S]*?)\2|=([^\s"'>]+))?/g)) {
    attrs[match[1].toLowerCase()] = decodeEntities(match[3] ?? match[4] ?? '');
  }
  return attrs;
}

function htmlToText(html) {
  return decodeEntities(
    String(html ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
}

function cleanText(value) {
  return decodeEntities(String(value ?? '')).replace(/\s+/g, ' ').trim();
}

function decodeEntities(value) {
  return String(value ?? '')
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
    .replace(/&gt;/g, '>')
    .replace(/&hellip;/g, '...');
}

function normalizeName(value) {
  return cleanTitleName(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeUrl(value = '') {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    url.hostname = url.hostname.replace(/^www\./, '');
    return url.href.replace(/\/$/, '');
  } catch {
    return '';
  }
}

function absoluteUrl(value = '', baseUrl) {
  try {
    return new URL(decodeEntities(value), baseUrl).href;
  } catch {
    return '';
  }
}

function safeHostname(value = '') {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function numberOrNull(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function wordCount(value) {
  return cleanText(value).split(/\s+/).filter(Boolean).length;
}

function countBy(values, keyFn) {
  return values.reduce((counts, value) => {
    const key = keyFn(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function topMentions(values) {
  return Object.entries(countBy(values, (value) => (typeof value === 'string' ? value : value.name)))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 25)
    .map(([name, count]) => ({ name, count }));
}

function dedupeObjects(values, keyFn) {
  const seen = new Set();
  return values.filter((value) => {
    const key = keyFn(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, Math.max(0, ms)));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
