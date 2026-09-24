/** Types for `server.mjs`, which runs as plain JavaScript on the display. */
import type { Server } from 'node:http';
export function createKioskServer(options: { root: string }): Server;
