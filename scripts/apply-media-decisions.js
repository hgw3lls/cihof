import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { loadInductees, loadMediaManifest, mediaManifestPath, parseCsv } from './data-utils.js';

const args = parseArgs(process.argv.slice(2));
const inputPath = args.input ? resolve(args.input) : '';
const outputPath = args.output ? resolve(args.output) : mediaManifestPath;
const dryRun = Boolean(args.dryRun);
const clearEmpty = Boolean(args.clearEmpty);
const noBackup = Boolean(args.noBackup);

if (!inputPath) {
  printUsage();
  process.exit(1);
}

if (!existsSync(inputPath)) {
  console.error(`Missing media decisions CSV: ${inputPath}`);
  process.exit(1);
}

const inductees = loadInductees({ includeCurated: false, includeMedia: false });
const expectedIds = inductees.map((item) => item.id);
const expectedIdSet = new Set(expectedIds);
const manifest = loadMediaManifest({ optional: false });
const rows = readRows(inputPath);
const importErrors = [];
const importWarnings = [];
const applied = [];

rows.forEach((row, index) => {
  const rowNumber = index + 2;
  const id = getCell(row, ['id']);
  if (!id) return;

  if (!expectedIdSet.has(id)) {
    importErrors.push(`Row ${rowNumber}: unknown inductee id "${id}".`);
    return;
  }

  const record = manifest.assets?.[id];
  if (!record) {
    importErrors.push(`Row ${rowNumber}: no media manifest record for "${id}".`);
    return;
  }

  const changed = applyRow(record, row, rowNumber, importErrors);
  if (changed.length > 0) applied.push({ id, changed });
});

manifest.source = {
  ...(manifest.source ?? {}),
  lastDecisionImport: {
    input: basename(inputPath),
    appliedAt: new Date().toISOString(),
    rowsRead: rows.length,
    recordsChanged: applied.length,
  },
};

const validation = validateManifest(manifest, expectedIds);
const errors = [...importErrors, ...validation.errors];
const warnings = [...importWarnings, ...validation.warnings];

console.log(`Read ${rows.length} media decision rows from ${inputPath}.`);
console.log(`${applied.length} media records ${dryRun ? 'would be updated' : 'updated'}.`);
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

if (dryRun) {
  console.log('Dry run only. No files were written.');
} else {
  if (outputPath === mediaManifestPath && !noBackup) {
    const backupPath = `${mediaManifestPath}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    copyFileSync(mediaManifestPath, backupPath);
    console.log(`Backup written to ${backupPath}`);
  }
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${outputPath}`);
}

function applyRow(record, row, rowNumber, errors) {
  const before = JSON.stringify(record);
  const changed = [];

  record.images = record.images && typeof record.images === 'object' ? record.images : {};
  record.images.primary = record.images.primary && typeof record.images.primary === 'object' ? record.images.primary : {};
  applyString(row, ['primary_image_source_url', 'image_source_url'], record.images.primary, 'sourceUrl', changed, clearEmpty, 'images.primary.sourceUrl');
  applyString(row, ['primary_image_file_path', 'image_file_path'], record.images.primary, 'filePath', changed, clearEmpty, 'images.primary.filePath');
  applyString(row, ['primary_image_runtime_path', 'image_runtime_path'], record.images.primary, 'runtimePath', changed, clearEmpty, 'images.primary.runtimePath');
  applyString(row, ['primary_image_checksum_sha256', 'image_checksum_sha256'], record.images.primary, 'checksumSha256', changed, clearEmpty, 'images.primary.checksumSha256');
  applyNullableNumber(row, ['primary_image_width', 'image_width'], record.images.primary, 'width', changed, rowNumber, errors, clearEmpty, 'images.primary.width');
  applyNullableNumber(row, ['primary_image_height', 'image_height'], record.images.primary, 'height', changed, rowNumber, errors, clearEmpty, 'images.primary.height');
  applyString(row, ['primary_image_alt_text', 'image_alt_text'], record.images.primary, 'altText', changed, clearEmpty, 'images.primary.altText');
  applyString(row, ['image_rights_status', 'primary_image_rights_status'], record.images.primary, 'rightsStatus', changed, clearEmpty, 'images.primary.rightsStatus');

  if (readBoolean(row, ['image_rights_approved', 'approve_image_rights', 'primary_image_rights_approved'], rowNumber, errors) === true) {
    setValue(record.images.primary, 'rightsStatus', 'approved', changed, 'images.primary.rightsStatus');
  }

  const imageApproved = readBoolean(row, ['primary_image_kiosk_approved', 'image_kiosk_approved', 'approve_primary_image_for_kiosk'], rowNumber, errors);
  if (imageApproved !== undefined) {
    if (imageApproved && !canApproveImage(record.images.primary, rowNumber, errors)) return [];
    setValue(record.images.primary, 'approvedForKiosk', imageApproved, changed, 'images.primary.approvedForKiosk');
  }

  const selectedVideos = selectVideos(record, row, rowNumber, errors);
  if (selectedVideos.length > 0) {
    selectedVideos.forEach(({ video, label }) => applyVideoRow(video, row, rowNumber, errors, changed, label, selectedVideos.length));
  }

  applyList(row, ['media_notes', 'notes'], record, 'notes', changed, clearEmpty, 'notes');

  return before === JSON.stringify(record) ? [] : changed;
}

