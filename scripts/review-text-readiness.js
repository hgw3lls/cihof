import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  loadCuratedMetadata,
  loadInductees,
  loadMediaManifest,
} from './data-utils.js';

const markdownOutputPath = resolve('docs/profile-text-readiness-report.md');
const jsonOutputPath = resolve('artifacts/profile-text-readiness-review.json');
const csvOutputPath = resolve('artifacts/profile-text-readiness-review.csv');

const inductees = loadInductees();
const curatedMetadata = loadCuratedMetadata();
const mediaManifest = loadMediaManifest();
const storySections = readJson('data/cihof_story_sections.json', { records: {} });
const archiveLeads = readJson('public/data/archive-leads.json', { records: [] });

const curatedRecords = curatedMetadata.inductees ?? {};
const mediaRecords = mediaManifest.assets ?? {};
const storySectionRecords = storySections.records ?? {};
const archiveLeadsByPerson = groupBy(archiveLeads.records ?? [], (record) => record.inducteeId || 'unassigned');

const decisionLabels = {
  'pass-as-is': 'Pass as-is',
  'minimal-edits': 'Minimal edits',
  'needs-editorial-review': 'Needs editorial review',
};

const personReviews = inductees.map(reviewPerson);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  title: 'CIHOF Profile Text Readiness Review',
  scope: {
    included: [
      'data/cihof_kiosk_manifest.csv',
      'data/cihof_curated_metadata.json',
      'data/media_manifest.json',
      'data/cihof_story_sections.json',
      'public/data/archive-leads.json',
      'public/data/inductees.json',
    ],
    excluded: ['data/external-research/*'],
    note: 'Automated copy triage only. This does not verify facts, rights, permissions, or final curator approval.',
  },
  fieldInventory: buildFieldInventory(),
  summary: buildSummary(personReviews),
  personReviews,
};

mkdirSync(dirname(markdownOutputPath), { recursive: true });
mkdirSync(dirname(jsonOutputPath), { recursive: true });
writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(csvOutputPath, `${buildCsv(report)}\n`);
writeFileSync(markdownOutputPath, `${buildMarkdown(report)}\n`);

console.log('Profile text readiness review complete.');
console.log(`${personReviews.length} profiles reviewed.`);
console.log(formatDecisionCounts(report.summary.profileDecisions));
console.log(`Visitor text fields needing substantive edit: ${report.summary.textSurfaceTotals.visitorFacing.needsEdit}`);
console.log(`Visitor text fields needing minimal edit: ${report.summary.textSurfaceTotals.visitorFacing.minimalEdit}`);
console.log(`Wrote ${markdownOutputPath}`);
console.log(`Wrote ${jsonOutputPath}`);
console.log(`Wrote ${csvOutputPath}`);

function readJson(path, fallback) {
  const absolute = resolve(path);
  if (!existsSync(absolute)) return fallback;
  return JSON.parse(readFileSync(absolute, 'utf8'));
}

function reviewPerson(person) {
  const curated = curatedRecords[person.id] ?? {};
  const media = mediaRecords[person.id] ?? {};
  const storySection = storySectionRecords[person.id] ?? null;
  const archiveLeadRecords = archiveLeadsByPerson.get(person.id) ?? [];
  const fields = [
    reviewDisplayName(person),
    reviewSortName(person, curated),
    reviewPronunciation(person),
    reviewSummary(person, curated),
    reviewDocumentedContextLine(person),
    reviewHonoredForSummary(person),
    reviewLifeWorkSummary(person),
    reviewBiography(person),
    reviewHighlights(person),
    reviewThemeTags(person),
    reviewCountryTags(person),
    reviewCommunityTags(person),
    reviewJourneySuggestions(curated),
    reviewImageAltText(person, curated, media),
    reviewVideoTextAssets(person, media),
    reviewCountryNotes(curated),
    reviewCuratorNotes(curated),
    reviewStorySectionText(person, storySection),
    reviewArchiveLeadText(person, archiveLeadRecords),
  ];

  const decisionIssues = fields.flatMap((field) => field.issues.filter((issue) => issue.affectsProfileDecision !== false));
  const criticalIssues = decisionIssues.filter((issue) => issue.severity === 'critical');
  const majorIssues = decisionIssues.filter((issue) => issue.severity === 'major');
  const minorIssues = decisionIssues.filter((issue) => issue.severity === 'minor');
  const decision = decideProfileReadiness(criticalIssues, majorIssues);

  return {
    id: person.id,
    name: person.name,
    classYear: person.classYear,
    region: person.region,
    decision,
    decisionLabel: decisionLabels[decision],
    recommendedAction: recommendedAction(decision, criticalIssues, majorIssues, minorIssues),
    issueCounts: {
      critical: criticalIssues.length,
      major: majorIssues.length,
      minor: minorIssues.length,
      totalDecisionIssues: decisionIssues.length,
      totalObservedIssues: fields.reduce((count, field) => count + field.issues.length, 0),
    },
    fieldStatusCounts: countBy(fields.map((field) => field.status)),
    topIssues: [...criticalIssues, ...majorIssues, ...minorIssues].slice(0, 8).map((issue) => issue.code),
    fieldReviews: fields,
  };
}

