#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, dirname, resolve } from 'node:path';
import {
  CANONICAL_CAPTION_SUFFIXES,
  POSTER_EXTENSIONS,
  canonicalVideoPaths as canonicalPaths,
  createLocalFileReference,
  displayPath,
  firstExistingPath as chooseFirstExisting,
  indexFilesByYoutubeId,
  pathExists as existsAfterMaterialize,
  resolveRepoPath,
  runtimePathFor,
  scanMediaFiles,
  suffixAfterYoutubeId,
} from './media-utils.js';

const DEFAULT_SCAN_ROOTS = ['public/media/videos', 'public/videos'];

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const repoRoot = process.cwd();
const manifestPath = resolve(repoRoot, args.manifest ?? 'data/media_manifest.json');
const reportPath = resolve(repoRoot, args.report ?? 'artifacts/video-manifest-normalization-report.json');
const scanRoots = [...new Set([...DEFAULT_SCAN_ROOTS, ...args.scanRoots])].map((scanRoot) => resolveRepoPath(scanRoot));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const mediaFiles = scanMediaFiles(scanRoots);
const youtubeIds = collectYoutubeIds(manifest);
const filesByYoutubeId = indexFilesByYoutubeId(mediaFiles, youtubeIds);
const report = normalizeManifest(manifest, filesByYoutubeId);

