/**
 * Which audience this build is for, decided once.
 *
 * Two places need the answer — `publish.mjs`, which chooses what content goes
 * into the runtime bundle, and `vite.config.ts`, which decides whether the
 * operator recovery panel is compiled in at all. They previously each read the
 * environment themselves, with the same fall-through:
 *
 *     const target = process.env.CIHOF_TARGET === 'public' ? 'public' : 'kiosk';
 *
 * Anything that was not exactly the string `public` produced a kiosk build. A
 * missing variable, a capitalised one, a trailing space, a workflow step that
 * dropped the prefix — all of them silently selected the restricted target. For
 * a build that is about to be uploaded somewhere, defaulting to the target that
 * must not be published is the wrong way round.
 *
 * What makes that dangerous here rather than merely untidy: all 93 films are
 * approved for the kiosk and approved for the public web on none of them. The
 * refusal is deliberate and recent. A kiosk artifact reaching a public URL does
 * not leak unreviewed material — it overrides a decision somebody made on
 * purpose. And since every film also carries a YouTube id, a kiosk build serves
 * 93 embedded players without a single megabyte of video leaving the repository,
 * so "no video in the artifact" proves nothing on its own.
 *
 * So: an unrecognised value is always an error, and an absent value is an error
 * anywhere automated. Locally, where nobody is publishing, an absent value still
 * means kiosk — that is the useful default for `npm run dev`, and it says so.
 */

/** @typedef {'public' | 'kiosk'} VisitorTarget */

const valid = ['public', 'kiosk'];

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {VisitorTarget}
 */
export function resolveTarget(env = process.env) {
  const raw = env.CIHOF_TARGET;

  if (raw === undefined || raw.trim() === '') {
    // `CI` is set by GitHub Actions and by every other runner worth naming.
    // Automated builds get no default, because an automated build is the one
    // whose output goes somewhere.
    if (env.CI) {
      throw new Error(
        'CIHOF_TARGET is not set. An automated build must say which audience it is for: '
        + 'CIHOF_TARGET=public (no films, safe to publish) or CIHOF_TARGET=kiosk (all 93 films, never publish).',
      );
    }
    console.warn('CIHOF_TARGET is not set: building for the kiosk. This artifact contains films and must not be published.');
    return 'kiosk';
  }

  const value = raw.trim();
  if (!valid.includes(value)) {
    // Never guessed, not even locally. A typo is not a preference.
    throw new Error(`CIHOF_TARGET is "${raw}", which is not a target. Use "public" or "kiosk".`);
  }

  return /** @type {VisitorTarget} */ (value);
}