function reviewDisplayName(person) {
  const field = createField({
    key: 'displayName',
    label: 'Display name',
    category: 'identity',
    visibility: 'visitor-facing',
    value: person.name,
    required: true,
  });
  requireText(field);
  if (new RegExp(`[–-]\\s*${person.classYear}\\s*$`, 'u').test(person.name)) {
    addIssue(field, 'DISPLAY_NAME_YEAR_ARTIFACT', 'critical', 'Display name appears to include the induction year as scrape residue.');
  }
  if (/\(\d{4}\s*[–-]\s*\d{4}\)/u.test(person.name)) {
    addIssue(field, 'DISPLAY_NAME_LIFE_DATES', 'minor', 'Display name includes life dates; confirm this is intentional.');
  }
  if (wordCount(person.name) > 8) addIssue(field, 'DISPLAY_NAME_LONG', 'minor', 'Display name is long for compact portrait labels.');
  return finishField(field);
}

function reviewSortName(person, curated) {
  const value = curated.sortName || person.sortName;
  const field = createField({
    key: 'sortName',
    label: 'Sort name',
    category: 'identity',
    visibility: 'internal',
    value,
    required: true,
    affectsProfileDecision: false,
  });
  requireText(field);
  if (value && !value.includes(',')) addIssue(field, 'SORT_NAME_FORMAT_REVIEW', 'minor', 'Sort name does not use the expected "Last, First" pattern.', false);
  return finishField(field);
}

function reviewPronunciation(person) {
  const field = createField({
    key: 'pronunciation',
    label: 'Pronunciation',
    category: 'accessibility',
    visibility: 'visitor-facing',
    value: person.pronunciation,
    required: false,
    affectsProfileDecision: false,
  });
  if (!hasText(person.pronunciation)) addIssue(field, 'PRONUNCIATION_MISSING', 'minor', 'Pronunciation guidance is empty; this is optional but useful.', false);
  return finishField(field);
}

function reviewSummary(person, curated) {
  const value = person.storySummary || curated.approvedSummary || curated.summaryDraft || '';
  const field = createField({
    key: 'storySummary',
    label: 'Story summary',
    category: 'profile-copy',
    visibility: 'visitor-facing',
    value,
    required: true,
    targetWords: '18-60',
  });
  requireText(field);
  checkWordRange(field, 18, 60, 12, 80);
  checkGeneralText(field, person, { core: true, allowTemporal: false });
  if (curated.summaryDraft && curated.approvedSummary && curated.summaryDraft !== curated.approvedSummary) {
    addIssue(field, 'SUMMARY_DRAFT_APPROVED_DIFFER', 'minor', 'Draft and approved summary differ; confirm which should be displayed.');
  }
  return finishField(field);
}

function reviewDocumentedContextLine(person) {
  const field = createField({
    key: 'documentedContextLine',
    label: 'Documented context line',
    category: 'profile-copy',
    visibility: 'visitor-facing',
    value: person.documentedContextLine,
    required: true,
    targetWords: '8-28',
  });
  requireText(field);
  checkWordRange(field, 8, 28, 5, 36);
  checkGeneralText(field, person, { core: true, allowTemporal: true });
  if (hasText(field.value) && !/Class of \d{4}/.test(field.value)) {
    addIssue(field, 'CONTEXT_LINE_CLASS_MISSING', 'major', 'Context line does not mention the class year.');
  }
  if (hasText(field.value) && /\bconnected to\.\b/i.test(field.value)) {
    addIssue(field, 'CONTEXT_LINE_EMPTY_HERITAGE', 'major', 'Context line appears to have an empty heritage phrase.');
  }
  return finishField(field);
}

function reviewHonoredForSummary(person) {
  const field = createField({
    key: 'honoredForSummary',
    label: 'Honored-for summary',
    category: 'profile-copy',
    visibility: 'visitor-facing',
    value: person.honoredForSummary,
    required: true,
    targetWords: '12-40',
  });
  requireText(field);
  checkWordRange(field, 12, 40, 8, 55);
  checkGeneralText(field, person, { core: true, allowTemporal: true });
  if (hasText(field.value) && !/Contributions? to|Leadership in|Service to|Work in/i.test(field.value)) {
    addIssue(field, 'HONORED_FOR_PATTERN_REVIEW', 'minor', 'Honored-for line does not follow the current compact contribution pattern.');
  }
  return finishField(field);
}

function reviewLifeWorkSummary(person) {
  const field = createField({
    key: 'lifeWorkSummary',
    label: 'Life + Work summary',
    category: 'profile-copy',
    visibility: 'visitor-facing',
    value: person.lifeWorkSummary,
    required: true,
    targetWords: '45-140',
  });
  requireText(field);
  checkWordRange(field, 45, 140, 25, 180);
  checkGeneralText(field, person, { core: true, allowTemporal: false });
  return finishField(field);
}

function reviewBiography(person) {
  const field = createField({
    key: 'bioText',
    label: 'Full biography',
    category: 'profile-copy',
    visibility: 'visitor-facing',
    value: person.bioText,
    required: true,
    targetWords: '150-900',
  });
  requireText(field);
  checkWordRange(field, 150, 900, 120, 1400);
  checkGeneralText(field, person, { core: true, allowTemporal: false });
  if (startsWithDuplicatedName(field.value, person.name)) {
    addIssue(field, 'BIO_LEADING_NAME_DUPLICATION', 'major', 'Biography starts with a duplicated scraped name heading.');
  }
  return finishField(field);
}

