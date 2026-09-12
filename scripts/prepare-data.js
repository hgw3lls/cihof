import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { buildReport, loadInductees, loadPhysicalWallMetadata } from './data-utils.js';
import { buildEntityModel, loadCuratedEntityModel } from './entity-model.js';
import { normalizeRelationshipRecords, validateRelationshipRecords } from './relationship-metadata.js';
import { generatedAtFor } from './stable-generated-at.js';

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
const sourceCurationAddendumPaths = [
  resolve('data/wrhs_exhibition_research_addendum.json'),
];
const runtimeDataBundleOutputPath = resolve('public/data/cihof-runtime-data.json');
const standardsIndexOutputPath = resolve('public/data/standards-index.json');
const linkedArtOutputPath = resolve('public/data/linked-art-export.json');
const cidocCrmOutputPath = resolve('public/data/cidoc-crm-export.json');
const iiifCollectionOutputPath = resolve('public/data/iiif-collection.json');
const iiifManifestOutputDir = resolve('public/data/iiif');
const publicBaseUrl = 'https://clevelandinternationalhalloffame.com/cihof/';
const runtimeDataGeneratedAt = generatedAtFor(runtimeDataBundleOutputPath);
const standardsIndexGeneratedAt = generatedAtFor(standardsIndexOutputPath);

const inductees = loadInductees();
const report = buildReport(inductees);
const entityModel = buildEntityModel(inductees, loadCuratedEntityModel());
const relationshipMetadata = loadRelationshipMetadata(inductees);
const storySections = loadStorySections(inductees);
const storyLenses = loadStoryLenses();
const mediaManifest = loadRuntimeMediaManifest();
const physicalWallMetadata = loadPhysicalWallMetadata();
const sourceCurationPacket = loadSourceCurationPacket();
const standardsExport = buildStandardsExport();
const runtimeDataBundle = buildRuntimeDataBundle();

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(iiifManifestOutputDir, { recursive: true });
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
writeFileSync(standardsIndexOutputPath, `${JSON.stringify(standardsExport.index, null, 2)}\n`);
writeFileSync(linkedArtOutputPath, `${JSON.stringify(standardsExport.linkedArt, null, 2)}\n`);
writeFileSync(cidocCrmOutputPath, `${JSON.stringify(standardsExport.cidocCrm, null, 2)}\n`);
writeFileSync(iiifCollectionOutputPath, `${JSON.stringify(standardsExport.iiif.collection, null, 2)}\n`);
standardsExport.iiif.manifests.forEach((manifest) => {
  writeFileSync(resolve(iiifManifestOutputDir, `${manifest.slug}.json`), `${JSON.stringify(manifest.document, null, 2)}\n`);
});
writeFileSync(runtimeDataBundleOutputPath, `${JSON.stringify(runtimeDataBundle)}\n`);

console.log(
  `Prepared ${report.totalInductees} inductees across ${report.regions.length} regions and ${report.countries.length} nationality/heritage labels. ` +
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
console.log(
  `Prepared standards exports: Linked Art, CIDOC CRM JSON-LD, and ${standardsExport.iiif.manifests.length} IIIF Presentation manifests.`,
);
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

  const baseDocument = existsSync(sourceCurationSourcePath)
    ? JSON.parse(readFileSync(sourceCurationSourcePath, 'utf8'))
    : emptyDocument;
  const addenda = sourceCurationAddendumPaths
    .filter((path) => existsSync(path))
    .map((path) => ({
      path,
      document: JSON.parse(readFileSync(path, 'utf8')),
    }));
  const document = addenda.reduce(
    (current, addendum) => mergeSourceCurationPacket(current, addendum.document, addendum.path),
    normalizeSourceCurationPacket(baseDocument, emptyDocument),
  );

  return {
    document: sanitizeSourceCurationPacketForPublic(withRecountedSourceSummary(document)),
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

function mergeSourceCurationPacket(base, addendum, addendumPath) {
  const normalizedAddendum = normalizeSourceCurationPacket(addendum, {
    schemaVersion: 1,
    source: {},
    guardrails: {},
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
  });
  const sourceAddenda = Array.isArray(base.source?.addenda) ? base.source.addenda : [];
  const merged = {
    ...base,
    source: {
      ...base.source,
      addenda: [
        ...sourceAddenda,
        {
          ...sanitizePublicSourceMetadata(normalizedAddendum.source),
          path: publicSourcePath(addendumPath),
        },
      ],
    },
    guardrails: {
      ...(base.guardrails ?? {}),
      ...(normalizedAddendum.guardrails ?? {}),
    },
    summary: {
      ...(base.summary ?? {}),
      ...(normalizedAddendum.summary ?? {}),
    },
  };

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
    merged[key] = [...(base[key] ?? []), ...(normalizedAddendum[key] ?? [])];
  });

  return merged;
}

