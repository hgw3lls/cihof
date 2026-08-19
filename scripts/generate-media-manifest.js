import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadInductees } from './data-utils.js';

const outputPath = resolve('data/media_manifest.json');
const force = process.argv.includes('--force');

if (existsSync(outputPath) && !force) {
  console.error(`${outputPath} already exists. Re-run with --force to replace it.`);
  process.exit(1);
}

const inductees = loadInductees({ includeMedia: false });
const manifest = {
  schemaVersion: 1,
  source: {
    generator: 'scripts/generate-media-manifest.js',
    baseData: 'public/data/inductees.json',
    recordCount: inductees.length,
  },
  reviewGuidance: {
    filePath: 'Filesystem path inside this repo, usually public/media/...',
    runtimePath: 'Browser path served by Vite, usually /media/...',
    approvedForKiosk: 'Set true only after file existence, rights, captions/transcripts, and curator review are complete.',
    checksumSha256: 'Optional but recommended for release validation.',
    rightsStatus: 'Use approved only when usage rights for permanent museum installation are confirmed.',
    captionStatus: 'Use approved only when captions exist and have been reviewed.',
    transcriptStatus: 'Use approved only when transcript text exists and has been reviewed.',
    audio: 'Optional local audio items, including speeches or other approved audio clips.',
    oralHistories: 'Optional local oral-history audio items with transcript metadata.',
  },
  assets: Object.fromEntries(inductees.map((inductee) => [inductee.id, buildAssetRecord(inductee)])),
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Generated media manifest for ${inductees.length} inductees.`);
console.log(`Image records: ${inductees.length}`);
console.log(`Video records: ${inductees.filter((item) => item.hasVideo).length}`);
console.log(`Wrote ${outputPath}`);

function buildAssetRecord(inductee) {
  const imageUrls = Array.from(new Set([inductee.primaryImageUrl, ...inductee.imageUrls].filter(Boolean)));
  const videoItems = buildVideoItems(inductee);

  return {
    id: inductee.id,
    name: inductee.name,
    classYear: inductee.classYear,
    countryTags: inductee.countryTags,
    countryTagsSource: inductee.countryTagsSource,
    region: inductee.region,
    approvalStatus: inductee.approvalStatus,
    reviewPriority: inductee.reviewPriority,
    images: {
      primary: imageAsset(imageUrls[0] ?? inductee.primaryImageUrl, inductee.imageAltText, true),
      gallery: imageUrls.slice(1).map((url, index) => imageAsset(url, `${inductee.imageAltText} Gallery image ${index + 2}.`, false)),
    },
    videos: videoItems,
    audio: [],
    oralHistories: [],
    notes: buildNotes(inductee, imageUrls, videoItems),
  };
}

function imageAsset(sourceUrl, altText, primary) {
  return {
    sourceUrl: sourceUrl ?? '',
    filePath: '',
    runtimePath: '',
    checksumSha256: '',
    width: null,
    height: null,
    altText,
    primary,
    rightsStatus: 'needs-review',
    approvedForKiosk: false,
  };
}

function buildVideoItems(inductee) {
  const sourceUrls = inductee.videoUrls.length > 0 ? inductee.videoUrls : inductee.youtubeVideoIds.map((id) => `https://www.youtube.com/watch?v=${id}`);
  const maxLength = Math.max(sourceUrls.length, inductee.youtubeVideoIds.length, inductee.localVideoPaths.length);

  return Array.from({ length: maxLength }, (_, index) => ({
    sourceUrl: sourceUrls[index] ?? '',
    youtubeVideoId: inductee.youtubeVideoIds[index] ?? '',
    filePath: inductee.localVideoPaths[index] ? `public/${inductee.localVideoPaths[index].replace(/^\/+/, '')}` : '',
    runtimePath: inductee.localVideoPaths[index] ? `/${inductee.localVideoPaths[index].replace(/^\/+/, '')}` : '',
    posterFilePath: '',
    posterRuntimePath: '',
    captionFilePath: '',
    captionRuntimePath: '',
    transcriptFilePath: '',
    transcriptRuntimePath: '',
    checksumSha256: '',
    durationSeconds: null,
    codec: '',
    rightsStatus: inductee.hasVideo ? 'needs-review' : 'not-applicable',
    captionStatus: inductee.hasVideo ? 'needed' : 'not-applicable',
    transcriptStatus: inductee.hasVideo ? 'needed' : 'not-applicable',
    audioDescriptionStatus: inductee.hasVideo ? 'review-needed' : 'not-applicable',
    approvedForKiosk: false,
  }));
}

function buildNotes(inductee, imageUrls, videoItems) {
  const notes = [];
  if (imageUrls.length === 0) notes.push('No source image URL found.');
  if (imageUrls.length === 1) notes.push('Only one image source is currently available.');
  if (videoItems.length === 0) notes.push('No video source is currently linked.');
  if (videoItems.length > 0) notes.push('Video must be localized or explicitly approved for the final kiosk runtime.');
  if (inductee.featuredCandidate) notes.push('Featured candidate; prioritize local image and video readiness.');
  return notes;
}
