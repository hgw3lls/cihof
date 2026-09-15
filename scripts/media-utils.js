import {
  copyFileSync,
  existsSync,
  linkSync,
  lstatSync,
  readFileSync,
  readdirSync,
  statSync,
  symlinkSync,
} from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';

export const VIDEO_EXTENSIONS = new Set(['.m4v', '.mkv', '.mov', '.mp4', '.webm']);
export const POSTER_EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png'];
export const CAPTION_EXTENSIONS = new Set(['.srt', '.vtt']);
export const CANONICAL_CAPTION_SUFFIXES = ['.en.vtt', '.vtt', '.en-orig.vtt', '.en.srt', '.srt'];
export const PREFERRED_CAPTION_SUFFIXES = [
  '.en.vtt',
  '.en-US.vtt',
  '.en-orig.vtt',
  '.vtt',
  '.en.srt',
  '.en-US.srt',
  '.srt',
];
export const SIDECAR_EXTENSIONS = new Set([...POSTER_EXTENSIONS, ...CAPTION_EXTENSIONS]);
export const MEDIA_EXTENSIONS = new Set([...VIDEO_EXTENSIONS, ...SIDECAR_EXTENSIONS]);

export function canonicalVideoPaths(personId, youtubeVideoId) {
  const directoryPath = `public/media/videos/${personId}`;
  const stemPath = `${directoryPath}/${personId}_${youtubeVideoId}`;
  return {
    directoryPath,
    stemPath,
    videoFilePath: `${stemPath}.mp4`,
  };
}

export function defaultVideoOutputPath(personId, youtubeVideoId) {
  return canonicalVideoPaths(personId, youtubeVideoId).videoFilePath;
}

export function resolveVideoStemPath(personId, asset) {
  const filePath = asset.filePath || '';
  return filePath ? stripExtension(filePath) : canonicalVideoPaths(personId, asset.youtubeVideoId).stemPath;
}

export function scanMediaFiles(scanRoots, options = {}) {
  const files = [];
  scanRoots.forEach((scanRoot) => {
    const rootPath = typeof scanRoot === 'string' ? scanRoot : scanRoot.absPath;
    if (rootPath && existsSync(rootPath)) walkMediaFiles(rootPath, files, options);
  });
  return files.sort(compareByRelativePath);
}

export function describeMediaFile(filePath, options = {}) {
  if (!existsSync(filePath)) return null;

  const stat = lstatSync(filePath).isSymbolicLink() ? statSync(filePath) : lstatSync(filePath);
  if (!stat.isFile() || stat.size <= 0) return null;

  const extension = extname(filePath).toLowerCase();
  const mediaExtensions = options.mediaExtensions ?? MEDIA_EXTENSIONS;
  if (!mediaExtensions.has(extension)) return null;

  return {
    absPath: resolve(filePath),
    relativePath: displayPath(filePath, options.repoRoot),
    extension,
    kind: mediaKindForExtension(extension, options),
    size: stat.size,
  };
}

export function indexFilesByYoutubeId(files, youtubeIdsToIndex) {
  const index = new Map(youtubeIdsToIndex.map((youtubeVideoId) => [youtubeVideoId, []]));
  files.forEach((file) => {
    youtubeIdsToIndex.forEach((youtubeVideoId) => {
      if (basename(file.absPath).includes(youtubeVideoId)) {
        index.get(youtubeVideoId).push(file);
      }
    });
  });
  return index;
}

export function addFilesToIndex(filesById, youtubeVideoId, files) {
  if (!filesById.has(youtubeVideoId)) filesById.set(youtubeVideoId, []);
  const existing = new Set(filesById.get(youtubeVideoId).map((file) => file.absPath));
  files.forEach((file) => {
    if (!file || existing.has(file.absPath)) return;
    filesById.get(youtubeVideoId).push(file);
    existing.add(file.absPath);
  });
}

export function suffixAfterYoutubeId(file, youtubeVideoId, options = {}) {
  const filePath = typeof file === 'string' ? file : file.absPath;
  const fileBase = basename(filePath);
  const idIndex = fileBase.indexOf(youtubeVideoId);
  if (idIndex < 0) return '';

  const suffix = fileBase.slice(idIndex + youtubeVideoId.length);
  if (!suffix.startsWith('.')) return '';

  const mediaExtensions = options.mediaExtensions ?? MEDIA_EXTENSIONS;
  const suffixExtension = mediaExtensions.has(suffix.toLowerCase()) ? suffix.toLowerCase() : extname(suffix).toLowerCase();
  return mediaExtensions.has(suffixExtension) ? suffix : '';
}

export function firstExistingPath(stemPath, suffixes, options = {}) {
  return suffixes.map((suffix) => `${stemPath}${suffix}`).find((filePath) => pathExists(filePath, options)) ?? '';
}

export function findCaptionFile(stemPath, asset, options = {}) {
  const explicit = asset.captionFilePath || '';
  if (explicit && existsRepoPath(explicit, options)) return explicit;

  const suffixes = options.suffixes ?? PREFERRED_CAPTION_SUFFIXES;
  const preferred = firstExistingPath(stemPath, suffixes, { ...options, requireNonEmpty: true });
  if (preferred) return preferred;

  if (options.includeDirectoryFallback === false) return '';

  const directory = dirname(resolveRepoPath(stemPath, options.repoRoot));
  const stemName = basename(stemPath);
  if (!existsSync(directory)) return '';

  const youtubeVideoId = asset.youtubeVideoId || '';
  return readdirSync(directory)
    .filter((fileName) => CAPTION_EXTENSIONS.has(extname(fileName).toLowerCase()))
    .filter((fileName) => fileName.startsWith(`${stemName}.`) || (youtubeVideoId && fileName.includes(youtubeVideoId)))
    .map((fileName) => displayPath(join(directory, fileName), options.repoRoot))
    .filter((filePath) => statMaybe(filePath, options)?.size > 0)
    .sort(compareCaptionCandidates(stemPath, youtubeVideoId, suffixes, options))
    [0] ?? '';
}

