#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import {
  displayPath,
  existsRepoPath,
  findCaptionFile,
  findTranscriptFile,
  isCanonicalTranscriptPath,
  resolveRepoPath,
  resolveVideoStemPath as resolveStemPath,
  setCaptionFields,
  setTranscriptFields,
  youtubeWatchUrl,
} from './media-utils.js';

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const repoRoot = process.cwd();
const manifestPath = resolveRepoPath(args.manifest ?? 'data/media_manifest.json');
const reportPath = resolveRepoPath(args.report ?? 'artifacts/video-caption-transcript-report.json');
const csvPath = args.csv === false ? '' : resolveRepoPath(args.csv ?? 'artifacts/video-caption-transcript-report.csv');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const report = processManifest(manifest);

if (args.execute) {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (csvPath) writeCsv(report, csvPath);
printSummary(report);

function processManifest(manifestData) {
  const records = [];
  const summary = {
    videoItems: 0,
    processedItems: 0,
    channelOrNonVideoRecords: 0,
    captionPathsBefore: 0,
    captionFilesBefore: 0,
    captionPathsAfter: 0,
    captionFilesAfter: 0,
    captionsFilledFromLocal: 0,
    captionsDownloaded: 0,
    captionsStillMissing: 0,
    transcriptsBefore: 0,
    transcriptsAfter: 0,
    transcriptsCreated: 0,
    transcriptsPlanned: 0,
    transcriptsEmpty: 0,
    transcriptPathsFilledFromLocal: 0,
    downloadAttempts: 0,
    downloadFailures: 0,
    youtubeCaptionsUnavailable: 0,
    warnings: 0,
    errors: 0,
  };

  for (const [personId, mediaRecord] of Object.entries(manifestData.assets ?? {})) {
    (mediaRecord.videos ?? []).forEach((asset, index) => {
      summary.videoItems += 1;
      if (!matchesFilters(personId, asset)) return;
      summary.processedItems += 1;

      const record = {
        personId,
        personName: mediaRecord.name || '',
        index,
        youtubeVideoId: asset.youtubeVideoId || '',
        sourceUrl: asset.sourceUrl || '',
        before: snapshotAsset(asset),
        after: null,
        action: 'unchanged',
        captionAction: 'unchanged',
        transcriptAction: 'unchanged',
        transcriptWordCount: 0,
        warnings: [],
        errors: [],
      };

      if (asset.captionFilePath) summary.captionPathsBefore += 1;
      if (asset.captionFilePath && existsRepoPath(asset.captionFilePath)) summary.captionFilesBefore += 1;
      if (isCanonicalTranscriptPath(asset.transcriptFilePath) && existsRepoPath(asset.transcriptFilePath)) summary.transcriptsBefore += 1;

      if (!asset.youtubeVideoId) {
        summary.channelOrNonVideoRecords += 1;
        summary.captionsStillMissing += 1;
        record.action = 'needs-specific-video-url';
        record.captionAction = 'needs-specific-video-url';
        record.transcriptAction = 'needs-specific-video-url';
        record.after = snapshotAsset(asset);
        records.push(record);
        return;
      }

      const stemPath = resolveStemPath(personId, asset);
      const captionBefore = asset.captionFilePath && existsRepoPath(asset.captionFilePath) ? asset.captionFilePath : '';
      let captionPath = captionBefore || findCaptionFile(stemPath, asset);

      if (!captionPath && args.downloadMissingCaptions) {
        summary.downloadAttempts += 1;
        const download = downloadCaption(stemPath, asset);
        record.downloadStatus = download.status;
        record.downloadOutput = summarizeToolOutput(download.output);
        record.warnings.push(...download.warnings);
        record.errors.push(...download.errors);
        if (!download.ok && download.status === 'no-youtube-caption-available') summary.youtubeCaptionsUnavailable += 1;
        else if (!download.ok) summary.downloadFailures += 1;
        captionPath = findCaptionFile(stemPath, asset);
        if (captionPath) summary.captionsDownloaded += 1;
      }

      if (captionPath) {
        const filledCaptionPath = setCaptionFields(asset, captionPath);
        if (!captionBefore && filledCaptionPath) {
          summary.captionsFilledFromLocal += args.downloadMissingCaptions && record.downloadStatus === 'downloaded-caption' ? 0 : 1;
          record.captionAction = args.execute ? 'filled-from-local' : 'would-fill-from-local';
        }
        if (args.downloadMissingCaptions && record.downloadStatus === 'downloaded-caption') {
          record.captionAction = args.execute ? 'downloaded' : 'would-download';
        }
      } else {
        summary.captionsStillMissing += 1;
        record.captionAction = args.downloadMissingCaptions ? 'missing-after-download-attempt' : 'missing-needs-caption-or-stt';
      }

      const transcriptBefore = isCanonicalTranscriptPath(asset.transcriptFilePath) && existsRepoPath(asset.transcriptFilePath)
        ? asset.transcriptFilePath
        : '';
      let transcriptPath = transcriptBefore || findTranscriptFile(stemPath, asset);
      if (transcriptPath && !transcriptBefore) {
        setTranscriptFields(asset, transcriptPath);
        summary.transcriptPathsFilledFromLocal += 1;
        record.transcriptAction = args.execute ? 'filled-from-local' : 'would-fill-from-local';
      }

      if (captionPath && (!transcriptPath || args.overwriteTranscripts)) {
        const transcript = buildTranscript(captionPath);
        if (transcript.wordCount > 0) {
          transcriptPath = transcriptPath || `${stemPath}.transcript.txt`;
          if (args.execute) {
            mkdirSync(dirname(resolveRepoPath(transcriptPath)), { recursive: true });
            writeFileSync(resolveRepoPath(transcriptPath), transcript.content);
            summary.transcriptsCreated += 1;
            record.transcriptAction = transcriptBefore || args.overwriteTranscripts ? 'rewritten-from-caption' : 'created-from-caption';
          } else {
            summary.transcriptsPlanned += 1;
            record.transcriptAction = transcriptBefore || args.overwriteTranscripts ? 'would-rewrite-from-caption' : 'would-create-from-caption';
          }
          setTranscriptFields(asset, transcriptPath);
          record.transcriptWordCount = transcript.wordCount;
        } else {
          summary.transcriptsEmpty += 1;
          record.transcriptAction = 'caption-produced-empty-transcript';
          record.errors.push(`No transcript text extracted from ${captionPath}`);
        }
      }

      if (asset.captionFilePath) summary.captionPathsAfter += 1;
      if (asset.captionFilePath && existsRepoPath(asset.captionFilePath)) summary.captionFilesAfter += 1;
      if (asset.transcriptFilePath && (args.execute ? existsRepoPath(asset.transcriptFilePath) : Boolean(asset.transcriptFilePath))) {
        summary.transcriptsAfter += 1;
      }

      if (record.captionAction !== 'unchanged' || record.transcriptAction !== 'unchanged') {
        record.action = args.execute ? 'updated' : 'would-update';
      }
      summary.warnings += record.warnings.length;
      summary.errors += record.errors.length;
      record.after = snapshotAsset(asset);
      records.push(record);
    });
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    dryRun: !args.execute,
    downloadMissingCaptions: args.downloadMissingCaptions,
    overwriteTranscripts: args.overwriteTranscripts,
    manifestPath: displayPath(manifestPath),
    summary,
    missingCaptionRecords: records
      .filter((record) => !record.after.captionFilePath)
      .map((record) => ({
        personId: record.personId,
        personName: record.personName,
        index: record.index,
        youtubeVideoId: record.youtubeVideoId,
        sourceUrl: record.sourceUrl,
        action: record.captionAction,
      })),
    records,
  };
}

function downloadCaption(stemPath, asset) {
  const outputPath = resolveRepoPath(`${stemPath}.%(ext)s`);
  mkdirSync(dirname(outputPath), { recursive: true });

  if (!args.execute) {
    return {
      ok: true,
      status: 'would-download-caption',
      output: `yt-dlp subtitles for ${asset.youtubeVideoId}`,
      warnings: [],
      errors: [],
    };
  }

  const sourceUrl = asset.sourceUrl && asset.sourceUrl.includes(asset.youtubeVideoId)
    ? asset.sourceUrl
    : youtubeWatchUrl(asset.youtubeVideoId);
  const result = spawnSync(args.ytDlpBin ?? 'yt-dlp', [
    '--skip-download',
    '--no-playlist',
    '--no-update',
    '--write-subs',
    '--write-auto-subs',
    '--sub-langs',
    'en.*',
    '--sub-format',
    'vtt/best',
    '--output',
    outputPath,
    sourceUrl,
  ], { encoding: 'utf8' });

  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
  const caption = findCaptionFile(stemPath, asset);
  if (caption) {
    return {
      ok: true,
      status: 'downloaded-caption',
      output,
      warnings: [],
      errors: [],
    };
  }

  const noCaptions = /has no subtitles|has no automatic captions|No subtitles/i.test(output);
  return {
    ok: false,
    status: noCaptions ? 'no-youtube-caption-available' : `yt-dlp-exit-${result.status ?? 'unknown'}`,
    output,
    warnings: noCaptions ? [`No YouTube caption track available for ${asset.youtubeVideoId}.`] : [],
    errors: noCaptions ? [] : [`No caption file created for ${asset.youtubeVideoId}.`],
  };
}

function buildTranscript(captionPath) {
  const captionText = readFileSync(resolveRepoPath(captionPath), 'utf8');
  const transcriptText = captionPath.endsWith('.srt')
    ? parseSrt(captionText)
    : parseVtt(captionText);
  const wordCount = countWords(transcriptText);
  if (wordCount === 0) return { content: '', wordCount: 0 };

  const content = [
    `Draft transcript generated from ${captionPath}.`,
    `Generated: ${new Date().toISOString()}.`,
    'Review required before kiosk approval.',
    '',
    wrapText(transcriptText),
    '',
  ].join('\n');

  return { content, wordCount };
}

function parseVtt(text) {
  return linesToTranscript(stripCaptionMetadata(text));
}

function parseSrt(text) {
  return linesToTranscript(text.replace(/\r/g, '').split('\n'));
}

function stripCaptionMetadata(text) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n');
  const result = [];
  let skippingBlock = false;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      skippingBlock = false;
      result.push(line);
      return;
    }

    if (/^(NOTE|STYLE|REGION)\b/i.test(trimmed)) {
      skippingBlock = true;
      return;
    }

    if (!skippingBlock) result.push(line);
  });

  return result;
}

