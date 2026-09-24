import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { curatedMetadataPath, loadCuratedMetadata, loadInductees, parseCsv, validateCuratedMetadata } from './data-utils.js';
import { changesWhatVisitorsSee, printVisibleChanges, visibleChanges, writeRecordedDifferences } from './parity-utils.js';

const args = parseArgs(process.argv.slice(2));
const inputPath = args.input ? resolve(args.input) : '';
const outputPath = args.output ? resolve(args.output) : curatedMetadataPath;
// A preview unless --apply is given, like every other apply tool here: a
// sheet is read, checked and summarised first, and nothing is written by
// accident. --dry-run is still accepted and still means a preview.
const dryRun = !args.apply || Boolean(args.dryRun);
const clearEmpty = Boolean(args.clearEmpty);
const noBackup = Boolean(args.noBackup);

if (!inputPath) {
  printUsage();
  process.exit(1);
}

if (!existsSync(inputPath)) {
  console.error(`Missing curation decisions CSV: ${inputPath}`);
  process.exit(1);
}

const baseInductees = loadInductees({ includeCurated: false, includeMedia: false });
const expectedIds = baseInductees.map((item) => item.id);
const expectedIdSet = new Set(expectedIds);
const metadata = loadCuratedMetadata({ optional: false });
const decisions = readDecisionRows(inputPath);
const importErrors = [];
const importWarnings = [];
const applied = [];

decisions.forEach((row, index) => {
  const rowNumber = index + 2;
  const id = getCell(row, ['id']);
  if (!id) return;

  if (!expectedIdSet.has(id)) {
    importErrors.push(`Row ${rowNumber}: unknown inductee id "${id}".`);
    return;
  }

  const record = metadata.inductees[id];
  if (!record) {
    importErrors.push(`Row ${rowNumber}: no curated metadata record for "${id}".`);
    return;
  }

  const changed = applyRow(record, row, rowNumber, importErrors, importWarnings);
  if (changed.length > 0) applied.push({ id, changed });
});

metadata.source = {
  ...(metadata.source ?? {}),
  lastDecisionImport: {
    input: basename(inputPath),
    appliedAt: new Date().toISOString(),
    rowsRead: decisions.length,
    recordsChanged: applied.length,
  },
};

const validation = validateCuratedMetadata(metadata, expectedIds);
const errors = [...importErrors, ...validation.errors];
const warnings = [...importWarnings, ...validation.warnings];

console.log(`Read ${decisions.length} curation decision rows from ${inputPath}.`);
console.log(`${applied.length} curated records ${dryRun ? 'would be updated' : 'updated'}.`);
if (warnings.length > 0) console.log(`Warnings: ${warnings.length}`);

applied.slice(0, 20).forEach(({ id, changed }) => {
  console.log(`- ${id}: ${changed.join(', ')}`);
});
if (applied.length > 20) console.log(`- ...and ${applied.length - 20} more`);

if (warnings.length > 0) {
  warnings.slice(0, 20).forEach((warning) => console.warn(`Warning: ${warning}`));
  if (warnings.length > 20) console.warn(`Warning: ...and ${warnings.length - 20} more`);
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`Error: ${error}`));
  process.exit(1);
}

// What this changes on screen, from the published record. A change visitors
// will see is recorded with the decision that made it, or npm test fails; so
// such a change needs a decision reference before it is written.
const writesCanonical = outputPath === curatedMetadataPath;
const reference = decisionReference(args, decisions);
const visible = writesCanonical
  ? visibleChanges({ sources: { curated: metadata }, ids: applied.map(({ id }) => id), decisionReference: reference })
  : null;
if (visible) printVisibleChanges(visible);
if (visible && changesWhatVisitorsSee(visible) && !reference) {
  console.error('\nThis sheet changes what visitors see, so it needs the decision it rests on:');
  console.error('  add --decision-reference=<reference>, or a decision_reference column with one value.');
  console.error('  See data/curation-decisions/README.md for how references are named.');
  if (!dryRun) {
    console.error('Nothing was written.');
    process.exit(1);
  }
}

