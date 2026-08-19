import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { dirname, relative, resolve } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { parseCsv } from './data-utils.js';
import { dedupeRelationshipRecords, normalizeRelationshipRecords, validateRelationshipRecords } from './relationship-metadata.js';

const host = process.env.CIHOF_PORTAL_HOST || '127.0.0.1';
const port = Number(process.env.CIHOF_PORTAL_PORT || 5174);
const repoRoot = resolve('.');
const decisionsDir = resolve('.portal/decisions');
const jobsDir = resolve('.portal/jobs');
const relationshipsSourcePath = resolve('data/cihof_relationships.json');
const relationshipsPublicPath = resolve('public/data/relationships.json');
const storyLensesSourcePath = resolve('data/cihof_story_lenses.json');
const storyLensesPublicPath = resolve('public/data/story-lenses.json');
const runtimeInducteesPath = resolve('public/data/inductees.json');
const sourceInducteesPath = resolve('data/cihof_inductees.json');
const allowedExternalOrigins = new Set(
  String(process.env.CIHOF_PORTAL_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const configuredPortalToken = String(process.env.CIHOF_PORTAL_TOKEN || '').trim();
const tokenDisabledForLocalDev = process.env.CIHOF_PORTAL_REQUIRE_TOKEN === '0';
const portalTokenRequired = !tokenDisabledForLocalDev || allowedExternalOrigins.size > 0 || host !== '127.0.0.1';
const portalToken = configuredPortalToken || (portalTokenRequired ? randomBytes(24).toString('base64url') : '');
const portalTokenSource = configuredPortalToken ? 'environment' : portalTokenRequired ? 'generated' : 'disabled';
const jobs = new Map();
const maxBodyBytes = 12 * 1024 * 1024;
const maxPersistedJobs = Number(process.env.CIHOF_PORTAL_MAX_JOB_LOGS || 80);
const runnerStartedAt = new Date().toISOString();
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const scripts = [
  {
    id: 'prepare:data',
    label: 'Prepare Data',
    description: 'Regenerate runtime JSON from current source, curation, media, entities, places, and wall metadata.',
    command: ['run', 'prepare:data'],
    mutates: true,
  },
  {
    id: 'curate:report',
    label: 'Curation Report',
    description: 'Regenerate the staff curation report.',
    command: ['run', 'curate:report'],
    mutates: true,
  },
  {
    id: 'media:validate',
    label: 'Media Validate',
    description: 'Validate media manifest and regenerate media report.',
    command: ['run', 'media:validate'],
    mutates: true,
  },
  {
    id: 'validate:entities',
    label: 'Validate Entities',
    description: 'Validate entity and relationship JSON.',
    command: ['run', 'validate:entities'],
    mutates: false,
  },
  {
    id: 'validate:kiosk',
    label: 'Validate Kiosk',
    description: 'Run curation report and strict media validation without building.',
    command: ['run', 'validate:kiosk'],
    mutates: true,
    strict: true,
  },
  {
    id: 'audit:data',
    label: 'Data Audit',
    description: 'Run the local data audit report.',
    command: ['run', 'audit:data'],
    mutates: true,
  },
  {
    id: 'build',
    label: 'Build Site',
    description: 'Run the standard production build.',
    command: ['run', 'build'],
    mutates: true,
  },
  {
    id: 'build:kiosk',
    label: 'Strict Kiosk Build',
    description: 'Run strict kiosk validation and production build. This can fail until every kiosk readiness item is approved.',
    command: ['run', 'build:kiosk'],
    mutates: true,
    strict: true,
  },
  {
    id: 'curate:metadata',
    label: 'Regenerate Curation Scaffold',
    description: 'Regenerate curated metadata scaffold from source data. Use with care because it rewrites curation scaffolding.',
    command: ['run', 'curate:metadata'],
    mutates: true,
    destructive: true,
  },
  {
    id: 'media:manifest',
    label: 'Regenerate Media Manifest',
    description: 'Regenerate the media manifest from current inductee data.',
    command: ['run', 'media:manifest'],
    mutates: true,
  },
  {
    id: 'media:localize',
    label: 'Localize Media',
    description: 'Attempt to localize remote media assets into the repository. This may take time and can require network access.',
    command: ['run', 'media:localize'],
    mutates: true,
    destructive: true,
  },
  {
    id: 'import:2026',
    label: 'Import 2026 Data',
    description: 'Import the 2026 live data source. Use only when intentionally refreshing source coverage.',
    command: ['run', 'import:2026'],
    mutates: true,
    destructive: true,
  },
];

const scriptById = new Map(scripts.map((script) => [script.id, script]));
const validationScriptIds = new Set(['curate:report', 'media:validate', 'validate:entities', 'validate:kiosk']);
const buildScriptIds = new Set(['build', 'build:kiosk']);
const curationDecisionColumns = new Set([
  'approval_status',
  'review_priority',
  'approve_profile',
  'display_name',
  'name',
  'sort_name',
  'pronunciation',
  'approved_summary',
  'summary_approved',
  'approved_theme_tags',
  'theme_tags_approved',
  'approved_country_tags',
  'approved_countries',
  'country_tags_approved',
  'country_note',
  'country_notes',
  'approved_community_tags',
  'community_tags',
  'community_tags_approved',
  'journey_suggestions',
  'curator_notes',
  'attract_priority',
  'featured',
  'featured_candidate',
  'primary_image_alt_text',
  'image_alt_text',
  'image_focal_point',
  'image_rights_status',
  'image_rights_notes',
  'image_source_url',
  'image_rights_approved',
  'video_review_status',
  'caption_status',
  'transcript_status',
  'audio_description_status',
  'video_rights_status',
  'video_source_urls',
  'youtube_video_ids',
  'local_video_paths',
  'video_rights_approved',
  'captions_approved',
  'transcript_approved',
  'plain_language_review',
  'sensitive_content_review',
  'image_description_review',
  'accessibility_approved',
]);
const mediaDecisionColumns = new Set([
  'primary_image_source_url',
  'image_source_url',
  'primary_image_file_path',
  'image_file_path',
  'primary_image_runtime_path',
  'image_runtime_path',
  'primary_image_checksum_sha256',
  'image_checksum_sha256',
  'primary_image_width',
  'image_width',
  'primary_image_height',
  'image_height',
  'primary_image_alt_text',
  'image_alt_text',
  'image_rights_status',
  'primary_image_rights_status',
  'image_rights_approved',
  'approve_image_rights',
  'primary_image_rights_approved',
  'primary_image_kiosk_approved',
  'image_kiosk_approved',
  'approve_primary_image_for_kiosk',
  'video_index',
  'video_source_url',
  'youtube_video_id',
  'video_file_path',
  'video_runtime_path',
  'video_poster_file_path',
  'poster_file_path',
  'video_poster_runtime_path',
  'poster_runtime_path',
  'caption_file_path',
  'caption_runtime_path',
  'transcript_file_path',
  'transcript_runtime_path',
  'video_checksum_sha256',
  'duration_seconds',
  'codec',
  'video_rights_status',
  'video_rights_approved',
  'approve_video_rights',
  'caption_status',
  'captions_approved',
  'approve_captions',
  'transcript_status',
  'transcript_approved',
  'approve_transcript',
  'audio_description_status',
  'video_kiosk_approved',
  'all_videos_kiosk_approved',
  'approve_video_for_kiosk',
  'media_notes',
  'notes',
]);
hydratePersistedJobs();

const server = createServer(async (request, response) => {
  setCorsHeaders(request, response);
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    if (!isAllowedOrigin(request.headers.origin)) {
      sendJson(response, 403, { error: 'Origin not allowed. Portal runner accepts localhost by default and configured external origins only.' });
      return;
    }

    if (!isAuthorizedRequest(request)) {
      sendJson(response, 401, {
        error: 'Portal runner token is required. Copy the token printed by npm run portal:server into the Staff Portal runner token field.',
        tokenRequired: portalTokenRequired,
        tokenSource: portalTokenSource,
      });
      return;
    }

    const url = new URL(request.url || '/', `http://${host}:${port}`);

    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, {
        ok: true,
        name: 'CIHOF portal runner',
        repoRoot,
        scripts: scripts.length,
        activeJobs: Array.from(jobs.values()).filter((job) => job.status === 'running').length,
        externalOrigins: Array.from(allowedExternalOrigins),
        tokenRequired: portalTokenRequired,
        tokenSource: portalTokenSource,
        jobLogDir: relative(repoRoot, jobsDir),
        maxPersistedJobs,
        runnerStartedAt,
        git: readGitStatus(),
        lastSuccessfulValidation: findLastSuccessfulValidation(),
        lastSuccessfulBuild: findLastSuccessfulBuild(),
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/scripts') {
      sendJson(response, 200, { scripts: scripts.map(toPublicScript) });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/jobs') {
      sendJson(response, 200, { jobs: Array.from(jobs.values()).map(toPublicJob).reverse().slice(0, 20) });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/story-lenses') {
      const document = readStoryLensDocument();
      sendJson(response, 200, { document, validation: validateStoryLensDocument(document) });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/relationships') {
      const records = readRelationshipRecords();
      sendJson(response, 200, { records, validation: validateRelationshipRecords(records, readKnownInducteeIds()) });
      return;
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/jobs/')) {
      const id = decodeURIComponent(url.pathname.replace('/api/jobs/', ''));
      const job = jobs.get(id);
      if (!job) {
        sendJson(response, 404, { error: 'Job not found.' });
        return;
      }
      sendJson(response, 200, { job: toPublicJob(job) });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/run') {
      const body = await readJsonBody(request);
      const scriptId = typeof body.scriptId === 'string' ? body.scriptId : '';
      const script = scriptById.get(scriptId);
      if (!script) {
        sendJson(response, 400, { error: 'Unknown or unavailable script.' });
        return;
      }

      const job = createJob(script.label, [{ label: script.label, command: script.command }], { kind: 'script', scriptId });
      runJob(job);
      sendJson(response, 202, { job: toPublicJob(job) });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/story-lenses') {
      const body = await readJsonBody(request);
      const document = normalizeStoryLensDocument(body.document ?? body);
      const validation = validateStoryLensDocument(document);
      if (validation.errors.length > 0) {
        sendJson(response, 400, { error: 'Story lens validation failed.', validation });
        return;
      }

      const savedDocument = {
        ...document,
        schemaVersion: typeof document.schemaVersion === 'number' ? document.schemaVersion : 1,
        updatedAt: new Date().toISOString(),
      };
      mkdirSync(dirname(storyLensesSourcePath), { recursive: true });
      mkdirSync(dirname(storyLensesPublicPath), { recursive: true });
      writeFileSync(storyLensesSourcePath, `${JSON.stringify(savedDocument, null, 2)}\n`);
      writeFileSync(storyLensesPublicPath, `${JSON.stringify(savedDocument, null, 2)}\n`);
      sendJson(response, 200, { ok: true, document: savedDocument, validation: validateStoryLensDocument(savedDocument) });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/relationships') {
      const body = await readJsonBody(request);
      const records = dedupeRelationshipRecords(body.records ?? body.relationships ?? body);
      const validation = validateRelationshipRecords(records, readKnownInducteeIds());
      if (validation.errors.length > 0) {
        sendJson(response, 400, { error: 'Relationship validation failed.', validation });
        return;
      }

      mkdirSync(dirname(relationshipsSourcePath), { recursive: true });
      mkdirSync(dirname(relationshipsPublicPath), { recursive: true });
      writeFileSync(relationshipsSourcePath, `${JSON.stringify(records, null, 2)}\n`);
      writeFileSync(relationshipsPublicPath, `${JSON.stringify(records, null, 2)}\n`);
      sendJson(response, 200, { ok: true, records, validation: validateRelationshipRecords(records, readKnownInducteeIds()) });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/apply-decisions') {
      const body = await readJsonBody(request);
      const csv = typeof body.csv === 'string' ? body.csv.trim() : '';
      const dryRun = body.dryRun !== false;
      const targets = Array.isArray(body.targets) ? body.targets.filter((target) => target === 'curation' || target === 'media') : ['curation', 'media'];
      if (!csv || !csvHasIdHeader(csv)) {
        sendJson(response, 400, { error: 'Decision CSV is missing or invalid.' });
        return;
      }
      if (targets.length === 0) {
        sendJson(response, 400, { error: 'At least one apply target is required.' });
        return;
      }

      const csvHash = hashText(csv);
      const applySummary = buildDecisionApplySummary(csv, targets);
      if (!dryRun) {
        const previewJobId = typeof body.previewJobId === 'string' ? body.previewJobId : '';
        const previewHash = typeof body.previewHash === 'string' ? body.previewHash : '';
        const previewJob = jobs.get(previewJobId);
        const gitStatus = readGitStatus();

        if (!previewJob || previewJob.status !== 'success' || previewJob.meta?.kind !== 'apply-decisions' || previewJob.meta?.dryRun !== true) {
          sendJson(response, 409, { error: 'Run a successful dry run from this portal session before applying changes.' });
          return;
        }
        if (previewJob.meta?.csvHash !== csvHash || (previewHash && previewHash !== csvHash)) {
          sendJson(response, 409, { error: 'Portal edits changed after the dry run. Run the dry run again before applying.' });
          return;
        }
        if (gitStatus.available && gitStatus.dirty) {
          sendJson(response, 409, {
            error: 'The repo has uncommitted changes. Commit, stash, or discard them before applying portal edits.',
            git: gitStatus,
          });
          return;
        }
      }

      mkdirSync(decisionsDir, { recursive: true });
      const decisionPath = resolve(decisionsDir, `portal-decisions-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);
      writeFileSync(decisionPath, `${csv.replace(/^\uFEFF/, '')}\n`);
      const steps = [];
      if (targets.includes('curation')) {
        steps.push({ label: dryRun ? 'Dry Run Curation Decisions' : 'Apply Curation Decisions', command: ['run', 'curate:apply', '--', `--input=${decisionPath}`, ...(dryRun ? ['--dry-run'] : [])] });
      }
      if (targets.includes('media')) {
        steps.push({ label: dryRun ? 'Dry Run Media Decisions' : 'Apply Media Decisions', command: ['run', 'media:apply', '--', `--input=${decisionPath}`, ...(dryRun ? ['--dry-run'] : [])] });
      }
      if (!dryRun) {
        steps.push(
          { label: 'Prepare Data', command: ['run', 'prepare:data'] },
          { label: 'Curation Report', command: ['run', 'curate:report'] },
          { label: 'Media Validate', command: ['run', 'media:validate'] },
          { label: 'Validate Entities', command: ['run', 'validate:entities'] },
          { label: 'Build Public Site', command: ['run', 'build'] },
        );
      }
      const job = createJob(dryRun ? 'Dry Run Portal Decisions' : 'Apply Portal Decisions', steps, {
        kind: 'apply-decisions',
        decisionPath,
        dryRun,
        targets,
        csvHash,
        previewJobId: typeof body.previewJobId === 'string' ? body.previewJobId : '',
        applySummary,
      });
      runJob(job);
      sendJson(response, 202, { job: toPublicJob(job) });
      return;
    }

    sendJson(response, 404, { error: 'Not found.' });
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : 'Portal runner error.' });
  }
});

server.listen(port, host, () => {
  console.log(`CIHOF portal runner listening at http://${host}:${port}`);
  console.log(`External portal origins: ${allowedExternalOrigins.size > 0 ? Array.from(allowedExternalOrigins).join(', ') : 'none'}.`);
  if (portalTokenRequired && portalTokenSource === 'generated') {
    console.log(`Portal runner token: ${portalToken}`);
  } else if (portalTokenRequired) {
    console.log('Portal runner token required. Using CIHOF_PORTAL_TOKEN from the environment.');
  } else {
    console.log('Portal runner token disabled for local development by CIHOF_PORTAL_REQUIRE_TOKEN=0.');
  }
  console.log(`Persistent job logs: ${relative(repoRoot, jobsDir)}`);
  console.log('Use the Staff Portal runner controls to execute whitelisted scripts.');
});

function readRelationshipRecords() {
  const path = existsSync(relationshipsSourcePath)
    ? relationshipsSourcePath
    : existsSync(relationshipsPublicPath)
      ? relationshipsPublicPath
      : '';

  if (!path) return [];
  return normalizeRelationshipRecords(JSON.parse(readFileSync(path, 'utf8')));
}

function readStoryLensDocument() {
  const fallback = {
    schemaVersion: 1,
    source: {
      name: 'CIHOF story lenses',
      note: 'No story lens source file was found yet.',
    },
    lenses: [],
  };
  const path = existsSync(storyLensesSourcePath)
    ? storyLensesSourcePath
    : existsSync(storyLensesPublicPath)
      ? storyLensesPublicPath
      : '';

  if (!path) return fallback;
  return normalizeStoryLensDocument(JSON.parse(readFileSync(path, 'utf8')));
}

function normalizeStoryLensDocument(input) {
  const document = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const source = document.source && typeof document.source === 'object' && !Array.isArray(document.source)
    ? {
        name: typeof document.source.name === 'string' ? document.source.name.trim() : 'CIHOF story lenses',
        note: typeof document.source.note === 'string' ? document.source.note.trim() : '',
      }
    : {
        name: 'CIHOF story lenses',
        note: 'Curator-editable interpretive prompts for arranging the All People portrait wall.',
      };
  const lenses = Array.isArray(document.lenses)
    ? document.lenses.map(normalizeStoryLens).filter(Boolean)
    : [];

  return {
    schemaVersion: typeof document.schemaVersion === 'number' ? document.schemaVersion : 1,
    updatedAt: typeof document.updatedAt === 'string' ? document.updatedAt : '',
    source,
    lenses,
  };
}

function normalizeStoryLens(lens) {
  if (!lens || typeof lens !== 'object' || Array.isArray(lens)) return null;
  return {
    id: cleanStoryString(lens.id),
    label: cleanStoryString(lens.label),
    prompt: cleanStoryString(lens.prompt),
    description: cleanStoryString(lens.description),
    terms: cleanStoryList(lens.terms),
    themes: cleanStoryList(lens.themes),
    pinnedPersonIds: cleanStoryList(lens.pinnedPersonIds),
    excludedPersonIds: cleanStoryList(lens.excludedPersonIds),
    curatorNotes: cleanStoryList(lens.curatorNotes),
    reviewStatus: ['draft', 'reviewed', 'approved'].includes(lens.reviewStatus) ? lens.reviewStatus : 'draft',
    maxPortraits: Number.isFinite(lens.maxPortraits) ? Math.round(lens.maxPortraits) : 48,
    enabled: lens.enabled !== false,
  };
}

function validateStoryLensDocument(document) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const knownInducteeIds = readKnownInducteeIds();

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
    ['id', 'label', 'prompt', 'description'].forEach((field) => {
      if (typeof lens[field] !== 'string' || lens[field].trim().length === 0) errors.push(`${label}.${field} is required.`);
    });
    if (typeof lens.id === 'string') {
      if (ids.has(lens.id)) errors.push(`${label}.id duplicates ${lens.id}.`);
      ids.add(lens.id);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(lens.id)) warnings.push(`${label}.id should be lowercase kebab-case.`);
    }
    if (!Array.isArray(lens.terms)) errors.push(`${label}.terms must be an array.`);
    if (!Array.isArray(lens.themes)) errors.push(`${label}.themes must be an array.`);
    if (Array.isArray(lens.terms)) {
      lens.terms.forEach((term, termIndex) => {
        if (typeof term !== 'string' || term.trim().length === 0) errors.push(`${label}.terms[${termIndex}] is required.`);
      });
    }
    if (Array.isArray(lens.themes)) {
      lens.themes.forEach((theme, themeIndex) => {
        if (typeof theme !== 'string' || theme.trim().length === 0) errors.push(`${label}.themes[${themeIndex}] is required.`);
      });
    }
    if (Array.isArray(lens.terms) && Array.isArray(lens.themes) && lens.terms.length + lens.themes.length === 0) {
      errors.push(`${label} must contain at least one term or theme.`);
    }
    ['pinnedPersonIds', 'excludedPersonIds', 'curatorNotes'].forEach((field) => {
      if (lens[field] !== undefined && !Array.isArray(lens[field])) errors.push(`${label}.${field} must be an array when present.`);
      if (Array.isArray(lens[field])) {
        lens[field].forEach((value, valueIndex) => {
          if (typeof value !== 'string' || value.trim().length === 0) errors.push(`${label}.${field}[${valueIndex}] is required.`);
        });
      }
    });
    ['pinnedPersonIds', 'excludedPersonIds'].forEach((field) => {
      if (!Array.isArray(lens[field])) return;
      lens[field].forEach((id) => {
        if (typeof id === 'string' && knownInducteeIds.size > 0 && !knownInducteeIds.has(id)) errors.push(`${label}.${field} contains unknown inductee id ${id}.`);
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
    if (!Number.isFinite(lens.maxPortraits) || lens.maxPortraits < 12 || lens.maxPortraits > 96) {
      errors.push(`${label}.maxPortraits must be a number from 12 to 96.`);
    }
    if (typeof lens.enabled !== 'boolean') errors.push(`${label}.enabled must be a boolean.`);
  });

  return { errors, warnings };
}

function readKnownInducteeIds() {
  const ids = new Set();
  const path = existsSync(runtimeInducteesPath)
    ? runtimeInducteesPath
    : existsSync(sourceInducteesPath)
      ? sourceInducteesPath
      : '';
  if (!path) return ids;

  try {
    const payload = JSON.parse(readFileSync(path, 'utf8'));
    const records = Array.isArray(payload) ? payload : Array.isArray(payload?.inductees) ? payload.inductees : [];
    records.forEach((record) => {
      if (record && typeof record.id === 'string') ids.add(record.id);
    });
  } catch {
    return new Set();
  }

  return ids;
}

function cleanStoryString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanStoryList(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanStoryString(item)).filter(Boolean)));
}

function createJob(label, steps, meta = {}) {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id,
    label,
    status: 'queued',
    startedAt: '',
    finishedAt: '',
    exitCode: null,
    output: '',
    currentStep: '',
    steps: steps.map((step) => ({ ...step, status: 'queued', startedAt: '', finishedAt: '', exitCode: null })),
    meta,
    logPath: relative(repoRoot, jobLogPath(id)),
    persistedAt: '',
  };
  jobs.set(id, job);
  trimJobs();
  persistJob(job);
  return job;
}

