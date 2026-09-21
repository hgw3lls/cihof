import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, linkSync, lstatSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { isVisitorReadyVideo, type VisitorMediaTarget } from './src/app/mediaPublication.ts';

const buildTarget = process.env.CIHOF_BUILD_TARGET === 'portal' ? 'portal' : process.env.CIHOF_BUILD_TARGET === 'public' ? 'public' : 'kiosk';
const defaultBase = process.env.NODE_ENV === 'production' ? '/cihof/' : '/';
const base = process.env.CIHOF_BASE_PATH || defaultBase;
const outDir = process.env.CIHOF_OUT_DIR || (buildTarget === 'portal' ? 'dist-portal' : 'dist');
const buildInfo = createBuildInfo();
const mediaPublicPaths = buildTarget === 'portal' ? null : readMediaPublicPaths(buildTarget);

export default defineConfig(({ command }) => ({
  base,
  publicDir: command === 'build' ? false : 'public',
  build: {
    outDir,
    rollupOptions: {
      input: buildTarget === 'portal' ? 'portal.html' : 'index.html',
    },
  },
  define: {
    __CIHOF_BUILD_INFO__: JSON.stringify(buildInfo),
  },
  plugins: [react(), buildInfoPlugin(), selectivePublicCopyPlugin()],
}));

function buildInfoPlugin(): Plugin {
  return {
    name: 'cihof-build-info',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'data/build-info.json',
        source: `${JSON.stringify(buildInfo, null, 2)}\n`,
      });
    },
  };
}

function selectivePublicCopyPlugin(): Plugin {
  return {
    name: 'cihof-selective-public-copy',
    apply: 'build',
    writeBundle() {
      const publicRoot = resolve('public');
      if (!existsSync(publicRoot)) return;

      const stats = copyPublicAssets(publicRoot, resolve(outDir));
      this.info(
        `copied public assets: ${stats.copiedFiles} copied (${formatBytes(stats.copiedBytes)}), ` +
          `${stats.hardlinkedFiles} hardlinked (${formatBytes(stats.hardlinkedBytes)}), ` +
          `${stats.skippedFiles} skipped for ${buildTarget}`,
      );
    },
  };
}

type CopyStats = {
  copiedFiles: number;
  copiedBytes: number;
  hardlinkedFiles: number;
  hardlinkedBytes: number;
  skippedFiles: number;
};

function copyPublicAssets(publicRoot: string, outputRoot: string) {
  const stats: CopyStats = {
    copiedFiles: 0,
    copiedBytes: 0,
    hardlinkedFiles: 0,
    hardlinkedBytes: 0,
    skippedFiles: 0,
  };

  copyPublicDirectory(publicRoot, outputRoot, publicRoot, stats);
  return stats;
}

function copyPublicDirectory(sourceDirectory: string, outputRoot: string, publicRoot: string, stats: CopyStats) {
  for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
    const sourcePath = join(sourceDirectory, entry.name);
    const publicPath = toPublicPath(relative(publicRoot, sourcePath));

    if (shouldSkipPublicPath(publicPath, entry.isDirectory())) {
      stats.skippedFiles += entry.isDirectory() ? countFiles(sourcePath) : 1;
      continue;
    }

    if (entry.isDirectory()) {
      copyPublicDirectory(sourcePath, outputRoot, publicRoot, stats);
      continue;
    }

    if (!entry.isFile()) continue;
    copyPublicFile(sourcePath, join(outputRoot, publicPath), publicPath, stats);
  }
}

function copyPublicFile(sourcePath: string, targetPath: string, publicPath: string, stats: CopyStats) {
  const sourceStat = lstatSync(sourcePath);
  if (!sourceStat.isFile()) return;

  mkdirSync(dirname(targetPath), { recursive: true });
  if (existsSync(targetPath)) unlinkSync(targetPath);

  if (buildTarget !== 'portal' && visitorDataPaths.has(publicPath)) {
    const output = visitorDataJson(sourcePath, publicPath, buildTarget);
    writeFileSync(targetPath, output);
    stats.copiedFiles += 1;
    stats.copiedBytes += Buffer.byteLength(output);
    return;
  }

  if (buildTarget === 'kiosk' && publicPath.startsWith('media/videos/')) {
    try {
      linkSync(sourcePath, targetPath);
      stats.hardlinkedFiles += 1;
      stats.hardlinkedBytes += sourceStat.size;
      return;
    } catch {
      // Fall back to a normal copy when hardlinks are not supported by the filesystem.
    }
  }

  copyFileSync(sourcePath, targetPath);
  stats.copiedFiles += 1;
  stats.copiedBytes += sourceStat.size;
}

