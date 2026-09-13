import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, resolve } from 'node:path';

const manifestPath = resolve('data/media_manifest.json');
const defaultReportPath = resolve('artifacts/gallery-image-localization-report.json');
const outputRoot = 'public/media/images';
const options = parseOptions(process.argv.slice(2));

if (options.help) {
  printUsage();
  process.exit(0);
}

if (!existsSync(manifestPath)) {
  console.error('Missing data/media_manifest.json. Run npm run media:manifest first.');
  process.exit(1);
}

const normalizer = detectNormalizer(options.tool);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const candidates = collectRemoteOnlyGalleryCandidates(manifest);
const selected = selectCandidates(candidates, options);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  dryRun: !options.execute,
  source: 'data/media_manifest.json',
  outputManifest: 'data/media_manifest.json',
  outputRoot,
  normalizer,
  options: {
    ids: Array.from(options.ids),
    limit: options.limit,
    force: options.force,
    concurrency: options.concurrency,
    timeoutMs: options.timeoutMs,
    retries: options.retries,
    delayMs: options.delayMs,
    maxBytes: options.maxBytes,
    maxWidth: options.maxWidth,
    maxHeight: options.maxHeight,
    format: options.format,
    quality: options.quality,
    approveForKiosk: options.approveForKiosk,
    requireApprovedRights: options.requireApprovedRights,
  },
  summary: {
    remoteOnlyGalleryCandidates: candidates.length,
    selectedTargets: selected.length,
    downloaded: 0,
    normalized: 0,
    reusedExistingFiles: 0,
    skipped: 0,
    errors: 0,
    bytesDownloaded: 0,
  },
  records: [],
};

if (options.execute && !normalizer) {
  report.records.push({
    status: 'error',
    message: 'No supported image normalization tool found. Install ImageMagick (`magick`) or run on macOS with `sips` available.',
  });
  report.summary.errors = 1;
  writeReport(report);
  process.exit(1);
}

await runConcurrent(selected, options.concurrency, processTarget);