function applyVideoRow(video, row, rowNumber, errors, changed, label, selectionSize) {
  const hasPathEdits = hasAnyCell(row, [
    'video_source_url',
    'youtube_video_id',
    'video_file_path',
    'video_runtime_path',
    'video_poster_file_path',
    'video_poster_runtime_path',
    'caption_file_path',
    'caption_runtime_path',
    'transcript_file_path',
    'transcript_runtime_path',
    'video_checksum_sha256',
    'duration_seconds',
    'codec',
  ]);

  if (selectionSize > 1 && hasPathEdits) {
    errors.push(`Row ${rowNumber}: video_index is required when editing video file/path fields for a profile with multiple videos.`);
    return;
  }

  applyString(row, ['video_source_url'], video, 'sourceUrl', changed, clearEmpty, `${label}.sourceUrl`);
  applyString(row, ['youtube_video_id'], video, 'youtubeVideoId', changed, clearEmpty, `${label}.youtubeVideoId`);
  applyString(row, ['video_file_path'], video, 'filePath', changed, clearEmpty, `${label}.filePath`);
  applyString(row, ['video_runtime_path'], video, 'runtimePath', changed, clearEmpty, `${label}.runtimePath`);
  applyString(row, ['video_poster_file_path', 'poster_file_path'], video, 'posterFilePath', changed, clearEmpty, `${label}.posterFilePath`);
  applyString(row, ['video_poster_runtime_path', 'poster_runtime_path'], video, 'posterRuntimePath', changed, clearEmpty, `${label}.posterRuntimePath`);
  applyString(row, ['caption_file_path'], video, 'captionFilePath', changed, clearEmpty, `${label}.captionFilePath`);
  applyString(row, ['caption_runtime_path'], video, 'captionRuntimePath', changed, clearEmpty, `${label}.captionRuntimePath`);
  applyString(row, ['transcript_file_path'], video, 'transcriptFilePath', changed, clearEmpty, `${label}.transcriptFilePath`);
  applyString(row, ['transcript_runtime_path'], video, 'transcriptRuntimePath', changed, clearEmpty, `${label}.transcriptRuntimePath`);
  applyString(row, ['video_checksum_sha256'], video, 'checksumSha256', changed, clearEmpty, `${label}.checksumSha256`);
  applyNullableNumber(row, ['duration_seconds'], video, 'durationSeconds', changed, rowNumber, errors, clearEmpty, `${label}.durationSeconds`);
  applyString(row, ['codec'], video, 'codec', changed, clearEmpty, `${label}.codec`);
  applyString(row, ['video_rights_status'], video, 'rightsStatus', changed, clearEmpty, `${label}.rightsStatus`);
  applyString(row, ['caption_status'], video, 'captionStatus', changed, clearEmpty, `${label}.captionStatus`);
  applyString(row, ['transcript_status'], video, 'transcriptStatus', changed, clearEmpty, `${label}.transcriptStatus`);
  applyString(row, ['audio_description_status'], video, 'audioDescriptionStatus', changed, clearEmpty, `${label}.audioDescriptionStatus`);

  if (readBoolean(row, ['video_rights_approved', 'approve_video_rights'], rowNumber, errors) === true) {
    setValue(video, 'rightsStatus', 'approved', changed, `${label}.rightsStatus`);
  }
  if (readBoolean(row, ['captions_approved', 'approve_captions'], rowNumber, errors) === true) {
    setValue(video, 'captionStatus', 'approved', changed, `${label}.captionStatus`);
  }
  if (readBoolean(row, ['transcript_approved', 'approve_transcript'], rowNumber, errors) === true) {
    setValue(video, 'transcriptStatus', 'approved', changed, `${label}.transcriptStatus`);
  }

  const videoApproved = readBoolean(row, ['video_kiosk_approved', 'all_videos_kiosk_approved', 'approve_video_for_kiosk'], rowNumber, errors);
  if (videoApproved !== undefined) {
    if (videoApproved && !canApproveVideo(video, rowNumber, label, errors)) return;
    setValue(video, 'approvedForKiosk', videoApproved, changed, `${label}.approvedForKiosk`);
  }

  const publicWebApproved = readBoolean(row, ['video_public_web_approved', 'approve_video_for_public_web'], rowNumber, errors);
  if (publicWebApproved !== undefined) {
    if (publicWebApproved && !canApproveVideo(video, rowNumber, label, errors, 'approvedForPublicWeb')) return;
    setValue(video, 'approvedForPublicWeb', publicWebApproved, changed, `${label}.approvedForPublicWeb`);
  }
}