if (args.execute) {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
printSummary(report);

function normalizeManifest(manifestData, filesById) {
  const records = [];
  const summary = {
    videoItems: 0,
    videoItemsWithYoutubeId: 0,
    channelOrNonVideoRecords: 0,
    canonicalAlready: 0,
    canonicalizedRecords: 0,
    missingLocalFiles: 0,
    postersFound: 0,
    captionsFound: 0,
    checksumsAdded: 0,
    ffprobeMetadataAdded: 0,
    materializedFiles: 0,
    plannedMaterializedFiles: 0,
    errors: 0,
  };

  for (const [personId, mediaRecord] of Object.entries(manifestData.assets ?? {})) {
    (mediaRecord.videos ?? []).forEach((asset, index) => {
      summary.videoItems += 1;

      const record = {
        personId,
        personName: mediaRecord.name || '',
        index,
        youtubeVideoId: asset.youtubeVideoId || '',
        sourceUrl: asset.sourceUrl || '',
        before: snapshotAsset(asset),
        after: null,
        action: 'unchanged',
        materializedFiles: [],
        errors: [],
      };

      if (!asset.youtubeVideoId) {
        summary.channelOrNonVideoRecords += 1;
        record.action = 'needs-specific-video-url';
        record.after = snapshotAsset(asset);
        records.push(record);
        return;
      }

      summary.videoItemsWithYoutubeId += 1;
      const canonical = canonicalPaths(personId, asset.youtubeVideoId);
      const localFiles = filesById.get(asset.youtubeVideoId) ?? [];
      const sourceVideo = chooseVideoSource(localFiles, canonical.videoFilePath);

      const materialized = materializeCompanions(asset.youtubeVideoId, canonical, localFiles, sourceVideo);
      record.materializedFiles = materialized.files;
      record.errors.push(...materialized.errors);

      const canonicalVideoExists = existsAfterMaterialize(canonical.videoFilePath);
      if (!sourceVideo && !canonicalVideoExists) {
        summary.missingLocalFiles += 1;
        record.action = 'missing-local-video';
        record.after = snapshotAsset(asset);
        records.push(record);
        return;
      }

      const beforeJson = JSON.stringify(snapshotAsset(asset));
      asset.filePath = canonical.videoFilePath;
      asset.runtimePath = runtimePathFor(canonical.videoFilePath);

      const poster = chooseFirstExisting(canonical.stemPath, POSTER_EXTENSIONS);
      if (poster) {
        asset.posterFilePath = poster;
        asset.posterRuntimePath = runtimePathFor(poster);
        summary.postersFound += 1;
      }

      const caption = chooseFirstExisting(canonical.stemPath, CANONICAL_CAPTION_SUFFIXES);
      if (caption) {
        asset.captionFilePath = caption;
        asset.captionRuntimePath = runtimePathFor(caption);
        if (asset.captionStatus === 'needed') asset.captionStatus = 'needs-review';
        summary.captionsFound += 1;
      }

      const checksum = sha256IfExists(canonical.videoFilePath);
      if (checksum && asset.checksumSha256 !== checksum) {
        asset.checksumSha256 = checksum;
        summary.checksumsAdded += 1;
      }

      const metadata = readVideoMetadata(canonical.videoFilePath);
      if (metadata.durationSeconds !== null && asset.durationSeconds !== metadata.durationSeconds) {
        asset.durationSeconds = metadata.durationSeconds;
        summary.ffprobeMetadataAdded += 1;
      }
      if (metadata.codec && asset.codec !== metadata.codec) {
        asset.codec = metadata.codec;
        summary.ffprobeMetadataAdded += 1;
      }

      const afterJson = JSON.stringify(snapshotAsset(asset));
      const startedCanonical = record.before.filePath === canonical.videoFilePath && record.before.runtimePath === runtimePathFor(canonical.videoFilePath);
      if (startedCanonical && beforeJson === afterJson && materialized.files.length === 0) {
        summary.canonicalAlready += 1;
        record.action = 'already-canonical';
      } else {
        summary.canonicalizedRecords += 1;
        record.action = args.execute ? 'canonicalized' : 'would-canonicalize';
      }

      summary.materializedFiles += args.execute ? materialized.files.length : 0;
      summary.plannedMaterializedFiles += args.execute ? 0 : materialized.files.length;
      summary.errors += record.errors.length;
      record.after = snapshotAsset(asset);
      records.push(record);
    });
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    dryRun: !args.execute,
    manifestPath: displayPath(manifestPath),
    scannedRoots: scanRoots.map(displayPath),
    linkMode: args.linkMode,
    summary,
    records,
  };
}

function materializeCompanions(youtubeVideoId, canonical, localFiles, sourceVideo) {
  const result = { files: [], errors: [] };
  if (!sourceVideo) return result;

  const sourceDirectory = dirname(sourceVideo.absPath);
  const plannedTargets = new Set();
  const candidates = localFiles
    .filter((file) => dirname(file.absPath) === sourceDirectory && basename(file.absPath).includes(youtubeVideoId))
    .sort((left, right) => {
      if (left.absPath === sourceVideo.absPath) return -1;
      if (right.absPath === sourceVideo.absPath) return 1;
      return left.relativePath.localeCompare(right.relativePath);
    });

  candidates.forEach((sourceFile) => {
    const suffix = suffixAfterYoutubeId(sourceFile, youtubeVideoId);
    if (!suffix) return;

    const targetPath = `${canonical.stemPath}${suffix}`;
    if (sourceFile.absPath === resolveRepoPath(targetPath)) return;
    if (existsSync(resolveRepoPath(targetPath))) return;
    if (plannedTargets.has(targetPath)) return;
    plannedTargets.add(targetPath);

    const materializedFile = {
      sourceFilePath: sourceFile.relativePath,
      targetFilePath: targetPath,
      size: sourceFile.size,
      kind: sourceFile.kind,
    };

    if (!args.execute || args.linkMode === 'none') {
      result.files.push(materializedFile);
      return;
    }

    try {
      mkdirSync(dirname(resolveRepoPath(targetPath)), { recursive: true });
      createLocalFileReference(sourceFile.absPath, resolveRepoPath(targetPath), args.linkMode);
      result.files.push(materializedFile);
    } catch (error) {
      result.errors.push(`${sourceFile.relativePath} -> ${targetPath}: ${error.message}`);
    }
  });

  return result;
}

function chooseVideoSource(localFiles, canonicalVideoFilePath) {
  const canonicalAbsPath = resolveRepoPath(canonicalVideoFilePath);
  return localFiles
    .filter((file) => file.kind === 'video')
    .sort((left, right) => {
      if (left.absPath === canonicalAbsPath) return -1;
      if (right.absPath === canonicalAbsPath) return 1;
      if (left.relativePath.startsWith('public/media/videos/') && !right.relativePath.startsWith('public/media/videos/')) return -1;
      if (right.relativePath.startsWith('public/media/videos/') && !left.relativePath.startsWith('public/media/videos/')) return 1;
      return right.size - left.size;
    })[0] ?? null;
}

function collectYoutubeIds(manifestData) {
  return Array.from(new Set(Object.values(manifestData.assets ?? {})
    .flatMap((record) => record.videos ?? [])
    .map((video) => video.youtubeVideoId)
    .filter(Boolean)));
}


function sha256IfExists(path) {
  const absolutePath = resolveRepoPath(path);
  if (!existsSync(absolutePath)) return '';
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

function readVideoMetadata(path) {
  const fallback = { durationSeconds: null, codec: '' };
  if (args.noFfprobe || !existsSync(resolveRepoPath(path))) return fallback;

  const result = spawnSync(args.ffprobeBin ?? 'ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,duration',
    '-of', 'json',
    resolveRepoPath(path),
  ], { encoding: 'utf8' });

  if (result.status !== 0 || !result.stdout) return fallback;

  try {
    const payload = JSON.parse(result.stdout);
    const stream = payload.streams?.[0] ?? {};
    const duration = Number(stream.duration);
    return {
      durationSeconds: Number.isFinite(duration) ? Math.round(duration) : null,
      codec: stream.codec_name || '',
    };
  } catch {
    return fallback;
  }
}

function snapshotAsset(asset) {
  return {
    sourceUrl: asset.sourceUrl || '',
    youtubeVideoId: asset.youtubeVideoId || '',
    filePath: asset.filePath || '',
    runtimePath: asset.runtimePath || '',
    posterFilePath: asset.posterFilePath || '',
    posterRuntimePath: asset.posterRuntimePath || '',
    captionFilePath: asset.captionFilePath || '',
    captionRuntimePath: asset.captionRuntimePath || '',
    transcriptFilePath: asset.transcriptFilePath || '',
    transcriptRuntimePath: asset.transcriptRuntimePath || '',
    checksumSha256: asset.checksumSha256 || '',
    durationSeconds: asset.durationSeconds ?? null,
    codec: asset.codec || '',
    rightsStatus: asset.rightsStatus || '',
    captionStatus: asset.captionStatus || '',
    transcriptStatus: asset.transcriptStatus || '',
    audioDescriptionStatus: asset.audioDescriptionStatus || '',
    approvedForKiosk: Boolean(asset.approvedForKiosk),
  };
}

function parseArgs(values) {
  const parsed = {
    execute: false,
    help: false,
    linkMode: 'hardlink',
    noFfprobe: false,
    scanRoots: [],
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const [key, inlineValue] = value.includes('=') ? value.split(/=(.*)/s, 2) : [value, undefined];

    if (value === '--execute') parsed.execute = true;
    else if (value === '--help' || value === '-h') parsed.help = true;
    else if (value === '--no-ffprobe') parsed.noFfprobe = true;
    else if (key === '--ffprobe-bin') parsed.ffprobeBin = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--link-mode') parsed.linkMode = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--manifest') parsed.manifest = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--report') parsed.report = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--scan-root') parsed.scanRoots.push(readValue(values, inlineValue, () => { index += 1; return values[index]; }));
    else throw new Error(`Unknown argument: ${value}`);
  }

  if (!['copy', 'hardlink', 'none', 'symlink'].includes(parsed.linkMode)) {
    throw new Error('--link-mode must be one of: hardlink, copy, symlink, none');
  }

  return parsed;
}