async function runJob(job) {
  job.status = 'running';
  job.startedAt = new Date().toISOString();
  persistJob(job);

  for (const step of job.steps) {
    job.currentStep = step.label;
    step.status = 'running';
    step.startedAt = new Date().toISOString();
    step.output = '';
    persistJob(job);
    appendOutput(job, `\n> ${step.label}\n$ npm ${step.command.join(' ')}\n`);
    const exitCode = await runNpmCommand(step.command, (chunk) => {
      step.output = `${step.output}${redactSecrets(chunk)}`.slice(-24_000);
      appendOutput(job, chunk);
    });
    step.exitCode = exitCode;
    step.finishedAt = new Date().toISOString();
    step.status = exitCode === 0 ? 'success' : 'failed';
    updateApplySummaryFromSteps(job);
    persistJob(job);
    if (exitCode !== 0) {
      job.status = 'failed';
      job.exitCode = exitCode;
      job.finishedAt = new Date().toISOString();
      appendOutput(job, `\nStep failed with exit code ${exitCode}.\n`);
      persistJob(job);
      return;
    }
  }

  job.status = 'success';
  job.exitCode = 0;
  job.currentStep = '';
  job.finishedAt = new Date().toISOString();
  appendOutput(job, '\nJob completed successfully.\n');
  persistJob(job);
}