function reviewHighlights(person) {
  const field = createField({
    key: 'storyHighlights',
    label: 'Story highlights',
    category: 'profile-copy',
    visibility: 'visitor-facing',
    value: person.storyHighlights,
    required: false,
    targetWords: '3-5 short highlights',
  });
  if (!Array.isArray(person.storyHighlights) || person.storyHighlights.length === 0) {
    addIssue(field, 'HIGHLIGHTS_MISSING', 'minor', 'No generated highlights are available.');
    return finishField(field);
  }
  if (person.storyHighlights.length < 3) addIssue(field, 'HIGHLIGHTS_LOW_COUNT', 'minor', 'Fewer than three highlights are available.');
  person.storyHighlights.forEach((highlight, index) => {
    const label = `highlight ${index + 1}`;
    if (wordCount(highlight) < 4) addIssue(field, 'HIGHLIGHT_FRAGMENT', 'minor', `${label} is very short and may be a fragment.`);
    if (wordCount(highlight) > 32) addIssue(field, 'HIGHLIGHT_TOO_LONG', 'minor', `${label} is long for a scannable highlight.`);
    if (hasEllipsis(highlight)) addIssue(field, 'HIGHLIGHT_TRUNCATED', 'major', `${label} appears truncated.`);
    if (startsWithDuplicatedName(highlight, person.name)) addIssue(field, 'HIGHLIGHT_LEADING_NAME_DUPLICATION', 'minor', `${label} repeats the display name.`);
  });
  return finishField(field);
}

function reviewThemeTags(person) {
  const field = createField({
    key: 'themeTags',
    label: 'Theme tags',
    category: 'taxonomy',
    visibility: 'visitor-facing',
    value: person.themeTags,
    required: true,
    targetWords: '2-6 labels',
  });
  if (!Array.isArray(person.themeTags) || person.themeTags.length === 0) addIssue(field, 'THEME_TAGS_MISSING', 'major', 'No theme tags are available.');
  if (person.themeTags.length > 6) addIssue(field, 'THEME_TAGS_TOO_MANY', 'minor', 'Theme tag list is crowded for visitor display.');
  if (person.themeTagsSource !== 'curated') {
    addIssue(field, 'THEME_TAGS_NOT_APPROVED', 'minor', 'Theme tags are generated/candidate text, not final curator-approved labels.', false);
  }
  return finishField(field);
}

function reviewCountryTags(person) {
  const field = createField({
    key: 'countryTags',
    label: 'Country/heritage tags',
    category: 'taxonomy',
    visibility: 'visitor-facing',
    value: person.countryTags,
    required: true,
    targetWords: '1+ labels',
  });
  if (hasReviewedNoCountryTagException(person)) {
    field.required = false;
    field.status = 'not-applicable';
    field.excerpt = 'Reviewed community-based induction; no nationality/heritage tag assigned.';
    return finishField(field);
  }
  if (!Array.isArray(person.countryTags) || person.countryTags.length === 0) {
    addIssue(field, 'COUNTRY_TAGS_MISSING', 'major', 'Country/heritage tags are missing.');
  }
  if (person.countryTags.length > 4) addIssue(field, 'COUNTRY_TAGS_TOO_MANY', 'minor', 'Country/heritage tag list may be too crowded for display.');
  return finishField(field);
}

function hasReviewedNoCountryTagException(person) {
  return (
    Array.isArray(person.countryTags) &&
    person.countryTags.length === 0 &&
    Array.isArray(person.communityTags) &&
    person.communityTags.length > 0 &&
    /\bno nationality\/heritage tag is assigned\b/i.test(person.countryTagsNote ?? '')
  );
}

function reviewCommunityTags(person) {
  const field = createField({
    key: 'communityTags',
    label: 'Community tags',
    category: 'taxonomy',
    visibility: 'visitor-facing',
    value: person.communityTags,
    required: false,
    targetWords: '0+ labels',
    affectsProfileDecision: false,
  });
  if (!Array.isArray(person.communityTags) || person.communityTags.length === 0) {
    addIssue(field, 'COMMUNITY_TAGS_MISSING', 'minor', 'Community tags are empty or not normalized yet.', false);
  }
  return finishField(field);
}

function reviewJourneySuggestions(curated) {
  const suggestions = curated.journeySuggestions ?? [];
  const field = createField({
    key: 'journeySuggestions',
    label: 'Journey suggestions',
    category: 'navigation-copy',
    visibility: 'internal',
    value: suggestions,
    required: false,
    targetWords: 'route labels',
    affectsProfileDecision: false,
  });
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    addIssue(field, 'JOURNEY_SUGGESTIONS_MISSING', 'minor', 'No internal journey suggestions are attached.', false);
  }
  return finishField(field);
}

