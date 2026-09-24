/** Types for `target.mjs`, which the build scripts run as plain JavaScript. */
export type VisitorTarget = 'public' | 'kiosk';
export function resolveTarget(env?: Record<string, string | undefined>): VisitorTarget;
export function resolvePreview(target: VisitorTarget, env?: Record<string, string | undefined>): boolean;