function selectVideos(record, row, rowNumber, errors) {
  const videos = Array.isArray(record.videos) ? record.videos : [];
  const rawIndex = getCell(row, ['video_index']);
  const hasVideoFields = hasAnyCell(row, [
    'video_source_url',
    'youtube_video_id',
    'video_file_path',
    'video_runtime_path',
    'video_poster_file_path',
    'video_poster_runtime_path',
    'caption_file_path',
    'caption_runtime_path',
    'transcript_file_path',
    'transcript_runtime_path',
    'video_checksum_sha256',
    'duration_seconds',
    'codec',
    'video_rights_status',
    'video_rights_approved',
    'approve_video_rights',
    'caption_status',
    'captions_approved',
    'approve_captions',
    'transcript_status',
    'transcript_approved',
    'approve_transcript',
    'audio_description_status',
    'video_kiosk_approved',
    'all_videos_kiosk_approved',
    'approve_video_for_kiosk',
    'video_public_web_approved',
    'approve_video_for_public_web',
  ]);

  if (!hasVideoFields || videos.length === 0) return [];
  if (!rawIndex || rawIndex.toLowerCase() === 'all') {
    return videos.map((video, index) => ({ video, label: `videos[${index}]` }));
  }

  const index = Number(rawIndex);
  if (!Number.isInteger(index) || index < 1 || index > videos.length) {
    errors.push(`Row ${rowNumber}: video_index must be a 1-based index from 1 to ${videos.length}, or blank/all.`);
    return [];
  }

  return [{ video: videos[index - 1], label: `videos[${index - 1}]` }];
}

function canApproveImage(image, rowNumber, errors) {
  const missing = [];
  if (image.rightsStatus !== 'approved') missing.push('rightsStatus approved');
  if (!image.filePath) missing.push('filePath');
  if (!image.runtimePath) missing.push('runtimePath');
  if (image.filePath && !existsSync(resolve(image.filePath))) missing.push(`existing file ${image.filePath}`);
  if (missing.length > 0) {
    errors.push(`Row ${rowNumber}: primary_image_kiosk_approved requires ${missing.join(', ')}.`);
    return false;
  }
  return true;
}

