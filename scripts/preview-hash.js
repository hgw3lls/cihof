import { createHash } from 'node:crypto';

/**
 * The token a preview prints and --apply must be given (--expect-hash): a
 * fingerprint of exactly what was previewed. For a tool that also asks who
 * may see what it approves (--targets), that is the sheet and the audience
 * together, so an audience nobody previewed, such as the public website
 * added to a preview of the display alone, cannot be applied with the token.
 *
 * `targets` is the audience as the tool reads it, in the order kiosk then
 * public-web (`kiosk`, `kiosk,public-web`, or `public-web`), or omitted for a
 * tool that has no audience; then the token is the sheet's alone, as always.
 */
export function previewHash(csv, targets) {
  const hash = createHash('sha256').update(csv);
  if (targets !== undefined) hash.update(`\n--targets=${targets}`);
  return hash.digest('hex');
}

/** The audience a tool parsed, written as previewHash expects it. */
export function targetsLabel(targets) {
  if (!targets) return '';
  return [targets.kiosk && 'kiosk', targets.publicWeb && 'public-web'].filter(Boolean).join(',');
}
