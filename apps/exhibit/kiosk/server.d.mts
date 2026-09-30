/** Types for `server.mjs`, which runs as plain JavaScript on the display. */
import type { Server } from 'node:http';
/** `videos`: a folder the films are played from first, or a function saying what it is now. */
export function createKioskServer(options: { root: string; videos?: string | null | (() => string | null) }): Server;
