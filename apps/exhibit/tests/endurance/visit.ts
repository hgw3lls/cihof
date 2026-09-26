import type { CDPSession, Page } from '@playwright/test';

/**
 * One simulated visit to the display, and what the page holds afterwards.
 *
 * Used by `npm run endurance`, which repeats visits against a real build for
 * hours, and by `endurance.spec.ts`, which runs a few against the test build
 * so that the visits keep up with the exhibit's screens.
 *
 * A visit is what a visitor does: start from the attract screen, look through
 * a lens or two, open somebody's record, perhaps watch a little of a film or
 * take the record away, then leave. Some visitors touch Start over; most walk
 * off and the display ends the visit itself. Every visit ends back on the
 * attract screen, or the visit says it did not.
 */

export type VisitOptions = {
  /** How long a visitor watches a film for. */
  readonly filmMs: number;
  /** False where there are no video files to watch (CI); visits then never open a film. */
  readonly films?: boolean;
  /** How long to wait for a visit left alone to end by itself. */
  readonly idleWaitMs: number;
  /** How long a single touch may take to show its result. */
  readonly stepMs?: number;
};

export type VisitResult = {
  readonly visit: number;
  readonly started: 'call to action' | 'face' | 'name';
  readonly lenses: readonly string[];
  readonly opened: string | null;
  readonly film: boolean;
  readonly share: boolean;
  readonly ended: 'start over' | 'left alone';
  /** Whether the display was back on its attract screen afterwards. */
  readonly returned: boolean;
  readonly problems: readonly string[];
  readonly ms: number;
};

export type Measure = {
  readonly heapMB: number;
  readonly nodes: number;
  readonly listeners: number;
  readonly documents: number;
};

const lensOrder = ['Years', 'Places', 'Connections'];