function shouldSkipPublicPath(publicPath: string, isDirectory = false) {
  if (!publicPath || publicPath.endsWith('/.DS_Store') || publicPath === '.DS_Store') return true;
  if (publicPath === 'fonts/exhibit' || publicPath.startsWith('fonts/exhibit/')) return true;
  if (buildTarget !== 'portal' && publicPath === 'data/source-curation-packet.json') return true;
  if (publicPath === 'media/videos' || publicPath.startsWith('media/videos/')) {
    if (buildTarget === 'portal') return true;
    return !isDirectory && !mediaPublicPaths?.has(publicPath);
  }
  return false;
}

const visitorDataPaths = new Set([
  'data/media-manifest.json',
  'data/cihof-runtime-data.json',
  'data/inductees.json',
  'data/entities.json',
  'data/entity-relationships.json',
  'data/linked-art-export.json',
  'data/cidoc-crm-export.json',
]);

const provisionalRelationshipTypes = new Set([
  'inducted_by_candidate',
  'legacy_related_candidate',
  'related_to',
]);

function countFiles(path: string): number {
  const stat = lstatSync(path);
  if (stat.isFile()) return 1;
  if (!stat.isDirectory()) return 0;
  return readdirSync(path, { withFileTypes: true }).reduce((count, entry) => count + countFiles(join(path, entry.name)), 0);
}

function toPublicPath(path: string) {
  return path.split(/[\\/]+/).filter(Boolean).join('/');
}