function linesToTranscript(lines) {
  const cleanedLines = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (/^WEBVTT\b/i.test(trimmed)) return;
    if (/^(Kind|Language):/i.test(trimmed)) return;
    if (/^\d+$/.test(trimmed)) return;
    if (/-->/i.test(trimmed)) return;

    const cleaned = cleanCaptionLine(trimmed);
    if (!cleaned) return;
    if (/^\[(music|applause|laughter|silence)\]$/i.test(cleaned)) return;
    if (cleanedLines.at(-1) === cleaned) return;
    cleanedLines.push(cleaned);
  });

  return normalizeTranscriptText(cleanedLines.join(' '));
}

function cleanCaptionLine(line) {
  return decodeHtmlEntities(line)
    .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, ' ')
    .replace(/<\d{2}:\d{2}\.\d{3}>/g, ' ')
    .replace(/<\/?c(?:\.[^>]*)?>/g, ' ')
    .replace(/<\/?v(?:\s+[^>]*)?>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{\\[^}]+\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTranscriptText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([([{])\s+/g, '$1')
    .trim();
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(parseInt(value, 16)))
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)));
}

function wrapText(text, lineWidth = 92) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';

  words.forEach((word) => {
    if (!line) {
      line = word;
      return;
    }
    if (`${line} ${word}`.length > lineWidth) {
      lines.push(line);
      line = word;
      return;
    }
    line = `${line} ${word}`;
  });

  if (line) lines.push(line);
  return lines.join('\n');
}