function reviewImageAltText(person, curated, media) {
  const values = [];
  const curatedAlt = curated.image?.primaryAltText || '';
  const runtimeAlt = person.imageAltText || '';
  const manifestAlt = media.images?.primary?.altText || '';
  if (curatedAlt) values.push(curatedAlt);
  if (runtimeAlt && runtimeAlt !== curatedAlt) values.push(runtimeAlt);
  if (manifestAlt && !values.includes(manifestAlt)) values.push(manifestAlt);
  const value = values[0] || '';
  const field = createField({
    key: 'imageAltText',
    label: 'Image alt text',
    category: 'accessibility',
    visibility: 'visitor-facing',
    value,
    allValues: values,
    required: true,
    targetWords: '8-24',
    affectsProfileDecision: false,
  });
  requireText(field);
  checkWordRange(field, 8, 24, 4, 36, false);
  if (/^Portrait or archival image of .+, Class of \d{4}\.$/.test(value)) {
    addIssue(field, 'ALT_TEXT_GENERIC_TEMPLATE', 'minor', 'Alt text is a generic template; acceptable as a placeholder, but should be person-specific before final accessibility approval.', false);
  }
  return finishField(field);
}

function reviewVideoTextAssets(person, media) {
  const videos = Array.isArray(media.videos) ? media.videos : [];
  const field = createField({
    key: 'videoCaptionTranscriptText',
    label: 'Video caption/transcript text',
    category: 'accessibility',
    visibility: 'visitor-facing',
    value: videos.map((video) => ({
      youtubeVideoId: video.youtubeVideoId,
      captionStatus: video.captionStatus,
      transcriptStatus: video.transcriptStatus,
      captionFilePath: video.captionFilePath,
      transcriptFilePath: video.transcriptFilePath,
    })),
    required: false,
    targetWords: 'captions and transcripts for enabled videos',
    affectsProfileDecision: false,
  });
  if (!person.hasVideo) {
    field.status = 'not-applicable';
    return field;
  }
  if (videos.length === 0) {
    addIssue(field, 'VIDEO_TEXT_ASSETS_MISSING', 'major', 'Profile has video ids but no media-manifest video records.', false);
    return finishField(field);
  }
  const missingCaptions = videos.filter((video) => !video.captionFilePath || video.captionStatus !== 'approved');
  const missingTranscripts = videos.filter((video) => !video.transcriptFilePath || video.transcriptStatus !== 'approved');
  if (missingCaptions.length > 0) addIssue(field, 'VIDEO_CAPTIONS_NOT_READY', 'major', `${missingCaptions.length}/${videos.length} video caption text assets are not approved.`, false);
  if (missingTranscripts.length > 0) addIssue(field, 'VIDEO_TRANSCRIPTS_NOT_READY', 'major', `${missingTranscripts.length}/${videos.length} video transcript text assets are not approved.`, false);
  return finishField(field);
}

function reviewCountryNotes(curated) {
  const field = createField({
    key: 'countryNotes',
    label: 'Country notes',
    category: 'staff-notes',
    visibility: 'staff/internal',
    value: curated.countryNotes,
    required: false,
    targetWords: 'short provenance note',
    affectsProfileDecision: false,
  });
  if (!hasText(curated.countryNotes)) addIssue(field, 'COUNTRY_NOTES_MISSING', 'minor', 'Country provenance note is empty.', false);
  return finishField(field);
}

function reviewCuratorNotes(curated) {
  const notes = curated.curatorNotes ?? [];
  const field = createField({
    key: 'curatorNotes',
    label: 'Curator notes',
    category: 'staff-notes',
    visibility: 'staff/internal',
    value: notes,
    required: false,
    targetWords: 'short internal notes',
    affectsProfileDecision: false,
  });
  if (!Array.isArray(notes) || notes.length === 0) addIssue(field, 'CURATOR_NOTES_MISSING', 'minor', 'Curator notes are empty.', false);
  return finishField(field);
}

function reviewStorySectionText(person, storySection) {
  const field = createField({
    key: 'storySectionBeats',
    label: 'Story-section beats',
    category: 'supplemental-story-copy',
    visibility: 'visitor-facing',
    value: storySection?.beats ?? [],
    required: false,
    targetWords: 'curated optional beats',
    affectsProfileDecision: false,
  });
  if (!storySection) {
    field.status = 'not-applicable';
    return field;
  }
  const beats = Array.isArray(storySection.beats) ? storySection.beats : [];
  if (beats.length === 0) {
    addIssue(field, 'STORY_BEATS_EMPTY', 'minor', 'Story section exists but has no beats.', false);
    return finishField(field);
  }
  beats.forEach((beat, index) => {
    if (!hasText(beat.headline)) addIssue(field, 'STORY_BEAT_HEADLINE_MISSING', 'major', `Beat ${index + 1} is missing a headline.`, false);
    if (!hasText(beat.body)) addIssue(field, 'STORY_BEAT_BODY_MISSING', 'major', `Beat ${index + 1} is missing body text.`, false);
    if (hasText(beat.body) && hasEllipsis(beat.body)) addIssue(field, 'STORY_BEAT_BODY_TRUNCATED', 'major', `Beat ${index + 1} body appears truncated.`, false);
    if (hasText(beat.body) && /\bhis biography connects|her biography connects|their biography connects\b/i.test(beat.body)) {
      addIssue(field, 'STORY_BEAT_META_LANGUAGE', 'minor', `Beat ${index + 1} uses meta-biography wording that may need polish.`, false);
    }
  });
  return finishField(field);
}

