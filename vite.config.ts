import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const buildTarget = process.env.CIHOF_BUILD_TARGET === 'portal' ? 'portal' : 'kiosk';
const defaultBase = process.env.NODE_ENV === 'production' ? '/cihof/' : '/';
const base = process.env.CIHOF_BASE_PATH || defaultBase;
const outDir = process.env.CIHOF_OUT_DIR || (buildTarget === 'portal' ? 'dist-portal' : 'dist');
const buildInfo = createBuildInfo();

export default defineConfig({
  base,
  build: {
    outDir,
    rollupOptions: {
      input: buildTarget === 'portal' ? 'portal.html' : 'index.html',
    },
  },
  define: {
    __CIHOF_BUILD_INFO__: JSON.stringify(buildInfo),
  },
  plugins: [react(), buildInfoPlugin()],
});

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

function readGitValue(command: string) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}
