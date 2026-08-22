import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const manifestPath = resolve('data/media_manifest.json');
const outputRoot = resolve('public/media/portraits');
const runtimeRoot = '/media/portraits';
const generatorVersion = 2;
const displayTreatment = 'source-aware 4:5 color derivative; no color or tone retouching';
const cropDescription = '4:5 source-aware crop or matte fit';
const targetAspectRatio = 4 / 5;
const matteColor = '#efe3c7';
const force = process.argv.includes('--force');
const reportOnly = process.argv.includes('--report-only');
const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const onlyIds = onlyArg ? new Set(onlyArg.replace('--only=', '').split(',').map((id) => id.trim()).filter(Boolean)) : null;
const limit = limitArg ? Number.parseInt(limitArg.replace('--limit=', ''), 10) : 0;

const variants = [
  { key: 'wall', fileName: 'wall.jpg', width: 480, height: 600, role: 'portrait-wall-display' },
  { key: 'profile', fileName: 'profile.jpg', width: 720, height: 900, role: 'profile-display' },
  { key: 'thumbnail', fileName: 'thumbnail.jpg', width: 240, height: 300, role: 'portrait-thumbnail' },
];

if (!existsSync(manifestPath)) {
  console.error(`${manifestPath} was not found. Run npm run media:manifest and npm run media:localize first.`);
  process.exit(1);
}

assertMagickAvailable();

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const assets = manifest?.assets && typeof manifest.assets === 'object' && !Array.isArray(manifest.assets)
  ? manifest.assets
  : {};
const entries = Object.entries(assets).filter(([id]) => !onlyIds || onlyIds.has(id)).slice(0, limit > 0 ? limit : undefined);
const report = {
  processed: 0,
  generated: 0,
  reused: 0,
  stale: 0,
  skipped: 0,
  missing: [],
};

for (const [id, record] of entries) {
  const primary = record?.images?.primary;
  const sourceFile = findSourceFile(primary);

  if (!sourceFile) {
    report.skipped += 1;
    report.missing.push(id);
    continue;
  }

  report.processed += 1;
  const sourceDimensions = sourceImageDimensions(primary, sourceFile);
  const sourceChecksumSha256 = primary?.checksumSha256 || checksum(sourceFile);
  const treatment = portraitTreatment(sourceDimensions.width, sourceDimensions.height);
  const existingPortraits = record.images?.portraits && typeof record.images.portraits === 'object' ? record.images.portraits : {};
  const portraitRecord = {};

  for (const variant of variants) {
    const filePath = `public/media/portraits/${id}/${variant.fileName}`;
    const runtimePath = `${runtimeRoot}/${id}/${variant.fileName}`;
    const outputFile = resolve(filePath);
    const derivativeExists = existsSync(outputFile);
    const staleDerivative = derivativeExists && isStaleDerivative(existingPortraits[variant.key], sourceChecksumSha256, variant, treatment);

    if (reportOnly) {
      if (staleDerivative) report.stale += 1;
      else if (derivativeExists) report.reused += 1;
    } else {
      mkdirSync(dirname(outputFile), { recursive: true });
      if (force || !derivativeExists || staleDerivative) {
        generateVariant(sourceFile, outputFile, variant, treatment);
        report.generated += 1;
      } else {
        report.reused += 1;
      }
    }

    const checksumSha256 = existsSync(outputFile) ? checksum(outputFile) : '';
    portraitRecord[variant.key] = {
      sourceUrl: primary?.sourceUrl ?? '',
      filePath,
      runtimePath,
      checksumSha256,
      width: variant.width,
      height: variant.height,
      altText: primary?.altText ?? `${record.name ?? id} portrait.`,
      primary: variant.key === 'wall',
      role: variant.role,
      generated: true,
      generatorVersion,
      sourceAssetRuntimePath: primary?.runtimePath ?? '',
      sourceAssetChecksumSha256: sourceChecksumSha256,
      displayTreatment,
      fitMode: treatment.fitMode,
      rightsStatus: primary?.rightsStatus ?? 'needs-review',
      approvedForKiosk: primary?.approvedForKiosk ?? false,
      provenance: {
        source: 'scripts/prepare-portraits.js',
        confidence: 'curated',
        note: 'Generated display derivative from the localized primary image. Original source image is preserved in images.primary.',
      },
    };
  }

  if (!reportOnly) {
    record.images = {
      ...(record.images ?? {}),
      portraits: portraitRecord,
      portraitQuality: {
        generator: 'scripts/prepare-portraits.js',
        generatorVersion,
        crop: cropDescription,
        sourceFilePath: relativePath(sourceFile),
        sourceRuntimePath: primary?.runtimePath ?? '',
        sourceWidth: sourceDimensions.width,
        sourceHeight: sourceDimensions.height,
        aspectRatio: treatment.aspectRatio,
        fitMode: treatment.fitMode,
        qualityLabel: qualityLabel(sourceDimensions.width, sourceDimensions.height),
        reviewFlags: treatment.reviewFlags,
        reviewRecommendation: treatment.reviewRecommendation,
        notes: qualityNotes(sourceDimensions.width, sourceDimensions.height, treatment),
      },
    };
  }
}