function runNpmCommand(args, onOutput) {
  return new Promise((resolvePromise) => {
    const childEnv = { ...process.env };
    delete childEnv.CIHOF_PORTAL_TOKEN;

    const child = spawn(npmCommand, args, {
      cwd: repoRoot,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => onOutput(chunk.toString()));
    child.stderr.on('data', (chunk) => onOutput(chunk.toString()));
    child.on('error', (error) => {
      onOutput(`\nCould not start command: ${error.message}\n`);
      resolvePromise(1);
    });
    child.on('close', (code) => resolvePromise(typeof code === 'number' ? code : 1));
  });
}

function appendOutput(job, chunk) {
  job.output += redactSecrets(chunk);
  if (job.output.length > 80_000) job.output = job.output.slice(-80_000);
  persistJob(job);
}

function hydratePersistedJobs() {
  mkdirSync(jobsDir, { recursive: true });
  const files = safeJobFiles()
    .sort((a, b) => a.mtimeMs - b.mtimeMs)
    .slice(-40);

  files.forEach((file) => {
    try {
      const job = normalizePersistedJob(JSON.parse(readFileSync(file.path, 'utf8')));
      if (!job) return;
      jobs.set(job.id, job);
    } catch (error) {
      console.warn(`Skipping unreadable portal job log ${file.path}: ${error instanceof Error ? error.message : error}`);
    }
  });
}

function normalizePersistedJob(job) {
  if (!job || typeof job !== 'object' || Array.isArray(job) || typeof job.id !== 'string') return null;
  const status = ['queued', 'running', 'success', 'failed'].includes(job.status) ? job.status : 'failed';
  const recoveredJob = {
    id: job.id,
    label: typeof job.label === 'string' ? job.label : 'Portal Job',
    status,
    startedAt: typeof job.startedAt === 'string' ? job.startedAt : '',
    finishedAt: typeof job.finishedAt === 'string' ? job.finishedAt : '',
    exitCode: Number.isFinite(job.exitCode) ? job.exitCode : null,
    output: typeof job.output === 'string' ? redactSecrets(job.output).slice(-80_000) : '',
    currentStep: typeof job.currentStep === 'string' ? job.currentStep : '',
    steps: Array.isArray(job.steps) ? job.steps.map(normalizePersistedStep).filter(Boolean) : [],
    meta: job.meta && typeof job.meta === 'object' && !Array.isArray(job.meta) ? job.meta : {},
    logPath: relative(repoRoot, jobLogPath(job.id)),
    persistedAt: typeof job.persistedAt === 'string' ? job.persistedAt : '',
  };

  if (recoveredJob.status === 'running' || recoveredJob.status === 'queued') {
    recoveredJob.status = 'failed';
    recoveredJob.exitCode = 1;
    recoveredJob.currentStep = '';
    recoveredJob.finishedAt = runnerStartedAt;
    recoveredJob.output = `${recoveredJob.output}\nRunner restarted before this job finished.\n`.slice(-80_000);
    persistJob(recoveredJob);
  }

  return recoveredJob;
}

function normalizePersistedStep(step) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) return null;
  return {
    label: typeof step.label === 'string' ? step.label : 'Step',
    status: ['queued', 'running', 'success', 'failed'].includes(step.status) ? step.status : 'failed',
    startedAt: typeof step.startedAt === 'string' ? step.startedAt : '',
    finishedAt: typeof step.finishedAt === 'string' ? step.finishedAt : '',
    exitCode: Number.isFinite(step.exitCode) ? step.exitCode : null,
    output: typeof step.output === 'string' ? redactSecrets(step.output).slice(-24_000) : '',
  };
}