function reviewArchiveLeadText(person, records) {
  const field = createField({
    key: 'archiveLeadText',
    label: 'Archive lead text',
    category: 'supplemental-staff-copy',
    visibility: 'staff/internal',
    value: records.map((record) => ({
      title: record.title,
      displayText: record.displayText,
      candidateUse: record.candidateUse,
      rightsNote: record.rightsNote,
      visibility: record.visibility,
    })),
    required: false,
    targetWords: 'staff review notes',
    affectsProfileDecision: false,
  });
  if (records.length === 0) {
    field.status = 'not-applicable';
    return field;
  }
  records.forEach((record, index) => {
    if (!hasText(record.displayText)) addIssue(field, 'ARCHIVE_LEAD_DISPLAY_TEXT_MISSING', 'minor', `Archive lead ${index + 1} is missing display text.`, false);
    if (record.visibility !== 'visitor-ready') {
      addIssue(field, 'ARCHIVE_LEAD_STAFF_ONLY', 'minor', `Archive lead ${index + 1} is staff-review only.`, false);
    }
  });
  return finishField(field);
}

function createField(options) {
  return {
    key: options.key,
    label: options.label,
    category: options.category,
    visibility: options.visibility,
    status: 'pass-as-is',
    required: Boolean(options.required),
    targetWords: options.targetWords ?? '',
    wordCount: Array.isArray(options.value) || typeof options.value === 'object' ? null : wordCount(options.value),
    value: options.value ?? '',
    allValues: options.allValues,
    excerpt: excerpt(options.value),
    issues: [],
    affectsProfileDecision: options.affectsProfileDecision !== false,
  };
}

function requireText(field) {
  if (!hasText(field.value)) {
    addIssue(field, `${constantCase(field.key)}_MISSING`, field.required ? 'critical' : 'minor', `${field.label} is missing.`, field.affectsProfileDecision);
  }
}

function checkWordRange(field, min, max, hardMin, hardMax, affectsDecision = field.affectsProfileDecision) {
  if (!hasText(field.value)) return;
  const words = wordCount(field.value);
  if (words < hardMin) addIssue(field, `${constantCase(field.key)}_TOO_SHORT`, 'critical', `${field.label} is very short at ${words} words.`, affectsDecision);
  else if (words < min) addIssue(field, `${constantCase(field.key)}_SLIGHTLY_SHORT`, 'major', `${field.label} is short at ${words} words.`, affectsDecision);
  if (words > hardMax) addIssue(field, `${constantCase(field.key)}_TOO_LONG`, 'critical', `${field.label} is very long at ${words} words.`, affectsDecision);
  else if (words > max) addIssue(field, `${constantCase(field.key)}_SLIGHTLY_LONG`, 'major', `${field.label} is long at ${words} words.`, affectsDecision);
}

function checkGeneralText(field, person, options = {}) {
  if (!hasText(field.value)) return;
  if (hasEllipsis(field.value)) {
    addIssue(field, `${constantCase(field.key)}_TRUNCATED`, options.core ? 'critical' : 'major', `${field.label} appears truncated with an ellipsis.`, field.affectsProfileDecision);
  }
  if (!options.allowTemporal && hasTemporalWording(field.value)) {
    addIssue(field, `${constantCase(field.key)}_TEMPORAL_WORDING`, 'major', `${field.label} contains time-sensitive wording such as currently, today, or now.`, field.affectsProfileDecision);
  }
  if (hasContactLikeText(field.value)) {
    addIssue(field, `${constantCase(field.key)}_CONTACT_OR_ADDRESS`, 'critical', `${field.label} includes contact/address/phone-like text.`, field.affectsProfileDecision);
  }
  if (hasUrlOrEmail(field.value)) {
    addIssue(field, `${constantCase(field.key)}_URL_OR_EMAIL`, 'critical', `${field.label} includes a URL or email-like string.`, field.affectsProfileDecision);
  }
  if (hasScrapeResidue(field.value)) {
    addIssue(field, `${constantCase(field.key)}_SCRAPE_RESIDUE`, 'major', `${field.label} appears to include scrape/navigation residue.`, field.affectsProfileDecision);
  }
  if (startsWithDuplicatedName(field.value, person.name) && field.key !== 'bioText') {
    addIssue(field, `${constantCase(field.key)}_LEADING_NAME_DUPLICATION`, 'major', `${field.label} begins with a duplicated scraped name heading.`, field.affectsProfileDecision);
  }
}

function addIssue(field, code, severity, message, affectsProfileDecision = field.affectsProfileDecision) {
  field.issues.push({ code, severity, message, affectsProfileDecision });
}

function finishField(field) {
  if (field.status === 'not-applicable') return field;
  const allIssues = field.issues;
  if (allIssues.some((issue) => issue.severity === 'critical')) field.status = 'needs-substantive-edit';
  else if (allIssues.some((issue) => issue.severity === 'major')) field.status = 'minimal-edit';
  else if (allIssues.length > 0) field.status = 'pass-with-optional-polish';
  else field.status = 'pass-as-is';
  return field;
}

function decideProfileReadiness(criticalIssues, majorIssues) {
  if (criticalIssues.length > 0) return 'needs-editorial-review';
  if (majorIssues.length > 0) return 'minimal-edits';
  return 'pass-as-is';
}