if (dryRun) {
  console.log(`\nPreview only. No files were written. To write them: npm run curate:apply -- --input=${args.input}${reference && args.decisionReference ? ` --decision-reference=${reference}` : ''} --apply`);
} else {
  if (writesCanonical && !noBackup) {
    const backupPath = `${curatedMetadataPath}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    copyFileSync(curatedMetadataPath, backupPath);
    console.log(`Backup written to ${backupPath}`);
  }
  writeFileSync(outputPath, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`Wrote ${outputPath}`);
  if (visible && changesWhatVisitorsSee(visible)) {
    writeRecordedDifferences(visible);
    console.log(`Recorded what visitors see differently under ${reference} in data/cihof_reviewed_differences.json`);
  }
}

function readDecisionRows(path) {
  const rows = parseCsv(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  const headers = rows.shift()?.map(normalizeHeader) ?? [];
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

function applyRow(record, row, rowNumber, errors, warnings) {
  const before = JSON.stringify(record);
  const changed = [];

  applyString(row, ['approval_status'], record, 'approvalStatus', changed, clearEmpty);
  applyString(row, ['review_priority'], record, 'reviewPriority', changed, clearEmpty, (value) => validateChoice(value, ['high', 'medium', 'standard'], rowNumber, 'review_priority', errors));
  applyString(row, ['display_name', 'name'], record, 'displayName', changed, clearEmpty);
  applyString(row, ['sort_name'], record, 'sortName', changed, clearEmpty);
  applyString(row, ['pronunciation'], record, 'pronunciation', changed, clearEmpty);
  applyString(row, ['approved_summary'], record, 'approvedSummary', changed, clearEmpty);
  applyString(row, ['documented_context_line', 'context_line'], record, 'documentedContextLine', changed, clearEmpty);
  applyString(row, ['honored_for_summary', 'honored_for'], record, 'honoredForSummary', changed, clearEmpty);
  applyString(row, ['life_work_summary', 'life_and_work_summary'], record, 'lifeWorkSummary', changed, clearEmpty);
  applyString(row, ['bio_text_override', 'approved_bio_text', 'display_bio_text'], record, 'bioTextOverride', changed, clearEmpty);
  applyList(row, ['approved_theme_tags'], record, 'approvedThemeTags', changed, clearEmpty);
  applyList(row, ['approved_country_tags', 'approved_countries', 'approved_nationality_tags', 'approved_nationality_heritage_tags'], record, 'approvedCountryTags', changed, clearEmpty);
  applyString(row, ['country_note', 'country_notes', 'nationality_note', 'nationality_heritage_note'], record, 'countryNotes', changed, clearEmpty);
  applyList(row, ['approved_community_tags', 'community_tags'], record, 'approvedCommunityTags', changed, clearEmpty);
  applyList(row, ['journey_suggestions'], record, 'journeySuggestions', changed, clearEmpty);
  applyList(row, ['curator_notes'], record, 'curatorNotes', changed, clearEmpty);
  applyNumber(row, ['attract_priority'], record, 'attractPriority', changed, rowNumber, errors, clearEmpty);
  applyBoolean(row, ['featured'], record, 'featured', changed, rowNumber, errors);
  applyBoolean(row, ['featured_candidate'], record, 'featuredCandidate', changed, rowNumber, errors);

  if (readBoolean(row, ['approve_profile', 'profile_approved'], rowNumber, errors) === true) {
    setValue(record, 'approvalStatus', 'approved', changed);
  }
  if (readBoolean(row, ['summary_approved', 'approve_summary'], rowNumber, errors) === true) {
    setValue(record, 'approvedSummary', getCell(row, ['approved_summary']) || record.approvedSummary || record.summaryDraft || '', changed);
  }
  if (readBoolean(row, ['theme_tags_approved', 'approve_theme_tags'], rowNumber, errors) === true) {
    const approvedTags = parseList(getCell(row, ['approved_theme_tags']));
    setValue(record, 'approvedThemeTags', approvedTags.length > 0 ? approvedTags : record.approvedThemeTags?.length > 0 ? record.approvedThemeTags : record.themeTagCandidates ?? [], changed);
  }
  if (readBoolean(row, ['country_tags_approved', 'approve_country_tags', 'nationality_tags_approved', 'approve_nationality_tags', 'nationality_heritage_tags_approved', 'approve_nationality_heritage_tags'], rowNumber, errors) === true) {
    const approvedTags = parseList(getCell(row, ['approved_country_tags', 'approved_countries', 'country_tags', 'approved_nationality_tags', 'nationality_tags', 'approved_nationality_heritage_tags', 'nationality_heritage_tags']));
    setValue(record, 'approvedCountryTags', approvedTags.length > 0 ? approvedTags : record.approvedCountryTags?.length > 0 ? record.approvedCountryTags : record.countryTagCandidates ?? [], changed);
    const countryNote = getCell(row, ['country_note', 'country_notes', 'nationality_note', 'nationality_heritage_note']);
    if (countryNote !== undefined && countryNote !== '') setValue(record, 'countryNotes', countryNote, changed);
  }
  if (readBoolean(row, ['community_tags_approved', 'approve_community_tags'], rowNumber, errors) === true) {
    const approvedTags = parseList(getCell(row, ['approved_community_tags', 'community_tags']));
    setValue(record, 'approvedCommunityTags', approvedTags.length > 0 ? approvedTags : record.approvedCommunityTags?.length > 0 ? record.approvedCommunityTags : record.communityTagCandidates ?? [], changed);
  }

  record.image = record.image && typeof record.image === 'object' ? record.image : {};
  applyString(row, ['primary_image_alt_text', 'image_alt_text'], record.image, 'primaryAltText', changed, clearEmpty, undefined, 'image.primaryAltText');
  applyString(row, ['image_focal_point'], record.image, 'focalPoint', changed, clearEmpty, undefined, 'image.focalPoint');
  applyString(row, ['image_rights_status'], record.image, 'rightsStatus', changed, clearEmpty, undefined, 'image.rightsStatus');
  applyString(row, ['image_rights_notes'], record.image, 'rightsNotes', changed, clearEmpty, undefined, 'image.rightsNotes');
  applyString(row, ['image_source_url'], record.image, 'sourceUrl', changed, clearEmpty, undefined, 'image.sourceUrl');
  if (readBoolean(row, ['image_rights_approved', 'approve_image_rights'], rowNumber, errors) === true) {
    setValue(record.image, 'rightsStatus', 'approved', changed, 'image.rightsStatus');
  }

  record.video = record.video && typeof record.video === 'object' ? record.video : {};
  applyString(row, ['video_review_status'], record.video, 'reviewStatus', changed, clearEmpty, undefined, 'video.reviewStatus');
  applyString(row, ['caption_status'], record.video, 'captionStatus', changed, clearEmpty, undefined, 'video.captionStatus');
  applyString(row, ['transcript_status'], record.video, 'transcriptStatus', changed, clearEmpty, undefined, 'video.transcriptStatus');
  applyString(row, ['audio_description_status'], record.video, 'audioDescriptionStatus', changed, clearEmpty, undefined, 'video.audioDescriptionStatus');
  applyString(row, ['video_rights_status'], record.video, 'rightsStatus', changed, clearEmpty, undefined, 'video.rightsStatus');
  applyList(row, ['video_source_urls'], record.video, 'sourceUrls', changed, clearEmpty, 'video.sourceUrls');
  applyList(row, ['youtube_video_ids'], record.video, 'youtubeVideoIds', changed, clearEmpty, 'video.youtubeVideoIds');
  applyList(row, ['local_video_paths'], record.video, 'localVideoPaths', changed, clearEmpty, 'video.localVideoPaths');
  if (readBoolean(row, ['video_rights_approved', 'approve_video_rights'], rowNumber, errors) === true) {
    setValue(record.video, 'rightsStatus', 'approved', changed, 'video.rightsStatus');
  }
  if (readBoolean(row, ['captions_approved', 'approve_captions'], rowNumber, errors) === true) {
    setValue(record.video, 'captionStatus', 'approved', changed, 'video.captionStatus');
  }
  if (readBoolean(row, ['transcript_approved', 'approve_transcript'], rowNumber, errors) === true) {
    setValue(record.video, 'transcriptStatus', 'approved', changed, 'video.transcriptStatus');
  }

  record.accessibility = record.accessibility && typeof record.accessibility === 'object' ? record.accessibility : {};
  applyString(row, ['plain_language_review'], record.accessibility, 'plainLanguageReview', changed, clearEmpty, undefined, 'accessibility.plainLanguageReview');
  applyString(row, ['sensitive_content_review'], record.accessibility, 'sensitiveContentReview', changed, clearEmpty, undefined, 'accessibility.sensitiveContentReview');
  applyString(row, ['image_description_review'], record.accessibility, 'imageDescriptionReview', changed, clearEmpty, undefined, 'accessibility.imageDescriptionReview');
  if (readBoolean(row, ['accessibility_approved', 'approve_accessibility'], rowNumber, errors) === true) {
    setValue(record.accessibility, 'plainLanguageReview', 'approved', changed, 'accessibility.plainLanguageReview');
    setValue(record.accessibility, 'sensitiveContentReview', 'approved', changed, 'accessibility.sensitiveContentReview');
    setValue(record.accessibility, 'imageDescriptionReview', 'approved', changed, 'accessibility.imageDescriptionReview');
  }

  return before === JSON.stringify(record) ? [] : changed;
}

function applyString(row, keys, target, prop, changed, shouldClear, validator, label = prop) {
  const value = getCell(row, keys);
  if (value === undefined || (value === '' && !shouldClear)) return;
  if (validator && !validator(value)) return;
  setValue(target, prop, value, changed, label);
}

function applyList(row, keys, target, prop, changed, shouldClear, label = prop) {
  const value = getCell(row, keys);
  if (value === undefined || (value === '' && !shouldClear)) return;
  setValue(target, prop, parseList(value), changed, label);
}

function applyBoolean(row, keys, target, prop, changed, rowNumber, errors, label = prop) {
  const value = readBoolean(row, keys, rowNumber, errors);
  if (value === undefined) return;
  setValue(target, prop, value, changed, label);
}

function applyNumber(row, keys, target, prop, changed, rowNumber, errors, shouldClear, label = prop) {
  const value = getCell(row, keys);
  if (value === undefined || (value === '' && !shouldClear)) return;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    errors.push(`Row ${rowNumber}: ${keys[0]} must be a finite number.`);
    return;
  }
  setValue(target, prop, numberValue, changed, label);
}

function setValue(target, prop, value, changed, label = prop) {
  if (JSON.stringify(target[prop]) === JSON.stringify(value)) return;
  target[prop] = value;
  changed.push(label);
}

function readBoolean(row, keys, rowNumber, errors) {
  const value = getCell(row, keys);
  if (value === undefined || value === '') return undefined;
  const normalized = value.toLowerCase();
  if (['1', 'true', 'yes', 'y', 'approved', 'approve'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'not-approved', 'needs-review', 'needed'].includes(normalized)) return false;
  errors.push(`Row ${rowNumber}: ${keys[0]} must be yes/no or true/false.`);
  return undefined;
}

function validateChoice(value, choices, rowNumber, label, errors) {
  if (value === '') return true;
  if (choices.includes(value)) return true;
  errors.push(`Row ${rowNumber}: ${label} must be one of ${choices.join(', ')}.`);
  return false;
}

function getCell(row, keys) {
  for (const key of keys) {
    if (Object.hasOwn(row, key)) return String(row[key] ?? '').trim();
  }
  return undefined;
}

function parseList(value) {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(/[|;\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeHeader(header) {
  return header
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--dry-run') parsed.dryRun = true;
    else if (value === '--apply') parsed.apply = true;
    else if (value === '--clear-empty') parsed.clearEmpty = true;
    else if (value === '--no-backup') parsed.noBackup = true;
    else if (value.startsWith('--decision-reference=')) parsed.decisionReference = value.slice('--decision-reference='.length).trim();
    else if (value.startsWith('--input=')) parsed.input = value.slice('--input='.length);
    else if (value === '--input') {
      parsed.input = values[index + 1];
      index += 1;
    } else if (value.startsWith('--output=')) parsed.output = value.slice('--output='.length);
    else if (value === '--output') {
      parsed.output = values[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function printUsage() {
  console.error(`Usage:
  npm run curate:apply -- --input=/path/to/edited-review.csv            (preview; writes nothing)
  npm run curate:apply -- --input=/path/to/edited-review.csv --apply    (writes)

Supported editable columns include:
  approval_status, review_priority, approve_profile, approved_summary,
  approved_theme_tags, approved_nationality_heritage_tags, nationality_heritage_note, approved_community_tags,
  featured, featured_candidate,
  image_rights_status, image_rights_approved, caption_status, captions_approved,
  transcript_status, transcript_approved, video_rights_status, video_rights_approved,
  primary_image_alt_text, accessibility_approved, curator_notes
`);
}

/**
 * The decision a sheet rests on: --decision-reference, or the one value of the
 * sheet's decision_reference column. Two different values in one sheet are
 * two decisions, and are applied as two sheets.
 */
function decisionReference(parsedArgs, sheetRows) {
  if (parsedArgs.decisionReference) return parsedArgs.decisionReference;
  const values = new Set(sheetRows.map((row) => getCell(row, ['decision_reference', 'decisionreference']) ?? '').filter(Boolean));
  if (values.size > 1) {
    console.error(`This sheet names ${values.size} decision references (${[...values].join(', ')}). Split it into one sheet per decision.`);
    process.exit(1);
  }
  return [...values][0] ?? '';
}
