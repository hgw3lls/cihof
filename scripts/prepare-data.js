import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildReport, loadInductees, loadPhysicalWallMetadata } from './data-utils.js';
import { buildEntityModel, loadCuratedEntityModel } from './entity-model.js';

const outputPath = resolve('public/data/inductees.json');
const reportPath = resolve('public/data/data-report.json');
const entitiesPath = resolve('public/data/entities.json');
const entityRelationshipsPath = resolve('public/data/entity-relationships.json');
const entityReportPath = resolve('public/data/entity-model-report.json');
const storySectionsSourcePath = resolve('data/cihof_story_sections.json');
const storySectionsOutputPath = resolve('public/data/story-sections.json');
const mediaManifestSourcePath = resolve('data/media_manifest.json');
const mediaManifestOutputPath = resolve('public/data/media-manifest.json');
const physicalWallOutputPath = resolve('public/data/physical-wall-positions.json');

const inductees = loadInductees();
const report = buildReport(inductees);
const entityModel = buildEntityModel(inductees, loadCuratedEntityModel());
const storySections = loadStorySections(inductees);
const mediaManifest = loadRuntimeMediaManifest();
const physicalWallMetadata = loadPhysicalWallMetadata();

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(inductees, null, 2)}\n`);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(entitiesPath, `${JSON.stringify(entityModel.entityDocument, null, 2)}\n`);
writeFileSync(entityRelationshipsPath, `${JSON.stringify(entityModel.relationshipDocument, null, 2)}\n`);
writeFileSync(entityReportPath, `${JSON.stringify(entityModel.report, null, 2)}\n`);
writeFileSync(storySectionsOutputPath, `${JSON.stringify(storySections.document, null, 2)}\n`);
writeFileSync(mediaManifestOutputPath, `${JSON.stringify(mediaManifest.document, null, 2)}\n`);
writeFileSync(physicalWallOutputPath, `${JSON.stringify(physicalWallMetadata, null, 2)}\n`);

console.log(
  `Prepared ${report.totalInductees} inductees across ${report.regions.length} regions. ` +
    `${report.media.withPrimaryImage} have primary images, ${report.media.withVideo} have videos.`,
);
console.log(
  `Prepared ${entityModel.entityDocument.entities.length} entities and ` +
    `${entityModel.relationshipDocument.relationships.length} entity relationships.`,
);
console.log(`Prepared ${storySections.recordCount} curated story section records.`);
console.log(`Prepared ${mediaManifest.recordCount} runtime media manifest records.`);
console.log(`Prepared ${Object.keys(physicalWallMetadata.positions ?? {}).length} physical wall position records.`);
if (report.missing.primaryImage.length > 0) {
  console.log(`Missing primary images: ${report.missing.primaryImage.length}`);
}
if (entityModel.validation.errors.length > 0) {
  throw new Error(`Entity model validation failed:\n${entityModel.validation.errors.map((error) => `- ${error}`).join('\n')}`);
}
if (storySections.validation.errors.length > 0) {
  throw new Error(`Story section validation failed:\n${storySections.validation.errors.map((error) => `- ${error}`).join('\n')}`);
}

function loadStorySections(inductees) {
  const emptyDocument = {
    schemaVersion: 1,
    source: {
      name: 'CIHOF story sections',
      note: 'No curated story section source file was found. Runtime will generate fallback beats from imported biography text.',
    },
    records: {},
  };

  if (!existsSync(storySectionsSourcePath)) {
    return { document: emptyDocument, recordCount: 0, validation: { errors: [], warnings: [] } };
  }

  const document = JSON.parse(readFileSync(storySectionsSourcePath, 'utf8'));
  const validation = validateStorySections(document, new Set(inductees.map((inductee) => inductee.id)));
  return {
    document,
    recordCount: Object.keys(document.records ?? {}).length,
    validation,
  };
}

function validateStorySections(document, inducteeIds) {
  const errors = [];
  const warnings = [];
  const records = document?.records;

  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return { errors: ['Story section document must be an object.'], warnings };
  }
  if (typeof document.schemaVersion !== 'number') warnings.push('Missing numeric schemaVersion.');
  if (!records || typeof records !== 'object' || Array.isArray(records)) {
    errors.push('Story section document must contain a records object.');
    return { errors, warnings };
  }

  Object.entries(records).forEach(([id, record]) => {
    if (!inducteeIds.has(id)) errors.push(`${id}: unknown inductee id.`);
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push(`${id}: story section record must be an object.`);
      return;
    }
    if (record.inducteeId && record.inducteeId !== id) errors.push(`${id}: inducteeId must match records key.`);
    if (!Array.isArray(record.beats) || record.beats.length === 0) {
      errors.push(`${id}: beats must be a non-empty array.`);
      return;
    }

    record.beats.forEach((beat, index) => {
      const label = `${id}: beats[${index}]`;
      if (!beat || typeof beat !== 'object' || Array.isArray(beat)) {
        errors.push(`${label} must be an object.`);
        return;
      }
      requireStoryString(beat.id, `${label}.id`, errors);
      requireStoryString(beat.headline, `${label}.headline`, errors);
      requireStoryString(beat.body, `${label}.body`, errors);
      if (typeof beat.body === 'string') {
        const wordCount = beat.body.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount < 30 || wordCount > 120) warnings.push(`${label}.body is ${wordCount} words; target is 40-100.`);
      }
      ['imageUrl', 'imageAltText', 'quote', 'place', 'organization', 'relatedPersonId', 'timelineMarker'].forEach((field) => {
        if (beat[field] !== undefined && typeof beat[field] !== 'string') errors.push(`${label}.${field} must be a string when present.`);
      });
      if (beat.relatedPersonId && !inducteeIds.has(beat.relatedPersonId)) errors.push(`${label}.relatedPersonId points to unknown inductee id.`);
    });
  });

  return { errors, warnings };
}

function requireStoryString(value, label, errors) {
  if (typeof value !== 'string' || value.trim().length === 0) errors.push(`${label} is required.`);
}

function loadRuntimeMediaManifest() {
  const emptyDocument = {
    schemaVersion: 1,
    source: {
      name: 'CIHOF media manifest',
      note: 'No media manifest source file was found. Runtime will fall back to media fields on inductee records.',
    },
    assets: {},
  };

  if (!existsSync(mediaManifestSourcePath)) {
    return { document: emptyDocument, recordCount: 0 };
  }

  const document = JSON.parse(readFileSync(mediaManifestSourcePath, 'utf8'));
  const assets = document && typeof document === 'object' && !Array.isArray(document) && document.assets && typeof document.assets === 'object'
    ? document.assets
    : {};

  return {
    document: {
      ...document,
      assets,
    },
    recordCount: Object.keys(assets).length,
  };
}