function persistJob(job) {
  try {
    mkdirSync(jobsDir, { recursive: true });
    job.logPath = relative(repoRoot, jobLogPath(job.id));
    job.persistedAt = new Date().toISOString();
    writeFileSync(jobLogPath(job.id), `${JSON.stringify(toPublicJob(job), null, 2)}\n`);
    trimPersistedJobFiles();
  } catch (error) {
    console.warn(`Could not persist portal job ${job.id}: ${error instanceof Error ? error.message : error}`);
  }
}

function trimPersistedJobFiles() {
  if (!Number.isFinite(maxPersistedJobs) || maxPersistedJobs < 1) return;
  const files = safeJobFiles().sort((a, b) => a.mtimeMs - b.mtimeMs);
  files.slice(0, Math.max(0, files.length - maxPersistedJobs)).forEach((file) => {
    try {
      unlinkSync(file.path);
    } catch (error) {
      console.warn(`Could not remove old portal job log ${file.path}: ${error instanceof Error ? error.message : error}`);
    }
  });
}

function safeJobFiles() {
  if (!existsSync(jobsDir)) return [];
  return readdirSync(jobsDir)
    .filter((name) => /^[a-z0-9-]+\.json$/i.test(name))
    .map((name) => {
      const path = resolve(jobsDir, name);
      const stats = statSync(path);
      return { path, mtimeMs: stats.mtimeMs };
    })
    .filter((file) => file.path.startsWith(jobsDir));
}

