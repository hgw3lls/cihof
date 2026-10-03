/** Types for `server.mjs`, which runs as plain JavaScript on the display. */
import type { Server } from 'node:http';

/** A content version the desktop app serves instead of the delivered content (apps/kiosk-app/src/content-store.mjs). */
export type ContentServing = {
  readonly releaseJson: string;
  readonly workerJs: string;
  /** A content path's file (`data/…`, `media/…`) in this version, or null when it does not hold it. */
  site(path: string): string | null;
  /** A film's file (`<person>/<film>.mp4`) the version brought, or null. */
  film(path: string): string | null;
};

/**
 * `videos`: a folder the films are played from first, or a function saying what it is now.
 * `content`: the content version being served, asked on every request, or null for the delivered content.
 */
export function createKioskServer(options: {
  root: string;
  videos?: string | null | (() => string | null);
  content?: (() => ContentServing | null) | null;
}): Server;
