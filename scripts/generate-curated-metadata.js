import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadInductees } from './data-utils.js';

const outputPath = resolve('data/cihof_curated_metadata.json');
const force = process.argv.includes('--force');

const communityRules = [
  { tag: 'Albanian', keywords: ['albanian', 'albania'] },
  { tag: 'Arabic', keywords: ['arabic', 'arab'] },
  { tag: 'Armenian', keywords: ['armenian', 'armenia'] },
  { tag: 'Chinese', keywords: ['chinese', 'china'] },
  { tag: 'Croatian', keywords: ['croatian', 'croatia'] },
  { tag: 'Czech', keywords: ['czech'] },
  { tag: 'Egyptian', keywords: ['egyptian', 'egypt'] },
  { tag: 'Eritrean', keywords: ['eritrean', 'eritrea'] },
  { tag: 'Estonian', keywords: ['estonian', 'estonia'] },
  { tag: 'Ethiopian', keywords: ['ethiopian', 'ethiopia'] },
  { tag: 'German', keywords: ['german', 'germany'] },
  { tag: 'Greek', keywords: ['greek', 'greece'] },
  { tag: 'Hungarian', keywords: ['hungarian', 'hungary'] },
  { tag: 'Indian', keywords: ['indian', 'india'] },
  { tag: 'Irish', keywords: ['irish', 'ireland'] },
  { tag: 'Italian', keywords: ['italian', 'italy'] },
  { tag: 'Jewish', keywords: ['jewish', 'judaic'] },
  { tag: 'Korean', keywords: ['korean', 'korea'] },
  { tag: 'Lebanese', keywords: ['lebanese', 'lebanon'] },
  { tag: 'Lithuanian', keywords: ['lithuanian', 'lithuania'] },
  { tag: 'Mexican', keywords: ['mexican', 'mexico'] },
  { tag: 'Norwegian', keywords: ['norwegian', 'norway'] },
  { tag: 'Polish', keywords: ['polish', 'poland'] },
  { tag: 'Puerto Rican', keywords: ['puerto rican', 'puerto rico'] },
  { tag: 'Romanian', keywords: ['romanian', 'romania'] },
  { tag: 'Russian', keywords: ['russian', 'russia'] },
  { tag: 'Serbian', keywords: ['serbian', 'serbia'] },
  { tag: 'Slovak', keywords: ['slovak', 'slovakia'] },
  { tag: 'Slovenian', keywords: ['slovenian', 'slovenia'] },
  { tag: 'Syrian', keywords: ['syrian', 'syria'] },
  { tag: 'Turkish', keywords: ['turkish', 'turkey'] },
  { tag: 'Ukrainian', keywords: ['ukrainian', 'ukraine'] },
  { tag: 'Vietnamese', keywords: ['vietnamese', 'vietnam'] },
];

if (existsSync(outputPath) && !force) {
  console.error(`${outputPath} already exists. Re-run with --force to replace it.`);
  process.exit(1);
}