function recommendedAction(decision, criticalIssues, majorIssues, minorIssues) {
  if (decision === 'pass-as-is') {
    if (minorIssues.length > 0) return 'Can pass for current copy triage; optional polish remains for accessibility/internal labels.';
    return 'Can pass as-is for current copy triage.';
  }
  if (decision === 'minimal-edits') {
    const top = majorIssues.slice(0, 3).map((issue) => issue.message.replace(/\.$/, '')).join('; ');
    return `Apply minimal edits: ${top}.`;
  }
  const top = criticalIssues.slice(0, 3).map((issue) => issue.message.replace(/\.$/, '')).join('; ');
  return `Needs substantive editorial review before passing: ${top}.`;
}

function buildSummary(reviews) {
  const textSurfaceTotals = summarizeSurfaces(reviews);
  return {
    totalProfiles: reviews.length,
    profileDecisions: countBy(reviews.map((review) => review.decision)),
    profilesPassingOrMinimal: reviews.filter((review) => review.decision === 'pass-as-is' || review.decision === 'minimal-edits').length,
    textSurfaceTotals,
    issueCounts: countIssues(reviews),
    issueCountsByField: countIssuesByField(reviews),
    topIssueQueues: {
      substantiveReview: reviews.filter((review) => review.decision === 'needs-editorial-review').map(personQueueItem),
      minimalEdits: reviews.filter((review) => review.decision === 'minimal-edits').map(personQueueItem),
      passAsIs: reviews.filter((review) => review.decision === 'pass-as-is').map(personQueueItem),
    },
    fieldTypeReadiness: buildFieldTypeReadiness(reviews),
  };
}

function summarizeSurfaces(reviews) {
  const fields = reviews.flatMap((review) => review.fieldReviews);
  const summarize = (predicate) => {
    const subset = fields.filter(predicate);
    return {
      total: subset.length,
      passAsIs: subset.filter((field) => field.status === 'pass-as-is').length,
      passWithOptionalPolish: subset.filter((field) => field.status === 'pass-with-optional-polish').length,
      minimalEdit: subset.filter((field) => field.status === 'minimal-edit').length,
      needsEdit: subset.filter((field) => field.status === 'needs-substantive-edit').length,
      notApplicable: subset.filter((field) => field.status === 'not-applicable').length,
    };
  };
  return {
    all: summarize(() => true),
    visitorFacing: summarize((field) => field.visibility === 'visitor-facing'),
    coreProfileCopy: summarize((field) => field.category === 'profile-copy'),
    staffInternal: summarize((field) => field.visibility.includes('internal')),
    accessibility: summarize((field) => field.category === 'accessibility'),
  };
}

function countIssues(reviews) {
  return countBy(reviews.flatMap((review) => review.fieldReviews.flatMap((field) => field.issues.map((issue) => issue.code))));
}

function countIssuesByField(reviews) {
  const entries = {};
  reviews.forEach((review) => {
    review.fieldReviews.forEach((field) => {
      const current = entries[field.key] ?? { field: field.key, totalIssues: 0, critical: 0, major: 0, minor: 0 };
      field.issues.forEach((issue) => {
        current.totalIssues += 1;
        current[issue.severity] = (current[issue.severity] ?? 0) + 1;
      });
      entries[field.key] = current;
    });
  });
  return Object.fromEntries(Object.entries(entries).sort((a, b) => b[1].totalIssues - a[1].totalIssues || a[0].localeCompare(b[0])));
}

function buildFieldTypeReadiness(reviews) {
  const fieldsByKey = groupBy(reviews.flatMap((review) => review.fieldReviews), (field) => field.key);
  return Array.from(fieldsByKey.entries())
    .map(([key, fields]) => ({
      key,
      label: fields[0]?.label ?? key,
      category: fields[0]?.category ?? '',
      visibility: fields[0]?.visibility ?? '',
      statuses: countBy(fields.map((field) => field.status)),
      issueCount: fields.reduce((count, field) => count + field.issues.length, 0),
      mostCommonIssues: topCounts(fields.flatMap((field) => field.issues.map((issue) => issue.code)), 6),
    }))
    .sort((a, b) => statusRiskScore(b.statuses) - statusRiskScore(a.statuses) || b.issueCount - a.issueCount || a.key.localeCompare(b.key));
}