function readValue(values, inlineValue, nextValue) {
  const value = inlineValue ?? nextValue();
  if (!value) throw new Error(`Missing value in ${values.join(' ')}`);
  return value;
}

function printSummary(report) {
  const verb = report.dryRun ? 'Dry run' : 'Executed';
  console.log(`${verb} video manifest normalization.`);
  console.log(`Video items: ${report.summary.videoItems}; with YouTube IDs: ${report.summary.videoItemsWithYoutubeId}.`);
  console.log(`Canonicalized records: ${report.summary.canonicalizedRecords}; already canonical: ${report.summary.canonicalAlready}.`);
  console.log(`Posters found: ${report.summary.postersFound}; captions found: ${report.summary.captionsFound}.`);
  console.log(`Checksums updated: ${report.summary.checksumsAdded}; ffprobe metadata updates: ${report.summary.ffprobeMetadataAdded}.`);
  console.log(`Materialized files: ${report.dryRun ? report.summary.plannedMaterializedFiles : report.summary.materializedFiles}.`);
  console.log(`Missing local videos: ${report.summary.missingLocalFiles}; channel/non-video records: ${report.summary.channelOrNonVideoRecords}.`);
  console.log(`Report: ${displayPath(reportPath)}`);
}

function printHelp() {
  console.log(`
Usage:
  node scripts/normalize-video-manifest-paths.js
  node scripts/normalize-video-manifest-paths.js --execute

What it does:
  Normalizes manifest video file paths into public/media/videos/<profile-id>/,
  materializes local hardlinks for files found elsewhere, and fills local poster,
  caption, checksum, duration, and codec metadata when available.

Options:
  --execute                 Write data/media_manifest.json and materialize files.
  --link-mode=hardlink|copy|symlink|none
  --manifest=<path>
  --report=<path>
  --scan-root=<path>        Add another folder to scan.
  --no-ffprobe              Skip duration/codec detection.
`);
}