export function findTranscriptFile(stemPath, asset, options = {}) {
  const explicit = asset.transcriptFilePath || '';
  if (isCanonicalTranscriptPath(explicit) && existsRepoPath(explicit, options)) return explicit;

  const preferred = `${stemPath}.transcript.txt`;
  if (existsRepoPath(preferred, options)) return preferred;

  const directory = dirname(resolveRepoPath(stemPath, options.repoRoot));
  const stemName = basename(stemPath);
  if (!existsSync(directory)) return '';

  const youtubeVideoId = asset.youtubeVideoId || '';
  return readdirSync(directory)
    .filter((fileName) => fileName.endsWith('.transcript.txt'))
    .filter((fileName) => fileName.startsWith(`${stemName}.`) || (youtubeVideoId && fileName.includes(youtubeVideoId)))
    .map((fileName) => displayPath(join(directory, fileName), options.repoRoot))
    .filter((filePath) => statMaybe(filePath, options)?.size > 0)
    .sort()[0] ?? '';
}

export function setCaptionFields(asset, captionPath) {
  const changed = asset.captionFilePath !== captionPath || asset.captionRuntimePath !== runtimePathFor(captionPath);
  asset.captionFilePath = captionPath;
  asset.captionRuntimePath = runtimePathFor(captionPath);
  if (asset.captionStatus !== 'approved') asset.captionStatus = 'needs-review';
  return changed;
}

export function setTranscriptFields(asset, transcriptPath) {
  asset.transcriptFilePath = transcriptPath;
  asset.transcriptRuntimePath = runtimePathFor(transcriptPath);
  if (asset.transcriptStatus !== 'approved') asset.transcriptStatus = 'needs-review';
}

export function isCanonicalTranscriptPath(filePath) {
  return Boolean(filePath && filePath.endsWith('.transcript.txt'));
}

export function createLocalFileReference(sourcePath, targetPath, linkMode = 'hardlink') {
  if (linkMode === 'copy') {
    copyFileSync(sourcePath, targetPath);
    return;
  }

  if (linkMode === 'symlink') {
    symlinkSync(relative(dirname(targetPath), sourcePath), targetPath);
    return;
  }

  try {
    linkSync(sourcePath, targetPath);
  } catch (error) {
    if (error.code !== 'EXDEV' && error.code !== 'EPERM') throw error;
    copyFileSync(sourcePath, targetPath);
  }
}

export function stripExtension(filePath) {
  const extension = extname(filePath).toLowerCase();
  return VIDEO_EXTENSIONS.has(extension) ? filePath.slice(0, -extension.length) : filePath.replace(/\.[^.]+$/, '');
}

export function youtubeWatchUrl(youtubeVideoId) {
  return `https://www.youtube.com/watch?v=${youtubeVideoId}`;
}

export function runtimePathFor(filePath) {
  return `/${filePath.replace(/^public\//, '').replace(/^\/+/, '')}`;
}

export function existsRepoPath(filePath, options = {}) {
  return Boolean(filePath && statMaybe(filePath, options)?.size > 0);
}

export function pathExists(filePath, options = {}) {
  if (!filePath) return false;
  if (options.requireNonEmpty) return existsRepoPath(filePath, options);
  return existsSync(resolveRepoPath(filePath, options.repoRoot));
}

export function statMaybe(filePath, options = {}) {
  try {
    return statSync(resolveRepoPath(filePath, options.repoRoot));
  } catch {
    return null;
  }
}

export function resolveRepoPath(filePath, repoRoot = process.cwd()) {
  const root = typeof repoRoot === 'string' ? repoRoot : process.cwd();
  return resolve(root, filePath);
}

export function displayPath(filePath, repoRoot = process.cwd()) {
  const root = typeof repoRoot === 'string' ? repoRoot : process.cwd();
  const relativePath = relative(root, resolve(filePath));
  return relativePath && !relativePath.startsWith('..') ? relativePath : filePath;
}

export function compareByRelativePath(left, right) {
  return left.relativePath.localeCompare(right.relativePath);
}

function walkMediaFiles(directory, files, options) {
  readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      walkMediaFiles(filePath, files, options);
      return;
    }

    const file = describeMediaFile(filePath, options);
    if (file) files.push(file);
  });
}

function mediaKindForExtension(extension, options) {
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (options.sidecarsAsSingleKind) return 'sidecar';
  if (POSTER_EXTENSIONS.includes(extension)) return 'poster';
  if (CAPTION_EXTENSIONS.has(extension)) return 'caption';
  return 'sidecar';
}

function compareCaptionCandidates(stemPath, youtubeVideoId, suffixes, options) {
  return (left, right) => {
    const leftScore = captionCandidateScore(left, stemPath, youtubeVideoId, suffixes, options);
    const rightScore = captionCandidateScore(right, stemPath, youtubeVideoId, suffixes, options);
    if (leftScore !== rightScore) return leftScore - rightScore;
    return left.localeCompare(right);
  };
}

function captionCandidateScore(filePath, stemPath, youtubeVideoId, suffixes, options) {
  const stem = displayPath(resolveRepoPath(stemPath, options.repoRoot), options.repoRoot);
  const suffix = filePath.startsWith(stem) ? filePath.slice(stem.length) : '';
  const preferredIndex = suffixes.indexOf(suffix);
  if (preferredIndex >= 0) return preferredIndex;
  if (youtubeVideoId && basename(filePath).includes(youtubeVideoId)) return 20;
  return 40;
}
