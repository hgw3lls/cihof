import { expect, test } from '@playwright/test';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * The whole path a reviewer takes, against a real copy of the project: decide
 * some connections, a place and a biography, check, save, and find the
 * decisions committed with the reviewer's name. The copy is a detached git
 * worktree in a temporary folder, so nothing here can touch the real data.
 */

const repo = resolve(import.meta.dirname, '../../..');
const port = 5199;
const base = `http://localhost:${port}/`;
let worktree = '';
let server: ChildProcess | null = null;

const git = (...args: string[]) => execFileSync('git', args, { cwd: worktree, encoding: 'utf8' });

test.beforeAll(async () => {
  const parent = mkdtempSync(join(tmpdir(), 'cihof-review-'));
  worktree = join(parent, 'project');
  execFileSync('git', ['worktree', 'add', '--detach', worktree, 'HEAD'], { cwd: repo, stdio: 'ignore' });
  symlinkSync(join(repo, 'node_modules'), join(worktree, 'node_modules'), 'junction');
  cpSync(join(repo, 'apps/review/dist'), join(worktree, 'apps/review/dist'), { recursive: true });

  server = spawn(process.execPath, [
    '--experimental-strip-types', '--no-warnings=ExperimentalWarning',
    join(worktree, 'apps/review/server/server.mjs'), '--no-open', `--port=${port}`,
  ], { cwd: worktree, stdio: 'ignore' });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try { if ((await fetch(base)).ok) return; } catch { /* starting */ }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error('The review server did not start.');
});

test.afterAll(() => {
  server?.kill();
  if (worktree && existsSync(worktree)) {
    execFileSync('git', ['worktree', 'remove', '--force', worktree], { cwd: repo, stdio: 'ignore' });
    rmSync(resolve(worktree, '..'), { recursive: true, force: true });
  }
});

test('only this computer, and only this app, can use it', async ({ request }) => {
  expect((await request.get(`${base}api/review`, { headers: { host: `evil.example:${port}` } })).status()).toBe(403);
  expect((await request.put(`${base}api/draft`, { headers: { origin: 'http://evil.example', 'content-type': 'application/json' }, data: {} })).status()).toBe(403);
  expect((await request.post(`${base}api/save`, { headers: { 'content-type': 'text/plain' }, data: '{}' })).status()).toBe(415);
});

test('a reviewer decides, checks and saves, and each review becomes a commit', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const before = git('rev-parse', 'HEAD').trim();

  await page.goto(base);
  await page.getByLabel('Who is reviewing today?').fill('Playwright Reviewer');
  await page.getByRole('button', { name: 'Start' }).click();

  // Connections: a relationship, a reversed directional one, a rejection.
  await page.getByRole('button', { name: /^Connections/ }).click();
  const first = await names(page);
  await page.getByRole('button', { name: /A real connection/ }).click();
  await page.getByRole('button', { name: /Worked together/ }).click();
  await page.getByPlaceholder(/worked with/).fill(`worked with ${first[1]} on a test`);
  await expect(page.getByText(/Decided\. Kept on this computer/)).toBeVisible();
  await page.getByRole('button', { name: 'Next →' }).click();

  const second = await names(page);
  await page.getByRole('button', { name: /A real connection/ }).click();
  await page.getByRole('button', { name: /^Mentored/ }).click();
  await page.getByRole('button', { name: `${second[1]} mentored ${second[0]}` }).click();
  await expect(page.getByText(/Not finished yet/)).toBeVisible();
  await page.getByLabel(new RegExp(`On ${escape(second[1])}'s profile`)).fill(`mentored ${second[0]} (test)`);
  await page.getByLabel(new RegExp(`On ${escape(second[0])}'s profile`)).fill(`was mentored by ${second[1]} (test)`);
  await expect(page.getByText(/Decided\. Kept on this computer/)).toBeVisible();
  await page.getByRole('button', { name: 'Next →' }).click();

  await page.getByRole('button', { name: /This is wrong/ }).click();
  await page.getByRole('button', { name: 'Stop for now' }).click();

  // Places: approve the first place that can be, and give somebody a role.
  await page.getByRole('button', { name: /^Places/ }).click();
  for (let step = 0; step < 60 && !(await page.getByRole('button', { name: 'Yes, show it' }).isVisible()); step += 1) {
    await page.getByRole('button', { name: /Next place/ }).click();
  }
  await page.getByRole('button', { name: 'Yes, show it' }).click();
  await page.getByRole('group').first().getByRole('button', { name: 'worked' }).click();
  await page.getByRole('button', { name: 'Stop for now' }).click();

  // A biography.
  await page.getByRole('button', { name: /^Biographies/ }).click();
  await page.getByLabel(/Search/).fill('Grasselli');
  await page.getByRole('button', { name: /Jeanette Grasselli Brown/ }).click();
  const box = page.locator('textarea');
  await box.fill((await box.inputValue()).replace('spent 38 years', 'spent 38 (test) years'));
  await expect(page.locator('.diff ins')).toContainText('(test)');
  await page.getByRole('button', { name: 'Keep this correction' }).click();
  await page.getByRole('button', { name: 'Back to the start' }).click();

  // Nothing is written until the reviewer saves.
  expect(git('status', '--porcelain').trim()).toBe('');
  expect(git('rev-parse', 'HEAD').trim()).toBe(before);

  await page.getByRole('button', { name: 'Check and save' }).click();
  await page.getByRole('button', { name: 'Check my decisions' }).click();
  await expect(page.getByRole('heading', { name: 'Everything checks out' })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Saved' })).toBeVisible({ timeout: 120_000 });

  const log = git('log', '--format=%s%n%b', `${before}..HEAD`);
  expect(log).toContain('review: connections, 3 decisions');
  expect(log).toContain('review: places, 1 decision');
  expect(log).toContain('review: what people did at places, 1 decision');
  expect(log).toContain('review: biographies, 1 decision');
  expect(log).toContain('Reviewed-by: Playwright Reviewer');
  expect(git('status', '--porcelain').trim()).toBe('');

  const decisions = JSON.parse(readFileSync(join(worktree, 'data/cihof_tie_decisions.json'), 'utf8')).decisions;
  const reversed = decisions.find((decision: { reversed?: boolean }) => decision.reversed);
  expect(reversed.kind).toBe('mentored');
  expect(reversed.label).toBe(`mentored ${second[0]} (test)`);
  expect(decisions.every((decision: { note: string }) => decision.note.includes('Reviewed by Playwright Reviewer'))).toBe(true);
  expect(decisions.filter((decision: { publication: { publicWeb: boolean } }) => decision.publication.publicWeb)).toHaveLength(0);

  const curated = JSON.parse(readFileSync(join(worktree, 'data/cihof_curated_metadata.json'), 'utf8'));
  expect(curated.inductees['jeanette-grasselli-brown-2010'].bioTextOverride).toContain('spent 38 (test) years');

  // The home page now says the saves are waiting for the developer, and nothing is left to save.
  await page.getByRole('button', { name: 'Back to the start' }).click();
  await expect(page.getByText(/When you have made some decisions/)).toBeVisible();
  expect(errors).toEqual([]);
});

async function names(page: import('@playwright/test').Page): Promise<[string, string]> {
  const strong = page.locator('.pair .person strong');
  return [(await strong.nth(0).innerText()).trim(), (await strong.nth(1).innerText()).trim()];
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
