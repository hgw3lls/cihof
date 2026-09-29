import { buildPeople, buildRuntimeBundle, type RuntimeBundle } from '@cihof/pipeline';

/**
 * The collection as a kiosk release would publish it, built from the
 * repository's own sources. The published file itself is generated and not
 * in git, so a test that needs the real collection builds it rather than
 * reading a file a fresh checkout does not have.
 */
let built: RuntimeBundle | null = null;
export function publishedBundle(): RuntimeBundle {
  built ??= buildRuntimeBundle(buildPeople(), 'kiosk');
  return built;
}
