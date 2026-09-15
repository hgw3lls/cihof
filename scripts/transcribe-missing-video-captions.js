#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import {
  CANONICAL_CAPTION_SUFFIXES,
  displayPath,
  existsRepoPath,
  findCaptionFile,
  resolveRepoPath,
  resolveVideoStemPath as resolveStemPath,
} from './media-utils.js';

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const repoRoot = process.cwd();
const manifestPath = resolveRepoPath(args.manifest ?? 'data/media_manifest.json');
const reportPath = resolveRepoPath(args.report ?? 'artifacts/video-whisper-transcription-report.json');
const modelPath = resolveRepoPath(args.model ?? 'tools/whisper-models/ggml-small.en.bin');
const audioCacheRoot = resolveRepoPath(args.audioCache ?? 'artifacts/whisper-audio-cache');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const records = collectMissingCaptionRecords(manifest);
const report = processRecords(records);

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
printSummary(report);

function collectMissingCaptionRecords(manifestData) {
  const items = [];

  for (const [personId, mediaRecord] of Object.entries(manifestData.assets ?? {})) {
    (mediaRecord.videos ?? []).forEach((asset, index) => {
      if (!matchesFilters(personId, asset)) return;

      const stemPath = resolveStemPath(personId, asset);
      const localCaption = findLocalCaptionFile(stemPath, asset);
      const hasCaption = Boolean(asset.captionFilePath || localCaption);
      const needsCaption = !hasCaption || args.overwrite;

      if (!needsCaption) {
        if (args.includeSkipped) {
          items.push({
            personId,
            personName: mediaRecord.name || '',
            index,
            youtubeVideoId: asset.youtubeVideoId || '',
            filePath: asset.filePath || '',
            stemPath,
            durationSeconds: asset.durationSeconds ?? null,
            action: 'already-has-caption',
            captionFilePath: asset.captionFilePath || localCaption,
          });
        }
        return;
      }

      items.push({
        personId,
        personName: mediaRecord.name || '',
        index,
        youtubeVideoId: asset.youtubeVideoId || '',
        sourceUrl: asset.sourceUrl || '',
        filePath: asset.filePath || '',
        stemPath,
        durationSeconds: asset.durationSeconds ?? null,
        action: hasCaption ? 'overwrite-caption' : 'needs-caption',
      });
    });
  }

  return items.sort((left, right) => {
    if (args.longestFirst) return (right.durationSeconds ?? 0) - (left.durationSeconds ?? 0);
    return (left.durationSeconds ?? Number.MAX_SAFE_INTEGER) - (right.durationSeconds ?? Number.MAX_SAFE_INTEGER);
  });
}

function processRecords(allRecords) {
  const selectedRecords = args.limit ? allRecords.slice(0, args.limit) : allRecords;
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    dryRun: !args.execute,
    manifestPath: displayPath(manifestPath),
    modelPath: displayPath(modelPath),
    whisperBin: args.whisperBin,
    ffmpegBin: args.ffmpegBin,
    options: {
      threads: args.threads,
      beamSize: args.beamSize,
      bestOf: args.bestOf,
      maxLen: args.maxLen,
      splitOnWord: args.splitOnWord,
      noFallback: args.noFallback,
      keepAudio: args.keepAudio,
      overwrite: args.overwrite,
    },
    summary: {
      candidates: allRecords.length,
      selected: selectedRecords.length,
      channelOrNonVideoRecords: 0,
      missingLocalFiles: 0,
      skippedExisting: 0,
      plannedTranscriptions: 0,
      transcribed: 0,
      failed: 0,
      plannedSeconds: 0,
      transcribedSeconds: 0,
    },
    records: [],
  };

  if (!existsSync(modelPath)) {
    report.summary.failed = selectedRecords.length;
    report.error = `Whisper model not found: ${displayPath(modelPath)}`;
    report.records = selectedRecords.map((record) => ({
      ...record,
      action: 'missing-model',
      errors: [report.error],
    }));
    return report;
  }

  selectedRecords.forEach((record, ordinal) => {
    const result = processRecord(record, ordinal + 1, selectedRecords.length);
    report.records.push(result);

    if (result.action === 'needs-specific-video-url') report.summary.channelOrNonVideoRecords += 1;
    else if (result.action === 'missing-local-video') report.summary.missingLocalFiles += 1;
    else if (result.action === 'already-has-caption') report.summary.skippedExisting += 1;
    else if (result.action === 'would-transcribe') report.summary.plannedTranscriptions += 1;
    else if (result.action === 'transcribed') report.summary.transcribed += 1;
    else if (result.action === 'failed') report.summary.failed += 1;

    if (['would-transcribe', 'transcribed'].includes(result.action)) {
      report.summary.plannedSeconds += result.durationSeconds ?? 0;
    }
    if (result.action === 'transcribed') {
      report.summary.transcribedSeconds += result.durationSeconds ?? 0;
    }
  });

  return report;
}