function jobLogPath(id) {
  return resolve(jobsDir, `${String(id).replace(/[^a-z0-9-]/gi, '-')}.json`);
}

function redactSecrets(value) {
  if (!portalToken) return value;
  return String(value).split(portalToken).join('[redacted portal token]');
}

function hashText(value) {
  return createHash('sha256').update(value).digest('hex');
}

function buildDecisionApplySummary(csv, targets) {
  const csvRows = parseCsv(csv.replace(/^\uFEFF/, ''));
  const headers = csvRows.shift()?.map(normalizeDecisionHeader) ?? [];
  const targetSet = new Set(targets);
  const curationFieldCounts = {};
  const mediaFieldCounts = {};
  const affectedRecords = [];
  const warnings = [];

  csvRows.forEach((row, index) => {
    const record = Object.fromEntries(headers.map((header, cellIndex) => [header, String(row[cellIndex] ?? '').trim()]));
    const id = record.id || '';
    if (!id) {
      warnings.push(`Row ${index + 2} has no id and will be ignored by apply scripts.`);
      return;
    }

    const curationFields = [];
    const mediaFields = [];
    headers.forEach((header) => {
      const value = record[header];
      if (!value) return;
      if (targetSet.has('curation') && curationDecisionColumns.has(header)) {
        curationFields.push(header);
        curationFieldCounts[header] = (curationFieldCounts[header] ?? 0) + 1;
      }
      if (targetSet.has('media') && mediaDecisionColumns.has(header)) {
        mediaFields.push(header);
        mediaFieldCounts[header] = (mediaFieldCounts[header] ?? 0) + 1;
      }
    });

    affectedRecords.push({
      id,
      name: record.name || '',
      classYear: record.class_year || '',
      curationFields,
      mediaFields,
      fieldInputs: curationFields.length + mediaFields.length,
    });
  });

  return {
    rowsRead: csvRows.length,
    targetRows: affectedRecords.length,
    targets,
    curationFieldInputs: sumCounts(curationFieldCounts),
    mediaFieldInputs: sumCounts(mediaFieldCounts),
    curationFieldCounts,
    mediaFieldCounts,
    affectedRecords: affectedRecords.slice(0, 30),
    warnings,
    dryRunResults: [],
    pipeline: targets.flatMap((target) => target === 'curation' ? ['Apply Curation Decisions'] : ['Apply Media Decisions']).concat([
      'Prepare Data',
      'Curation Report',
      'Media Validate',
      'Validate Entities',
      'Build Public Site',
    ]),
  };
}