function countWords(text) {
  return (text.match(/\b[\p{L}\p{N}'-]+\b/gu) ?? []).length;
}

function snapshotAsset(asset) {
  return {
    youtubeVideoId: asset.youtubeVideoId || '',
    filePath: asset.filePath || '',
    captionFilePath: asset.captionFilePath || '',
    captionRuntimePath: asset.captionRuntimePath || '',
    transcriptFilePath: asset.transcriptFilePath || '',
    transcriptRuntimePath: asset.transcriptRuntimePath || '',
    rightsStatus: asset.rightsStatus || '',
    captionStatus: asset.captionStatus || '',
    transcriptStatus: asset.transcriptStatus || '',
    approvedForKiosk: Boolean(asset.approvedForKiosk),
  };
}

function summarizeToolOutput(output) {
  if (!output) return '';
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-8)
    .join('\n')
    .slice(0, 1600);
}

function matchesFilters(personId, asset) {
  if (args.personIds.length > 0 && !args.personIds.includes(personId)) return false;
  if (args.youtubeIds.length > 0 && !args.youtubeIds.includes(asset.youtubeVideoId || '')) return false;
  return true;
}

function writeCsv(report, path) {
  mkdirSync(dirname(path), { recursive: true });
  const header = [
    'personId',
    'personName',
    'index',
    'youtubeVideoId',
    'captionAction',
    'transcriptAction',
    'captionFilePath',
    'transcriptFilePath',
    'transcriptWordCount',
    'errors',
    'warnings',
  ];
  const rows = report.records.map((record) => [
    record.personId,
    record.personName,
    record.index,
    record.youtubeVideoId,
    record.captionAction,
    record.transcriptAction,
    record.after.captionFilePath,
    record.after.transcriptFilePath,
    record.transcriptWordCount,
    record.errors.join(' | '),
    record.warnings.join(' | '),
  ]);
  writeFileSync(path, [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n') + '\n');
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseArgs(values) {
  const parsed = {
    execute: false,
    help: false,
    downloadMissingCaptions: false,
    overwriteTranscripts: false,
    personIds: [],
    youtubeIds: [],
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const [key, inlineValue] = value.includes('=') ? value.split(/=(.*)/s, 2) : [value, undefined];

    if (value === '--execute') parsed.execute = true;
    else if (value === '--help' || value === '-h') parsed.help = true;
    else if (value === '--download-missing-captions') parsed.downloadMissingCaptions = true;
    else if (value === '--overwrite-transcripts') parsed.overwriteTranscripts = true;
    else if (key === '--manifest') parsed.manifest = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--report') parsed.report = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--csv') parsed.csv = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--yt-dlp-bin') parsed.ytDlpBin = readValue(values, inlineValue, () => { index += 1; return values[index]; });
    else if (key === '--person') parsed.personIds.push(readValue(values, inlineValue, () => { index += 1; return values[index]; }));
    else if (key === '--id') parsed.youtubeIds.push(readValue(values, inlineValue, () => { index += 1; return values[index]; }));
    else if (value === '--no-csv') parsed.csv = false;
    else throw new Error(`Unknown argument: ${value}`);
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
  console.log(`${verb} video caption/transcript fill.`);
  console.log(`Processed video records: ${report.summary.processedItems}/${report.summary.videoItems}.`);
  console.log(`Caption files: ${report.summary.captionFilesBefore} before; ${report.summary.captionFilesAfter} after.`);
  console.log(`Captions still missing: ${report.summary.captionsStillMissing}; channel/non-video records: ${report.summary.channelOrNonVideoRecords}.`);
  console.log(`Transcripts: ${report.summary.transcriptsBefore} before; ${report.summary.transcriptsAfter} after.`);
  console.log(`Transcripts ${report.dryRun ? 'planned' : 'created'}: ${report.dryRun ? report.summary.transcriptsPlanned : report.summary.transcriptsCreated}.`);
  if (report.downloadMissingCaptions) {
    console.log(`Caption download attempts: ${report.summary.downloadAttempts}; failures: ${report.summary.downloadFailures}.`);
    console.log(`YouTube captions unavailable: ${report.summary.youtubeCaptionsUnavailable}.`);
  }
  console.log(`Warnings: ${report.summary.warnings}; errors: ${report.summary.errors}.`);
  console.log(`Report: ${displayPath(reportPath)}`);
  if (csvPath) console.log(`CSV: ${displayPath(csvPath)}`);
}

function printHelp() {
  console.log(`
Usage:
  node scripts/fill-video-captions-transcripts.js
  node scripts/fill-video-captions-transcripts.js --execute
  node scripts/fill-video-captions-transcripts.js --download-missing-captions --execute

What it does:
  Finds local VTT/SRT caption sidecars for manifest videos, fills missing caption
  paths, and creates draft .transcript.txt files from captions. Existing rights
  and approvedForKiosk values are not changed.

Options:
  --execute                    Write manifest updates and transcript files.
  --download-missing-captions  Use yt-dlp to fetch missing YouTube captions.
  --overwrite-transcripts      Rebuild existing transcript files from captions.
  --person=<profile-id>        Process one profile id; may be repeated.
  --id=<youtube-id>            Process one YouTube id; may be repeated.
  --manifest=<path>
  --report=<path>
  --csv=<path>
  --no-csv
  --yt-dlp-bin=<path>
`);
}