if (options.execute) {
  manifest.source = {
    ...(manifest.source ?? {}),
    lastGalleryImageLocalization: {
      appliedAt: new Date().toISOString(),
      script: 'scripts/localize-remote-gallery-images.js',
      remoteOnlyGalleryCandidates: candidates.length,
      selectedTargets: selected.length,
      downloaded: report.summary.downloaded,
      normalized: report.summary.normalized,
      reusedExistingFiles: report.summary.reusedExistingFiles,
      skipped: report.summary.skipped,
      errors: report.summary.errors,
      maxWidth: options.maxWidth,
      maxHeight: options.maxHeight,
      format: options.format,
      quality: options.quality,
      note: 'Remote-only gallery images were downloaded, normalized for kiosk use, and linked into the media manifest.',
    },
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

writeReport(report);

console.log(`Remote-only gallery image candidates: ${report.summary.remoteOnlyGalleryCandidates}`);
console.log(`Selected targets: ${report.summary.selectedTargets}`);
console.log(`Downloaded: ${report.summary.downloaded}`);
console.log(`Normalized: ${report.summary.normalized}`);
console.log(`Reused existing files: ${report.summary.reusedExistingFiles}`);
console.log(`Skipped: ${report.summary.skipped}`);
console.log(`Errors: ${report.summary.errors}`);
console.log(`Wrote ${relativeReportPath(options.reportPath)}`);
if (!options.execute) {
  console.log('Dry run only. Re-run with --execute to download images and update data/media_manifest.json.');
}

if (report.summary.errors > 0) process.exitCode = 1;

async function processTarget(target, index) {
  const plannedPath = buildOutputFilePath(target.recordId, target.slot, options.format);
  const plannedRuntimePath = runtimePathFromFilePath(plannedPath);

  if (options.requireApprovedRights && target.image.rightsStatus !== 'approved') {
    addRecord({
      ...targetSummary(target, plannedPath, plannedRuntimePath),
      status: 'skipped',
      reason: `rightsStatus is "${target.image.rightsStatus || 'blank'}"; pass --allow-unapproved-rights to localize anyway`,
    });
    report.summary.skipped += 1;
    return;
  }

  const existingPath = !options.force ? findExistingOutput(target.recordId, target.slot) : '';
  if (existingPath) {
    if (options.execute) {
      updateImageManifest(target.image, existingPath, options);
    }
    addRecord({
      ...targetSummary(target, existingPath, runtimePathFromFilePath(existingPath)),
      status: options.execute ? 'reused-existing-file' : 'would-reuse-existing-file',
      width: options.execute ? target.image.width : null,
      height: options.execute ? target.image.height : null,
      checksumSha256: options.execute ? target.image.checksumSha256 : '',
    });
    report.summary.reusedExistingFiles += 1;
    logProgress(index + 1);
    return;
  }

  if (!target.image.sourceUrl) {
    addRecord({
      ...targetSummary(target, plannedPath, plannedRuntimePath),
      status: 'skipped',
      reason: 'gallery image has no sourceUrl',
    });
    report.summary.skipped += 1;
    return;
  }

  if (!options.execute) {
    addRecord({
      ...targetSummary(target, plannedPath, plannedRuntimePath),
      status: 'would-download-and-normalize',
    });
    return;
  }

  const tempDir = resolve(tmpdir(), `cihof-gallery-image-localizer-${process.pid}`);
  const tempInputPath = resolve(tempDir, `${safeFilePart(target.recordId)}-${target.slot}-source${extensionFromUrl(target.image.sourceUrl) || '.img'}`);
  const tempOutputPath = resolve(tempDir, `${safeFilePart(target.recordId)}-${target.slot}${extensionForFormat(options.format)}`);

  try {
    mkdirSync(tempDir, { recursive: true });
    const downloaded = await downloadWithRetries(target.image.sourceUrl, options);
    report.summary.bytesDownloaded += downloaded.buffer.length;
    writeFileSync(tempInputPath, downloaded.buffer);

    normalizeImage(tempInputPath, tempOutputPath, normalizer, options);
    const outputFilePath = buildOutputFilePath(target.recordId, target.slot, options.format);
    mkdirSync(dirname(outputFilePath), { recursive: true });
    const normalizedBuffer = readFileSync(tempOutputPath);
    writeFileSync(outputFilePath, normalizedBuffer);
    updateImageManifest(target.image, outputFilePath, options);

    report.summary.downloaded += 1;
    report.summary.normalized += 1;
    addRecord({
      ...targetSummary(target, outputFilePath, target.image.runtimePath),
      status: 'downloaded-and-normalized',
      width: target.image.width,
      height: target.image.height,
      checksumSha256: target.image.checksumSha256,
      bytesDownloaded: downloaded.buffer.length,
      bytesWritten: normalizedBuffer.length,
      contentType: downloaded.contentType,
    });
  } catch (error) {
    report.summary.errors += 1;
    addRecord({
      ...targetSummary(target, plannedPath, plannedRuntimePath),
      status: 'error',
      reason: error.message,
    });
  } finally {
    rmSync(tempInputPath, { force: true });
    rmSync(tempOutputPath, { force: true });
    logProgress(index + 1);
    if (options.delayMs > 0) await delay(options.delayMs);
  }
}

function collectRemoteOnlyGalleryCandidates(document) {
  const assets = document.assets ?? {};
  const candidates = [];

  Object.entries(assets).forEach(([recordId, record]) => {
    const gallery = Array.isArray(record?.images?.gallery) ? record.images.gallery : [];
    gallery.forEach((image, index) => {
      if (!image || typeof image !== 'object') return;
      if (hasUsableLocalFile(image) && !options.force) return;
      candidates.push({
        recordId,
        name: record.name || '',
        galleryIndex: index,
        slot: `gallery-${index + 1}`,
        image,
      });
    });
  });

  return candidates;
}

function selectCandidates(allCandidates, parsedOptions) {
  let result = allCandidates;
  if (parsedOptions.ids.size > 0) {
    result = result.filter((candidate) => parsedOptions.ids.has(candidate.recordId));
  }
  if (parsedOptions.limit !== null) {
    result = result.slice(0, parsedOptions.limit);
  }
  return result;
}

function normalizeImage(inputPath, outputPath, tool, parsedOptions) {
  if (tool === 'magick') {
    const args = [
      inputPath,
      '-auto-orient',
      '-resize',
      `${parsedOptions.maxWidth}x${parsedOptions.maxHeight}>`,
    ];
    if (parsedOptions.format === 'jpg') {
      args.push('-background', 'white', '-alpha', 'remove', '-alpha', 'off');
    }
    args.push('-strip', '-quality', String(parsedOptions.quality), outputPath);
    runTool('magick', args, 'ImageMagick normalization failed');
    return;
  }

  if (tool === 'sips') {
    const format = parsedOptions.format === 'jpg' ? 'jpeg' : parsedOptions.format;
    const maxDimension = Math.max(parsedOptions.maxWidth, parsedOptions.maxHeight);
    const args = ['-s', 'format', format, '--resampleHeightWidthMax', String(maxDimension), inputPath, '--out', outputPath];
    runTool('sips', args, 'sips normalization failed');
    return;
  }

  throw new Error('No image normalization tool is available.');
}

function updateImageManifest(image, filePath, parsedOptions) {
  const buffer = readFileSync(filePath);
  const dimensions = imageDimensions(filePath, buffer);
  image.filePath = filePath;
  image.runtimePath = runtimePathFromFilePath(filePath);
  image.checksumSha256 = sha256(buffer);
  image.width = dimensions?.width ?? image.width ?? null;
  image.height = dimensions?.height ?? image.height ?? null;
  if (parsedOptions.approveForKiosk && image.rightsStatus === 'approved') {
    image.approvedForKiosk = true;
  }
}

async function downloadWithRetries(url, parsedOptions) {
  let lastError = null;
  for (let attempt = 0; attempt <= parsedOptions.retries; attempt += 1) {
    try {
      return await downloadImage(url, parsedOptions);
    } catch (error) {
      lastError = error;
      if (attempt < parsedOptions.retries) {
        await delay(500 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

async function downloadImage(url, parsedOptions) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), parsedOptions.timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'CIHOF gallery image localizer/1.0',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType && !contentType.toLowerCase().startsWith('image/')) {
      throw new Error(`Expected image content-type, got ${contentType}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) throw new Error('Downloaded file is empty.');
    if (buffer.length > parsedOptions.maxBytes) {
      throw new Error(`Downloaded file is ${buffer.length} bytes, above --max-bytes=${parsedOptions.maxBytes}.`);
    }

    return { buffer, contentType };
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`request timed out after ${parsedOptions.timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function runConcurrent(items, concurrency, worker) {
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        await worker(items[currentIndex], currentIndex);
      }
    }),
  );
}

function detectNormalizer(requestedTool) {
  if (requestedTool !== 'auto') {
    return commandAvailable(requestedTool) ? requestedTool : '';
  }
  if (commandAvailable('magick')) return 'magick';
  if (commandAvailable('sips')) return 'sips';
  return '';
}

function commandAvailable(command) {
  const probeArgs = command === 'magick' ? ['-version'] : ['-h'];
  const result = spawnSync(command, probeArgs, { encoding: 'utf8' });
  return !result.error;
}

function runTool(command, args, message) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error) throw new Error(`${message}: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    throw new Error(`${message}${detail ? `: ${detail}` : ''}`);
  }
}

function targetSummary(target, filePath, runtimePath) {
  return {
    id: target.recordId,
    name: target.name,
    galleryIndex: target.galleryIndex,
    slot: target.slot,
    sourceUrl: target.image.sourceUrl || '',
    outputFilePath: filePath,
    outputRuntimePath: runtimePath,
  };
}

function addRecord(record) {
  report.records.push(record);
}

function hasUsableLocalFile(image) {
  return Boolean(image.filePath && image.runtimePath && existsSync(resolve(image.filePath)));
}

function findExistingOutput(id, slot) {
  const candidates = ['.jpg', '.jpeg', '.png', '.webp'].map((extension) => `public/media/images/${id}/${slot}${extension}`);
  return candidates.find((candidate) => existsSync(resolve(candidate))) ?? '';
}

function buildOutputFilePath(id, slot, format) {
  return `${outputRoot}/${id}/${slot}${extensionForFormat(format)}`;
}

function runtimePathFromFilePath(filePath) {
  if (!filePath.startsWith('public/')) return '';
  return `/${filePath.slice('public/'.length)}`;
}

function extensionForFormat(format) {
  if (format === 'jpg') return '.jpg';
  if (format === 'png') return '.png';
  if (format === 'webp') return '.webp';
  throw new Error(`Unsupported output format: ${format}`);
}

function extensionFromUrl(url) {
  try {
    const extension = extname(new URL(url).pathname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff'].includes(extension)) return extension;
  } catch {
    return '';
  }
  return '';
}

function imageDimensions(filePath, buffer) {
  const magickDimensions = commandAvailable('magick') ? dimensionsFromMagick(filePath) : null;
  if (magickDimensions) return magickDimensions;
  const sipsDimensions = commandAvailable('sips') ? dimensionsFromSips(filePath) : null;
  if (sipsDimensions) return sipsDimensions;
  return dimensionsFromBuffer(buffer);
}

function dimensionsFromMagick(filePath) {
  const result = spawnSync('magick', ['identify', '-format', '%w %h', filePath], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  const [width, height] = result.stdout.trim().split(/\s+/).map((value) => Number.parseInt(value, 10));
  return Number.isFinite(width) && Number.isFinite(height) ? { width, height } : null;
}

function dimensionsFromSips(filePath) {
  const result = spawnSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', filePath], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  const width = Number.parseInt(result.stdout.match(/pixelWidth:\s*(\d+)/)?.[1] ?? '', 10);
  const height = Number.parseInt(result.stdout.match(/pixelHeight:\s*(\d+)/)?.[1] ?? '', 10);
  return Number.isFinite(width) && Number.isFinite(height) ? { width, height } : null;
}

function dimensionsFromBuffer(buffer) {
  if (buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 10 && buffer.toString('ascii', 0, 3) === 'GIF') {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) return null;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

function parseArgs(rawArgs) {
  const flags = new Set();
  const values = new Map();
  const ids = new Set();

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith('--')) continue;
    const equalIndex = arg.indexOf('=');
    if (equalIndex > -1) {
      const key = arg.slice(0, equalIndex);
      const value = arg.slice(equalIndex + 1);
      if (key === '--id') ids.add(value);
      else values.set(key, value);
      continue;
    }
    if (arg === '--id') {
      const value = rawArgs[index + 1];
      if (value && !value.startsWith('--')) {
        ids.add(value);
        index += 1;
      }
      continue;
    }
    if (expectsValue(arg)) {
      const value = rawArgs[index + 1];
      if (value && !value.startsWith('--')) {
        values.set(arg, value);
        index += 1;
      }
      continue;
    }
    flags.add(arg);
  }

  const format = values.get('--format') ?? 'jpg';
  if (!['jpg', 'png', 'webp'].includes(format)) {
    throw new Error(`Unsupported --format=${format}. Use jpg, png, or webp.`);
  }
  const tool = values.get('--tool') ?? 'auto';
  if (!['auto', 'magick', 'sips'].includes(tool)) {
    throw new Error(`Unsupported --tool=${tool}. Use auto, magick, or sips.`);
  }

  return {
    help: flags.has('--help') || flags.has('-h'),
    execute: flags.has('--execute'),
    force: flags.has('--force'),
    ids,
    limit: parseOptionalInteger(values.get('--limit')),
    concurrency: parsePositiveInteger(values.get('--concurrency'), 4),
    timeoutMs: parsePositiveInteger(values.get('--timeout-ms'), 15_000),
    retries: parseNonNegativeInteger(values.get('--retries'), 2),
    delayMs: parseNonNegativeInteger(values.get('--delay-ms'), 150),
    maxBytes: parsePositiveInteger(values.get('--max-bytes'), 20 * 1024 * 1024),
    maxWidth: parsePositiveInteger(values.get('--max-width'), 1600),
    maxHeight: parsePositiveInteger(values.get('--max-height'), 1200),
    quality: clamp(parsePositiveInteger(values.get('--quality'), 84), 1, 100),
    format,
    tool,
    reportPath: resolve(values.get('--report') ?? defaultReportPath),
    approveForKiosk: !flags.has('--no-kiosk-approval'),
    requireApprovedRights: !flags.has('--allow-unapproved-rights'),
  };
}

function parseOptions(rawArgs) {
  try {
    return parseArgs(rawArgs);
  } catch (error) {
    console.error(error.message);
    console.error('Run with --help for usage.');
    process.exit(1);
  }
}

function expectsValue(arg) {
  return [
    '--limit',
    '--concurrency',
    '--timeout-ms',
    '--retries',
    '--delay-ms',
    '--max-bytes',
    '--max-width',
    '--max-height',
    '--quality',
    '--format',
    '--tool',
    '--report',
  ].includes(arg);
}

function parseOptionalInteger(value) {
  if (value === undefined || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parsePositiveInteger(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInteger(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeFilePart(value) {
  return String(value).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'image';
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function logProgress(count) {
  if (!options.execute) return;
  if (count > 0 && count % 25 === 0) {
    console.log(`Processed ${count}/${selected.length} gallery images...`);
  }
}

function writeReport(document) {
  mkdirSync(dirname(options.reportPath), { recursive: true });
  writeFileSync(options.reportPath, `${JSON.stringify(document, null, 2)}\n`);
}

function relativeReportPath(reportPath) {
  return reportPath.replace(`${process.cwd()}/`, '');
}

function printUsage() {
  console.log(`
Usage:
  npm run media:gallery-localize -- [options]
  npm run media:gallery-localize -- --execute

Defaults to a dry run. With --execute, downloads remote-only gallery images,
normalizes them, writes them under public/media/images/<id>/gallery-N.jpg,
updates data/media_manifest.json, and writes a report.

Options:
  --execute                    Download, normalize, and update the manifest.
  --limit=N                    Process only the first N selected targets.
  --id=INDUCTEE_ID             Process one profile; repeatable.
  --force                      Re-download and overwrite existing gallery files.
  --concurrency=N              Parallel downloads; default 4.
  --delay-ms=N                 Delay after each executed download; default 150.
  --timeout-ms=N               Per-request timeout; default 15000.
  --retries=N                  Retry failed downloads; default 2.
  --max-width=N                Normalized max width; default 1600.
  --max-height=N               Normalized max height; default 1200.
  --quality=N                  JPEG/WebP quality; default 84.
  --format=jpg|png|webp        Output format; default jpg.
  --tool=auto|magick|sips      Normalizer; default auto.
  --no-kiosk-approval          Do not mark successful images approvedForKiosk.
  --allow-unapproved-rights    Download even when image rightsStatus is not approved.
  --report=PATH                Report path; default artifacts/gallery-image-localization-report.json.
`);
}
