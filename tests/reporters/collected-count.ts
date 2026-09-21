import type { FullConfig, FullResult, Reporter, Suite } from '@playwright/test/reporter';

type Options = {
  /** Maintained alongside the suite. Lowering it is a deliberate act, not a fix. */
  minimum?: number;
};

/**
 * Fails a run that collected fewer tests than the suite is known to contain.
 *
 * On 2026-09-21 `npm run test:kiosk` exited 1 having collected zero tests: a spec
 * imported a module that reads a Vite `define`, which threw at load and aborted
 * collection. The run looked like an ordinary failure, and an earlier completion
 * record had already cited 72/72 from before that spec existed. A run that
 * silently shrinks is worse than a failing one, because it reads the same as a
 * suite with nothing to say.
 */
export default class CollectedCountReporter implements Reporter {
  private readonly minimum: number;
  private collected = 0;

  constructor(options: Options = {}) {
    const override = Number(process.env.CIHOF_MINIMUM_TESTS);
    this.minimum = Number.isFinite(override) && override >= 0 ? override : options.minimum ?? 0;
  }

  onBegin(_config: FullConfig, suite: Suite) {
    this.collected = suite.allTests().length;
  }

  onEnd(result: FullResult) {
    if (this.collected >= this.minimum) {
      console.log(`\nCollected ${this.collected} tests (minimum ${this.minimum}).`);
      return;
    }

    console.error([
      '',
      `Collected ${this.collected} tests, expected at least ${this.minimum}.`,
      '',
      'A spec that throws while loading, an over-narrow filter, a renamed file or a',
      'deleted one can empty a run without failing it. Find the cause before changing',
      'the minimum; lowering it is how coverage disappears quietly.',
      '',
      `Run status without this check: ${result.status}.`,
      '',
    ].join('\n'));

    return { status: 'failed' as const };
  }
}