function canApproveVideo(video, rowNumber, label, errors, approvalField = 'approvedForKiosk') {
  const required = [
    ['rightsStatus', 'approved'],
    ['captionStatus', 'approved'],
    ['transcriptStatus', 'approved'],
  ];
  const requiredPaths = [
    ['filePath', 'video file'],
    ['runtimePath', 'video runtimePath'],
    ['posterFilePath', 'poster file'],
    ['posterRuntimePath', 'poster runtimePath'],
    ['captionFilePath', 'caption file'],
    ['captionRuntimePath', 'caption runtimePath'],
    ['transcriptFilePath', 'transcript file'],
    ['transcriptRuntimePath', 'transcript runtimePath'],
  ];
  const missing = [];

  required.forEach(([key, value]) => {
    if (video[key] !== value) missing.push(`${key} ${value}`);
  });
  requiredPaths.forEach(([key, labelText]) => {
    if (!video[key]) missing.push(labelText);
    else if (key.toLowerCase().endsWith('filepath') && !existsSync(resolve(video[key]))) missing.push(`existing ${labelText} ${video[key]}`);
  });

  if (missing.length > 0) {
    errors.push(`Row ${rowNumber}: ${label}.${approvalField} requires ${missing.join(', ')}.`);
    return false;
  }
  return true;
}

function validateManifest(manifestData, expectedIds) {
  const errors = [];
  const warnings = [];
  const assets = manifestData?.assets;

  if (typeof manifestData?.schemaVersion !== 'number') warnings.push('Missing numeric schemaVersion.');
  if (!assets || typeof assets !== 'object' || Array.isArray(assets)) {
    errors.push('Media manifest must contain an assets object.');
    return { errors, warnings };
  }

  expectedIds.forEach((id) => {
    const record = assets[id];
    if (!record) {
      errors.push(`${id}: missing media manifest record.`);
      return;
    }
    if (!record.images?.primary || typeof record.images.primary !== 'object') errors.push(`${id}: images.primary must be an object.`);
    else validateImage(record.images.primary, `${id}: images.primary`, errors, warnings);
    if (!Array.isArray(record.images?.gallery)) errors.push(`${id}: images.gallery must be an array.`);
    else record.images.gallery.forEach((asset, index) => validateImage(asset, `${id}: images.gallery[${index}]`, errors, warnings));
    if (!Array.isArray(record.videos)) errors.push(`${id}: videos must be an array.`);
    else record.videos.forEach((asset, index) => validateVideo(asset, `${id}: videos[${index}]`, errors, warnings));
  });

  Object.keys(assets).forEach((id) => {
    if (!expectedIds.includes(id)) warnings.push(`${id}: media manifest contains unknown inductee id.`);
  });

  return { errors, warnings };
}

function validateImage(asset, label, errors, warnings) {
  checkString(asset, label, 'sourceUrl', errors);
  checkString(asset, label, 'filePath', errors);
  checkString(asset, label, 'runtimePath', errors);
  checkString(asset, label, 'checksumSha256', errors);
  checkNullableNumber(asset, label, 'width', errors);
  checkNullableNumber(asset, label, 'height', errors);
  checkString(asset, label, 'altText', errors);
  checkBoolean(asset, label, 'primary', errors);
  checkString(asset, label, 'rightsStatus', errors);
  checkBoolean(asset, label, 'approvedForKiosk', errors);
  validatePaths(asset, label, ['filePath'], ['runtimePath'], errors, warnings);
  if (asset.approvedForKiosk) canApproveImage(asset, label, errors);
}

function validateVideo(asset, label, errors, warnings) {
  [
    'sourceUrl',
    'youtubeVideoId',
    'filePath',
    'runtimePath',
    'posterFilePath',
    'posterRuntimePath',
    'captionFilePath',
    'captionRuntimePath',
    'transcriptFilePath',
    'transcriptRuntimePath',
    'checksumSha256',
    'codec',
    'rightsStatus',
    'captionStatus',
    'transcriptStatus',
    'audioDescriptionStatus',
  ].forEach((key) => checkString(asset, label, key, errors));
  checkNullableNumber(asset, label, 'durationSeconds', errors);
  checkBoolean(asset, label, 'approvedForKiosk', errors);
  checkBoolean(asset, label, 'approvedForPublicWeb', errors);
  validatePaths(
    asset,
    label,
    ['filePath', 'posterFilePath', 'captionFilePath', 'transcriptFilePath'],
    ['runtimePath', 'posterRuntimePath', 'captionRuntimePath', 'transcriptRuntimePath'],
    errors,
    warnings,
  );
  if (asset.approvedForKiosk) canApproveVideo(asset, label, label, errors);
  if (asset.approvedForPublicWeb) canApproveVideo(asset, label, label, errors, 'approvedForPublicWeb');
}