function updateApplySummaryFromSteps(job) {
  if (job.meta?.kind !== 'apply-decisions' || !job.meta.applySummary) return;
  job.meta.applySummary = {
    ...job.meta.applySummary,
    dryRunResults: summarizeApplySteps(job.steps),
  };
}

function summarizeApplySteps(steps) {
  return steps
    .filter((step) => /Curation Decisions|Media Decisions/.test(step.label))
    .map((step) => ({
      label: step.label,
      status: step.status,
      rowsRead: parseFirstNumber(step.output, /Read (\d+) (?:curation|media) decision rows/),
      recordsChanged: parseFirstNumber(step.output, /(\d+) (?:curated|media) records (?:would be updated|updated)/),
      warnings: parseFirstNumber(step.output, /Warnings: (\d+)/) ?? countOutputLines(step.output, /^Warning:/),
      errors: countOutputLines(step.output, /^Error:/),
      changedRecords: parseChangedRecordLines(step.output).slice(0, 20),
    }));
}

function parseFirstNumber(output, pattern) {
  const match = String(output || '').match(pattern);
  return match ? Number(match[1]) : null;
}

function countOutputLines(output, pattern) {
  return String(output || '').split(/\r?\n/).filter((line) => pattern.test(line)).length;
}

function parseChangedRecordLines(output) {
  return String(output || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^- [a-z0-9-]+: /i.test(line))
    .map((line) => {
      const [, id, fields] = line.match(/^- ([^:]+): (.+)$/) ?? [];
      return { id: id || '', fields: fields ? fields.split(',').map((field) => field.trim()).filter(Boolean) : [] };
    })
    .filter((record) => record.id);
}

