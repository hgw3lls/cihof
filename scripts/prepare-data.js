import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildReport, loadInductees, loadPhysicalWallMetadata } from './data-utils.js';
import { buildEntityModel, loadCuratedEntityModel } from './entity-model.js';
import { normalizeRelationshipRecords, validateRelationshipRecords } from './relationship-metadata.js';

const outputPath = resolve('public/data/inductees.json');
const reportPath = resolve('public/data/data-report.json');
const entitiesPath = resolve('public/data/entities.json');
const entityRelationshipsPath = resolve('public/data/entity-relationships.json');
const entityReportPath = resolve('public/data/entity-model-report.json');
const relationshipsSourcePath = resolve('data/cihof_relationships.json');
const relationshipsOutputPath = resolve('public/data/relationships.json');
const storySectionsSourcePath = resolve('data/cihof_story_sections.json');
const storySectionsOutputPath = resolve('public/data/story-sections.json');
const storyLensesSourcePath = resolve('data/cihof_story_lenses.json');
const storyLensesOutputPath = resolve('public/data/story-lenses.json');
const mediaManifestSourcePath = resolve('data/media_manifest.json');
const mediaManifestOutputPath = resolve('public/data/media-manifest.json');
const physicalWallOutputPath = resolve('public/data/physical-wall-positions.json');
const sourceCurationSourcePath = resolve('data/original-site-harvest/pre-curation/cihof-pre-curation-packet.json');
const sourceCurationOutputPath = resolve('public/data/source-curation-packet.json');
const runtimeDataBundleOutputPath = resolve('public/data/cihof-runtime-data.json');

