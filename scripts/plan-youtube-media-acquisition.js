import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, dirname, extname, join, resolve } from 'node:path';
import {
  VIDEO_EXTENSIONS,
  defaultVideoOutputPath,
  displayPath,
  youtubeWatchUrl,
} from './media-utils.js';

const args = parseArgs(process.argv.slice(2));
const manifestPath = resolve(args.manifest ?? 'data/media_manifest.json');
const sourcePacketPath = resolve(args.sourcePacket ?? 'data/original-site-harvest/pre-curation/cihof-pre-curation-packet.json');
const outputPlanPath = resolve(args.output ?? 'data/media-acquisition/youtube-download-plan.json');
const outputCommandPath = resolve(args.commands ?? 'data/media-acquisition/youtube-download-commands.sh');
const rightsAllowlistPath = args.rightsAllowlist ? resolve(args.rightsAllowlist) : '';
const execute = Boolean(args.execute);
const rightsConfirmed = Boolean(args.rightsConfirmed);

const plan = buildPlan();
writePlan(plan);

console.log(`Wrote ${plan.records.length} YouTube media acquisition records to ${outputPlanPath}.`);
console.log(`Wrote reviewable command file to ${outputCommandPath}.`);
console.log(`${plan.summary.rightsConfirmed} records are rights-confirmed; ${plan.summary.needsRightsReview} remain review-only.`);

if (execute) {
  if (!rightsConfirmed) {
    throw new Error('Refusing to execute downloads without --rights-confirmed. Confirm rights in writing before running downloads.');
  }
  executeDownloads(plan.records.filter((record) => record.rightsConfirmed));
}

function buildPlan() {
  const manifest = readJson(manifestPath, { assets: {} });
  const sourcePacket = readJson(sourcePacketPath, { videoReviewDrafts: [] });
  const rightsAllowlist = readRightsAllowlist(rightsAllowlistPath);
  const recordsByKey = new Map();

  Object.entries(manifest.assets ?? {}).forEach(([personId, assetRecord]) => {
    (assetRecord.videos ?? []).forEach((video) => {
      if (!video.youtubeVideoId) return;
      upsertRecord(recordsByKey, {
        personId,
        personName: assetRecord.name || '',
        youtubeVideoId: video.youtubeVideoId,
        sourceUrl: video.sourceUrl || youtubeWatchUrl(video.youtubeVideoId),
        sourcePageUrl: '',
        assignment: 'media-manifest',
        status: video.rightsStatus || 'needs-review',
        captionStatus: video.captionStatus || 'needed',
        transcriptStatus: video.transcriptStatus || 'needed',
        existingFilePath: video.filePath || '',
        outputFilePath: video.filePath || defaultVideoOutputPath(personId, video.youtubeVideoId),
        provenance: ['data/media_manifest.json'],
      });
    });
  });

  (sourcePacket.videoReviewDrafts ?? []).forEach((video) => {
    if (!video.youtubeVideoId) return;
    const personId = video.inducteeId || 'unassigned';
    upsertRecord(recordsByKey, {
      personId,
      personName: video.inducteeName || '',
      youtubeVideoId: video.youtubeVideoId,
      sourceUrl: video.sourceUrl || youtubeWatchUrl(video.youtubeVideoId),
      sourcePageUrl: video.sourcePageUrl || '',
      assignment: video.assignment || 'source-review',
      status: video.rightsStatus || 'needs-rights-review',
      captionStatus: 'needed',
      transcriptStatus: 'needed',
      existingFilePath: '',
      outputFilePath: defaultVideoOutputPath(personId, video.youtubeVideoId),
      provenance: ['source-curation videoReviewDrafts'],
    });
  });

  const records = Array.from(recordsByKey.values())
    .map((record) => {
      const downloadedFiles = findDownloadedFiles(record.outputFilePath);
      const next = {
        ...record,
        rightsConfirmed: rightsAllowlist.has(record.youtubeVideoId) || rightsAllowlist.has(`${record.personId}:${record.youtubeVideoId}`),
        alreadyDownloaded: downloadedFiles.length > 0,
        downloadedFiles,
      };
      return {
        ...next,
        downloadCommand: buildDownloadCommand(next),
      };
    })
    .sort((a, b) => a.personId.localeCompare(b.personId) || a.youtubeVideoId.localeCompare(b.youtubeVideoId));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    guardrails: {
      rights: 'Do not download or publish YouTube media unless CIHOF has confirmed rights or permission for local archival/offline use.',
      captions: 'Caption and transcript files must be acquired or created before visitor-facing kiosk approval.',
      publication: 'This plan does not set approvedForKiosk. It is an acquisition checklist only.',
    },
    summary: {
      totalRecords: records.length,
      uniqueYoutubeIds: new Set(records.map((record) => record.youtubeVideoId)).size,
      rightsConfirmed: records.filter((record) => record.rightsConfirmed).length,
      needsRightsReview: records.filter((record) => !record.rightsConfirmed).length,
      alreadyDownloaded: records.filter((record) => record.alreadyDownloaded).length,
      manifestRecords: records.filter((record) => record.provenance.includes('data/media_manifest.json')).length,
      sourceReviewRecords: records.filter((record) => record.provenance.includes('source-curation videoReviewDrafts')).length,
    },
    records,
  };
}