function sanitizeSourceCurationPacketForPublic(document) {
  const addenda = Array.isArray(document.source?.addenda)
    ? document.source.addenda.map((addendum) => sanitizePublicSourceMetadata(addendum))
    : [];

  return {
    ...document,
    source: {
      ...(document.source ?? {}),
      ...sanitizePublicSourceMetadata(document.source),
      addenda,
    },
  };
}

function sanitizePublicSourceMetadata(source = {}) {
  const sanitized = { ...source };
  if (sanitized.path) sanitized.path = publicSourcePath(sanitized.path);
  if (sanitized.sourceDocument) sanitized.sourceDocument = publicSourceDocument(sanitized.sourceDocument);
  return sanitized;
}

function publicSourcePath(path) {
  if (typeof path !== 'string' || path.trim().length === 0) return path;
  const repoRelative = relative(process.cwd(), path);
  if (repoRelative && !repoRelative.startsWith('..') && !repoRelative.startsWith('/')) return repoRelative;
  return basename(path);
}

function publicSourceDocument(path) {
  if (typeof path !== 'string' || path.trim().length === 0) return path;
  return path.startsWith('/') ? `${basename(path)} (user-supplied)` : path;
}

function withRecountedSourceSummary(document) {
  return {
    ...document,
    summary: {
      ...(document.summary ?? {}),
      mediaReviewDrafts: {
        ...(document.summary?.mediaReviewDrafts ?? {}),
        total: document.mediaReviewDrafts.length,
        newSources: document.mediaReviewDrafts.filter((record) => !record.alreadyInMediaManifest).length,
        highConfidenceNewSources: document.mediaReviewDrafts.filter((record) => !record.alreadyInMediaManifest && (record.confidence ?? 0) >= 0.8).length,
      },
      videoReviewDrafts: {
        ...(document.summary?.videoReviewDrafts ?? {}),
        total: document.videoReviewDrafts.length,
        newSources: document.videoReviewDrafts.filter((record) => !record.alreadyInMediaManifest).length,
      },
      relationshipReviewDrafts: {
        ...(document.summary?.relationshipReviewDrafts ?? {}),
        total: document.relationshipReviewDrafts.length,
      },
      placeReviewDrafts: {
        ...(document.summary?.placeReviewDrafts ?? {}),
        total: document.placeReviewDrafts.length,
        nonDirectional: document.placeReviewDrafts.filter((record) => record.migrationDirection !== 'inferred').length,
      },
      organizationReviewDrafts: {
        ...(document.summary?.organizationReviewDrafts ?? {}),
        total: document.organizationReviewDrafts.length,
      },
      storySectionReviewDrafts: {
        ...(document.summary?.storySectionReviewDrafts ?? {}),
        total: document.storySectionReviewDrafts.length,
        primaryLeads: document.storySectionReviewDrafts.filter((record) => record.priority === 'primary-story-lead').length,
      },
      classEvidenceReviewDrafts: {
        ...(document.summary?.classEvidenceReviewDrafts ?? {}),
        total: document.classEvidenceReviewDrafts.length,
      },
    },
  };
}

function buildRuntimeDataBundle() {
  return {
    schemaVersion: 1,
    generatedAt: runtimeDataGeneratedAt,
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
    sourceCuration: buildSourceCurationRuntimeSummary(sourceCurationPacket),
    standards: standardsExport.index,
  };
}

