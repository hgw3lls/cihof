#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import {
  addFilesToIndex,
  compareByRelativePath,
  createLocalFileReference,
  defaultVideoOutputPath,
  describeMediaFile,
  displayPath,
  indexFilesByYoutubeId,
  resolveRepoPath,
  scanMediaFiles as scanMediaFilesBase,
  stripExtension,
  suffixAfterYoutubeId,
  youtubeWatchUrl,
} from './media-utils.js';

const DEFAULT_SCAN_ROOTS = ['public/videos', 'public/media/videos'];
const BUILD_SCAN_ROOTS = ['dist/videos', 'dist/media/videos', 'dist-portal/videos', 'dist-portal/media/videos'];
const DEFAULT_FORMAT = 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*[height<=720]+ba/b[height<=720]/best[height<=720]/best';
const MEDIA_SCAN_OPTIONS = { sidecarsAsSingleKind: true };

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const repoRoot = process.cwd();
const planPath = resolve(repoRoot, args.plan ?? 'data/media-acquisition/youtube-download-plan.json');
const reportPath = resolve(repoRoot, args.report ?? 'artifacts/video-file-sync-report.json');
const csvPath = args.csv === false ? '' : resolve(repoRoot, args.csv ?? 'artifacts/video-file-sync-report.csv');
const scanRoots = buildScanRoots(args);
const records = loadRecords(planPath, args);
const youtubeIds = Array.from(new Set(records.map((record) => record.youtubeVideoId))).sort();
const scannedFiles = scanMediaFiles(scanRoots);
const filesByYoutubeId = indexFilesByYoutubeId(scannedFiles, youtubeIds);
const results = [];

for (const record of records) {
  const result = processRecord(record, filesByYoutubeId);
  results.push(result);
  if (args.limit && results.length >= args.limit) break;
}

const report = buildReport(results, records, scanRoots, scannedFiles);
writeReport(report, reportPath, csvPath);
printSummary(report);

function processRecord(record, filesById) {
  const expected = describeExpectedFiles(record);
  const localFiles = filesById.get(record.youtubeVideoId) ?? [];
  const alternateVideo = chooseAlternateVideo(record, expected, localFiles);
  const canDownload = args.download && (record.rightsConfirmed || args.allowUnconfirmedRights);
  const result = {
    personId: record.personId,
    personName: record.personName,
    youtubeVideoId: record.youtubeVideoId,
    sourceUrl: record.sourceUrl || youtubeWatchUrl(record.youtubeVideoId),
    rightsConfirmed: Boolean(record.rightsConfirmed),
    expectedFilePath: displayPath(expected.videoPath),
    expectedVideoExists: Boolean(expected.video),
    expectedSidecars: expected.sidecars.map(toReportFile),
    alternateVideoFiles: localFiles
      .filter((file) => file.kind === 'video' && (!expected.video || file.absPath !== expected.video.absPath))
      .sort(compareCandidate(record, expected))
      .slice(0, 8)
      .map(toReportFile),
    alternateSidecars: localFiles
      .filter((file) => file.kind === 'sidecar' && !isExpectedCompanion(expected, file))
      .sort(compareByRelativePath)
      .slice(0, 12)
      .map(toReportFile),
    action: 'present',
    materializedFiles: [],
    downloadedFiles: [],
    errors: [],
  };

  if (expected.video) {
    return result;
  }

  if (alternateVideo) {
    result.action = args.execute && args.linkMode !== 'none' ? 'materialized-from-alternate' : 'would-materialize-from-alternate';
    result.sourceFilePath = displayPath(alternateVideo.absPath);
    const materialized = materializeCompanions(record, expected, alternateVideo, localFiles, filesById);
    result.materializedFiles = materialized.created.map(toReportFile);
    result.skippedExistingFiles = materialized.existing.map(toReportFile);
    result.errors.push(...materialized.errors);
    return result;
  }

  if (!args.download) {
    result.action = 'missing-no-download';
    return result;
  }

  if (!canDownload) {
    result.action = 'missing-rights-unconfirmed';
    return result;
  }

  if (!args.execute) {
    result.action = 'would-download';
    return result;
  }

  const downloadResult = downloadRecord(record, expected);
  result.action = downloadResult.ok ? 'downloaded' : 'download-failed';
  result.downloadedFiles = downloadResult.files.map(toReportFile);
  result.errors.push(...downloadResult.errors);
  addFilesToIndex(filesById, record.youtubeVideoId, downloadResult.files);
  return result;
}