function upsertRecord(recordsByKey, next) {
  const key = `${next.personId}:${next.youtubeVideoId}`;
  const existing = recordsByKey.get(key);
  if (!existing) {
    recordsByKey.set(key, next);
    return;
  }
  recordsByKey.set(key, {
    ...existing,
    personName: existing.personName || next.personName,
    sourceUrl: existing.sourceUrl || next.sourceUrl,
    sourcePageUrl: existing.sourcePageUrl || next.sourcePageUrl,
    assignment: existing.assignment === next.assignment ? existing.assignment : `${existing.assignment}; ${next.assignment}`,
    status: existing.status === 'needs-review' ? next.status : existing.status,
    captionStatus: existing.captionStatus || next.captionStatus,
    transcriptStatus: existing.transcriptStatus || next.transcriptStatus,
    existingFilePath: existing.existingFilePath || next.existingFilePath,
    outputFilePath: existing.outputFilePath || next.outputFilePath,
    provenance: Array.from(new Set([...existing.provenance, ...next.provenance])),
  });
}

function writePlan(plan) {
  mkdirSync(dirname(outputPlanPath), { recursive: true });
  writeFileSync(outputPlanPath, `${JSON.stringify(plan, null, 2)}\n`);
  writeFileSync(outputCommandPath, buildCommandFile(plan));
}

function buildCommandFile(plan) {
  const lines = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    '# Review file generated by scripts/plan-youtube-media-acquisition.js',
    '# Commands are commented out unless rightsConfirmed is true in the plan.',
    '# Requires yt-dlp and ffmpeg on PATH.',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"',
    'ACQUISITION_DIR="$REPO_ROOT/data/media-acquisition"',
    'cd "$REPO_ROOT"',
    '',
    'first_downloaded_file() {',
    '  local output_file="$1"',
    '  if [[ -s "$output_file" ]]; then',
    '    printf \'%s\\n\' "$output_file"',
    '    return 0',
    '  fi',
    '  local output_stem="${output_file%.*}"',
    '  local candidate',
    '  for candidate in "${output_stem}".mp4 "${output_stem}".m4v "${output_stem}".mov "${output_stem}".webm "${output_stem}".mkv; do',
    '    if [[ -s "$candidate" ]]; then',
    '      printf \'%s\\n\' "$candidate"',
    '      return 0',
    '    fi',
    '  done',
    '  return 1',
    '}',
    '',
    'download_youtube() {',
    '  local person_id="$1"',
    '  local youtube_id="$2"',
    '  local output_file="$3"',
    '  local output_template="$4"',
    '  local url="$5"',
    '  local downloaded_file',
    '',
    '  if downloaded_file="$(first_downloaded_file "$output_file")"; then',
    '    echo "Skipping ${person_id} / ${youtube_id}; already downloaded at ${downloaded_file}."',
    '    return 0',
    '  fi',
    '',
    '  if [[ "$output_file" != /* ]] && downloaded_file="$(first_downloaded_file "$SCRIPT_DIR/$output_file")"; then',
    '    echo "Skipping ${person_id} / ${youtube_id}; already downloaded at ${downloaded_file}."',
    '    return 0',
    '  fi',
    '',
    '  if [[ "$output_file" != /* ]] && downloaded_file="$(first_downloaded_file "$ACQUISITION_DIR/$output_file")"; then',
    '    echo "Skipping ${person_id} / ${youtube_id}; already downloaded at ${downloaded_file}."',
    '    return 0',
    '  fi',
    '',
    '  mkdir -p "$(dirname "$output_file")"',
    '  yt-dlp \\',
    '    --no-playlist \\',
    '    --merge-output-format mp4 \\',
    '    --write-subs \\',
    '    --write-auto-subs \\',
    '    --sub-langs "en.*" \\',
    '    --write-thumbnail \\',
    '    --output "$output_template" \\',
    '    "$url"',
    '}',
    '',
  ];

  plan.records.forEach((record) => {
    const status = [record.rightsConfirmed ? 'RIGHTS CONFIRMED' : 'NEEDS RIGHTS REVIEW'];
    if (record.alreadyDownloaded) status.push('ALREADY DOWNLOADED');
    lines.push(`# ${record.personId} / ${record.youtubeVideoId} / ${status.join(' / ')}`);
    lines.push(record.rightsConfirmed ? record.downloadCommand : `# ${record.downloadCommand}`);
    lines.push('');
  });

  return `${lines.join('\n')}\n`;
}

