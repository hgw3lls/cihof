import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const host = process.env.CIHOF_PORTAL_HOST || '127.0.0.1';
const port = Number(process.env.CIHOF_PORTAL_PORT || 5174);
const repoRoot = resolve('.');
const decisionsDir = resolve('.portal/decisions');
const storyLensesSourcePath = resolve('data/cihof_story_lenses.json');
const storyLensesPublicPath = resolve('public/data/story-lenses.json');
const allowedExternalOrigins = new Set(
  String(process.env.CIHOF_PORTAL_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const portalToken = String(process.env.CIHOF_PORTAL_TOKEN || '');
const jobs = new Map();
const maxBodyBytes = 12 * 1024 * 1024;
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
      sendJson(response, 401, { error: 'Portal runner token is required for configured external origins.' });
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
        tokenRequiredForExternalOrigins: true,
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
        );
      }
      const job = createJob(dryRun ? 'Dry Run Portal Decisions' : 'Apply Portal Decisions', steps, {
        kind: 'apply-decisions',
        decisionPath,
        dryRun,
        targets,
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
  console.log('Configured external origins require CIHOF_PORTAL_TOKEN and the matching portal token header.');
  console.log('Use the Staff Portal runner controls to execute whitelisted scripts.');
});

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
    maxPortraits: Number.isFinite(lens.maxPortraits) ? Math.round(lens.maxPortraits) : 48,
    enabled: lens.enabled !== false,
  };
}

function validateStoryLensDocument(document) {
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
    if (!Number.isFinite(lens.maxPortraits) || lens.maxPortraits < 12 || lens.maxPortraits > 96) {
      errors.push(`${label}.maxPortraits must be a number from 12 to 96.`);
    }
    if (typeof lens.enabled !== 'boolean') errors.push(`${label}.enabled must be a boolean.`);
  });

  return { errors, warnings };
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
  };
  jobs.set(id, job);
  trimJobs();
  return job;
}

async function runJob(job) {
  job.status = 'running';
  job.startedAt = new Date().toISOString();

  for (const step of job.steps) {
    job.currentStep = step.label;
    step.status = 'running';
    step.startedAt = new Date().toISOString();
    appendOutput(job, `\n> ${step.label}\n$ npm ${step.command.join(' ')}\n`);
    const exitCode = await runNpmCommand(step.command, (chunk) => appendOutput(job, chunk));
    step.exitCode = exitCode;
    step.finishedAt = new Date().toISOString();
    step.status = exitCode === 0 ? 'success' : 'failed';
    if (exitCode !== 0) {
      job.status = 'failed';
      job.exitCode = exitCode;
      job.finishedAt = new Date().toISOString();
      appendOutput(job, `\nStep failed with exit code ${exitCode}.\n`);
      return;
    }
  }

  job.status = 'success';
  job.exitCode = 0;
  job.currentStep = '';
  job.finishedAt = new Date().toISOString();
  appendOutput(job, '\nJob completed successfully.\n');
}

function runNpmCommand(args, onOutput) {
  return new Promise((resolvePromise) => {
    const child = spawn(npmCommand, args, {
      cwd: repoRoot,
      env: process.env,
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
  job.output += chunk;
  if (job.output.length > 80_000) job.output = job.output.slice(-80_000);
}

function trimJobs() {
  const values = Array.from(jobs.values());
  if (values.length <= 40) return;
  values
    .sort((a, b) => String(a.startedAt || '').localeCompare(String(b.startedAt || '')))
    .slice(0, values.length - 40)
    .forEach((job) => jobs.delete(job.id));
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
  const origin = request.headers.origin;
  if (!origin || isLocalPortalOrigin(origin)) return true;
  if (!allowedExternalOrigins.has(origin) || !portalToken) return false;
  return request.headers['x-cihof-portal-token'] === portalToken;
}

function isLocalPortalOrigin(origin) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
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
    output: job.output,
    currentStep: job.currentStep,
    steps: job.steps.map(({ command, ...step }) => step),
    meta: job.meta,
  };
}