function describeExpectedFiles(record) {
  const videoPath = resolveRepoPath(record.outputFilePath || defaultVideoOutputPath(record.personId, record.youtubeVideoId));
  const files = findCompanionFiles(videoPath);
  return {
    videoPath,
    video: files.find((file) => file.kind === 'video') ?? null,
    sidecars: files.filter((file) => file.kind === 'sidecar'),
    stemPath: stripExtension(videoPath),
    stemName: basename(stripExtension(videoPath)),
  };
}

function findCompanionFiles(videoPath) {
  const directory = dirname(videoPath);
  if (!existsSync(directory)) return [];

  const stemName = basename(stripExtension(videoPath));
  return readdirSync(directory)
    .filter((fileName) => fileName === basename(videoPath) || fileName.startsWith(`${stemName}.`))
    .map((fileName) => describeFile(join(directory, fileName)))
    .filter(Boolean);
}

function chooseAlternateVideo(record, expected, localFiles) {
  return localFiles
    .filter((file) => file.kind === 'video')
    .filter((file) => !expected.video || file.absPath !== expected.video.absPath)
    .filter((file) => file.absPath !== expected.videoPath)
    .sort(compareCandidate(record, expected))[0] ?? null;
}

function compareCandidate(record, expected) {
  return (left, right) => {
    const scoreDelta = candidateScore(left, record, expected) - candidateScore(right, record, expected);
    if (scoreDelta !== 0) return scoreDelta;
    const sizeDelta = right.size - left.size;
    if (sizeDelta !== 0) return sizeDelta;
    return left.relativePath.localeCompare(right.relativePath);
  };
}

function candidateScore(file, record, expected) {
  const fileBase = basename(stripExtension(file.absPath)).toLowerCase();
  const expectedStem = expected.stemName.toLowerCase();
  const relativePath = file.relativePath.toLowerCase();

  if (fileBase === expectedStem) return 0;
  if (fileBase.startsWith(`${expectedStem}.`)) return 1;
  if (relativePath.startsWith(`public/media/videos/${record.personId.toLowerCase()}/`)) return 2;
  if (relativePath.startsWith('public/videos/')) return 3;
  if (relativePath.startsWith('public/media/videos/')) return 4;
  if (relativePath.startsWith('dist/') || relativePath.startsWith('dist-portal/')) return 8;
  return 6;
}

function materializeCompanions(record, expected, alternateVideo, localFiles, filesById) {
  const sourceDirectory = dirname(alternateVideo.absPath);
  const companions = localFiles
    .filter((file) => file.absPath === alternateVideo.absPath || dirname(file.absPath) === sourceDirectory)
    .filter((file) => basename(file.absPath).includes(record.youtubeVideoId))
    .sort((left, right) => {
      if (left.absPath === alternateVideo.absPath) return -1;
      if (right.absPath === alternateVideo.absPath) return 1;
      return left.relativePath.localeCompare(right.relativePath);
    });

  const created = [];
  const existing = [];
  const errors = [];

  companions.forEach((sourceFile) => {
    const suffix = suffixAfterYoutubeId(sourceFile, record.youtubeVideoId);
    if (!suffix) return;

    const targetPath = `${expected.stemPath}${suffix}`;
    if (sourceFile.absPath === targetPath) return;

    const targetFile = describeFile(targetPath);
    if (targetFile) {
      existing.push(targetFile);
      return;
    }

    const plannedFile = {
      ...sourceFile,
      absPath: targetPath,
      relativePath: displayPath(targetPath),
    };

    if (!args.execute || args.linkMode === 'none') {
      created.push(plannedFile);
      return;
    }

    try {
      mkdirSync(dirname(targetPath), { recursive: true });
      createLocalFileReference(sourceFile.absPath, targetPath, args.linkMode);
      const createdFile = describeFile(targetPath);
      if (createdFile) {
        created.push(createdFile);
        addFilesToIndex(filesById, record.youtubeVideoId, [createdFile]);
      }
    } catch (error) {
      errors.push(`${displayPath(sourceFile.absPath)} -> ${displayPath(targetPath)}: ${error.message}`);
    }
  });

  return { created, existing, errors };
}

