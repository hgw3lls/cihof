#!/usr/bin/env node
import { existsSync, linkSync, lstatSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';

const MEDIA_EXTENSIONS = new Set(['.jpg', '.jpeg', '.m4v', '.mkv', '.mov', '.mp4', '.png', '.srt', '.vtt', '.webm', '.webp']);
const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const root = resolve(process.cwd(), args.root ?? 'dist/media/videos');
const files = existsSync(root) ? collectFiles(root) : [];
const groups = groupDuplicateCandidates(files);
const report = dedupeGroups(groups);

console.log(`${args.execute ? 'Executed' : 'Dry run'} video hardlink dedupe for ${displayPath(root)}.`);
console.log(`Scanned files: ${files.length}.`);
console.log(`Duplicate groups: ${report.duplicateGroups}.`);
console.log(`${args.execute ? 'Hardlinked' : 'Would hardlink'} duplicate files: ${report.duplicateFiles}.`);
console.log(`Bytes that can share storage: ${formatBytes(report.duplicateBytes)}.`);
if (report.errors.length) {
  console.log(`Errors: ${report.errors.length}`);
  report.errors.slice(0, 10).forEach((error) => console.log(`- ${error}`));
}

function dedupeGroups(candidateGroups) {
  const errors = [];
  let duplicateGroups = 0;
  let duplicateFiles = 0;
  let duplicateBytes = 0;

  candidateGroups.forEach((sameFiles) => {
    sameFiles.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    const source = sameFiles.find((file) => file.linkCount > 1) ?? sameFiles[0];
    const duplicates = sameFiles.filter((file) => file.absPath !== source.absPath && file.inodeKey !== source.inodeKey);
    if (duplicates.length === 0) return;

    duplicateGroups += 1;
    duplicateFiles += duplicates.length;
    duplicateBytes += duplicates.reduce((total, file) => total + file.size, 0);

    if (!args.execute) return;

    duplicates.forEach((file) => {
      try {
        unlinkSync(file.absPath);
        linkSync(source.absPath, file.absPath);
      } catch (error) {
        errors.push(`${source.relativePath} -> ${file.relativePath}: ${error.message}`);
      }
    });
  });

  return { duplicateGroups, duplicateFiles, duplicateBytes, errors };
}

function collectFiles(directory) {
  const collected = [];
  walk(directory, collected);
  return collected;
}

function walk(directory, collected) {
  readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(path, collected);
      return;
    }

    const file = describeFile(path);
    if (file) collected.push(file);
  });
}

function describeFile(path) {
  const stat = lstatSync(path).isSymbolicLink() ? statSync(path) : lstatSync(path);
  if (!stat.isFile() || stat.size <= 0) return null;
  const extension = extname(path).toLowerCase();
  if (!MEDIA_EXTENSIONS.has(extension)) return null;
  return {
    absPath: resolve(path),
    relativePath: displayPath(path),
    extension,
    size: stat.size,
    linkCount: stat.nlink,
    inodeKey: `${stat.dev}:${stat.ino}`,
    duplicateKey: duplicateKey(path, stat.size),
  };
}

function groupDuplicateCandidates(filesToGroup) {
  const grouped = new Map();
  filesToGroup.forEach((file) => {
    if (!file.duplicateKey) return;
    if (!grouped.has(file.duplicateKey)) grouped.set(file.duplicateKey, []);
    grouped.get(file.duplicateKey).push(file);
  });
  return Array.from(grouped.values()).filter((group) => group.length > 1);
}

function duplicateKey(path, size) {
  const fileBase = basename(path);
  const youtubeVideoId = extractYoutubeVideoId(fileBase);
  if (!youtubeVideoId) return '';
  const suffix = fileBase.slice(fileBase.indexOf(youtubeVideoId) + youtubeVideoId.length);
  return `${youtubeVideoId}:${suffix}:${size}`;
}

function extractYoutubeVideoId(fileBase) {
  const match = fileBase.match(/_([A-Za-z0-9_-]{11})(?:\.|$)/);
  return match?.[1] ?? '';
}

function displayPath(path) {
  const relativePath = relative(process.cwd(), resolve(path));
  return relativePath && !relativePath.startsWith('..') ? relativePath : path;
}

function formatBytes(bytes) {
  if (bytes > 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
  if (bytes > 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  return `${bytes} bytes`;
}

function parseArgs(values) {
  const parsed = { execute: false, help: false };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const [key, inlineValue] = value.includes('=') ? value.split(/=(.*)/s, 2) : [value, undefined];
    if (value === '--execute') parsed.execute = true;
    else if (value === '--help' || value === '-h') parsed.help = true;
    else if (key === '--root') parsed.root = inlineValue ?? values[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/dedupe-video-hardlinks.js
  node scripts/dedupe-video-hardlinks.js --execute

Deduplicates repeated video/media files under dist/media/videos by replacing
identical duplicate files with hardlinks. This is intended for generated offline
bundles after Vite has copied public/media/videos without preserving hardlinks.
`);
}