export async function visit(page: Page, index: number, options: VisitOptions): Promise<VisitResult> {
  const began = Date.now();
  const step = options.stepMs ?? 10_000;
  const problems: string[] = [];
  const attempt = async (what: string, action: () => Promise<void>) => {
    try { await action(); return true; } catch (error) {
      problems.push(`${what}: ${(error instanceof Error ? error.message : String(error)).split('\n')[0]}`);
      return false;
    }
  };

  // Start the way visitors do: mostly the call to action, sometimes a face or a name.
  let started: VisitResult['started'] = 'call to action';
  await attempt('start', async () => {
    await page.locator('.attract').waitFor({ state: 'visible', timeout: step });
    const faces = page.locator('.attract__face:not([aria-hidden="true"])');
    const names = page.locator('.attract__name');
    if (index % 3 === 1 && await faces.count() > 0) {
      await faces.nth(index % await faces.count()).click({ timeout: step });
      started = 'face';
    } else if (index % 3 === 2 && await names.count() > 0) {
      // The rows drift, so touch a name where it is on screen now.
      const spot = await names.evaluateAll((all) => {
        const onScreen = all.map((name) => name.getBoundingClientRect())
          .filter((box) => box.left > 0 && box.right < window.innerWidth && box.top > 0 && box.bottom < window.innerHeight);
        const box = onScreen[Math.floor(onScreen.length / 2)];
        return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
      });
      if (spot) {
        await page.mouse.click(spot.x, spot.y);
        started = 'name';
      } else {
        await page.locator('[data-begin]').first().click({ timeout: step });
      }
    } else {
      await page.locator('[data-begin]').first().click({ timeout: step });
    }
    await page.locator('.lensbar').waitFor({ state: 'visible', timeout: step });
  });

  // A lens or two besides People.
  const lenses = ['People'];
  const wanted = [lensOrder[index % lensOrder.length]!, ...(index % 2 === 0 ? [lensOrder[(index + 1) % lensOrder.length]!] : [])];
  for (const lens of wanted) {
    const button = page.getByRole('button', { name: lens, exact: true });
    if (await button.count() === 0) continue;
    if (await attempt(`open ${lens}`, async () => {
      await button.click({ timeout: step });
      await page.waitForTimeout(600);
    })) lenses.push(lens);
  }

  // Somebody's record, from whichever lens is showing. The map has no tiles, so
  // a record is opened from People when the last lens was Connections.
  let opened: string | null = null;
  let film = false;
  let share = false;
  await attempt('open a record', async () => {
    let tiles = page.locator('.tile:visible');
    if (await tiles.count() === 0) {
      await page.getByRole('button', { name: 'People', exact: true }).click({ timeout: step });
      tiles = page.locator('.tile:visible');
    }
    const count = await tiles.count();
    if (count === 0) throw new Error('no portraits to touch');
    await tiles.nth((index * 7) % count).click({ timeout: step });
    await page.getByRole('button', { name: 'Read the record' }).click({ timeout: step });
    await page.locator('#recordTitle').waitFor({ state: 'visible', timeout: step });
    opened = (await page.locator('#recordTitle').textContent())?.trim() ?? null;

    const watch = page.getByRole('button', { name: /^Watch (the film|film 1)/ });
    if (options.films !== false && index % 2 === 0 && await watch.count() > 0) {
      await watch.first().click({ timeout: step });
      await page.locator('dialog.film').waitFor({ state: 'visible', timeout: step });
      await page.waitForTimeout(options.filmMs);
      await page.keyboard.press('Escape');
      await page.locator('dialog.film').waitFor({ state: 'detached', timeout: step });
      film = true;
    }
    const take = page.getByRole('button', { name: 'Take it with you' });
    if (index % 4 === 1 && await take.count() > 0) {
      await take.click({ timeout: step });
      await page.locator('.share').waitFor({ state: 'visible', timeout: step });
      await page.waitForTimeout(1_500);
      await page.keyboard.press('Escape');
      await page.locator('.share').waitFor({ state: 'detached', timeout: step });
      share = true;
    }
    await page.keyboard.press('Escape');
    await page.locator('dialog.record').waitFor({ state: 'detached', timeout: step });
  });

  // Then leave. One visitor in three touches Start over; the rest walk away.
  let ended: VisitResult['ended'] = index % 3 === 0 ? 'start over' : 'left alone';
  // A display with short timings may already have ended the visit itself.
  if (await page.locator('.attract').isVisible()) ended = 'left alone';
  if (ended === 'start over') {
    const done = await attempt('start over', async () => {
      // Close anything a failed step left open first.
      for (let layer = 0; layer < 3 && await page.locator('dialog[open]').count() > 0; layer += 1) await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Start over' }).click({ timeout: step });
    });
    if (!done) ended = 'left alone';
  }
  const returned = await attempt('return to the attract screen', async () => {
    await page.locator('.attract').waitFor({ state: 'visible', timeout: ended === 'start over' ? step : options.idleWaitMs });
  });

  return { visit: index, started, lenses, opened, film, share, ended, returned, problems, ms: Date.now() - began };
}

/** What the page holds, after a garbage collection so that only what is kept is counted. */
export async function measure(session: CDPSession): Promise<Measure> {
  await session.send('HeapProfiler.collectGarbage');
  const { metrics } = await session.send('Performance.getMetrics');
  const value = (name: string) => metrics.find((metric) => metric.name === name)?.value ?? 0;
  return {
    heapMB: Math.round((value('JSHeapUsedSize') / 1024 / 1024) * 100) / 100,
    nodes: value('Nodes'),
    listeners: value('JSEventListeners'),
    documents: value('Documents'),
  };
}

export async function startMeasuring(page: Page): Promise<CDPSession> {
  const session = await page.context().newCDPSession(page);
  await session.send('Performance.enable');
  return session;
}

// ------------------------------------------------------------------ summary

export type Sample = VisitResult & Measure & { readonly atMs: number };

export type Summary = {
  readonly visits: number;
  readonly hours: number;
  readonly notReturned: number;
  readonly visitProblems: number;
  readonly pageErrors: number;
  readonly heap: { readonly startMB: number; readonly endMB: number; readonly peakMB: number; readonly mbPerHour: number };
  readonly nodes: { readonly start: number; readonly end: number; readonly peak: number };
  readonly listeners: { readonly start: number; readonly end: number; readonly peak: number };
  /** What to look at more closely. Empty means nothing did. */
  readonly concerns: readonly string[];
};

