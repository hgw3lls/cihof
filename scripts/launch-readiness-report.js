import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { generatedAtFor } from './stable-generated-at.js';
import {
  loadCuratedMetadata,
  loadInductees,
  loadMediaManifest,
  loadPhysicalWallMetadata,
  validateCuratedMetadata,
} from './data-utils.js';

const outputPath = resolve('artifacts/launch-readiness.local.json');
const strict = process.argv.includes('--strict');
const launchTargetDate = '2026-10-12';
const requiredProfileFields = ['approvedSummary', 'documentedContextLine', 'honoredForSummary', 'lifeWorkSummary'];
const launchTargets = {
  explicitRelationships: 30,
  physicalWallPositions: 111,
  storySections: 3,
};

const baseInductees = loadInductees({ includeCurated: false, includeMedia: false, includePhysicalWall: false });
const inductees = loadInductees();
const curatedMetadata = loadCuratedMetadata();
const curatedValidation = validateCuratedMetadata(curatedMetadata, baseInductees.map((item) => item.id));
const mediaManifest = loadMediaManifest();
const physicalWall = loadPhysicalWallMetadata();
const relationships = readJson('data/cihof_relationships.json', []);
const storySections = readJson('data/cihof_story_sections.json', { records: {} });
const runtimeBundle = readJson('public/data/cihof-runtime-data.json', null);
const offlineMediaReferences = runtimeBundle ? collectOfflineMediaReferences(runtimeBundle) : { runtime: [], provenance: [] };

const expectedInducteeIds = inductees.map((item) => item.id);
const inducteeById = new Map(inductees.map((item) => [item.id, item]));
const curatedRecordEntries = Object.entries(curatedMetadata.inductees ?? {});
const curatedRecords = curatedRecordEntries.map(([, record]) => record);
const mediaRecordEntries = Object.entries(mediaManifest.assets ?? {});
const mediaRecords = mediaRecordEntries.map(([, record]) => record);
const primaryImages = mediaRecords.map((record) => record?.images?.primary).filter(Boolean);
const videoEntries = mediaRecordEntries.flatMap(([personId, record]) =>
  Array.isArray(record?.videos) ? record.videos.map((asset, index) => ({ personId, index, asset })) : [],
);
const videos = videoEntries.map((entry) => entry.asset);
const approvedVideos = videoEntries.filter((entry) => entry.asset?.approvedForKiosk);
const approvedVideoIssues = approvedVideos.filter((entry) => !isKioskReadyVideo(entry.asset));
const explicitRelationshipCount = countRecords(relationships);
const storySectionCount = countRecords(storySections.records ?? storySections);
const physicalWallPositionCount = Object.keys(physicalWall.positions ?? {}).length;
const remoteMediaReferenceCount = offlineMediaReferences.runtime.length;
const statusCounts = countBy(curatedRecords.map((record) => record.approvalStatus || 'unreviewed'));
const profileFieldCoverage = Object.fromEntries(
  requiredProfileFields.map((field) => [field, curatedRecords.filter((record) => hasText(record[field])).length]),
);
const profileFieldMissing = Object.fromEntries(
  requiredProfileFields.map((field) => [
    field,
    curatedRecords.filter((record) => !hasText(record[field])).map((record) => record.id).filter(Boolean),
  ]),
);

const counts = {
  inductees: inductees.length,
  curatedRecords: curatedRecords.length,
  curatedRecordStatuses: statusCounts,
  profileFieldCoverage,
  entities: readReportTotal('public/data/entity-model-report.json', 'entities'),
  generatedEntityRelationships: readReportTotal('public/data/entity-model-report.json', 'relationships'),
  explicitRelationships: explicitRelationshipCount,
  mediaRecords: mediaRecords.length,
  primaryImages: primaryImages.length,
  primaryImagesWallReady: primaryImages.filter(isWallReadyImage).length,
  primaryImagesKioskReady: primaryImages.filter(isKioskReadyImage).length,
  videoProfiles: inductees.filter((item) => item.hasVideo).length,
  videoItems: videos.length,
  approvedVideos: approvedVideos.length,
  kioskReadyVideos: videos.filter(isKioskReadyVideo).length,
  approvedVideoIssues: approvedVideoIssues.length,
  physicalWallPositions: physicalWallPositionCount,
  storySections: storySectionCount,
  remoteMediaReferences: remoteMediaReferenceCount,
  provenanceRemoteMediaReferences: offlineMediaReferences.provenance.length,
};