function isExpectedCompanion(expected, file) {
  return file.absPath.startsWith(`${expected.stemPath}.`);
}

function downloadRecord(record, expected) {
  const errors = [];
  mkdirSync(dirname(expected.videoPath), { recursive: true });

  const outputTemplate = `${expected.stemPath}.%(ext)s`;
  const ytDlpArgs = [
    '--no-playlist',
    '--continue',
    '--no-overwrites',
    '--merge-output-format', 'mp4',
    '--format', args.format ?? DEFAULT_FORMAT,
    '--write-subs',
    '--write-auto-subs',
    '--sub-langs', args.subLangs ?? 'en.*',
    '--write-thumbnail',
    '--convert-thumbnails', 'webp',
    '--output', outputTemplate,
    youtubeWatchUrl(record.youtubeVideoId),
  ];

  const result = spawnSync(args.ytDlpBin ?? 'yt-dlp', ytDlpArgs, { stdio: 'inherit' });
  if (result.error) errors.push(result.error.message);
  if (result.status !== 0) errors.push(`yt-dlp exited with status ${result.status}`);

  const files = findCompanionFiles(expected.videoPath);
  return {
    ok: errors.length === 0 && files.some((file) => file.kind === 'video'),
    files,
    errors,
  };
}

function scanMediaFiles(scanRootPaths) {
  return scanMediaFilesBase(scanRootPaths, MEDIA_SCAN_OPTIONS);
}

function describeFile(path) {
  return describeMediaFile(path, MEDIA_SCAN_OPTIONS);
}

function buildReport(results, sourceRecords, scanRootPaths, scannedMediaFiles) {
  const counts = countActions(results);
  const recordsWithAlternate = results.filter((result) => result.alternateVideoFiles.length > 0).length;
  const expectedPresent = results.filter((result) => result.expectedVideoExists).length;

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    dryRun: !args.execute,
    planPath: displayPath(planPath),
    scannedRoots: scanRootPaths.map((root) => root.displayPath),
    scannedMediaFiles: scannedMediaFiles.length,
    linkMode: args.linkMode,
    downloadEnabled: Boolean(args.download),
    allowUnconfirmedRights: Boolean(args.allowUnconfirmedRights),
    summary: {
      sourceRecords: sourceRecords.length,
      auditedRecords: results.length,
      uniqueYoutubeIds: new Set(results.map((result) => result.youtubeVideoId)).size,
      expectedPresent,
      foundInAlternateFolder: recordsWithAlternate,
      missingAfterFolderAudit: results.filter((result) => !result.expectedVideoExists && result.alternateVideoFiles.length === 0).length,
      ...counts,
    },
    records: results,
  };
}

function countActions(results) {
  return results.reduce((counts, result) => {
    counts[result.action] = (counts[result.action] ?? 0) + 1;
    counts.materializedFiles += result.materializedFiles.length;
    counts.downloadedFiles += result.downloadedFiles.length;
    counts.recordsWithErrors += result.errors.length > 0 ? 1 : 0;
    return counts;
  }, {
    present: 0,
    'would-materialize-from-alternate': 0,
    'materialized-from-alternate': 0,
    'missing-no-download': 0,
    'missing-rights-unconfirmed': 0,
    'would-download': 0,
    downloaded: 0,
    'download-failed': 0,
    materializedFiles: 0,
    downloadedFiles: 0,
    recordsWithErrors: 0,
  });
}