function sumCounts(counts) {
  return Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0);
}

function normalizeDecisionHeader(header) {
  return String(header)
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function trimJobs() {
  const values = Array.from(jobs.values());
  if (values.length <= 40) return;
  values
    .sort((a, b) => String(a.startedAt || '').localeCompare(String(b.startedAt || '')))
    .slice(0, values.length - 40)
    .forEach((job) => jobs.delete(job.id));
}

function readGitStatus() {
  const rootResult = runGit(['rev-parse', '--show-toplevel']);
  if (!rootResult.ok) {
    return {
      available: false,
      root: repoRoot,
      dirty: false,
      changedFiles: 0,
      error: rootResult.error || 'Not a git repository.',
    };
  }

  const branchResult = runGit(['branch', '--show-current']);
  const fallbackBranchResult = branchResult.stdout ? branchResult : runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  const commitResult = runGit(['rev-parse', '--short', 'HEAD']);
  const fullCommitResult = runGit(['rev-parse', 'HEAD']);
  const subjectResult = runGit(['log', '-1', '--pretty=%s']);
  const dateResult = runGit(['log', '-1', '--format=%cI']);
  const upstreamResult = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  const statusResult = runGit(['status', '--porcelain']);
  const statusLines = statusResult.ok && statusResult.stdout
    ? statusResult.stdout.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean)
    : [];
  const aheadBehind = upstreamResult.ok && upstreamResult.stdout
    ? readAheadBehind(upstreamResult.stdout)
    : { ahead: null, behind: null };

  return {
    available: true,
    root: rootResult.stdout || repoRoot,
    branch: fallbackBranchResult.stdout || '',
    upstream: upstreamResult.ok ? upstreamResult.stdout : '',
    commit: commitResult.stdout || '',
    fullCommit: fullCommitResult.stdout || '',
    commitSubject: subjectResult.stdout || '',
    commitDate: dateResult.stdout || '',
    dirty: statusLines.length > 0,
    changedFiles: statusLines.length,
    ahead: aheadBehind.ahead,
    behind: aheadBehind.behind,
    changes: statusLines.slice(0, 12).map(parseGitStatusLine),
  };
}

