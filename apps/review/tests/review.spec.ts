import { expect, test } from '@playwright/test';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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

  // Start from connections nobody has decided, whatever the real collection's
  // review has reached: the copy's tie decisions are cleared, its sheet
  // regenerated, and that committed, so the copy is clean.
  const decisionsPath = join(worktree, 'data/cihof_tie_decisions.json');
  if (existsSync(decisionsPath)) {
    const document = JSON.parse(readFileSync(decisionsPath, 'utf8'));
    writeFileSync(decisionsPath, `${JSON.stringify({ ...document, decisions: [] }, null, 2)}\n`);
    execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings=ExperimentalWarning',
      join(worktree, 'packages/pipeline/scripts/ties-sheet.mjs'), '--force'], { cwd: worktree, stdio: 'ignore' });
    git('-c', 'user.name=Test', '-c', 'user.email=test@cihof.invalid', 'commit', '-q', '-am', 'test: start from undecided connections');
  }

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
  // What stands between the exhibit and opening day, from the records.
  await expect(page.getByRole('heading', { name: 'Ready for opening?' })).toBeVisible();
  await expect(page.locator('.readiness').getByText('Approval to open')).toBeVisible();

  // Connections: a relationship, a reversed directional one, a rejection.
  await page.getByRole('button', { name: /^Connections/ }).click();
  const first = await names(page);
  await page.getByRole('button', { name: /A real connection/ }).click();
  await page.getByRole('button', { name: /Worked together/ }).click();
  await page.getByPlaceholder(/worked together/).fill('worked together on a test');
  await expect(page.getByText(/Decided\. Kept on this computer/)).toBeVisible();
  await page.getByRole('button', { name: 'Next →' }).click();

  const second = await names(page);
  await page.getByRole('button', { name: /A real connection/ }).click();
  await page.getByRole('button', { name: /^Mentored/ }).click();
  await page.getByRole('button', { name: `${second[1]} mentored ${second[0]}` }).click();
  await expect(page.getByText(/Not finished yet/)).toBeVisible();
  await page.getByLabel(new RegExp(`Next to ${escape(second[1])}:`)).fill(`mentored ${second[0]} (test)`);
  await page.getByLabel(new RegExp(`Next to ${escape(second[0])}:`)).fill(`was mentored by ${second[1]} (test)`);
  await expect(page.getByText(/Decided\. Kept on this computer/)).toBeVisible();
  await page.getByRole('button', { name: 'Next →' }).click();

  await page.getByRole('button', { name: /This is wrong/ }).click();
  await page.getByRole('button', { name: 'Stop for now' }).click();

  // Places: approve the first place offered in new words, starting from the
  // suggested wording, and give somebody a role.
  await page.getByRole('button', { name: /^Places/ }).click();
  for (let step = 0; step < 60 && !(await page.getByRole('button', { name: /Use the suggested wording/ }).isVisible()); step += 1) {
    await page.getByRole('button', { name: /Next place/ }).click();
  }
  await page.getByRole('button', { name: /Use the suggested wording/ }).click();
  const placeWords = page.getByLabel(/The words visitors read/);
  await placeWords.fill(`${await placeWords.inputValue()} (test)`);
  await page.getByRole('group').first().getByRole('button', { name: 'worked' }).click();
  await page.getByRole('button', { name: 'Stop for now' }).click();

  // Where a ceremony film starts: the suggestion for the first person.
  await page.getByRole('button', { name: /^Where ceremony films start/ }).click();
  await page.getByRole('button', { name: /^Open at \d/ }).first().click();
  await page.getByRole('button', { name: 'Back to the start' }).click();

  // Film captions: music heard as "heat" marked [music], and a misheard name corrected.
  await page.getByRole('button', { name: /^Film captions and transcripts/ }).click();
  await page.locator('article', { hasText: 'Raj Aggarwal' }).getByRole('button', { name: /Mark it \[music\]/ }).click();
  const filmChoice = page.getByRole('combobox', { name: /^Film/ });
  await filmChoice.selectOption({ label: await filmChoice.locator('option', { hasText: 'qzHokEDkXQc' }).innerText() });
  await page.getByLabel('The words as they are now').fill('Carolyn Varo');
  await page.getByLabel('As they should be').fill('Carolyn Balogh');
  await expect(page.getByText(/Found in 1 place in the transcript/)).toBeVisible();
  await page.getByRole('button', { name: 'Add this correction' }).click();
  await expect(page.getByText(/“Carolyn Varo” → “Carolyn Balogh”/)).toBeVisible();
  await page.getByRole('button', { name: 'Back to the start' }).click();

  // A sign-off given on paper, with a scan of the signed sheet.
  await page.getByRole('button', { name: /^Sign-offs/ }).click();
  const logo = page.locator('article', { hasText: 'The Hall of Fame approves the changed logo' });
  await logo.getByRole('button', { name: 'Record a signature' }).click();
  await logo.getByLabel('Signed by').fill('Test Chair');
  await logo.getByLabel(/Where the signed record is kept/).fill('Test board minutes, item 4');
  await logo.getByLabel(/A scan of the signed sheet/).setInputFiles({ name: 'signed.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') });
  await expect(logo.getByText('Scan attached: signed.png')).toBeVisible();
  await page.getByRole('button', { name: 'Back to the start' }).click();

  // A biography.
  await page.getByRole('button', { name: /^Biographies/ }).click();
  await page.getByLabel(/Search/).fill('Grasselli');
  await page.getByRole('button', { name: /Jeanette Grasselli Brown/ }).click();
  const box = page.locator('textarea');
  await box.fill((await box.inputValue()).replace('spent 38 years', 'spent 38 (test) years'));
  await expect(page.locator('.diff ins')).toContainText('(test)');
  await page.getByRole('button', { name: 'Keep this correction' }).click();
  await page.getByRole('button', { name: 'Back to the start' }).click();

  // Profiles. Hers waits until the correction is saved; the next is approved,
  // the one after has changes asked for.
  await page.getByRole('button', { name: /^Profiles/ }).click();
  // Classes to work through one at a time, each with how far it has come.
  await expect(page.getByRole('navigation', { name: 'Induction classes' }).getByRole('button', { name: /^2010/ })).toContainText('of 13 approved');
  await expect(page.getByRole('heading', { name: 'Jeanette Grasselli Brown' })).toBeVisible();
  await expect(page.getByText(/Save it first, then approve the profile/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Yes, approve it/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Skip for now/ }).click();
  const approvedName = await page.locator('.profile h2').innerText();
  // The A key approves, as the button does.
  await page.keyboard.press('a');
  await expect(page.getByRole('button', { name: /Yes, approve it/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Next →' }).click();
  const queriedName = await page.locator('.profile h2').innerText();
  await page.getByRole('button', { name: /Something needs changing/ }).click();
  await expect(page.getByText(/Not finished yet: say what needs changing/)).toBeVisible();
  await page.getByLabel('What needs changing?').fill('Test: the class year needs checking');
  await page.getByRole('button', { name: 'Stop for now' }).click();

  // Approving a profile, then correcting that person's biography, cannot be
  // saved together: the approval would cover words that are about to change.
  await page.getByRole('button', { name: /^Biographies/ }).click();
  await page.getByLabel(/Search/).fill(approvedName);
  await page.getByRole('button', { name: new RegExp(escape(approvedName)) }).first().click();
  const other = page.locator('textarea');
  await other.fill(`${await other.inputValue()} (test)`);
  await page.getByRole('button', { name: 'Keep this correction' }).click();
  await page.getByRole('button', { name: 'Back to the start' }).click();
  await page.getByRole('button', { name: 'Check and save' }).click();
  await expect(page.getByText(/must be saved first/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check my decisions' })).toBeDisabled();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: /^Biographies/ }).click();
  await page.getByLabel(/Search/).fill(approvedName);
  await page.getByRole('button', { name: new RegExp(escape(approvedName)) }).first().click();
  await page.getByRole('button', { name: 'Undo my correction' }).click();
  await page.getByRole('button', { name: 'Back to the start' }).click();

  // The attract screen's words: rewritten, and refused while too long.
  await page.getByRole('button', { name: /^Attract screen words/ }).click();
  await page.getByRole('button', { name: /Use different words/ }).click();
  await page.getByLabel(/^Headline/).fill('x'.repeat(61));
  await expect(page.getByText(/Not finished yet: the headline is too long/)).toBeVisible();
  await page.getByLabel(/^Headline/).fill('Test: the world, at home here.');
  await page.getByLabel(/^The line beneath/).fill('Test tagline.');
  await expect(page.getByText(/Decided\. Kept on this computer/)).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();

  // Nothing is written until the reviewer saves.
  expect(git('status', '--porcelain').trim()).toBe('');
  expect(git('rev-parse', 'HEAD').trim()).toBe(before);

  await page.getByRole('button', { name: 'Check and save' }).click();
  await page.getByRole('button', { name: 'Check my decisions' }).click();
  await expect(page.getByRole('heading', { name: 'Everything checks out' })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Saved' })).toBeVisible({ timeout: 120_000 });

  // The history shows what was just saved, with the sheet it rests on.
  await page.getByRole('button', { name: 'CIHOF staff review' }).click();
  await page.getByRole('button', { name: /^History/ }).click();
  const signoffEntry = page.locator('.history__entry', { hasText: 'Sign-offs' }).first();
  await expect(signoffEntry).toContainText('Playwright Reviewer');
  await signoffEntry.getByRole('button', { name: /Show what was decided/ }).click();
  await expect(signoffEntry.locator('table')).toContainText('Test Chair');

  const log = git('log', '--format=%s%n%b', `${before}..HEAD`);
  expect(log).toContain('review: connections, 3 decisions');
  expect(log).toContain('review: places, 1 decision');
  expect(log).toContain('review: what people did at places, 1 decision');
  expect(log).toContain('review: biographies, 1 decision');
  expect(log).toContain('review: profiles, 2 decisions');
  expect(log).toContain('review: attract screen words, 1 decision');
  expect(log).toContain('review: where ceremony films start, 1 decision');
  expect(log).toContain('review: sign-offs, 1 decision');
  expect(log).toContain('review: film captions and transcripts, 2 decisions');
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
  const byName = (name: string) => Object.values(curated.inductees).find((record) => (record as { displayName: string }).displayName === name) as Record<string, any>;
  expect(byName(approvedName).profileReview).toMatchObject({ status: 'approved', decisionReference: expect.stringMatching(/^profiles-review-/) });
  expect(byName(approvedName).approvalStatus).toBe('approved');
  expect(byName(queriedName).profileReview).toMatchObject({ status: 'changes-requested' });

  // The place shows the reviewer's words, and its approval names them.
  const reworded = JSON.parse(readFileSync(join(worktree, 'data/cihof_places.json'), 'utf8')).places
    .filter((place: { shortHistory?: string }) => place.shortHistory?.endsWith('(test)'));
  expect(reworded).toHaveLength(1);
  expect(reworded[0].review).toMatchObject({ status: 'approved', contentVersion: expect.stringMatching(/^place-[0-9a-f]{12}$/) });

  // The first person's ceremony film opens at the suggested second, approved for exactly that second.
  const starts = Object.entries(JSON.parse(readFileSync(join(worktree, 'data/cihof_film_starts.json'), 'utf8')).starts);
  expect(starts).toHaveLength(1);
  const [key, start] = starts[0] as [string, { startSeconds: number; review: { contentVersion: string } }];
  expect(start.review.contentVersion).toBe(`start-${key.split('|')[1]}-${start.startSeconds}`);

  // The captions and the transcript changed together, and the fixes are recorded.
  const filmFile = (dir: string, suffix: string) => {
    const folder = join(worktree, 'public/media/videos', dir);
    return readFileSync(join(folder, readdirSync(folder).find((name) => name.endsWith(suffix))!), 'utf8');
  };
  expect(filmFile('raj-aggarwal-2025', '.transcript.txt')).not.toMatch(/Heat\. Heat\./);
  expect(filmFile('raj-aggarwal-2025', '.transcript.txt')).toContain('[music]');
  expect(filmFile('raj-aggarwal-2025', '.en.vtt')).toContain('[music]');
  expect(filmFile('carolyn-balogh-2016-2016', 'qzHokEDkXQc.transcript.txt')).toContain('Carolyn Balogh');
  const captionFixes = JSON.parse(readFileSync(join(worktree, 'data/cihof_caption_fixes.json'), 'utf8')).fixes;
  expect(captionFixes.map((fix: { fix: string }) => fix.fix).sort()).toEqual(['music', 'phrase']);

  // The signature is recorded with its scan filed beside the other signed decisions.
  const logoSignoff = JSON.parse(readFileSync(join(worktree, 'data/cihof_opening_signoffs.json'), 'utf8')).items
    .find((item: { id: string }) => item.id === 'logo');
  expect(logoSignoff.signed).toMatchObject({ by: 'Test Chair', reference: 'Test board minutes, item 4', scan: expect.stringMatching(/^data\/curation-decisions\/signoffs\/logo-\d{4}-\d{2}-\d{2}\.png$/) });
  expect(existsSync(join(worktree, logoSignoff.signed.scan))).toBe(true);

  const words = JSON.parse(readFileSync(join(worktree, 'data/cihof_exhibit_text.json'), 'utf8')).attract;
  expect(words).toMatchObject({
    headline: 'Test: the world, at home here.', tagline: 'Test tagline.',
    review: { status: 'approved', decisionReference: expect.stringMatching(/^attract-words-review-/) },
    publication: { kiosk: true, publicWeb: false },
  });
  expect(byName(queriedName).profileReview.note).toContain('the class year needs checking');
  expect(curated.inductees['jeanette-grasselli-brown-2010'].profileReview).toBeUndefined();

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
