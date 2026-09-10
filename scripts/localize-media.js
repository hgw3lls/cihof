import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { generatedAtFor } from './stable-generated-at.js';

const manifestPath = resolve('data/media_manifest.json');
const reportPath = resolve('public/data/media-localization-report.json');
const options = parseArgs(process.argv.slice(2));

if (!existsSync(manifestPath)) {
  console.error('Missing data/media_manifest.json. Run npm run media:manifest first.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const records = Object.values(manifest.assets ?? {});
const selectedRecords = options.ids.size > 0 ? records.filter((record) => options.ids.has(record.id)) : records;
const limitedRecords = options.limit === null ? selectedRecords : selectedRecords.slice(0, options.limit);
const videoSourceIndex = options.videoSourceRoot ? buildFileIndex(resolve(options.videoSourceRoot)) : new Map();
const report = {
  generatedAt: generatedAtFor(reportPath),
  dryRun: options.dryRun,
  options: {
    downloadImages: options.downloadImages,
    copyVideos: options.copyVideos,
    force: options.force,
    limit: options.limit,
    ids: Array.from(options.ids),
    videoSourceRoot: options.videoSourceRoot,
  },
  totalManifestRecords: records.length,
  selectedRecords: limitedRecords.length,
  downloadedImages: [],
  copiedVideos: [],
  updatedExistingFiles: [],
  skipped: [],
  errors: [],
};

for (const record of limitedRecords) {
  if (options.images) {
    await processImage(record, record.images?.primary, 'primary');
    if (!options.primaryOnly) {
      for (const [index, image] of (record.images?.gallery ?? []).entries()) {
        await processImage(record, image, `gallery-${index + 1}`);
      }
    }
  }

  if (options.videos) {
    for (const [index, video] of (record.videos ?? []).entries()) {
      processVideo(record, video, index);
    }
  }
}

if (!options.dryRun) {
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Media localization ${options.dryRun ? '(dry run)' : ''}: ${limitedRecords.length} records.`);
console.log(`Downloaded images: ${report.downloadedImages.length}`);
console.log(`Copied videos: ${report.copiedVideos.length}`);
console.log(`Updated existing files: ${report.updatedExistingFiles.length}`);
console.log(`Skipped: ${report.skipped.length}`);
console.log(`Errors: ${report.errors.length}`);
console.log(`Wrote ${reportPath}`);

if (report.errors.length > 0) process.exitCode = 1;

async function processImage(record, image, slot) {
  if (!image) return;

  const existingPath = findExistingImagePath(record.id, slot, image);
  if (existingPath && !options.force) {
    image.filePath = existingPath;
    image.runtimePath = runtimePathFromFilePath(existingPath);
    updateExistingImage(image);
    report.updatedExistingFiles.push(`${record.id}: ${slot} image already exists at ${image.filePath}`);
    return;
  }

  if (!options.downloadImages) {
    report.skipped.push(`${record.id}: ${slot} image not downloaded; pass --download-images to fetch ${image.sourceUrl || 'source image'}.`);
    return;
  }

  if (!image.sourceUrl) {
    report.skipped.push(`${record.id}: ${slot} image has no sourceUrl.`);
    return;
  }

  try {
    if (options.dryRun) {
      report.downloadedImages.push(`${record.id}: would download ${slot} image from ${image.sourceUrl}`);
      return;
    }

    const downloaded = await downloadImage(image.sourceUrl);
    const extension = extensionFromUrl(image.sourceUrl) || extensionFromContentType(downloaded.contentType) || '.jpg';
    const filePath = `public/media/images/${record.id}/${slot}${extension}`;
    const runtimePath = `/media/images/${record.id}/${slot}${extension}`;

    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, downloaded.buffer);

    const dimensions = imageDimensions(downloaded.buffer);
    image.filePath = filePath;
    image.runtimePath = runtimePath;
    image.checksumSha256 = sha256(downloaded.buffer);
    image.width = dimensions?.width ?? image.width ?? null;
    image.height = dimensions?.height ?? image.height ?? null;

    report.downloadedImages.push(`${record.id}: downloaded ${slot} image to ${filePath}`);
    logProgress();
  } catch (error) {
    report.errors.push(`${record.id}: could not download ${slot} image: ${error.message}`);
    logProgress();
  }
}

function processVideo(record, video, index) {
  if (!video) return;

  const currentPath = video.filePath ? resolve(video.filePath) : '';
  if (currentPath && existsSync(currentPath) && video.filePath.startsWith('public/media/') && !options.force) {
    updateExistingVideo(video);
    report.updatedExistingFiles.push(`${record.id}: video ${index + 1} already exists at ${video.filePath}`);
    return;
  }

  if (!options.copyVideos) {
    report.skipped.push(`${record.id}: video ${index + 1} not copied; pass --copy-videos with optional --video-source-root.`);
    return;
  }

  const sourcePath = findVideoSource(video, videoSourceIndex);
  if (!sourcePath) {
    report.skipped.push(`${record.id}: video ${index + 1} has no local source file to copy.`);
    return;
  }

  const extension = extname(sourcePath) || '.mp4';
  const filePath = `public/media/videos/${record.id}/video-${index + 1}${extension}`;
  const runtimePath = `/media/videos/${record.id}/video-${index + 1}${extension}`;

  if (options.dryRun) {
    report.copiedVideos.push(`${record.id}: would copy video ${index + 1} from ${sourcePath} to ${filePath}`);
    return;
  }

  try {
    const buffer = readFileSync(sourcePath);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, buffer);
    video.filePath = filePath;
    video.runtimePath = runtimePath;
    video.checksumSha256 = sha256(buffer);
    if (!video.codec) video.codec = extension.replace(/^\./, '').toLowerCase();
    report.copiedVideos.push(`${record.id}: copied video ${index + 1} to ${filePath}`);
  } catch (error) {
    report.errors.push(`${record.id}: could not copy video ${index + 1}: ${error.message}`);
  }
}

function updateExistingImage(image) {
  const buffer = readFileSync(image.filePath);
  const dimensions = imageDimensions(buffer);
  image.checksumSha256 = sha256(buffer);
  image.width = dimensions?.width ?? image.width ?? null;
  image.height = dimensions?.height ?? image.height ?? null;
}

function updateExistingVideo(video) {
  const buffer = readFileSync(video.filePath);
  video.checksumSha256 = sha256(buffer);
  if (!video.codec) video.codec = extname(video.filePath).replace(/^\./, '').toLowerCase();
}

async function downloadImage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType && !contentType.toLowerCase().startsWith('image/')) {
      throw new Error(`Expected image content-type, got ${contentType}`);
    }
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType,
    };
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`request timed out after ${options.timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function findVideoSource(video, sourceIndex) {
  if (video.filePath && existsSync(resolve(video.filePath))) return resolve(video.filePath);
  if (!video.filePath || sourceIndex.size === 0) return '';
  return sourceIndex.get(basename(video.filePath)) ?? '';
}

function buildFileIndex(root) {
  const index = new Map();
  if (!existsSync(root)) return index;

  function visit(path) {
    const stat = statSync(path);
    if (stat.isDirectory()) {
      readdirSync(path).forEach((entry) => visit(join(path, entry)));
      return;
    }
    index.set(basename(path), path);
  }

  visit(root);
  return index;
}

function parseArgs(args) {
  const values = new Map();
  const flags = new Set();
  const ids = new Set();

  args.forEach((arg) => {
    if (arg.startsWith('--id=')) {
      ids.add(arg.slice('--id='.length));
      return;
    }
    const equalIndex = arg.indexOf('=');
    if (arg.startsWith('--') && equalIndex > -1) {
      values.set(arg.slice(0, equalIndex), arg.slice(equalIndex + 1));
      return;
    }
    flags.add(arg);
  });

  const all = flags.has('--all');
  const images = all || flags.has('--images') || (!flags.has('--videos') && !flags.has('--copy-videos'));
  const videos = all || flags.has('--videos') || flags.has('--copy-videos');
  const limitValue = values.get('--limit');
  const timeoutValue = values.get('--timeout-ms');

  return {
    dryRun: flags.has('--dry-run'),
    force: flags.has('--force'),
    primaryOnly: flags.has('--primary-only'),
    images,
    videos,
    downloadImages: all || flags.has('--download-images'),
    copyVideos: all || flags.has('--copy-videos'),
    limit: parseOptionalPositiveInteger(limitValue),
    timeoutMs: parseOptionalPositiveInteger(timeoutValue) ?? 15_000,
    ids,
    videoSourceRoot: values.get('--video-source-root') ?? '',
  };
}

function findExistingImagePath(id, slot, image) {
  if (image.filePath && existsSync(resolve(image.filePath))) return image.filePath;

  const extension = extensionFromUrl(image.sourceUrl);
  const candidates = extension
    ? [`public/media/images/${id}/${slot}${extension}`]
    : ['.jpg', '.png', '.gif', '.webp'].map((candidateExtension) => `public/media/images/${id}/${slot}${candidateExtension}`);

  return candidates.find((path) => existsSync(resolve(path))) ?? '';
}

function runtimePathFromFilePath(filePath) {
  if (!filePath.startsWith('public/')) return '';
  return `/${filePath.slice('public/'.length)}`;
}

function parseOptionalPositiveInteger(value) {
  if (value === undefined) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function logProgress() {
  const total = report.downloadedImages.length + report.errors.length;
  if (total > 0 && total % 25 === 0) {
    console.log(`Processed ${total} image downloads...`);
  }
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function extensionFromUrl(url) {
  try {
    const extension = extname(new URL(url).pathname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)) return extension === '.jpeg' ? '.jpg' : extension;
  } catch {
    return '';
  }
  return '';
}

function extensionFromContentType(contentType) {
  const normalized = contentType.toLowerCase().split(';')[0].trim();
  if (normalized === 'image/jpeg') return '.jpg';
  if (normalized === 'image/png') return '.png';
  if (normalized === 'image/gif') return '.gif';
  if (normalized === 'image/webp') return '.webp';
  return '';
}

function imageDimensions(buffer) {
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