const median = (values: readonly number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

/** Least-squares slope of y over x. */
const slope = (points: readonly (readonly [number, number])[]) => {
  if (points.length < 2) return 0;
  const meanX = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const meanY = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  const over = points.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0);
  const under = points.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0);
  return under === 0 ? 0 : over / under;
};

/**
 * What a run amounts to. The first few visits warm the page up (fonts,
 * portraits, the worker's cache), so the start is measured after them, and
 * the start and end are the middle of a handful of visits, not one.
 */
export function summarise(samples: readonly Sample[], pageErrors: number): Summary {
  const warm = samples.length > 6 ? samples.slice(3) : samples;
  const window = Math.max(1, Math.min(10, Math.floor(warm.length / 5)));
  const first = warm.slice(0, window);
  const last = warm.slice(-window);
  const of = (list: readonly Sample[], key: 'heapMB' | 'nodes' | 'listeners') => Math.round(median(list.map((sample) => sample[key])) * 100) / 100;
  const peak = (key: 'heapMB' | 'nodes' | 'listeners') => Math.max(0, ...samples.map((sample) => sample[key]));
  const hours = samples.length ? samples[samples.length - 1]!.atMs / 3_600_000 : 0;
  const mbPerHour = Math.round(slope(warm.map((sample) => [sample.atMs / 3_600_000, sample.heapMB])) * 100) / 100;

  const summary = {
    visits: samples.length,
    hours: Math.round(hours * 100) / 100,
    notReturned: samples.filter((sample) => !sample.returned).length,
    visitProblems: samples.filter((sample) => sample.problems.length > 0).length,
    pageErrors,
    heap: { startMB: of(first, 'heapMB'), endMB: of(last, 'heapMB'), peakMB: peak('heapMB'), mbPerHour },
    nodes: { start: of(first, 'nodes'), end: of(last, 'nodes'), peak: peak('nodes') },
    listeners: { start: of(first, 'listeners'), end: of(last, 'listeners'), peak: peak('listeners') },
  };

  const concerns: string[] = [];
  if (summary.notReturned) concerns.push(`${summary.notReturned} visit(s) did not end on the attract screen.`);
  if (summary.visitProblems) concerns.push(`${summary.visitProblems} visit(s) could not do something a visitor would (see the visits).`);
  if (pageErrors) concerns.push(`The page reported ${pageErrors} error(s).`);
  // Garbage collection makes the heap wander by a few megabytes; a leak climbs.
  if (summary.heap.endMB - summary.heap.startMB > 10 && mbPerHour > 2) {
    concerns.push(`The memory the page keeps grew from ${summary.heap.startMB} MB to ${summary.heap.endMB} MB, about ${mbPerHour} MB an hour.`);
  }
  // What the last visit left on screen is still held until the next one, so
  // the count swings by a thousand or so from visit to visit; a leak climbs.
  if (summary.nodes.end - summary.nodes.start > 2_000) {
    concerns.push(`The page holds more elements at the end (${summary.nodes.end}) than at the start (${summary.nodes.start}).`);
  }
  if (summary.listeners.end - summary.listeners.start > 500) {
    concerns.push(`The page holds more event listeners at the end (${summary.listeners.end}) than at the start (${summary.listeners.start}).`);
  }
  return { ...summary, concerns };
}

/** The measurements part of a report, in Markdown, the same for every kind of run. */
export function summaryLines(summary: Summary): string[] {
  return [
    '| | At the start | At the end | Highest |',
    '| --- | ---: | ---: | ---: |',
    `| Memory the page keeps (MB) | ${summary.heap.startMB} | ${summary.heap.endMB} | ${summary.heap.peakMB} |`,
    `| Elements | ${summary.nodes.start} | ${summary.nodes.end} | ${summary.nodes.peak} |`,
    `| Event listeners | ${summary.listeners.start} | ${summary.listeners.end} | ${summary.listeners.peak} |`,
    '',
    `Memory trend: ${summary.heap.mbPerHour} MB an hour. Measured after each visit, back on the attract screen, after a garbage collection; the start is after the first few visits have warmed the page up.`,
    '',
    `- Visits that did not end on the attract screen: ${summary.notReturned}`,
    `- Visits that could not do something a visitor would: ${summary.visitProblems}`,
    `- Errors the page reported: ${summary.pageErrors}`,
  ];
}
