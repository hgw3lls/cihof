import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, linkSync, lstatSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const buildTarget = process.env.CIHOF_BUILD_TARGET === 'portal' ? 'portal' : process.env.CIHOF_BUILD_TARGET === 'public' ? 'public' : 'kiosk';
const defaultBase = process.env.NODE_ENV === 'production' ? '/cihof/' : '/';
const base = process.env.CIHOF_BASE_PATH || defaultBase;
const outDir = process.env.CIHOF_OUT_DIR || (buildTarget === 'portal' ? 'dist-portal' : 'dist');
const buildInfo = createBuildInfo();
const mediaPublicPaths = buildTarget === 'portal' ? null : readMediaPublicPaths(buildTarget === 'public');

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
  if (publicPath === 'media/videos' || publicPath.startsWith('media/videos/')) {
    if (buildTarget === 'portal') return true;
    if (buildTarget === 'public') return !isDirectory && !mediaPublicPaths?.has(publicPath);
    return Boolean(mediaPublicPaths && !isDirectory && !mediaPublicPaths.has(publicPath));
  }
  return false;
}

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

function readMediaPublicPaths(approvedOnly: boolean) {
  try {
    const manifest = JSON.parse(readFileSync(resolve('data/media_manifest.json'), 'utf8')) as {
      assets?: Record<string, { videos?: Array<Record<string, unknown>> }>;
    };
    const paths = new Set<string>();

    for (const record of Object.values(manifest.assets ?? {})) {
      for (const video of record.videos ?? []) {
        if (approvedOnly && !(video.approvedForKiosk === true && video.rightsStatus === 'approved'
          && video.captionStatus === 'approved' && video.transcriptStatus === 'approved'
          && video.runtimePath && video.posterRuntimePath && video.captionRuntimePath && video.transcriptRuntimePath)) continue;
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

function readGitValue(command: string) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}