const queues = buildQueues();

const gates = [
  requiredGate({
    id: 'profile_text_populated',
    pass: requiredProfileFields.every((field) => profileFieldCoverage[field] === inductees.length),
    actual: `${Math.min(...Object.values(profileFieldCoverage))}/${inductees.length}`,
    target: `${inductees.length}/${inductees.length}`,
    detail: 'Summary, documented context, HONORED FOR, and Life + Work fields must be populated for every inductee.',
    missing: profileFieldMissing,
  }),
  requiredGate({
    id: 'curated_records_approved',
    pass: (statusCounts.approved ?? 0) === inductees.length,
    actual: `${statusCounts.approved ?? 0}/${inductees.length}`,
    target: `${inductees.length}/${inductees.length}`,
    detail: 'All public profile records need final curator approval status before installation launch.',
  }),
  requiredGate({
    id: 'curated_metadata_valid',
    pass: curatedValidation.errors.length === 0,
    actual: `${curatedValidation.errors.length} errors`,
    target: '0 errors',
    detail: 'Curated metadata must stay structurally valid.',
    errors: curatedValidation.errors,
    warnings: curatedValidation.warnings,
  }),
  requiredGate({
    id: 'primary_images_wall_ready',
    pass: counts.primaryImagesWallReady === inductees.length,
    actual: `${counts.primaryImagesWallReady}/${inductees.length}`,
    target: `${inductees.length}/${inductees.length}`,
    detail: 'Every inductee needs a local primary portrait that can render on the wall.',
  }),
  requiredGate({
    id: 'primary_images_kiosk_ready',
    pass: counts.primaryImagesKioskReady === inductees.length,
    actual: `${counts.primaryImagesKioskReady}/${inductees.length}`,
    target: `${inductees.length}/${inductees.length}`,
    detail: 'Every primary portrait needs approved rights status and kiosk approval.',
  }),
  requiredGate({
    id: 'approved_video_policy',
    pass: approvedVideoIssues.length === 0,
    actual: `${counts.kioskReadyVideos}/${approvedVideos.length} approved videos ready`,
    target: 'all approved videos ready',
    detail: 'Videos are optional for launch. Any video marked approvedForKiosk must have local file, poster, captions, transcript, and approved rights; other videos remain hidden.',
    failingIds: approvedVideoIssues.map((entry) => `${entry.personId}:${entry.index}`),
  }),
  requiredGate({
    id: 'explicit_traces_relationships',
    pass: explicitRelationshipCount >= launchTargets.explicitRelationships,
    actual: String(explicitRelationshipCount),
    target: String(launchTargets.explicitRelationships),
    detail: 'Launch TRACES should include a small source-reviewed relationship set, not only generated candidate relationships.',
  }),
  requiredGate({
    id: 'physical_wall_positions',
    pass: physicalWallPositionCount >= launchTargets.physicalWallPositions,
    actual: String(physicalWallPositionCount),
    target: String(launchTargets.physicalWallPositions),
    detail: 'Installation launch needs every digital inductee mapped to a measured physical wall position.',
  }),
  advisoryGate({
    id: 'story_section_depth',
    pass: storySectionCount >= launchTargets.storySections,
    actual: String(storySectionCount),
    target: String(launchTargets.storySections),
    detail: 'Starter story sections are enough for launch demos; expand only after blocker gates are moving.',
  }),
  advisoryGate({
    id: 'remote_media_references',
    pass: remoteMediaReferenceCount === 0,
    actual: String(remoteMediaReferenceCount),
    target: '0',
    detail: 'Remote references can remain as provenance, but final hardware must pass a network-disconnected run with approved media using local paths.',
  }),
  advisoryGate({
    id: 'caption_transcript_review',
    pass: counts.videoItems === counts.kioskReadyVideos,
    actual: `${counts.kioskReadyVideos}/${counts.videoItems}`,
    target: `${counts.videoItems}/${counts.videoItems}`,
    detail: 'Non-ready video items need rights, poster, caption, transcript, and local file work before they can be enabled.',
  }),
];