function buildDownloadCommand(record) {
  const outputTemplate = record.outputFilePath.replace(/\.mp4$/i, '.%(ext)s');
  return [
    'download_youtube',
    shellQuote(record.personId),
    shellQuote(record.youtubeVideoId),
    shellQuote(record.outputFilePath),
    shellQuote(outputTemplate),
    shellQuote(youtubeWatchUrl(record.youtubeVideoId)),
  ].join(' ');
}

function executeDownloads(records) {
  if (records.length === 0) {
    console.log('No rights-confirmed records to download.');
    return;
  }
  records.forEach((record) => {
    const downloadedFile = findDownloadedFiles(record.outputFilePath)[0];
    if (downloadedFile) {
      console.log(`Skipping ${record.personId}:${record.youtubeVideoId}; already downloaded at ${downloadedFile}.`);
      return;
    }
    mkdirSync(dirname(resolve(record.outputFilePath)), { recursive: true });
    const result = spawnSync('yt-dlp', [
      '--no-playlist',
      '--merge-output-format', 'mp4',
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs', 'en.*',
      '--write-thumbnail',
      '--output', record.outputFilePath.replace(/\.mp4$/i, '.%(ext)s'),
      youtubeWatchUrl(record.youtubeVideoId),
    ], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`yt-dlp failed for ${record.personId}:${record.youtubeVideoId}`);
  });
}

function findDownloadedFiles(outputFilePath) {
  const roots = [process.cwd(), dirname(outputCommandPath), resolve('data/media-acquisition')];
  const files = [];
  roots.forEach((root) => {
    findMatchingDownloads(resolve(root, outputFilePath)).forEach((path) => files.push(displayPath(path)));
  });
  return Array.from(new Set(files));
}

function findMatchingDownloads(outputFilePath) {
  const files = [];
  if (isDownloadedMediaFile(outputFilePath)) files.push(outputFilePath);

  const directory = dirname(outputFilePath);
  if (!existsSync(directory)) return files;

  const stem = basename(outputFilePath, extname(outputFilePath));
  readdirSync(directory).forEach((fileName) => {
    if (!fileName.startsWith(`${stem}.`)) return;
    const candidate = join(directory, fileName);
    if (isDownloadedMediaFile(candidate)) files.push(candidate);
  });

  return files;
}

function isDownloadedMediaFile(path) {
  if (!existsSync(path)) return false;
  return statSync(path).isFile() && statSync(path).size > 0 && VIDEO_EXTENSIONS.has(extname(path).toLowerCase());
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readRightsAllowlist(path) {
  if (!path || !existsSync(path)) return new Set();
  const payload = JSON.parse(readFileSync(path, 'utf8'));
  if (Array.isArray(payload)) return new Set(payload.map(String));
  if (Array.isArray(payload.records)) {
    return new Set(payload.records.filter((record) => record.rightsConfirmed).flatMap((record) => [
      record.youtubeVideoId,
      `${record.personId}:${record.youtubeVideoId}`,
    ]));
  }
  return new Set();
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--execute') parsed.execute = true;
    else if (value === '--rights-confirmed') parsed.rightsConfirmed = true;
    else if (value.startsWith('--manifest=')) parsed.manifest = value.slice('--manifest='.length);
    else if (value.startsWith('--source-packet=')) parsed.sourcePacket = value.slice('--source-packet='.length);
    else if (value.startsWith('--output=')) parsed.output = value.slice('--output='.length);
    else if (value.startsWith('--commands=')) parsed.commands = value.slice('--commands='.length);
    else if (value.startsWith('--rights-allowlist=')) parsed.rightsAllowlist = value.slice('--rights-allowlist='.length);
  }
  return parsed;
}