function validatePaths(asset, label, fileKeys, runtimeKeys, errors, warnings) {
  fileKeys.forEach((key) => {
    const path = asset[key];
    if (!path) return;
    if (path.startsWith('/') || path.includes('..')) {
      errors.push(`${label}: ${key} must be a repo-relative path without traversal.`);
      return;
    }
    if (!path.startsWith('public/media/')) warnings.push(`${label}: ${key} should usually live under public/media/.`);
    if (!existsSync(resolve(path))) warnings.push(`${label}: ${key} does not exist yet: ${path}`);
  });

  runtimeKeys.forEach((key) => {
    const path = asset[key];
    if (!path) return;
    if (!path.startsWith('/')) errors.push(`${label}: ${key} must start with /.`);
    if (!path.startsWith('/media/')) warnings.push(`${label}: ${key} should usually start with /media/.`);
  });
}

function readRows(path) {
  const csvRows = parseCsv(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  const headers = csvRows.shift()?.map(normalizeHeader) ?? [];
  return csvRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

function applyString(row, keys, target, prop, changed, shouldClear, label = prop) {
  const value = getCell(row, keys);
  if (value === undefined || (value === '' && !shouldClear)) return;
  setValue(target, prop, value, changed, label);
}

function applyList(row, keys, target, prop, changed, shouldClear, label = prop) {
  const value = getCell(row, keys);
  if (value === undefined || (value === '' && !shouldClear)) return;
  setValue(target, prop, parseList(value), changed, label);
}

function applyNullableNumber(row, keys, target, prop, changed, rowNumber, errors, shouldClear, label = prop) {
  const value = getCell(row, keys);
  if (value === undefined || (value === '' && !shouldClear)) return;
  if (value === '') {
    setValue(target, prop, null, changed, label);
    return;
  }
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

function checkString(record, label, path, errors) {
  const value = record[path];
  if (value !== undefined && typeof value !== 'string') errors.push(`${label}: ${path} must be a string.`);
}

function checkBoolean(record, label, path, errors) {
  const value = record[path];
  if (value !== undefined && typeof value !== 'boolean') errors.push(`${label}: ${path} must be a boolean.`);
}

function checkNullableNumber(record, label, path, errors) {
  const value = record[path];
  if (value !== undefined && value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
    errors.push(`${label}: ${path} must be a finite number or null.`);
  }
}

function getCell(row, keys) {
  for (const key of keys) {
    if (Object.hasOwn(row, key)) return String(row[key] ?? '').trim();
  }
  return undefined;
}

function hasAnyCell(row, keys) {
  return keys.some((key) => {
    const value = getCell(row, [key]);
    return value !== undefined && value !== '';
  });
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
    else if (value === '--clear-empty') parsed.clearEmpty = true;
    else if (value === '--no-backup') parsed.noBackup = true;
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
  npm run media:apply -- --input=/path/to/edited-media-review.csv --dry-run
  npm run media:apply -- --input=/path/to/edited-media-review.csv

Supported editable columns include:
  image_rights_approved, primary_image_kiosk_approved,
  primary_image_file_path, primary_image_runtime_path,
  primary_image_alt_text, video_index, video_file_path, video_runtime_path,
  video_poster_file_path, video_poster_runtime_path,
  caption_file_path, caption_runtime_path, transcript_file_path,
  transcript_runtime_path, video_rights_approved, captions_approved,
  transcript_approved, video_kiosk_approved, media_notes

Use a blank video_index or "all" for status approvals across every video.
Use a 1-based video_index when editing video file/path fields on profiles with multiple videos.
`);
}