const inductees = loadInductees({ includeCurated: false, includeMedia: false });
const featuredCandidates = new Set(
  [...inductees]
    .sort((a, b) => candidateScore(b) - candidateScore(a) || (b.classYear ?? 0) - (a.classYear ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 24)
    .map((item) => item.id),
);

const metadata = {
  schemaVersion: 1,
  source: {
    generator: 'scripts/generate-curated-metadata.js',
    baseData: 'data/cihof_kiosk_manifest.csv',
    recordCount: inductees.length,
  },
  reviewGuidance: {
    approvalStatus: 'Change draft to approved only after curator review.',
    summaryDraft: 'Generated from the current biography summary. Edit before copying into approvedSummary.',
    themeTagCandidates: 'Generated from biography keywords. Copy only curator-approved tags into approvedThemeTags.',
    communityTagCandidates: 'Generated from contextual heritage and community terms. Copy only reviewed tags into approvedCommunityTags.',
    featured: 'Human-owned final feature flag. Generated records default to false.',
    featuredCandidate: 'Machine-ranked suggestion for attract mode and promoted discovery.',
    mediaRightsStatus: 'Set to approved only after rights, licensing, captions, and transcripts are confirmed.',
  },
  inductees: Object.fromEntries(inductees.map((inductee) => [inductee.id, buildCuratedRecord(inductee, featuredCandidates.has(inductee.id))])),
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(metadata, null, 2)}\n`);

const videoCount = inductees.filter((item) => item.hasVideo).length;
console.log(`Generated curated metadata for ${inductees.length} inductees.`);
console.log(`${featuredCandidates.size} featured candidates, ${videoCount} video records needing caption/transcript review.`);
console.log(`Wrote ${outputPath}`);

function buildCuratedRecord(inductee, featuredCandidate) {
  return {
    id: inductee.id,
    approvalStatus: 'draft',
    reviewPriority: reviewPriority(inductee, featuredCandidate),
    displayName: inductee.name,
    sortName: sortName(inductee.name),
    pronunciation: '',
    summaryDraft: cleanSummary(inductee.storySummary || summarize(inductee.bioText, 260), inductee.name),
    approvedSummary: '',
    themeTagCandidates: inductee.themeTags,
    approvedThemeTags: [],
    communityTagCandidates: inferCommunityTags(inductee),
    approvedCommunityTags: [],
    featured: false,
    featuredCandidate,
    attractPriority: featuredCandidate ? candidateScore(inductee) : 0,
    journeySuggestions: journeySuggestions(inductee),
    image: {
      primaryAltText: buildPrimaryAltText(inductee),
      focalPoint: 'center',
      rightsStatus: 'needs-review',
      rightsNotes: '',
      sourceUrl: inductee.primaryImageUrl,
    },
    video: {
      hasVideo: inductee.hasVideo,
      reviewStatus: inductee.hasVideo ? 'needs-caption-transcript-review' : 'no-video-linked',
      captionStatus: inductee.hasVideo ? 'needed' : 'not-applicable',
      transcriptStatus: inductee.hasVideo ? 'needed' : 'not-applicable',
      audioDescriptionStatus: inductee.hasVideo ? 'review-needed' : 'not-applicable',
      rightsStatus: inductee.hasVideo ? 'needs-review' : 'not-applicable',
      sourceUrls: inductee.videoUrls,
      youtubeVideoIds: inductee.youtubeVideoIds,
      localVideoPaths: inductee.localVideoPaths,
    },
    accessibility: {
      plainLanguageReview: 'needed',
      sensitiveContentReview: 'needed',
      imageDescriptionReview: 'needed',
    },
    curatorNotes: curatorNotes(inductee, featuredCandidate),
  };
}

function candidateScore(inductee) {
  let score = 0;
  if (inductee.primaryImageUrl) score += 30;
  if (inductee.hasVideo) score += 25;
  if (inductee.hasGallery) score += 15;
  if ((inductee.classYear ?? 0) >= 2023) score += 12;
  if ((inductee.classYear ?? 0) >= 2026) score += 8;
  score += Math.min(inductee.themeTags.length * 3, 15);
  score += Math.min(Math.floor(inductee.bioText.length / 500), 12);
  return score;
}

function reviewPriority(inductee, featuredCandidate) {
  if (featuredCandidate || inductee.hasVideo) return 'high';
  if (!inductee.hasGallery || inductee.themeTags.length <= 1) return 'medium';
  return 'standard';
}

function sortName(name) {
  const cleaned = name
    .replace(/^(ambassador|bishop|dr\.?|father|former mayor|fr\.?|hon\.?|mayor|reverend|rev\.?|senator|sister)\s+/i, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return cleaned;
  const suffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'ph.d.', 'm.d.']);
  const withoutSuffix = suffixes.has(parts.at(-1)?.toLowerCase() ?? '') ? parts.slice(0, -1) : parts;
  if (withoutSuffix.length <= 1) return cleaned;
  return `${withoutSuffix.at(-1)}, ${withoutSuffix.slice(0, -1).join(' ')}`;
}

function buildPrimaryAltText(inductee) {
  const year = inductee.classYear ? `Class of ${inductee.classYear}` : 'Cleveland International Hall of Fame inductee';
  return `Portrait or archival image of ${inductee.name}, ${year}.`;
}

function journeySuggestions(inductee) {
  const suggestions = new Set([`region-${slugify(inductee.region)}`]);
  if ((inductee.classYear ?? 0) >= 2024) suggestions.add('recent-honorees');
  if (hasTheme(inductee, ['Civic Leadership', 'Law and Justice', 'Community Organizing'])) suggestions.add('civic-builders');
  if (hasTheme(inductee, ['Arts and Culture', 'Media and Storytelling'])) suggestions.add('arts-culture');
  if (hasTheme(inductee, ['Science and Technology', 'Medicine and Health', 'Education'])) suggestions.add('science-education');
  if (hasTheme(inductee, ['Diplomacy and Global Affairs', 'Immigrant Advocacy'])) suggestions.add('global-cleveland');
  if (hasTheme(inductee, ['Civic Leadership', 'Immigrant Advocacy', 'Faith and Service'])) suggestions.add('trailblazers');
  return Array.from(suggestions);
}

function hasTheme(inductee, themes) {
  return themes.some((theme) => inductee.themeTags.includes(theme));
}

function inferCommunityTags(inductee) {
  const text = `${inductee.name} ${inductee.region} ${inductee.bioText}`.toLowerCase();
  return communityRules
    .filter((rule) => rule.keywords.some((keyword) => containsCommunityEvidence(text, keyword)))
    .map((rule) => rule.tag)
    .sort((a, b) => a.localeCompare(b));
}

function containsCommunityEvidence(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const contextWords = [
    'american',
    'association',
    'born',
    'community',
    'communities',
    'culture',
    'cultural',
    'descent',
    'diaspora',
    'emigrated',
    'ethnic',
    'garden',
    'heritage',
    'immigrant',
    'immigrants',
    'immigrated',
    'museum',
    'nationality',
    'society',
    'tradition',
    'traditions',
  ].join('|');
  const contextualAfter = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9].{0,48})\\b(${contextWords})\\b`, 'i');
  const contextualBefore = new RegExp(`\\b(${contextWords})\\b(.{0,48}[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
  return contextualAfter.test(text) || contextualBefore.test(text);
}

function curatorNotes(inductee, featuredCandidate) {
  const notes = [];
  if (featuredCandidate) notes.push('Featured candidate based on media completeness, recency, and story depth.');
  if (inductee.hasVideo) notes.push('Video exists; verify local file, rights, captions, transcript, and audio-description need.');
  else notes.push('No video linked in current source data.');
  if (!inductee.hasGallery) notes.push('Only one image currently available; consider adding approved gallery media.');
  if (inductee.themeTags.length > 3) notes.push('Multiple generated themes; curator should trim to strongest public-facing tags.');
  if (inductee.storySummary.endsWith('...')) notes.push('Generated summary is truncated and should be rewritten for final display.');
  return notes;
}

function summarize(text, limit) {
  if (!text || text.length <= limit) return text;
  const slice = text.slice(0, limit + 1);
  const sentenceEnd = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'));
  if (sentenceEnd >= 120) return slice.slice(0, sentenceEnd + 1).trim();
  const wordEnd = slice.lastIndexOf(' ');
  return `${slice.slice(0, wordEnd > 120 ? wordEnd : limit).trim()}...`;
}

function cleanSummary(summary, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return summary.replace(new RegExp(`^${escapedName}\\s+${escapedName}\\s+`, 'i'), `${name} `).trim();
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