const summary = {
  targetDate: launchTargetDate,
  status: gates.some((gate) => gate.status === 'blocker') ? 'blocked' : 'launch-ready',
  blockers: gates.filter((gate) => gate.status === 'blocker').length,
  warnings: gates.filter((gate) => gate.status === 'warning').length,
  passing: gates.filter((gate) => gate.status === 'pass').length,
};

const report = {
  generatedAt: generatedAtFor(outputPath),
  phase: 'week-1-scope-lock',
  targetDate: launchTargetDate,
  launchPolicy: {
    publicScope: [
      'Persistent Hall visitor app with PORTRAITS, TRACES, LEGACIES, focused person actions, QR continuation, and hidden admin.',
      'Separate staff portal for curation, source review, and runner workflows.',
      'All 111 inductees visible with approved public text and kiosk-approved primary portraits.',
    ],
    mediaPolicy: 'WATCH is launch-optional. Show only media that is approved, localized, captioned, transcribed, and kiosk-ready; hide everything else.',
    relationshipPolicy: `TRACES can keep generated candidates, but launch needs at least ${launchTargets.explicitRelationships} explicit source-reviewed relationship records.`,
    outOfScope: [
      'New public visitor feature areas beyond PORTRAITS, TRACES, LEGACIES, focused actions, QR, admin, and portal.',
      'Publishing unapproved remote video/audio media.',
      'Moving profile curation back into the visitor app.',
    ],
  },
  launchTargets,
  summary,
  counts,
  gates,
  queues,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Launch readiness: ${summary.status} for ${launchTargetDate}.`);
console.log(`${summary.passing} passing, ${summary.blockers} blockers, ${summary.warnings} warnings.`);
gates.forEach((gate) => {
  const prefix = gate.status.toUpperCase().padEnd(7);
  console.log(`${prefix} ${gate.id}: ${gate.actual} / ${gate.target}`);
});
console.log(
  `Queues: ${queues.curatedRecordApproval.count} profile approvals, ${queues.primaryImageApproval.count} primary image approvals, ${queues.physicalWallPositions.count} wall positions, ${queues.explicitRelationships.needed} relationship records needed.`,
);
console.log(`Wrote ${outputPath}`);

if (strict && summary.blockers > 0) process.exitCode = 1;

function requiredGate(gate) {
  return { ...gate, required: true, status: gate.pass ? 'pass' : 'blocker' };
}

function advisoryGate(gate) {
  return { ...gate, required: false, status: gate.pass ? 'pass' : 'warning' };
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function countRecords(value) {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== 'object') return 0;
  if (Array.isArray(value.records)) return value.records.length;
  if (value.records && typeof value.records === 'object') return Object.keys(value.records).length;
  if (Array.isArray(value.relationships)) return value.relationships.length;
  if (value.relationships && typeof value.relationships === 'object') return Object.keys(value.relationships).length;
  return Object.keys(value).length;
}

function readJson(path, fallback) {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) return fallback;
  return JSON.parse(readFileSync(absolutePath, 'utf8'));
}

function readReportTotal(path, key) {
  const report = readJson(path, null);
  return report?.totals?.[key] ?? null;
}

function buildQueues() {
  const curatedRecordApproval = curatedRecordEntries
    .filter(([, record]) => record.approvalStatus !== 'approved')
    .map(([id, record]) => ({
      id,
      name: record.displayName || inducteeById.get(id)?.name || id,
      status: record.approvalStatus || 'unreviewed',
      reviewPriority: record.reviewPriority || inducteeById.get(id)?.reviewPriority || 'standard',
      missingFields: requiredProfileFields.filter((field) => !hasText(record[field])),
      nextAction: 'Curator reviews public text fields and sets approvalStatus to approved when accepted.',
    }));

  const primaryImageApproval = mediaRecordEntries
    .map(([id, record]) => ({ id, record, primary: record?.images?.primary }))
    .filter(({ primary }) => !isKioskReadyImage(primary))
    .map(({ id, record, primary }) => ({
      id,
      name: record?.name || inducteeById.get(id)?.name || id,
      rightsStatus: primary?.rightsStatus || 'missing',
      approvedForKiosk: Boolean(primary?.approvedForKiosk),
      hasFile: Boolean(primary?.filePath && existsSync(resolve(primary.filePath))),
      hasRuntimePath: hasText(primary?.runtimePath),
      hasAltText: hasText(primary?.altText),
      missingRequirements: missingKioskImageRequirements(primary),
      nextAction: 'Confirm rights/local file/alt text, then set rightsStatus to approved and approvedForKiosk to true.',
    }));

  const approvedVideoQueue = approvedVideoIssues.map(({ personId, index, asset }) => ({
    personId,
    name: inducteeById.get(personId)?.name || personId,
    videoIndex: index,
    sourceUrl: asset?.sourceUrl || '',
    youtubeVideoId: asset?.youtubeVideoId || '',
    missingRequirements: missingKioskVideoRequirements(asset),
    nextAction: 'Complete every required media field or set approvedForKiosk to false so the video stays hidden.',
  }));

  const nonReadyVideoQueue = videoEntries
    .filter(({ asset }) => !isKioskReadyVideo(asset))
    .map(({ personId, index, asset }) => ({
      personId,
      name: inducteeById.get(personId)?.name || personId,
      videoIndex: index,
      sourceUrl: asset?.sourceUrl || '',
      youtubeVideoId: asset?.youtubeVideoId || '',
      approvedForKiosk: Boolean(asset?.approvedForKiosk),
      rightsStatus: asset?.rightsStatus || 'missing',
      captionStatus: asset?.captionStatus || 'missing',
      transcriptStatus: asset?.transcriptStatus || 'missing',
      missingRequirements: missingKioskVideoRequirements(asset),
    }));

  const physicalWallPositions = expectedInducteeIds
    .filter((id) => !physicalWall.positions?.[id])
    .map((id) => ({
      id,
      name: inducteeById.get(id)?.name || id,
      classYear: inducteeById.get(id)?.classYear ?? null,
      nextAction: 'Measure final wall panel/row/column or x/y coordinates and add this id to data/physical_wall_positions.json.',
    }));

  return {
    curatedRecordApproval: {
      count: curatedRecordApproval.length,
      sourceFile: 'data/cihof_curated_metadata.json',
      records: curatedRecordApproval,
    },
    primaryImageApproval: {
      count: primaryImageApproval.length,
      sourceFile: 'data/media_manifest.json',
      records: primaryImageApproval,
    },
    explicitRelationships: {
      current: explicitRelationshipCount,
      target: launchTargets.explicitRelationships,
      needed: Math.max(0, launchTargets.explicitRelationships - explicitRelationshipCount),
      sourceFile: 'data/cihof_relationships.json',
      candidateSources: [
        relationshipCandidateSource('data/original-site-harvest/review-queues/relationship-candidates.csv'),
        relationshipCandidateSource('data/original-site-harvest/review-queues/induction-relationship-candidates.csv'),
        relationshipCandidateSource('data/original-site-harvest/review-queues/organization-candidates.csv'),
        relationshipCandidateSource('data/original-site-harvest/review-queues/place-candidates.csv'),
      ],
      nextAction: 'Review source-derived candidates and promote at least 30 strong documented relationships into data/cihof_relationships.json.',
    },
    physicalWallPositions: {
      count: physicalWallPositions.length,
      sourceFile: 'data/physical_wall_positions.json',
      records: physicalWallPositions,
    },
    approvedVideoPolicy: {
      count: approvedVideoQueue.length,
      sourceFile: 'data/media_manifest.json',
      records: approvedVideoQueue,
    },
    hiddenVideoBacklog: {
      count: nonReadyVideoQueue.length,
      sourceFile: 'data/media_manifest.json',
      records: nonReadyVideoQueue,
      note: 'These videos should stay hidden until every kiosk-ready requirement is satisfied.',
    },
    remoteMediaReferences: {
      count: offlineMediaReferences.runtime.length,
      examples: offlineMediaReferences.runtime.slice(0, 25),
      provenanceCount: offlineMediaReferences.provenance.length,
      provenanceExamples: offlineMediaReferences.provenance.slice(0, 25),
      note: 'Runtime references are visitor-loadable media paths. Provenance/source URLs are retained for traceability and non-kiosk streaming fallback fields.',
    },
  };
}

function relationshipCandidateSource(path) {
  return {
    path,
    candidateRows: countCsvDataRows(path),
  };
}

function countCsvDataRows(path) {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) return 0;
  return readFileSync(absolutePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0).length - 1;
}

function isWallReadyImage(asset) {
  return Boolean(
    asset?.filePath &&
      asset.runtimePath &&
      asset.altText &&
      asset.runtimePath.startsWith('/media/') &&
      existsSync(resolve(asset.filePath)),
  );
}

function isKioskReadyImage(asset) {
  return Boolean(
    asset?.approvedForKiosk &&
      asset.rightsStatus === 'approved' &&
      asset.filePath &&
      asset.runtimePath &&
      existsSync(resolve(asset.filePath)),
  );
}

function isKioskReadyVideo(asset) {
  return Boolean(
    asset?.approvedForKiosk &&
      asset.rightsStatus === 'approved' &&
      asset.captionStatus === 'approved' &&
      asset.transcriptStatus === 'approved' &&
      asset.filePath &&
      asset.runtimePath &&
      asset.posterFilePath &&
      asset.posterRuntimePath &&
      asset.captionFilePath &&
      asset.captionRuntimePath &&
      asset.transcriptFilePath &&
      asset.transcriptRuntimePath &&
      existsSync(resolve(asset.filePath)) &&
      existsSync(resolve(asset.posterFilePath)) &&
      existsSync(resolve(asset.captionFilePath)) &&
      existsSync(resolve(asset.transcriptFilePath)),
  );
}

function missingKioskImageRequirements(asset) {
  const missing = [];
  if (!asset?.approvedForKiosk) missing.push('approvedForKiosk');
  if (asset?.rightsStatus !== 'approved') missing.push('rightsStatus=approved');
  if (!asset?.filePath) missing.push('filePath');
  else if (!existsSync(resolve(asset.filePath))) missing.push('existing filePath');
  if (!asset?.runtimePath) missing.push('runtimePath');
  if (!asset?.altText) missing.push('altText');
  return missing;
}

function missingKioskVideoRequirements(asset) {
  const missing = [];
  if (!asset?.approvedForKiosk) missing.push('approvedForKiosk');
  if (asset?.rightsStatus !== 'approved') missing.push('rightsStatus=approved');
  if (asset?.captionStatus !== 'approved') missing.push('captionStatus=approved');
  if (asset?.transcriptStatus !== 'approved') missing.push('transcriptStatus=approved');
  ['filePath', 'posterFilePath', 'captionFilePath', 'transcriptFilePath'].forEach((field) => {
    if (!asset?.[field]) missing.push(field);
    else if (!existsSync(resolve(asset[field]))) missing.push(`existing ${field}`);
  });
  ['runtimePath', 'posterRuntimePath', 'captionRuntimePath', 'transcriptRuntimePath'].forEach((field) => {
    if (!asset?.[field]) missing.push(field);
  });
  return missing;
}

function collectOfflineMediaReferences(bundle) {
  const refs = {
    runtime: [],
    provenance: [],
  };

  if (Array.isArray(bundle.inductees)) {
    bundle.inductees.forEach((person, index) => {
      const label = person?.id || `inductee-${index}`;
      collectRemoteAssetRef(refs, person?.primaryImageUrl, `${label}.primaryImageUrl`);
      collectRemoteArrayRefs(refs, person?.imageUrls, `${label}.imageUrls`);
      collectRemoteArrayRefs(refs, person?.localImagePaths, `${label}.localImagePaths`);
      collectRemoteArrayRefs(refs, person?.videoUrls, `${label}.videoUrls`, { runtime: false });
      collectRemoteArrayRefs(refs, person?.localVideoPaths, `${label}.localVideoPaths`);
    });
  }

  const mediaAssets = bundle.mediaManifest?.assets;
  if (mediaAssets && typeof mediaAssets === 'object') {
    Object.entries(mediaAssets).forEach(([personId, asset]) => {
      collectRemoteImageRecord(refs, asset?.images?.primary, `${personId}.media.images.primary`);
      if (Array.isArray(asset?.images?.gallery)) {
        asset.images.gallery.forEach((image, index) => collectRemoteImageRecord(refs, image, `${personId}.media.images.gallery.${index}`));
      }
      if (Array.isArray(asset?.videos)) {
        asset.videos.forEach((video, index) => {
          collectRemoteAssetRef(refs, video?.runtimePath, `${personId}.media.videos.${index}.runtimePath`);
          collectRemoteAssetRef(refs, video?.posterRuntimePath, `${personId}.media.videos.${index}.posterRuntimePath`);
          collectRemoteAssetRef(refs, video?.captionRuntimePath, `${personId}.media.videos.${index}.captionRuntimePath`);
          collectRemoteAssetRef(refs, video?.transcriptRuntimePath, `${personId}.media.videos.${index}.transcriptRuntimePath`);
        });
      }
    });
  }

  const storyRecords = Array.isArray(bundle.storySections?.records)
    ? bundle.storySections.records
    : bundle.storySections?.records && typeof bundle.storySections.records === 'object'
      ? Object.values(bundle.storySections.records)
      : [];
  storyRecords.forEach((record) => {
    if (!Array.isArray(record?.beats)) return;
    record.beats.forEach((beat, index) => collectRemoteAssetRef(refs, beat?.imageUrl, `${record.personId}.story.beats.${index}.imageUrl`));
  });

  if (Array.isArray(bundle.archiveLeads?.records)) {
    bundle.archiveLeads.records.forEach((record, index) => {
      const label = record?.id || `archive-lead-${index}`;
      collectRemoteAssetRef(refs, record?.imageUrl, `${label}.archive.imageUrl`);
    });
  }

  return refs;
}

function collectRemoteImageRecord(refs, image, label) {
  if (!image || typeof image !== 'object') return;
  collectRemoteAssetRef(refs, image.runtimePath, `${label}.runtimePath`);
  collectRemoteAssetRef(refs, image.sourceUrl, `${label}.sourceUrl`, { runtime: false });
}

function collectRemoteArrayRefs(refs, value, label, options) {
  if (!Array.isArray(value)) return;
  value.forEach((item, index) => collectRemoteAssetRef(refs, item, `${label}.${index}`, options));
}

function collectRemoteAssetRef(refs, value, label, options = {}) {
  if (typeof value !== 'string') return;
  const reference = value.trim();
  if (/^https?:\/\//i.test(reference)) {
    const target = options.runtime === false ? refs.provenance : refs.runtime;
    target.push({ label, reference });
  }
}