function buildFieldInventory() {
  return [
    { key: 'displayName', visibility: 'visitor-facing', purpose: 'Portrait labels and focused profile heading.' },
    { key: 'sortName', visibility: 'internal', purpose: 'Stable sorting/search helper.' },
    { key: 'pronunciation', visibility: 'visitor-facing', purpose: 'Optional accessibility/person-name guidance.' },
    { key: 'storySummary', visibility: 'visitor-facing', purpose: 'Compact profile summary.' },
    { key: 'documentedContextLine', visibility: 'visitor-facing', purpose: 'Class/heritage/induction context.' },
    { key: 'honoredForSummary', visibility: 'visitor-facing', purpose: 'Honored-for contribution sentence.' },
    { key: 'lifeWorkSummary', visibility: 'visitor-facing', purpose: 'Short Life + Work panel copy.' },
    { key: 'bioText', visibility: 'visitor-facing', purpose: 'Full biography/detail text.' },
    { key: 'storyHighlights', visibility: 'visitor-facing', purpose: 'Generated quick-scan highlights.' },
    { key: 'themeTags', visibility: 'visitor-facing', purpose: 'Thematic trace/navigation labels.' },
    { key: 'countryTags', visibility: 'visitor-facing', purpose: 'Heritage/country trace labels.' },
    { key: 'communityTags', visibility: 'visitor-facing', purpose: 'Normalized community labels where available.' },
    { key: 'journeySuggestions', visibility: 'internal', purpose: 'Route/journey helper labels.' },
    { key: 'imageAltText', visibility: 'visitor-facing', purpose: 'Primary portrait accessibility text.' },
    { key: 'videoCaptionTranscriptText', visibility: 'visitor-facing', purpose: 'Caption/transcript text readiness for linked video.' },
    { key: 'countryNotes', visibility: 'staff/internal', purpose: 'Heritage-tag provenance note.' },
    { key: 'curatorNotes', visibility: 'staff/internal', purpose: 'Internal review notes and publication boundaries.' },
    { key: 'storySectionBeats', visibility: 'visitor-facing', purpose: 'Optional curated story-section narrative beats.' },
    { key: 'archiveLeadText', visibility: 'staff/internal', purpose: 'Staff-only archive lead display/review notes.' },
  ];
}