function processRecord(record, ordinal, total) {
  const result = {
    ...record,
    outputBasePath: `${record.stemPath}.en`,
    captionFilePath: `${record.stemPath}.en.vtt`,
    srtFilePath: `${record.stemPath}.en.srt`,
    textFilePath: `${record.stemPath}.en.txt`,
    jsonFilePath: `${record.stemPath}.en.json`,
    audioCachePath: '',
    elapsedSeconds: null,
    errors: [],
  };

  if (!record.youtubeVideoId) {
    result.action = 'needs-specific-video-url';
    return result;
  }

  if (!record.filePath || !existsRepoPath(record.filePath)) {
    result.action = 'missing-local-video';
    result.errors.push(`Missing local video file: ${record.filePath || '(empty filePath)'}`);
    return result;
  }

  const existingCaption = findLocalCaptionFile(record.stemPath, record);
  if (existingCaption && !args.overwrite) {
    result.action = 'already-has-caption';
    result.captionFilePath = existingCaption;
    return result;
  }

  result.action = args.execute ? 'transcribed' : 'would-transcribe';
  if (!args.execute) return result;

  console.log(`[${ordinal}/${total}] Transcribing ${record.personName} (${record.youtubeVideoId}, ${formatDuration(record.durationSeconds)})`);
  const startedAt = Date.now();
  const audioPath = buildAudioCachePath(record);
  result.audioCachePath = displayPath(audioPath);

  const extract = spawnSync(args.ffmpegBin, [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    resolveRepoPath(record.filePath),
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    audioPath,
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

  if (extract.status !== 0) {
    result.action = 'failed';
    result.errors.push(`ffmpeg failed: ${summarizeOutput(extract.stderr || extract.stdout)}`);
    return result;
  }

  const whisperArgs = buildWhisperArgs(record, audioPath);
  const transcription = spawnSync(args.whisperBin, whisperArgs, {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });

  if (!args.keepAudio) {
    try {
      unlinkSync(audioPath);
      result.audioCachePath = '';
    } catch (error) {
      result.errors.push(`Could not remove temporary audio ${displayPath(audioPath)}: ${error.message}`);
    }
  }

  result.elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);

  if (transcription.status !== 0) {
    result.action = 'failed';
    result.errors.push(`whisper-cli failed: ${summarizeOutput([transcription.stdout, transcription.stderr].filter(Boolean).join('\n'))}`);
    return result;
  }

  if (!existsRepoPath(result.captionFilePath)) {
    result.action = 'failed';
    result.errors.push(`Expected VTT was not created: ${result.captionFilePath}`);
    return result;
  }

  console.log(`    wrote ${result.captionFilePath} in ${formatDuration(result.elapsedSeconds)}`);
  return result;
}

function buildWhisperArgs(record, audioPath) {
  const whisperArgs = [
    '-m',
    modelPath,
    '-f',
    audioPath,
    '-l',
    args.language,
    '-t',
    String(args.threads),
    '-bs',
    String(args.beamSize),
    '-bo',
    String(args.bestOf),
    '-ml',
    String(args.maxLen),
    '-ovtt',
    '-osrt',
    '-otxt',
    '-oj',
    '-of',
    resolveRepoPath(`${record.stemPath}.en`),
  ];

  if (args.splitOnWord) whisperArgs.push('-sow');
  if (args.noFallback) whisperArgs.push('-nf');

  const prompt = [
    'Cleveland International Hall of Fame.',
    record.personName,
    'Cleveland, heritage, honoree, induction ceremony.',
  ].filter(Boolean).join(' ');
  whisperArgs.push('--prompt', prompt);

  return whisperArgs;
}

function findLocalCaptionFile(stemPath, asset) {
  return findCaptionFile(stemPath, asset, {
    suffixes: CANONICAL_CAPTION_SUFFIXES,
    includeDirectoryFallback: false,
  });
}

function buildAudioCachePath(record) {
  mkdirSync(audioCacheRoot, { recursive: true });
  return resolve(audioCacheRoot, `${record.personId}_${record.youtubeVideoId}.wav`);
}

function summarizeOutput(output) {
  if (!output) return '';
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-12)
    .join('\n')
    .slice(0, 2400);
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'unknown';
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s`;
}

function matchesFilters(personId, asset) {
  if (args.personIds.length > 0 && !args.personIds.includes(personId)) return false;
  if (args.youtubeIds.length > 0 && !args.youtubeIds.includes(asset.youtubeVideoId || '')) return false;
  return true;
}

function parseArgs(values) {
  const parsed = {
    execute: false,
    help: false,
    includeSkipped: false,
    keepAudio: false,
    overwrite: false,
    longestFirst: false,
    splitOnWord: true,
    noFallback: true,
    personIds: [],
    youtubeIds: [],
    whisperBin: 'whisper-cli',
    ffmpegBin: 'ffmpeg',
    language: 'en',
    threads: 8,
    beamSize: 1,
    bestOf: 1,
    maxLen: 80,
    limit: 0,
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const [key, inlineValue] = value.includes('=') ? value.split(/=(.*)/s, 2) : [value, undefined];

    if (value === '--execute') parsed.execute = true;
    else if (value === '--help' || value === '-h') parsed.help = true;
    else if (value === '--include-skipped') parsed.includeSkipped = true;
    else if (value === '--keep-audio') parsed.keepAudio = true;
    else if (value === '--overwrite') parsed.overwrite = true;
    else if (value === '--longest-first') parsed.longestFirst = true;
    else if (value === '--no-split-on-word') parsed.splitOnWord = false;
    else if (value === '--allow-fallback') parsed.noFallback = false;
    else if (key === '--manifest') parsed.manifest = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--report') parsed.report = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--model') parsed.model = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--audio-cache') parsed.audioCache = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--whisper-bin') parsed.whisperBin = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--ffmpeg-bin') parsed.ffmpegBin = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--language') parsed.language = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--threads') parsed.threads = readInteger(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--beam-size') parsed.beamSize = readInteger(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--best-of') parsed.bestOf = readInteger(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--max-len') parsed.maxLen = readInteger(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--limit') parsed.limit = readInteger(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--person') parsed.personIds.push(readValue(values, inlineValue, () => { index += 1; return values[index]; }));
    else if (key === '--id') parsed.youtubeIds.push(readValue(values, inlineValue, () => { index += 1; return values[index]; }));
    else throw new Error(`Unknown argument: ${value}`);
  }

  if (parsed.threads < 1) throw new Error('--threads must be 1 or higher');
  if (parsed.beamSize < 1) throw new Error('--beam-size must be 1 or higher');
  if (parsed.bestOf < 1) throw new Error('--best-of must be 1 or higher');
  if (parsed.maxLen < 0) throw new Error('--max-len must be 0 or higher');
  if (parsed.limit < 0) throw new Error('--limit must be 0 or higher');

  return parsed;
}

function readValue(values, inlineValue, nextValue) {
  const value = inlineValue ?? nextValue();
  if (!value) throw new Error(`Missing value in ${values.join(' ')}`);
  return value;
}

function readInteger(values, inlineValue, nextValue) {
  const value = Number.parseInt(readValue(values, inlineValue, nextValue), 10);
  if (!Number.isFinite(value)) throw new Error(`Expected integer in ${values.join(' ')}`);
  return value;
}

function printSummary(report) {
  const verb = report.dryRun ? 'Dry run' : 'Executed';
  console.log(`${verb} local Whisper caption generation.`);
  console.log(`Candidates: ${report.summary.candidates}; selected: ${report.summary.selected}.`);
  console.log(`Transcribed: ${report.summary.transcribed}; planned: ${report.summary.plannedTranscriptions}; skipped existing: ${report.summary.skippedExisting}.`);
  console.log(`Missing local videos: ${report.summary.missingLocalFiles}; channel/non-video records: ${report.summary.channelOrNonVideoRecords}.`);
  console.log(`Audio duration ${report.dryRun ? 'planned' : 'transcribed'}: ${formatDuration(report.dryRun ? report.summary.plannedSeconds : report.summary.transcribedSeconds)}.`);
  console.log(`Failures: ${report.summary.failed}.`);
  console.log(`Report: ${displayPath(reportPath)}`);
}

function printHelp() {
  console.log(`
Usage:
  node scripts/transcribe-missing-video-captions.js
  node scripts/transcribe-missing-video-captions.js --execute

What it does:
  Uses local whisper.cpp to generate VTT/SRT/TXT/JSON sidecars for manifest
  video records that do not already have captions. It extracts temporary
  16 kHz mono WAV audio per video and removes that cache after each success.

Options:
  --execute                  Run ffmpeg and whisper-cli.
  --limit=<n>                Process only the first n candidates.
  --person=<profile-id>      Process one profile id; may be repeated.
  --id=<youtube-id>          Process one YouTube id; may be repeated.
  --model=<path>             GGML model path. Default: tools/whisper-models/ggml-small.en.bin
  --threads=<n>              Whisper threads. Default: 8
  --beam-size=<n>            Whisper beam size. Default: 1
  --best-of=<n>              Whisper best-of. Default: 1
  --allow-fallback           Enable Whisper fallback decoding.
  --overwrite                Rebuild even if caption sidecar already exists.
  --keep-audio               Keep extracted WAV files in artifacts/whisper-audio-cache.
  --longest-first            Process longer videos before shorter videos.
  --report=<path>
`);
}