const inductees = loadInductees();
const report = buildReport(inductees);
const entityModel = buildEntityModel(inductees, loadCuratedEntityModel());
const relationshipMetadata = loadRelationshipMetadata(inductees);
const storySections = loadStorySections(inductees);
const storyLenses = loadStoryLenses();
const mediaManifest = loadRuntimeMediaManifest();
const physicalWallMetadata = loadPhysicalWallMetadata();
const sourceCurationPacket = loadSourceCurationPacket();
const runtimeDataBundle = buildRuntimeDataBundle();

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(inductees, null, 2)}\n`);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(entitiesPath, `${JSON.stringify(entityModel.entityDocument, null, 2)}\n`);
writeFileSync(entityRelationshipsPath, `${JSON.stringify(entityModel.relationshipDocument, null, 2)}\n`);
writeFileSync(entityReportPath, `${JSON.stringify(entityModel.report, null, 2)}\n`);
writeFileSync(relationshipsOutputPath, `${JSON.stringify(relationshipMetadata.records, null, 2)}\n`);
writeFileSync(storySectionsOutputPath, `${JSON.stringify(storySections.document, null, 2)}\n`);
writeFileSync(storyLensesOutputPath, `${JSON.stringify(storyLenses.document, null, 2)}\n`);
writeFileSync(mediaManifestOutputPath, `${JSON.stringify(mediaManifest.document, null, 2)}\n`);
writeFileSync(physicalWallOutputPath, `${JSON.stringify(physicalWallMetadata, null, 2)}\n`);
writeFileSync(sourceCurationOutputPath, `${JSON.stringify(sourceCurationPacket.document, null, 2)}\n`);
writeFileSync(runtimeDataBundleOutputPath, `${JSON.stringify(runtimeDataBundle, null, 2)}\n`);

console.log(
  `Prepared ${report.totalInductees} inductees across ${report.regions.length} regions and ${report.countries.length} countries. ` +
    `${report.media.withPrimaryImage} have primary images, ${report.media.withVideo} have videos.`,
);
console.log(
  `Prepared ${entityModel.entityDocument.entities.length} entities and ` +
    `${entityModel.relationshipDocument.relationships.length} entity relationships.`,
);
console.log(`Prepared ${relationshipMetadata.recordCount} explicit relationship records.`);
console.log(`Prepared ${storySections.recordCount} curated story section records.`);
console.log(`Prepared ${storyLenses.recordCount} story lens records.`);
console.log(`Prepared ${mediaManifest.recordCount} runtime media manifest records.`);
console.log(`Prepared ${Object.keys(physicalWallMetadata.positions ?? {}).length} physical wall position records.`);
console.log(`Prepared ${sourceCurationPacket.recordCount} source curation profile rows.`);
console.log(`Prepared one-file runtime data bundle at ${runtimeDataBundleOutputPath}.`);
if (report.missing.primaryImage.length > 0) {
  console.log(`Missing primary images: ${report.missing.primaryImage.length}`);
}
if (entityModel.validation.errors.length > 0) {
  throw new Error(`Entity model validation failed:\n${entityModel.validation.errors.map((error) => `- ${error}`).join('\n')}`);
}
if (relationshipMetadata.validation.errors.length > 0) {
  throw new Error(`Relationship metadata validation failed:\n${relationshipMetadata.validation.errors.map((error) => `- ${error}`).join('\n')}`);
}
if (storySections.validation.errors.length > 0) {
  throw new Error(`Story section validation failed:\n${storySections.validation.errors.map((error) => `- ${error}`).join('\n')}`);
}
if (storyLenses.validation.errors.length > 0) {
  throw new Error(`Story lens validation failed:\n${storyLenses.validation.errors.map((error) => `- ${error}`).join('\n')}`);
}

function loadRelationshipMetadata(inductees) {
  if (!existsSync(relationshipsSourcePath)) {
    return { records: [], recordCount: 0, validation: { errors: [], warnings: [] } };
  }

  const records = normalizeRelationshipRecords(JSON.parse(readFileSync(relationshipsSourcePath, 'utf8')));
  return {
    records,
    recordCount: records.length,
    validation: validateRelationshipRecords(records, new Set(inductees.map((inductee) => inductee.id))),
  };
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

function loadStoryLenses() {
  const emptyDocument = {
    schemaVersion: 1,
    source: {
      name: 'CIHOF trace themes',
      note: 'No trace-theme source file was found. Runtime will use built-in default trace themes.',
    },
    lenses: [],
  };

  if (!existsSync(storyLensesSourcePath)) {
    return { document: emptyDocument, recordCount: 0, validation: { errors: [], warnings: [] } };
  }

  const document = JSON.parse(readFileSync(storyLensesSourcePath, 'utf8'));
  const validation = validateStoryLenses(document, new Set(inductees.map((inductee) => inductee.id)));
  return {
    document,
    recordCount: Array.isArray(document.lenses) ? document.lenses.length : 0,
    validation,
  };
}

function validateStoryLenses(document, inducteeIds) {
  const errors = [];
  const warnings = [];
  const ids = new Set();

  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return { errors: ['Story lens document must be an object.'], warnings };
  }
  if (typeof document.schemaVersion !== 'number') warnings.push('Missing numeric schemaVersion.');
  if (!Array.isArray(document.lenses)) {
    errors.push('Story lens document must contain a lenses array.');
    return { errors, warnings };
  }

  document.lenses.forEach((lens, index) => {
    const label = `lenses[${index}]`;
    if (!lens || typeof lens !== 'object' || Array.isArray(lens)) {
      errors.push(`${label} must be an object.`);
      return;
    }

    ['id', 'label', 'prompt', 'description'].forEach((field) => requireStoryString(lens[field], `${label}.${field}`, errors));
    if (typeof lens.id === 'string') {
      if (ids.has(lens.id)) errors.push(`${label}.id duplicates ${lens.id}.`);
      ids.add(lens.id);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(lens.id)) warnings.push(`${label}.id should be lowercase kebab-case.`);
    }
    if (!Array.isArray(lens.terms)) errors.push(`${label}.terms must be an array.`);
    if (!Array.isArray(lens.themes)) errors.push(`${label}.themes must be an array.`);
    if (Array.isArray(lens.terms)) lens.terms.forEach((term, termIndex) => requireStoryString(term, `${label}.terms[${termIndex}]`, errors));
    if (Array.isArray(lens.themes)) lens.themes.forEach((theme, themeIndex) => requireStoryString(theme, `${label}.themes[${themeIndex}]`, errors));
    if (Array.isArray(lens.terms) && Array.isArray(lens.themes) && lens.terms.length + lens.themes.length === 0) {
      errors.push(`${label} must contain at least one term or theme.`);
    }
    ['pinnedPersonIds', 'excludedPersonIds', 'curatorNotes'].forEach((field) => {
      if (lens[field] !== undefined && !Array.isArray(lens[field])) errors.push(`${label}.${field} must be an array when present.`);
      if (Array.isArray(lens[field])) {
        lens[field].forEach((value, valueIndex) => requireStoryString(value, `${label}.${field}[${valueIndex}]`, errors));
      }
    });
    ['pinnedPersonIds', 'excludedPersonIds'].forEach((field) => {
      if (!Array.isArray(lens[field])) return;
      lens[field].forEach((id) => {
        if (typeof id === 'string' && !inducteeIds.has(id)) errors.push(`${label}.${field} contains unknown inductee id ${id}.`);
      });
    });
    if (Array.isArray(lens.pinnedPersonIds) && Array.isArray(lens.excludedPersonIds)) {
      const excludedIds = new Set(lens.excludedPersonIds);
      lens.pinnedPersonIds.forEach((id) => {
        if (excludedIds.has(id)) errors.push(`${label}: ${id} cannot be both pinned and excluded.`);
      });
    }
    if (lens.reviewStatus !== undefined && !['draft', 'reviewed', 'approved'].includes(lens.reviewStatus)) {
      errors.push(`${label}.reviewStatus must be draft, reviewed, or approved when present.`);
    }
    if (lens.maxPortraits !== undefined && (!Number.isFinite(lens.maxPortraits) || lens.maxPortraits < 12 || lens.maxPortraits > 96)) {
      errors.push(`${label}.maxPortraits must be a number from 12 to 96.`);
    }
    if (lens.enabled !== undefined && typeof lens.enabled !== 'boolean') errors.push(`${label}.enabled must be a boolean when present.`);
  });

  return { errors, warnings };
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

function loadSourceCurationPacket() {
  const emptyDocument = {
    schemaVersion: 1,
    source: {
      generator: 'scripts/prepare-data.js',
      note: 'No original-site pre-curation packet was found. Staff portal source queues will be empty.',
    },
    guardrails: {
      mediaRights: 'Source leads are review aids only and do not approve media rights.',
      relationships: 'Relationship leads require curator approval before public use.',
      geography: 'Place leads are textual evidence only. Migration direction is never inferred.',
      storyText: 'Story excerpts are source pointers for curator rewriting, not publication-ready text.',
    },
    summary: {},
    curationIndex: [],
    sourceProfileReferences: [],
    profileUrlAliasDrafts: [],
    duplicateSourceGroups: [],
    mediaReviewDrafts: [],
    videoReviewDrafts: [],
    relationshipReviewDrafts: [],
    placeReviewDrafts: [],
    placePhraseReviewDrafts: [],
    organizationReviewDrafts: [],
    storySectionReviewDrafts: [],
    classEvidenceReviewDrafts: [],
    unresolvedSourceRecords: [],
  };

  if (!existsSync(sourceCurationSourcePath)) {
    return { document: emptyDocument, recordCount: 0 };
  }

  const document = JSON.parse(readFileSync(sourceCurationSourcePath, 'utf8'));
  return {
    document: normalizeSourceCurationPacket(document, emptyDocument),
    recordCount: Array.isArray(document.curationIndex) ? document.curationIndex.length : 0,
  };
}

function normalizeSourceCurationPacket(document, fallback) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) return fallback;
  const normalized = { ...fallback, ...document };
  [
    'curationIndex',
    'sourceProfileReferences',
    'profileUrlAliasDrafts',
    'duplicateSourceGroups',
    'mediaReviewDrafts',
    'videoReviewDrafts',
    'relationshipReviewDrafts',
    'placeReviewDrafts',
    'placePhraseReviewDrafts',
    'organizationReviewDrafts',
    'storySectionReviewDrafts',
    'classEvidenceReviewDrafts',
    'unresolvedSourceRecords',
  ].forEach((key) => {
    if (!Array.isArray(normalized[key])) normalized[key] = [];
  });
  return normalized;
}

function buildRuntimeDataBundle() {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    appName: 'CIHOF Portrait Wall',
    source: {
      generator: 'scripts/prepare-data.js',
      note: 'Single-file runtime bundle for visitor import/export and offline cache hydration. Individual JSON files are still emitted for compatibility and portal tooling.',
    },
    inductees,
    relationships: relationshipMetadata.records,
    entities: entityModel.entityDocument,
    entityRelationships: entityModel.relationshipDocument,
    storySections: storySections.document,
    storyLenses: storyLenses.document,
    mediaManifest: mediaManifest.document,
    physicalWall: physicalWallMetadata,
    places: loadOptionalRuntimeJson('public/data/places.json', { schemaVersion: 1, places: [] }),
    cityQuestion: loadOptionalRuntimeJson('public/data/city-question.json', null),
    worldLens: loadOptionalRuntimeJson('public/data/world-lens.json', null),
    sourceCuration: sourceCurationPacket.document,
    reports: {
      data: report,
      entityModel: entityModel.report,
      curation: loadOptionalRuntimeJson('public/data/curation-report.json', null),
      media: loadOptionalRuntimeJson('public/data/media-report.json', null),
      mediaLocalization: loadOptionalRuntimeJson('public/data/media-localization-report.json', null),
    },
  };
}

function loadOptionalRuntimeJson(path, fallback) {
  const resolvedPath = resolve(path);
  if (!existsSync(resolvedPath)) return fallback;
  try {
    return JSON.parse(readFileSync(resolvedPath, 'utf8'));
  } catch {
    return fallback;
  }
}
