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
    const localVideoPaths = splitList(record.local_video_paths);
    const localImagePaths = splitList(record.local_image_paths);
    const hasVideo = youtubeVideoIds.length > 0 || localVideoPaths.length > 0;
    const hasGallery = imageUrls.length > 1 || localImagePaths.length > 1;
    const bioText = record.bio_text.trim().replace(/\s+/g, ' ');
    const themeTags = extractThemeTags([name, region, record.inducted_by, bioText].filter(Boolean).join(' '));
    const storySummary = summarizeText(bioText);
    const storyHighlights = extractHighlights(bioText);

    return {
      id: `${slugify(name)}-${Number.isFinite(classYear) ? classYear : 'unknown'}`,
      name,
      classYear: Number.isFinite(classYear) ? classYear : null,
      decade: getDecade(Number.isFinite(classYear) ? classYear : null),
      region,
      profileUrl: record.profile_url.trim(),
      inductedBy: record.inducted_by.trim(),
      primaryImageUrl,
      imageUrls,
      videoUrls,
      youtubeVideoIds,
      localVideoPaths,
      localImagePaths,
      hasVideo,
      hasGallery,
      bioText,
      storySummary,
      storyHighlights,
      themeTags,
      relatedIds: [],
      searchText: [name, classYear, region, record.inducted_by, bioText, storySummary, ...themeTags].filter(Boolean).join(' ').toLowerCase(),
    };
  });

  return addRelatedIds(records).sort((a, b) => {
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
    decades: countBy(inductees.map((item) => item.decade).filter(Boolean), 'decade'),
    themes: countBy(inductees.flatMap((item) => item.themeTags), 'theme'),
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
      withGalleryImages: inductees.filter((item) => item.hasGallery).length,
      withVideo: inductees.filter((item) => item.hasVideo).length,
      withoutVideo: inductees.filter((item) => !item.hasVideo).length,
      completeness: countBy(inductees.map(mediaCompleteness), 'score'),
    },
    content: {
      shortBio: inductees.filter((item) => item.bioText.length < 320).map((item) => item.id),
      withoutThemeTags: inductees.filter((item) => item.themeTags.length === 0).map((item) => item.id),
    },
    relationships: {
      averageRelatedCount: round(
        inductees.reduce((total, item) => total + item.relatedIds.length, 0) / Math.max(inductees.length, 1),
      ),
      withoutRelated: inductees.filter((item) => item.relatedIds.length === 0).map((item) => item.id),
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

const themeRules = [
  {
    tag: 'Civic Leadership',
    keywords: [
      'mayor',
      'senator',
      'council',
      'public service',
      'public affairs',
      'government',
      'civic',
      'city of cleveland',
      'neighborhood',
      'policy',
      'legislative',
    ],
  },
  {
    tag: 'Arts and Culture',
    keywords: [
      'art',
      'artist',
      'arts',
      'music',
      'musician',
      'dance',
      'film',
      'festival',
      'cultural',
      'culture',
      'heritage',
      'museum',
      'theater',
      'performing',
    ],
  },
  {
    tag: 'Business and Entrepreneurship',
    keywords: [
      'business',
      'entrepreneur',
      'company',
      'corporation',
      'founder',
      'executive',
      'industry',
      'commerce',
      'bank',
      'real estate',
      'economic',
    ],
  },
  {
    tag: 'Education',
    keywords: ['education', 'educator', 'school', 'teacher', 'professor', 'university', 'college', 'student', 'academic', 'scholarship'],
  },
  {
    tag: 'Medicine and Health',
    keywords: ['medicine', 'medical', 'health', 'hospital', 'physician', 'nurse', 'healthcare', 'clinic', 'patient'],
  },
  {
    tag: 'Law and Justice',
    keywords: ['law', 'lawyer', 'attorney', 'judge', 'justice', 'legal', 'court', 'immigration law', 'rights'],
  },
  {
    tag: 'Faith and Service',
    keywords: ['faith', 'church', 'clergy', 'reverend', 'bishop', 'priest', 'sister', 'ministry', 'religious', 'parish'],
  },
  {
    tag: 'Immigrant Advocacy',
    keywords: ['immigrant', 'immigration', 'refugee', 'newcomer', 'diaspora', 'ethnic', 'nationality', 'naturalization'],
  },
  {
    tag: 'Diplomacy and Global Affairs',
    keywords: ['ambassador', 'diplomacy', 'diplomatic', 'international', 'global', 'consul', 'foreign', 'world affairs'],
  },
  {
    tag: 'Media and Storytelling',
    keywords: ['journalism', 'journalist', 'media', 'broadcast', 'radio', 'television', 'newspaper', 'publisher', 'writer', 'author'],
  },
  {
    tag: 'Science and Technology',
    keywords: ['science', 'scientist', 'engineering', 'engineer', 'technology', 'research', 'innovation', 'inventor', 'laboratory'],
  },
  {
    tag: 'Philanthropy',
    keywords: ['philanthropy', 'philanthropist', 'foundation', 'donor', 'charity', 'charitable', 'fundraising', 'endowment'],
  },
  {
    tag: 'Community Organizing',
    keywords: ['community', 'organizer', 'advocacy', 'volunteer', 'nonprofit', 'grassroots', 'service', 'social services'],
  },
  {
    tag: 'Public Safety and Military',
    keywords: ['police', 'firefighter', 'military', 'veteran', 'army', 'navy', 'air force', 'public safety'],
  },
];

const stopWords = new Set([
  'about',
  'after',
  'also',
  'among',
  'been',
  'being',
  'cleveland',
  'from',
  'have',
  'hall',
  'into',
  'more',
  'most',
  'than',
  'that',
  'their',
  'there',
  'this',
  'through',
  'with',
  'work',
  'years',
]);

const highValueThemeKeywords = new Set([
  'artist',
  'attorney',
  'bishop',
  'doctor',
  'educator',
  'engineer',
  'entrepreneur',
  'filmmaker',
  'founder',
  'judge',
  'lawyer',
  'mayor',
  'musician',
  'nurse',
  'philanthropist',
  'physician',
  'priest',
  'professor',
  'publisher',
  'refugee',
  'reverend',
  'scientist',
  'senator',
  'teacher',
  'veteran',
]);

function extractThemeTags(text) {
  const lower = text.toLowerCase();
  const tags = themeRules
    .map((rule) => ({ tag: rule.tag, score: themeScore(lower, rule.keywords) }))
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score || a.tag.localeCompare(b.tag))
    .map((item) => item.tag);

  return tags.length > 0 ? tags.slice(0, 5) : ['Community Leadership'];
}

function themeScore(text, keywords) {
  return keywords.reduce((score, keyword) => {
    if (!containsKeyword(text, keyword)) return score;
    return score + keywordWeight(keyword);
  }, 0);
}

function keywordWeight(keyword) {
  if (keyword.includes(' ')) return 2;
  if (highValueThemeKeywords.has(keyword)) return 2;
  return 1;
}

function containsKeyword(text, keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
}

function summarizeText(text, limit = 245) {
  if (!text || text.length <= limit) return text;
  const slice = text.slice(0, limit + 1);
  const sentenceEnd = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'));
  if (sentenceEnd >= 120) return `${slice.slice(0, sentenceEnd + 1).trim()}`;

  const wordEnd = slice.lastIndexOf(' ');
  return `${slice.slice(0, wordEnd > 120 ? wordEnd : limit).trim()}...`;
}

function extractHighlights(text) {
  return splitSentences(text)
    .filter((sentence) => sentence.length >= 45)
    .slice(0, 4)
    .map((sentence) => summarizeText(sentence, 150));
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function getDecade(year) {
  if (typeof year !== 'number') return '';
  return `${Math.floor(year / 10) * 10}s`;
}

function addRelatedIds(inductees) {
  const tokenSets = new Map(inductees.map((item) => [item.id, tokenize(item.searchText)]));

  return inductees.map((item) => {
    const relatedIds = inductees
      .filter((candidate) => candidate.id !== item.id)
      .map((candidate) => ({
        candidate,
        score: relationshipScore(item, candidate, tokenSets.get(item.id) ?? new Set(), tokenSets.get(candidate.id) ?? new Set()),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        const yearDistanceA = yearDistance(item, a.candidate);
        const yearDistanceB = yearDistance(item, b.candidate);
        return b.score - a.score || yearDistanceA - yearDistanceB || a.candidate.name.localeCompare(b.candidate.name);
      })
      .slice(0, 8)
      .map((entry) => entry.candidate.id);

    return { ...item, relatedIds };
  });
}

function relationshipScore(a, b, aTokens, bTokens) {
  let score = 0;
  if (a.classYear !== null && a.classYear === b.classYear) score += 8;
  if (a.region === b.region) score += 5;
  if (a.decade && a.decade === b.decade) score += 2;

  const sharedThemes = a.themeTags.filter((tag) => b.themeTags.includes(tag));
  score += sharedThemes.length * 7;

  const sharedTerms = countSharedTerms(aTokens, bTokens);
  score += Math.min(sharedTerms, 8);

  if (a.hasVideo && b.hasVideo) score += 1;
  return score;
}

function tokenize(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 4 && !stopWords.has(token)),
  );
}

function countSharedTerms(aTokens, bTokens) {
  let count = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) count += 1;
  });
  return count;
}

function yearDistance(a, b) {
  if (a.classYear === null || b.classYear === null) return 9999;
  return Math.abs(a.classYear - b.classYear);
}

function countBy(values, keyName) {
  const counts = values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map());
  return Array.from(counts.entries())
    .map(([value, count]) => ({ [keyName]: value, count }))
    .sort((a, b) => b.count - a.count || String(a[keyName]).localeCompare(String(b[keyName])));
}

function mediaCompleteness(inductee) {
  let score = 0;
  if (inductee.primaryImageUrl) score += 1;
  if (inductee.hasGallery) score += 1;
  if (inductee.hasVideo) score += 1;
  return String(score);
}

function round(value) {
  return Math.round(value * 10) / 10;
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