function buildMarkdown(data) {
  const s = data.summary;
  const lines = [];
  lines.push('# CIHOF Profile Text Readiness Review');
  lines.push('');
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push('This review checks local text surfaces only and explicitly excludes `data/external-research/*`. It is an automated copy triage, not factual verification, rights approval, or final curator approval.');
  lines.push('');
  lines.push('## Executive Read');
  lines.push('');
  lines.push(`${s.profileDecisions['pass-as-is'] ?? 0}/${s.totalProfiles} profiles can pass as-is for current text triage, and ${s.profileDecisions['minimal-edits'] ?? 0}/${s.totalProfiles} can likely pass with minimal edits. ${s.profileDecisions['needs-editorial-review'] ?? 0}/${s.totalProfiles} need substantive text review before they should be treated as clean copy.`);
  lines.push('');
  lines.push('The recurring issues are not mysterious: truncated summaries/life-work copy, duplicated scraped headings, time-sensitive wording, generic alt text, missing pronunciation guidance, missing video caption/transcript text, and a small number of display-name or contact/address artifacts.');
  lines.push('');
  lines.push('## Decision Counts');
  lines.push('');
  lines.push('| Decision | Count | Meaning |');
  lines.push('| --- | ---: | --- |');
  lines.push(`| Pass as-is | ${s.profileDecisions['pass-as-is'] ?? 0} | Core profile text has no critical or major automated copy flags. |`);
  lines.push(`| Minimal edits | ${s.profileDecisions['minimal-edits'] ?? 0} | Core text looks usable after small cleanup, usually duplicated heading, length, or temporal wording. |`);
  lines.push(`| Needs editorial review | ${s.profileDecisions['needs-editorial-review'] ?? 0} | Core text has a critical flag such as truncation, contact text, display-name scrape residue, or extreme length. |`);
  lines.push('');
  lines.push('## Text Surface Totals');
  lines.push('');
  lines.push('| Surface group | Total | Pass | Optional polish | Minimal edit | Needs edit | N/A |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  lines.push(surfaceRow('All checked fields', s.textSurfaceTotals.all));
  lines.push(surfaceRow('Visitor-facing fields', s.textSurfaceTotals.visitorFacing));
  lines.push(surfaceRow('Core profile copy', s.textSurfaceTotals.coreProfileCopy));
  lines.push(surfaceRow('Accessibility text', s.textSurfaceTotals.accessibility));
  lines.push(surfaceRow('Staff/internal fields', s.textSurfaceTotals.staffInternal));
  lines.push('');
  lines.push('## Field-Type Readiness');
  lines.push('');
  lines.push('| Field type | Status counts | Common issues |');
  lines.push('| --- | --- | --- |');
  s.fieldTypeReadiness.forEach((field) => {
    lines.push(`| ${escapeCell(field.label)} | ${escapeCell(formatCountMap(field.statuses))} | ${escapeCell(formatTopCounts(field.mostCommonIssues))} |`);
  });
  lines.push('');
  lines.push('## Highest-Value Minimal Edits');
  lines.push('');
  lines.push('- Strip duplicated scraped names at the beginning of biographies/highlights where present.');
  lines.push('- Rewrite text ending in ellipses instead of approving truncated summaries or Life + Work copy.');
  lines.push('- Replace contact/address fragments with stable institutional context.');
  lines.push('- Clean the four display names that still carry class-year artifacts.');
  lines.push('- Personalize primary portrait alt text beyond the current generic template before final accessibility approval.');
  lines.push('- Keep video caption/transcript work separate from profile-copy approval unless WATCH media is being enabled.');
  lines.push('');
  lines.push('## Per-Profile Text Decision Matrix');
  lines.push('');
  lines.push('| Person | Class | Decision | Critical | Major | Main text issues | Recommended action |');
  lines.push('| --- | ---: | --- | ---: | ---: | --- | --- |');
  data.personReviews.forEach((review) => {
    lines.push(`| ${escapeCell(review.name)} | ${review.classYear ?? ''} | ${escapeCell(review.decisionLabel)} | ${review.issueCounts.critical} | ${review.issueCounts.major} | ${escapeCell(formatList(review.topIssues, 5))} | ${escapeCell(review.recommendedAction)} |`);
  });
  lines.push('');
  lines.push('## Full Detail');
  lines.push('');
  lines.push(`Full field-by-field details, including excerpts and the checked values, are in \`${jsonOutputPath.replace(`${process.cwd()}/`, '')}\`.`);
  lines.push(`A triage spreadsheet-style export is in \`${csvOutputPath.replace(`${process.cwd()}/`, '')}\`.`);
  return lines.join('\n');
}

function buildCsv(data) {
  const rows = [
    [
      'id',
      'name',
      'classYear',
      'decision',
      'criticalIssues',
      'majorIssues',
      'minorIssues',
      'topIssues',
      'needsSubstantiveEditFields',
      'minimalEditFields',
      'optionalPolishFields',
      'recommendedAction',
    ],
  ];
  data.personReviews.forEach((review) => {
    rows.push([
      review.id,
      review.name,
      review.classYear,
      review.decision,
      review.issueCounts.critical,
      review.issueCounts.major,
      review.issueCounts.minor,
      review.topIssues.join('; '),
      review.fieldReviews.filter((field) => field.status === 'needs-substantive-edit').map((field) => field.key).join('; '),
      review.fieldReviews.filter((field) => field.status === 'minimal-edit').map((field) => field.key).join('; '),
      review.fieldReviews.filter((field) => field.status === 'pass-with-optional-polish').map((field) => field.key).join('; '),
      review.recommendedAction,
    ]);
  });
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function personQueueItem(review) {
  return {
    id: review.id,
    name: review.name,
    classYear: review.classYear,
    criticalIssues: review.issueCounts.critical,
    majorIssues: review.issueCounts.major,
    topIssues: review.topIssues,
    recommendedAction: review.recommendedAction,
  };
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function wordCount(value) {
  if (!hasText(value)) return 0;
  return String(value).split(/\s+/).filter(Boolean).length;
}

function hasEllipsis(value) {
  return /\.{3}|…/u.test(String(value ?? ''));
}

function hasTemporalWording(value) {
  return /\b(currently|today|now|at present|presently)\b/i.test(String(value ?? ''));
}

function hasContactLikeText(value) {
  const text = String(value ?? '');
  return (
    /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/.test(text) ||
    /\b\d{2,5}\s+(?:Public Square|Lakeshore Boulevard)\b/i.test(text)
  );
}

function hasUrlOrEmail(value) {
  return /\bhttps?:\/\/|\bwww\.|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(String(value ?? ''));
}

function hasScrapeResidue(value) {
  return /\b(read more|click here|share this|posted in|leave a reply|comments are closed|wp-content|javascript:)\b/i.test(String(value ?? ''));
}

function startsWithDuplicatedName(value, name) {
  const normalizedText = normalizeText(value);
  const normalizedName = normalizeText(stripDisplayNameArtifacts(name));
  return Boolean(normalizedName) && normalizedText.startsWith(`${normalizedName} ${normalizedName}`);
}

function stripDisplayNameArtifacts(name) {
  return String(name ?? '')
    .replace(/\s+[–-]\s*\d{4}$/u, '')
    .replace(/\s*\(\d{4}\s*[–-]\s*\d{4}\)\s*$/u, '')
    .trim();
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function groupBy(values, keyFn) {
  return values.reduce((map, value) => {
    const key = keyFn(value);
    map.set(key, [...(map.get(key) ?? []), value]);
    return map;
  }, new Map());
}

function countBy(values) {
  return values.reduce((counts, value) => {
    const key = String(value || 'blank');
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function topCounts(values, limit) {
  return Object.entries(countBy(values))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function statusRiskScore(statuses) {
  return (statuses['needs-substantive-edit'] ?? 0) * 10 + (statuses['minimal-edit'] ?? 0) * 4 + (statuses['pass-with-optional-polish'] ?? 0);
}

function constantCase(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function excerpt(value) {
  if (Array.isArray(value)) return formatList(value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))), 3);
  if (value && typeof value === 'object') return JSON.stringify(value).slice(0, 240);
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

function formatDecisionCounts(map) {
  return [
    `pass-as-is: ${map['pass-as-is'] ?? 0}`,
    `minimal-edits: ${map['minimal-edits'] ?? 0}`,
    `needs-editorial-review: ${map['needs-editorial-review'] ?? 0}`,
  ].join('; ');
}

function formatCountMap(map) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => `${key}: ${count}`)
    .join('; ') || 'none';
}

function formatTopCounts(values) {
  return values.map((item) => `${item.label}: ${item.count}`).join('; ') || 'none';
}

function formatList(values, limit = 10) {
  const list = values.slice(0, limit).join(', ');
  const remaining = values.length - limit;
  return remaining > 0 ? `${list}, +${remaining} more` : list || 'none';
}

function surfaceRow(label, totals) {
  return `| ${escapeCell(label)} | ${totals.total} | ${totals.passAsIs} | ${totals.passWithOptionalPolish} | ${totals.minimalEdit} | ${totals.needsEdit} | ${totals.notApplicable} |`;
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