function readAheadBehind(upstream) {
  const result = runGit(['rev-list', '--left-right', '--count', `${upstream}...HEAD`]);
  if (!result.ok || !result.stdout) return { ahead: null, behind: null };
  const [behind, ahead] = result.stdout.split(/\s+/).map((value) => Number(value));
  return {
    ahead: Number.isFinite(ahead) ? ahead : null,
    behind: Number.isFinite(behind) ? behind : null,
  };
}

function parseGitStatusLine(line) {
  return {
    status: line.slice(0, 2).trim() || 'changed',
    path: line.slice(3).trim(),
  };
}

function runGit(args) {
  try {
    return {
      ok: true,
      stdout: execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      }).trimEnd(),
      error: '',
    };
  } catch (error) {
    return {
      ok: false,
      stdout: '',
      error: gitErrorMessage(error),
    };
  }
}

function gitErrorMessage(error) {
  if (error && typeof error === 'object' && 'stderr' in error && error.stderr) {
    return String(error.stderr).trim();
  }
  return error instanceof Error ? error.message : 'Git command failed.';
}

function findLastSuccessfulValidation() {
  return findLastSuccessfulJob((job) => {
    if (validationScriptIds.has(job.meta?.scriptId)) return true;
    return hasSuccessfulStep(job, 'Curation Report') && hasSuccessfulStep(job, 'Media Validate') && hasSuccessfulStep(job, 'Validate Entities');
  });
}

function findLastSuccessfulBuild() {
  return findLastSuccessfulJob((job) => {
    if (buildScriptIds.has(job.meta?.scriptId)) return true;
    return hasSuccessfulStep(job, 'Build Public Site');
  });
}

function findLastSuccessfulJob(matchesJob) {
  const matching = Array.from(jobs.values())
    .filter((job) => job.status === 'success' && matchesJob(job))
    .sort((a, b) => String(b.finishedAt || b.startedAt || '').localeCompare(String(a.finishedAt || a.startedAt || '')));
  return matching[0] ? summarizeJob(matching[0]) : null;
}

function hasSuccessfulStep(job, label) {
  return Array.isArray(job.steps) && job.steps.some((step) => step.label === label && step.status === 'success');
}

function summarizeJob(job) {
  return {
    id: job.id,
    label: job.label,
    status: job.status,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    exitCode: job.exitCode,
    scriptId: typeof job.meta?.scriptId === 'string' ? job.meta.scriptId : '',
    logPath: job.logPath,
    persistedAt: job.persistedAt,
  };
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  return JSON.parse(text);
}

function setCorsHeaders(request, response) {
  const origin = request.headers.origin;
  if (isAllowedOrigin(origin)) response.setHeader('Access-Control-Allow-Origin', origin || '*');
  response.setHeader('Access-Control-Allow-Headers', 'content-type, x-cihof-portal-token');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Max-Age', '600');
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  return isLocalPortalOrigin(origin) || allowedExternalOrigins.has(origin);
}

function isAuthorizedRequest(request) {
  if (!portalTokenRequired) return true;
  if (!portalToken) return false;
  const suppliedToken = Array.isArray(request.headers['x-cihof-portal-token'])
    ? request.headers['x-cihof-portal-token'][0]
    : request.headers['x-cihof-portal-token'];
  return tokenMatches(String(suppliedToken || ''));
}

function isLocalPortalOrigin(origin) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
}

function tokenMatches(value) {
  const supplied = Buffer.from(value);
  const expected = Buffer.from(portalToken);
  if (supplied.length !== expected.length) return false;
  return timingSafeEqual(supplied, expected);
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(`${JSON.stringify(payload)}\n`);
}

function csvHasIdHeader(csv) {
  const firstLine = csv.split(/\r?\n/, 1)[0] || '';
  return firstLine
    .split(',')
    .map((cell) => cell.trim().replace(/^"|"$/g, '').toLowerCase())
    .includes('id');
}

function toPublicScript(script) {
  const { command, ...publicScript } = script;
  return publicScript;
}

function toPublicJob(job) {
  return {
    id: job.id,
    label: job.label,
    status: job.status,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    exitCode: job.exitCode,
    output: redactSecrets(job.output),
    currentStep: job.currentStep,
    steps: job.steps.map(({ command, ...step }) => step),
    meta: job.meta,
    logPath: job.logPath,
    persistedAt: job.persistedAt,
  };
}
