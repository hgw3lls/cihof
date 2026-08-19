import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const host = process.env.CIHOF_PORTAL_HOST || '127.0.0.1';
const port = Number(process.env.CIHOF_PORTAL_PORT || 5174);
const repoRoot = resolve('.');
const decisionsDir = resolve('.portal/decisions');
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
      sendJson(response, 403, { error: 'Origin not allowed. Portal runner only accepts localhost browser requests.' });
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
  console.log('Only localhost origins are allowed. Use the Staff Portal runner controls to execute whitelisted scripts.');
});

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
  response.setHeader('Access-Control-Allow-Headers', 'content-type');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Max-Age', '600');
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
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