if (!reportOnly) {
  manifest.reviewGuidance = {
    ...(manifest.reviewGuidance ?? {}),
    portraits: 'Generated portrait derivatives are display crops only. Review the original primary image, rights status, and crop quality before final kiosk approval.',
  };
  manifest.source = {
    ...(manifest.source ?? {}),
    portraitDerivativeGenerator: 'scripts/prepare-portraits.js',
    portraitDerivativeGeneratorVersion: generatorVersion,
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

console.log(
  `Portrait derivatives: ${report.processed} processed, ${report.generated} generated, ${report.reused} reused, ${report.stale} stale, ${report.skipped} skipped.`,
);
if (report.missing.length > 0) {
  console.log(`Missing source images: ${report.missing.join(', ')}`);
}
if (reportOnly) {
  console.log('Report-only mode did not write files or update the manifest.');
}

function assertMagickAvailable() {
  try {
    execFileSync('magick', ['-version'], { stdio: 'ignore' });
  } catch {
    console.error('ImageMagick is required for portrait preparation. Install the magick command, then re-run this script.');
    process.exit(1);
  }
}

function findSourceFile(asset) {
  const candidates = [
    asset?.filePath,
    asset?.runtimePath ? `public/${asset.runtimePath.replace(/^\/+/, '')}` : '',
    asset?.sourceUrl?.startsWith('/media/') ? `public/${asset.sourceUrl.replace(/^\/+/, '')}` : '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const absolutePath = resolve(candidate);
    if (existsSync(absolutePath) && statSync(absolutePath).isFile()) return absolutePath;
  }

  return '';
}

function sourceImageDimensions(asset, sourceFile) {
  const width = positiveInteger(asset?.width);
  const height = positiveInteger(asset?.height);
  if (width && height) return { width, height };

  try {
    const output = execFileSync('magick', ['identify', '-format', '%w %h', sourceFile], { encoding: 'utf8' }).trim();
    const [identifiedWidth, identifiedHeight] = output.split(/\s+/).map((value) => Number.parseInt(value, 10));
    return {
      width: positiveInteger(identifiedWidth) ?? 0,
      height: positiveInteger(identifiedHeight) ?? 0,
    };
  } catch {
    return { width: 0, height: 0 };
  }
}

function generateVariant(sourceFile, outputFile, variant, treatment) {
  const resizeMode = treatment.fitMode === 'contain'
    ? [`${variant.width}x${variant.height}`, '-background', matteColor, '-gravity', 'Center']
    : [`${variant.width}x${variant.height}^`, '-gravity', 'North'];

  execFileSync(
    'magick',
    [
      sourceFile,
      '-auto-orient',
      '-colorspace',
      'sRGB',
      '-resize',
      ...resizeMode,
      '-extent',
      `${variant.width}x${variant.height}`,
      '-strip',
      '-quality',
      '88',
      outputFile,
    ],
    { stdio: 'pipe' },
  );
}

function isStaleDerivative(existingAsset, sourceChecksumSha256, variant, treatment) {
  if (!existingAsset || typeof existingAsset !== 'object') return true;
  return (
    existingAsset.sourceAssetChecksumSha256 !== sourceChecksumSha256 ||
    existingAsset.generatorVersion !== generatorVersion ||
    existingAsset.width !== variant.width ||
    existingAsset.height !== variant.height ||
    existingAsset.displayTreatment !== displayTreatment ||
    existingAsset.fitMode !== treatment.fitMode
  );
}

function checksum(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function qualityLabel(width, height) {
  const shortestSide = Math.min(width || 0, height || 0);
  if (shortestSide >= 900) return 'high-resolution-source';
  if (shortestSide >= 520) return 'standard-source';
  if (shortestSide >= 300) return 'usable-source';
  if (shortestSide > 0) return 'low-resolution-source';
  return 'unknown-source-resolution';
}

function portraitTreatment(width, height) {
  const aspectRatio = width > 0 && height > 0 ? width / height : 0;
  const reviewFlags = [];

  if (!aspectRatio) reviewFlags.push('unknown-resolution');
  if (aspectRatio > 1.35) reviewFlags.push('wide-source');
  if (aspectRatio > 0 && aspectRatio < 0.58) reviewFlags.push('tall-source');

  const shortestSide = Math.min(width || 0, height || 0);
  if (shortestSide > 0 && shortestSide < 300) reviewFlags.push('low-resolution-source');
  else if (shortestSide >= 300 && shortestSide < 520) reviewFlags.push('usable-but-small-source');

  const fitMode = reviewFlags.includes('wide-source') || reviewFlags.includes('tall-source') ? 'contain' : 'cover';
  const reviewRecommendation = recommendationForTreatment(reviewFlags, fitMode);

  return {
    aspectRatio: aspectRatio ? Number(aspectRatio.toFixed(3)) : 0,
    fitMode,
    reviewFlags,
    reviewRecommendation,
  };
}

function recommendationForTreatment(reviewFlags, fitMode) {
  if (reviewFlags.includes('unknown-resolution')) return 'Source dimensions could not be verified; inspect manually before installation.';
  if (reviewFlags.includes('low-resolution-source')) return 'Replace with a higher-resolution portrait before permanent installation if possible.';
  if (fitMode === 'contain') return 'Uses a neutral matte to avoid over-cropping; consider a curator-approved custom crop or replacement portrait.';
  if (reviewFlags.includes('usable-but-small-source')) return 'Usable for prototype display; prioritize a higher-resolution source for final installation.';
  return 'Use generated display crops unless curator review identifies a better focal crop.';
}

function qualityNotes(width, height, treatment) {
  const shortestSide = Math.min(width || 0, height || 0);
  const notes = [`Generated as a consistent ${cropDescription} for the portrait wall and profile display.`];
  if (treatment.fitMode === 'contain') {
    notes.push('Source aspect ratio is atypical; the image is fit inside a neutral matte instead of being aggressively cropped.');
  }
  if (shortestSide > 0 && shortestSide < 300) {
    notes.push('Source image is small; consider replacing it with a higher-resolution portrait before permanent installation.');
  }
  if (shortestSide >= 300 && shortestSide < 520) {
    notes.push('Source image is usable for prototype display but should be reviewed for the final kiosk.');
  }
  return notes;
}

function relativePath(filePath) {
  return filePath.replace(`${process.cwd()}/`, '');
}