function buildSourceCurationRuntimeSummary(packet) {
  const document = packet.document ?? {};
  return {
    schemaVersion: typeof document.schemaVersion === 'number' ? document.schemaVersion : 1,
    source: document.source ?? {},
    guardrails: document.guardrails ?? {},
    summary: document.summary ?? {},
    recordCount: packet.recordCount,
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

function buildStandardsExport() {
  const linkedArt = buildLinkedArtExport();
  const cidocCrm = buildCidocCrmExport();
  const iiif = buildIiifExport();

  return {
    index: buildStandardsIndex(linkedArt, cidocCrm, iiif.collection, iiif.manifests.length),
    linkedArt,
    cidocCrm,
    iiif,
  };
}

function buildStandardsIndex(linkedArt, cidocCrm, iiifCollection, iiifManifestCount) {
  return {
    schemaVersion: 1,
    generatedAt: standardsIndexGeneratedAt,
    source: {
      generator: 'scripts/prepare-data.js',
      publicBaseUrl,
      note: 'Public interoperability index for museum, archive, and cultural-heritage integrations.',
    },
    exports: {
      linkedArt: {
        id: linkedArt.id,
        path: '/data/linked-art-export.json',
        context: linkedArt['@context'],
        description: 'Linked Art JSON-LD person set aligned to CIDOC CRM cultural-heritage semantics.',
      },
      cidocCrm: {
        id: cidocCrm.id,
        path: '/data/cidoc-crm-export.json',
        context: cidocCrm['@context'],
        description: 'Compact CIDOC CRM JSON-LD graph for people, class events, places, themes, media, and documented relationships.',
      },
      iiifCollection: {
        id: iiifCollection.id,
        path: '/data/iiif-collection.json',
        context: iiifCollection['@context'],
        description: 'IIIF Presentation 3 collection with one portrait manifest per inductee with public image media.',
      },
    },
    coverage: {
      inductees: inductees.length,
      entityRecords: entityModel.entityDocument.entities.length,
      relationshipRecords: entityModel.relationshipDocument.relationships.length,
      iiifManifests: iiifManifestCount,
      primaryPortraits: inductees.filter((inductee) => Boolean(inductee.primaryImageUrl)).length,
    },
    mediaReadinessPolicy: {
      images: 'IIIF manifests include public portrait image URLs. Rights status remains governed by data/media_manifest.json.',
      videoAndAudio: 'Public playback requires approved rights, runtime files, posters where applicable, and caption/transcript readiness.',
    },
  };
}

function buildLinkedArtExport() {
  return {
    '@context': 'https://linked.art/ns/v1/linked-art.json',
    id: publicUrl('data/linked-art-export.json'),
    type: 'Set',
    _label: 'Cleveland International Hall of Fame inductees',
    identified_by: [linkedArtName('Cleveland International Hall of Fame inductees')],
    classified_as: [linkedArtType('Inductee collection')],
    referred_to_by: [
      {
        type: 'LinguisticObject',
        _label: 'Export note',
        content: 'Generated public interoperability export for the CIHOF portrait wall and staff portal.',
      },
    ],
    member: inductees.map(personToLinkedArt),
    subject_of: [
      {
        id: publicUrl('data/iiif-collection.json'),
        type: 'LinguisticObject',
        _label: 'IIIF Presentation collection',
      },
      {
        id: publicUrl('data/cidoc-crm-export.json'),
        type: 'LinguisticObject',
        _label: 'CIDOC CRM JSON-LD export',
      },
    ],
    _cihof_relationship_assertions: entityModel.relationshipDocument.relationships.map((relationship) => ({
      id: relationship.id,
      source: entityPublicId(relationship.sourceEntityId),
      target: entityPublicId(relationship.targetEntityId),
      type: relationship.type,
      label: relationship.displayLabel,
      provenance: relationship.provenance,
    })),
  };
}

function personToLinkedArt(inductee) {
  const description = descriptionForInductee(inductee);
  const result = {
    id: personPublicId(inductee),
    type: 'Person',
    _label: inductee.name,
    identified_by: [linkedArtName(inductee.name)],
    classified_as: [linkedArtType('CIHOF inductee'), ...inductee.themeTags.map(linkedArtType)],
    referred_to_by: description
      ? [
          {
            type: 'LinguisticObject',
            _label: `${inductee.name} biography summary`,
            content: description,
          },
        ]
      : [],
    subject_of: [
      ...profileSubject(inductee),
      {
        id: publicUrl(`data/iiif/${inductee.id}.json`),
        type: 'LinguisticObject',
        _label: `${inductee.name} IIIF manifest`,
      },
    ],
    member_of: inductee.classYear
      ? [
          {
            id: publicUrl(`data/linked-art-export.json#class-${inductee.classYear}`),
            type: 'Set',
            _label: `Class of ${inductee.classYear}`,
          },
        ]
      : [],
    _cihof: inducteePayload(inductee),
  };

  if (inductee.primaryImageUrl) {
    result.representation = [
      {
        id: publicUrl(inductee.primaryImageUrl),
        type: 'VisualItem',
        _label: `${inductee.name} portrait`,
      },
    ];
  }

  return result;
}

function buildCidocCrmExport() {
  return {
    '@context': {
      crm: 'http://www.cidoc-crm.org/cidoc-crm/',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      cihof: `${publicBaseUrl}ontology/`,
    },
    id: publicUrl('data/cidoc-crm-export.json'),
    type: 'crm:E78_Curated_Holding',
    'rdfs:label': 'Cleveland International Hall of Fame portrait wall knowledge graph',
    'crm:P46_is_composed_of': [
      ...inductees.map(personToCidocCrm),
      ...entityModel.entityDocument.entities.filter((entity) => entity.type !== 'Person').map(entityToCidocCrm),
    ],
    'crm:P67_refers_to': entityModel.relationshipDocument.relationships.map((relationship) => ({
      id: publicUrl(`data/cidoc-crm-export.json#relationship-${relationship.id}`),
      type: 'crm:E13_Attribute_Assignment',
      'rdfs:label': relationship.displayLabel,
      'crm:P140_assigned_attribute_to': entityPublicId(relationship.sourceEntityId),
      'crm:P141_assigned': entityPublicId(relationship.targetEntityId),
      'crm:P2_has_type': relationship.type,
      cihof: {
        provenance: relationship.provenance,
        sourceField: relationship.provenance?.sourceField ?? '',
        note: relationship.shortDescription ?? '',
      },
    })),
  };
}

function personToCidocCrm(inductee) {
  return {
    id: personPublicId(inductee),
    type: 'crm:E21_Person',
    'rdfs:label': inductee.name,
    'crm:P1_is_identified_by': inductee.name,
    'crm:P2_has_type': ['CIHOF inductee', ...inductee.themeTags],
    'crm:P11i_participated_in': inductee.classYear ? publicUrl(`data/cidoc-crm-export.json#class-${inductee.classYear}`) : undefined,
    'crm:P67i_is_referred_to_by': descriptionForInductee(inductee),
    'crm:P138i_has_representation': inductee.primaryImageUrl ? publicUrl(inductee.primaryImageUrl) : undefined,
    cihof: inducteePayload(inductee),
  };
}

function entityToCidocCrm(entity) {
  return {
    id: entityPublicId(entity.id),
    type: cidocTypeForEntity(entity.type),
    'rdfs:label': entity.displayName,
    'crm:P2_has_type': entity.type,
    'crm:P3_has_note': entity.shortDescription,
    cihof: {
      provenance: entity.provenance,
      dateRange: entity.dateRange,
      location: entity.location,
      attributes: entity.attributes,
    },
  };
}

function buildIiifExport() {
  const manifests = inductees
    .filter((inductee) => Boolean(inductee.primaryImageUrl))
    .map((inductee) => ({
      slug: inductee.id,
      document: buildIiifManifest(inductee),
    }));

  return {
    manifests,
    collection: {
      '@context': 'http://iiif.io/api/presentation/3/context.json',
      id: publicUrl('data/iiif-collection.json'),
      type: 'Collection',
      label: { en: ['Cleveland International Hall of Fame portraits'] },
      summary: { en: ['Public portrait collection generated from the CIHOF kiosk data model.'] },
      requiredStatement: {
        label: { en: ['Attribution'] },
        value: { en: ['Cleveland International Hall of Fame'] },
      },
      homepage: [
        {
          id: publicBaseUrl,
          type: 'Text',
          label: { en: ['Cleveland International Hall of Fame portrait wall'] },
          format: 'text/html',
        },
      ],
      items: manifests.map((manifest) => ({
        id: manifest.document.id,
        type: 'Manifest',
        label: manifest.document.label,
        thumbnail: manifest.document.thumbnail,
      })),
    },
  };
}

function buildIiifManifest(inductee) {
  const imageUrl = publicUrl(inductee.primaryImageUrl);
  const manifestId = publicUrl(`data/iiif/${inductee.id}.json`);
  const canvasId = `${manifestId}/canvas/primary`;
  const pageId = `${canvasId}/page`;
  const annotationId = `${canvasId}/annotation/primary`;
  const dimensions = imageDimensionsForInductee(inductee);
  const summary = descriptionForInductee(inductee);

  return {
    '@context': 'http://iiif.io/api/presentation/3/context.json',
    id: manifestId,
    type: 'Manifest',
    label: { en: [inductee.classYear ? `${inductee.name}, Class of ${inductee.classYear}` : inductee.name] },
    summary: summary ? { en: [summary] } : undefined,
    metadata: iiifMetadata(inductee),
    requiredStatement: {
      label: { en: ['Attribution'] },
      value: { en: ['Cleveland International Hall of Fame'] },
    },
    homepage: profileSubject(inductee).map((item) => ({
      id: item.id,
      type: 'Text',
      label: { en: ['CIHOF profile'] },
      format: 'text/html',
    })),
    thumbnail: [
      {
        id: imageUrl,
        type: 'Image',
        format: mimeTypeForPath(inductee.primaryImageUrl),
      },
    ],
    items: [
      {
        id: canvasId,
        type: 'Canvas',
        height: dimensions.height,
        width: dimensions.width,
        items: [
          {
            id: pageId,
            type: 'AnnotationPage',
            items: [
              {
                id: annotationId,
                type: 'Annotation',
                motivation: 'painting',
                body: {
                  id: imageUrl,
                  type: 'Image',
                  format: mimeTypeForPath(inductee.primaryImageUrl),
                  height: dimensions.height,
                  width: dimensions.width,
                },
                target: canvasId,
              },
            ],
          },
        ],
      },
    ],
  };
}

function iiifMetadata(inductee) {
  return [
    ['Class Year', inductee.classYear ? String(inductee.classYear) : ''],
    ['Region', inductee.region],
    ['Nationality / Heritage', inductee.countryTags.join(', ')],
    ['Communities', inductee.communityTags.join(', ')],
    ['Themes', inductee.themeTags.join(', ')],
    ['Review status', inductee.approvalStatus],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => ({
      label: { en: [label] },
      value: { en: [value] },
    }));
}

function linkedArtName(content) {
  return {
    type: 'Name',
    content,
  };
}

function linkedArtType(label) {
  return {
    type: 'Type',
    _label: label,
  };
}

function profileSubject(inductee) {
  if (!inductee.profileUrl) return [];
  return [
    {
      id: publicUrl(inductee.profileUrl),
      type: 'DigitalObject',
      _label: `${inductee.name} CIHOF profile`,
    },
  ];
}

function inducteePayload(inductee) {
  return {
    id: inductee.id,
    classYear: inductee.classYear,
    region: inductee.region,
    countryTags: inductee.countryTags,
    countryTagsSource: inductee.countryTagsSource,
    communityTags: inductee.communityTags,
    themeTags: inductee.themeTags,
    reviewStatus: inductee.approvalStatus,
    profileUrl: inductee.profileUrl,
  };
}

function descriptionForInductee(inductee) {
  return compactText(
    inductee.lifeWorkSummary ||
      inductee.honoredForSummary ||
      inductee.storySummary ||
      inductee.bioText ||
      `${inductee.name}, Cleveland International Hall of Fame inductee.`,
    560,
  );
}

function imageDimensionsForInductee(inductee) {
  const primary = mediaManifest.document.assets?.[inductee.id]?.images?.primary;
  const width = Number(primary?.width);
  const height = Number(primary?.height);
  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    return { width, height };
  }
  return { width: 1200, height: 1500 };
}

function personPublicId(inductee) {
  return publicUrl(`?person=${encodeURIComponent(inductee.id)}`);
}

function entityPublicId(id) {
  const person = inductees.find((inductee) => `person:${inductee.id}` === id || inductee.id === id);
  if (person) return personPublicId(person);
  return publicUrl(`data/cidoc-crm-export.json#${encodeURIComponent(id)}`);
}

function publicUrl(path) {
  if (!path) return publicBaseUrl;
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(String(path).replace(/^\/+/, ''), publicBaseUrl).href;
}

function compactText(value, maxLength) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength - 1).trimEnd();
  const boundary = truncated.lastIndexOf(' ');
  return `${truncated.slice(0, boundary > 160 ? boundary : truncated.length).trimEnd()}...`;
}

function mimeTypeForPath(path) {
  const cleanPath = String(path ?? '').toLowerCase().split(/[?#]/)[0];
  if (cleanPath.endsWith('.png')) return 'image/png';
  if (cleanPath.endsWith('.webp')) return 'image/webp';
  if (cleanPath.endsWith('.gif')) return 'image/gif';
  if (cleanPath.endsWith('.avif')) return 'image/avif';
  if (cleanPath.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

function cidocTypeForEntity(type) {
  switch (type) {
    case 'Community':
      return 'crm:E74_Group';
    case 'Place':
      return 'crm:E53_Place';
    case 'Organization':
      return 'crm:E74_Group';
    case 'Event':
      return 'crm:E5_Event';
    case 'Theme':
      return 'crm:E55_Type';
    case 'Media':
      return 'crm:E36_Visual_Item';
    default:
      return 'crm:E1_CRM_Entity';
  }
}