function formatBytes(bytes: number) {
  if (bytes > 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
  if (bytes > 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} bytes`;
}

function createBuildInfo() {
  const packageJson = readPackageJson();
  const gitCommit = process.env.GITHUB_SHA || readGitValue('git rev-parse HEAD');
  const gitCommitShort = gitCommit === 'unknown' ? 'unknown' : gitCommit.slice(0, 12);

  return {
    schemaVersion: 1,
    appName: 'CIHOF Portrait Wall',
    packageName: packageJson.name ?? 'cihof-rebuild',
    packageVersion: packageJson.version ?? '0.0.0',
    buildTarget,
    mode: process.env.NODE_ENV || 'development',
    basePath: base,
    outDir,
    gitCommit,
    gitCommitShort,
    gitBranch: process.env.GITHUB_REF_NAME || readGitValue('git rev-parse --abbrev-ref HEAD'),
    builtAt: process.env.CIHOF_BUILD_TIME || new Date().toISOString(),
  };
}

function readPackageJson(): { name?: string; version?: string } {
  try {
    return JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  } catch {
    return {};
  }
}

function readMediaPublicPaths(target: VisitorMediaTarget) {
  try {
    const manifest = JSON.parse(readFileSync(resolve('data/media_manifest.json'), 'utf8')) as {
      assets?: Record<string, { videos?: Array<Record<string, unknown>> }>;
    };
    const paths = new Set<string>();

    for (const record of Object.values(manifest.assets ?? {})) {
      for (const video of record.videos ?? []) {
        if (!isVisitorReadyVideo(video, target)) continue;
        for (const [key, value] of Object.entries(video)) {
          if ((key !== 'filePath' && !key.endsWith('FilePath')) || typeof value !== 'string') continue;
          const publicPath = toPublicPath(value.replace(/^public\//, ''));
          if (publicPath.startsWith('media/videos/')) paths.add(publicPath);
        }
      }
    }

    return paths;
  } catch {
    return null;
  }
}

function visitorDataJson(sourcePath: string, publicPath: string, target: VisitorMediaTarget) {
  const document = JSON.parse(readFileSync(sourcePath, 'utf8')) as Record<string, unknown>;
  if (publicPath === 'data/media-manifest.json') {
    return `${JSON.stringify(visitorMediaManifest(document, target), null, 2)}\n`;
  }

  const mediaManifest = readVisitorMediaManifest(target);
  if (publicPath === 'data/inductees.json') {
    const inductees = Array.isArray(document)
      ? document.map((value) => visitorInductee(value, mediaManifest))
      : document;
    return `${JSON.stringify(inductees, null, 2)}\n`;
  }

  const removedEntityIds = readRemovedVisitorEntityIds();
  if (publicPath === 'data/entities.json') {
    return `${JSON.stringify(visitorEntities(document, mediaManifest), null, 2)}\n`;
  }
  if (publicPath === 'data/entity-relationships.json') {
    return `${JSON.stringify(visitorEntityRelationships(document, removedEntityIds), null, 2)}\n`;
  }
  if (publicPath === 'data/linked-art-export.json') {
    return `${JSON.stringify(visitorLinkedArt(document), null, 2)}\n`;
  }
  if (publicPath === 'data/cidoc-crm-export.json') {
    return `${JSON.stringify(visitorCidocCrm(document), null, 2)}\n`;
  }

  const runtimeMediaManifest = visitorMediaManifest(asRecord(document.mediaManifest), target);
  const inductees = Array.isArray(document.inductees)
    ? document.inductees.map((value) => visitorInductee(value, runtimeMediaManifest))
    : document.inductees;
  const entities = visitorEntities(asRecord(document.entities), runtimeMediaManifest);
  const entityRelationships = visitorEntityRelationships(asRecord(document.entityRelationships), removedEntityIds);
  return `${JSON.stringify({ ...document, inductees, mediaManifest: runtimeMediaManifest, entities, entityRelationships }, null, 2)}\n`;
}

function readVisitorMediaManifest(target: VisitorMediaTarget) {
  try {
    const document = JSON.parse(readFileSync(resolve('public/data/media-manifest.json'), 'utf8')) as Record<string, unknown>;
    return visitorMediaManifest(document, target);
  } catch {
    return { assets: {} };
  }
}

function readRemovedVisitorEntityIds() {
  try {
    const document = JSON.parse(readFileSync(resolve('public/data/entities.json'), 'utf8')) as Record<string, unknown>;
    return removedVisitorEntityIds(document);
  } catch {
    return new Set<string>();
  }
}

function removedVisitorEntityIds(document: Record<string, unknown>) {
  const entities = Array.isArray(document.entities) ? document.entities : [];
  return new Set(entities.filter(isVisitorRemovedEntity).map((value) => String(asRecord(value).id)));
}

function visitorEntities(document: Record<string, unknown>, mediaManifest: Record<string, unknown>) {
  const removedEntityIds = removedVisitorEntityIds(document);
  const visitorVideoPersonIds = new Set(Object.entries(asRecord(mediaManifest.assets))
    .filter(([, value]) => Array.isArray(asRecord(value).videos) && asRecord(value).videos.length > 0)
    .map(([id]) => id));
  const entities = Array.isArray(document.entities)
    ? document.entities.filter((value) => !isVisitorRemovedEntity(value)).map((value) => {
        const entity = asRecord(value);
        const media = Array.isArray(entity.media)
          ? entity.media.filter((item) => {
              const record = asRecord(item);
              return record.kind !== 'video' && !removedEntityIds.has(String(record.entityId));
            })
          : entity.media;
        const rawAttributes = asRecord(entity.attributes);
        const { relatedIds: _relatedIds, ...visitorAttributes } = rawAttributes;
        const attributes = entity.type === 'Person'
          ? { ...visitorAttributes, hasVideo: visitorVideoPersonIds.has(String(rawAttributes.legacyInducteeId)) }
          : entity.attributes;
        return { ...entity, media, attributes };
      })
    : document.entities;
  return { ...document, entities };
}

function isVideoEntity(value: unknown) {
  const entity = asRecord(value);
  return entity.type === 'Media' && asRecord(entity.attributes).mediaType === 'video';
}

function isCandidateEntity(value: unknown) {
  return asRecord(asRecord(value).attributes).candidateEntity === true;
}

function isVisitorRemovedEntity(value: unknown) {
  return isVideoEntity(value) || isCandidateEntity(value);
}

function visitorEntityRelationships(document: Record<string, unknown>, removedEntityIds: Set<string>) {
  const relationships = Array.isArray(document.relationships)
    ? document.relationships.filter((value) => {
        const relationship = asRecord(value);
        return !removedEntityIds.has(String(relationship.sourceEntityId))
          && !removedEntityIds.has(String(relationship.targetEntityId))
          && !isProvisionalRelationshipType(relationship.type)
          && !isVideoSourceField(asRecord(relationship.provenance).sourceField);
      })
    : document.relationships;
  return { ...document, relationships };
}

function visitorLinkedArt(document: Record<string, unknown>) {
  const key = '_cihof_relationship_assertions';
  const assertions = Array.isArray(document[key])
    ? document[key].filter((value) => {
        const assertion = asRecord(value);
        return !isProvisionalRelationshipType(assertion.type)
          && !isVideoSourceField(asRecord(assertion.provenance).sourceField);
      })
    : document[key];
  return { ...document, [key]: assertions };
}

function visitorCidocCrm(document: Record<string, unknown>) {
  const componentsKey = 'crm:P46_is_composed_of';
  const relationshipsKey = 'crm:P67_refers_to';
  const components = Array.isArray(document[componentsKey])
    ? document[componentsKey].filter((value) => {
        const cihof = asRecord(asRecord(value).cihof);
        const attributes = asRecord(cihof.attributes);
        return attributes.mediaType !== 'video' && attributes.candidateEntity !== true && cihof.candidateEntity !== true;
      })
    : document[componentsKey];
  const relationships = Array.isArray(document[relationshipsKey])
    ? document[relationshipsKey].filter((value) => {
        const relationship = asRecord(value);
        return !isProvisionalRelationshipType(relationship['crm:P2_has_type'])
          && !isVideoSourceField(asRecord(asRecord(relationship.cihof).provenance).sourceField);
      })
    : document[relationshipsKey];
  return { ...document, [componentsKey]: components, [relationshipsKey]: relationships };
}

function isVideoSourceField(value: unknown) {
  return value === 'localVideoPaths' || value === 'youtubeVideoIds' || value === 'videoUrls';
}

function isProvisionalRelationshipType(value: unknown) {
  return typeof value === 'string' && provisionalRelationshipTypes.has(value);
}

function visitorMediaManifest(document: Record<string, unknown>, target: VisitorMediaTarget) {
  const assets = asRecord(document.assets);
  const filteredAssets = Object.fromEntries(Object.entries(assets).map(([id, value]) => {
    const record = asRecord(value);
    const videos = Array.isArray(record.videos)
      ? record.videos.filter((video) => isVisitorReadyVideo(asRecord(video), target)).map((video) => visitorVideo(asRecord(video), target))
      : [];
    return [id, { ...record, videos }];
  }));
  return { ...document, assets: filteredAssets };
}

function visitorVideo(video: Record<string, unknown>, target: VisitorMediaTarget) {
  return {
    runtimePath: video.runtimePath,
    posterRuntimePath: video.posterRuntimePath,
    captionRuntimePath: video.captionRuntimePath,
    transcriptRuntimePath: video.transcriptRuntimePath,
    transcript: video.transcript,
    durationSeconds: video.durationSeconds,
    codec: video.codec,
    rightsStatus: 'approved',
    captionStatus: 'approved',
    transcriptStatus: 'approved',
    ...(target === 'public' ? { approvedForPublicWeb: true } : { approvedForKiosk: true }),
    title: video.title,
    description: video.description,
  };
}

function visitorInductee(value: unknown, mediaManifest: Record<string, unknown>) {
  const person = asRecord(value);
  const { videoUrls: _videoUrls, youtubeVideoIds: _youtubeVideoIds, localVideoPaths: _localVideoPaths,
    videoRightsStatus: _videoRightsStatus, mediaReviewStatus: _mediaReviewStatus, relatedIds: _relatedIds,
    ...visitor } = person;
  const record = asRecord(asRecord(mediaManifest.assets)[String(person.id)]);
  const videos = Array.isArray(record.videos) ? record.videos : [];
  return { ...visitor, hasVideo: videos.length > 0 };
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function readGitValue(command: string) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}