function writeReport(report, jsonOutputPath, csvOutputPath) {
  mkdirSync(dirname(jsonOutputPath), { recursive: true });
  writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`);

  if (!csvOutputPath) return;

  mkdirSync(dirname(csvOutputPath), { recursive: true });
  const rows = [
    [
      'personId',
      'personName',
      'youtubeVideoId',
      'action',
      'expectedVideoExists',
      'expectedFilePath',
      'sourceFilePath',
      'alternateVideoCount',
      'materializedFileCount',
      'downloadedFileCount',
      'errorCount',
    ],
    ...report.records.map((record) => [
      record.personId,
      record.personName,
      record.youtubeVideoId,
      record.action,
      record.expectedVideoExists ? 'yes' : 'no',
      record.expectedFilePath,
      record.sourceFilePath ?? '',
      String(record.alternateVideoFiles.length),
      String(record.materializedFiles.length),
      String(record.downloadedFiles.length),
      String(record.errors.length),
    ]),
  ];
  writeFileSync(csvOutputPath, `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`);
}

function printSummary(report) {
  const summary = report.summary;
  console.log(`${report.dryRun ? 'Dry run' : 'Executed'} video file sync.`);
  console.log(`Audited ${summary.auditedRecords} records (${summary.uniqueYoutubeIds} unique YouTube IDs).`);
  console.log(`Expected files present: ${summary.expectedPresent}.`);
  console.log(`Found in alternate folders: ${summary.foundInAlternateFolder}.`);
  console.log(`Missing after folder audit: ${summary.missingAfterFolderAudit}.`);

  if (report.dryRun) {
    console.log(`Would materialize from alternate folders: ${summary['would-materialize-from-alternate']}.`);
    console.log(`Would download: ${summary['would-download']}.`);
  } else {
    console.log(`Materialized from alternate folders: ${summary['materialized-from-alternate']} records / ${summary.materializedFiles} files.`);
    console.log(`Downloaded: ${summary.downloaded} records / ${summary.downloadedFiles} files.`);
    console.log(`Download failures: ${summary['download-failed']}.`);
  }

  if (summary['missing-rights-unconfirmed']) {
    console.log(`Skipped for unconfirmed rights: ${summary['missing-rights-unconfirmed']}. Pass --allow-unconfirmed-rights only after permissions are confirmed.`);
  }

  if (summary.recordsWithErrors) {
    console.log(`Records with errors: ${summary.recordsWithErrors}.`);
  }

  console.log(`Report: ${displayPath(reportPath)}`);
  if (csvPath) console.log(`CSV: ${displayPath(csvPath)}`);
}

function loadRecords(path, options) {
  const payload = JSON.parse(readFileSync(path, 'utf8'));
  const rawRecords = Array.isArray(payload) ? payload : payload.records ?? payload.downloads ?? payload.items ?? [];
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    throw new Error(`No video records found in ${displayPath(path)}.`);
  }

  return rawRecords
    .map((record) => ({
      personId: record.personId || 'unassigned',
      personName: record.personName || '',
      youtubeVideoId: record.youtubeVideoId,
      sourceUrl: record.sourceUrl || '',
      outputFilePath: record.outputFilePath || record.existingFilePath || defaultVideoOutputPath(record.personId || 'unassigned', record.youtubeVideoId),
      rightsConfirmed: Boolean(record.rightsConfirmed),
    }))
    .filter((record) => record.youtubeVideoId)
    .filter((record) => options.ids.size === 0 || options.ids.has(record.youtubeVideoId))
    .filter((record) => options.personIds.size === 0 || options.personIds.has(record.personId));
}

function buildScanRoots(options) {
  const roots = new Set(DEFAULT_SCAN_ROOTS);
  if (options.includeBuildOutput) BUILD_SCAN_ROOTS.forEach((root) => roots.add(root));
  options.scanRoots.forEach((root) => roots.add(root));

  return Array.from(roots).map((root) => ({
    displayPath: root,
    absPath: resolveRepoPath(root),
  }));
}

function toReportFile(file) {
  return {
    filePath: file.relativePath,
    extension: file.extension,
    kind: file.kind,
    size: file.size,
  };
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseArgs(values) {
  const parsed = {
    allowUnconfirmedRights: false,
    download: true,
    execute: false,
    help: false,
    ids: new Set(),
    includeBuildOutput: false,
    linkMode: 'hardlink',
    personIds: new Set(),
    scanRoots: [],
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const [key, inlineValue] = value.includes('=') ? value.split(/=(.*)/s, 2) : [value, undefined];

    if (value === '--allow-unconfirmed-rights') parsed.allowUnconfirmedRights = true;
    else if (value === '--execute') parsed.execute = true;
    else if (value === '--help' || value === '-h') parsed.help = true;
    else if (value === '--include-build-output') parsed.includeBuildOutput = true;
    else if (value === '--no-csv') parsed.csv = false;
    else if (value === '--no-download') parsed.download = false;
    else if (key === '--csv') parsed.csv = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--format') parsed.format = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--id') splitList(readValue(values, inlineValue, () => { index += 1; return values[index]; })).forEach((id) => parsed.ids.add(id));
    else if (key === '--limit') parsed.limit = Number(readValue(values, inlineValue, () => { index += 1; return values[index]; }));
    else if (key === '--link-mode') parsed.linkMode = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--person') splitList(readValue(values, inlineValue, () => { index += 1; return values[index]; })).forEach((personId) => parsed.personIds.add(personId));
    else if (key === '--plan') parsed.plan = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--report') parsed.report = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--scan-root') parsed.scanRoots.push(readValue(values, inlineValue, () => { index += 1; return values[index]; }));
    else if (key === '--sub-langs') parsed.subLangs = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--yt-dlp-bin') parsed.ytDlpBin = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else throw new Error(`Unknown argument: ${value}`);
  }

  if (!['copy', 'hardlink', 'none', 'symlink'].includes(parsed.linkMode)) {
    throw new Error('--link-mode must be one of: hardlink, copy, symlink, none');
  }

  if (parsed.limit !== undefined && (!Number.isInteger(parsed.limit) || parsed.limit <= 0)) {
    throw new Error('--limit must be a positive integer');
  }

  return parsed;
}

function readValue(values, inlineValue, nextValue) {
  const value = inlineValue ?? nextValue();
  if (!value) throw new Error(`Missing value for ${values}`);
  return value;
}

function splitList(value) {
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function printHelp() {
  console.log(`
Usage:
  npm run media:video-sync
  npm run media:video-sync -- --execute --no-download
  npm run media:video-sync -- --execute --allow-unconfirmed-rights

What it does:
  1. Reads data/media-acquisition/youtube-download-plan.json.
  2. Scans public/videos and public/media/videos for existing files.
  3. If the expected file is missing but the same YouTube ID exists elsewhere,
     it materializes the expected file by hardlinking by default.
  4. If no local file exists, --execute downloads it with yt-dlp.

Useful options:
  --execute                      Apply changes; otherwise this is a dry run.
  --no-download                  Only audit and materialize wrong-folder files.
  --allow-unconfirmed-rights     Permit downloads for records still marked rightsConfirmed=false.
  --id=<youtubeId[,youtubeId]>   Limit to specific YouTube IDs.
  --person=<personId[,personId]> Limit to specific profile IDs.
  --limit=<n>                    Process only the first n filtered records.
  --link-mode=hardlink|copy|symlink|none
  --include-build-output         Also scan dist and dist-portal for misplaced files.
  --report=<path>                JSON report path.
  --csv=<path>                   CSV report path.
`);
}
