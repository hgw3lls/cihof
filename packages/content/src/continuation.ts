import type { InducteeId } from './identity.ts';

/**
 * Where a visitor continues reading after they walk away.
 *
 * A code on a wall is scanned by a stranger's phone and cannot be corrected
 * once it is printed into someone's browser history. So the destination is
 * checked rather than assumed, and a destination that fails the check produces
 * no code at all — an absent code is a small disappointment, a code leading to
 * a staff route or an unreachable host is a broken promise.
 */

export type ContinuationRefusal =
  | 'no-base-configured'
  | 'not-a-url'
  | 'insecure-scheme'
  | 'not-publicly-reachable'
  | 'staff-route';

export type ContinuationResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly refusal: ContinuationRefusal };

/** Hosts that mean something only on the machine showing the code. */
const unreachableHost = /^(localhost|127\.|0\.0\.0\.0$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)|\.local$/i;

/** Route fragments that belong to staff tooling and never to a visitor. */
const staffRoute = /(^|\/)(portal|admin|review|staff)(\/|$)/i;

export function continuationUrl(siteBase: string | null | undefined, personId: InducteeId | string): ContinuationResult {
  if (!siteBase || siteBase.trim().length === 0) return { ok: false, refusal: 'no-base-configured' };

  let url: URL;
  try {
    // A trailing slash matters: without it the last path segment is replaced
    // rather than extended, which would silently drop a deployment sub-path.
    url = new URL(`people/${encodeURIComponent(personId)}/`, siteBase.endsWith('/') ? siteBase : `${siteBase}/`);
  } catch {
    return { ok: false, refusal: 'not-a-url' };
  }

  if (url.protocol !== 'https:') return { ok: false, refusal: 'insecure-scheme' };
  if (unreachableHost.test(url.hostname)) return { ok: false, refusal: 'not-publicly-reachable' };
  if (staffRoute.test(url.pathname)) return { ok: false, refusal: 'staff-route' };

  return { ok: true, url: url.href };
}

export function refusalMessage(refusal: ContinuationRefusal): string {
  switch (refusal) {
    case 'no-base-configured': return 'No public site is configured for this build, so there is nothing to link to.';
    case 'not-a-url': return 'The configured public site is not a usable address.';
    case 'insecure-scheme': return 'The public site must be served over https before it can be shared.';
    case 'not-publicly-reachable': return 'The configured address only works on this machine, so a phone could not open it.';
    case 'staff-route': return 'That address is a staff route and must not be given to a visitor.';
  }
}
