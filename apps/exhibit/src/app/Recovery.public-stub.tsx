import type { ReleaseStatus } from './useRelease.ts';

/**
 * Public-target stand-in for the operator recovery panel.
 *
 * The exhibit is a kiosk artifact and recovery belongs on an installed display,
 * but that is a fact about how it is deployed rather than a guarantee. Aliasing
 * this in for a public target makes the boundary structural: the panel and
 * everything it reads are absent from the bundle rather than merely behind an
 * unadvertised address.
 */
export function Recovery(_props: {
  status: ReleaseStatus | null;
  onRefresh: () => void;
  onRestore: () => void;
  onClose: () => void;
}) {
  return null;
}
