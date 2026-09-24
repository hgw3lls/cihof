/** Types for `launch.mjs`, which runs as plain JavaScript on the display. */
import type { spawn } from 'node:child_process';
export function findBrowser(options?: {
  platform?: string; env?: Record<string, string | undefined>; exists?: (path: string) => boolean;
}): { path: string; kind: 'edge' | 'chrome' | 'chromium' } | null;
export function browserArgs(options: { url: string; profile: string; kind: string }): string[];
export function msUntil(at: string, now?: Date): number | null;
export function keepBrowserRunning(options: {
  command: string; args: string[]; spawnBrowser?: typeof spawn; log?: (line: string) => void;
  quickExitMs?: number; minBackoffMs?: number; maxBackoffMs?: number;
}): { restart(): void; stop(): void; readonly launches: number; readonly running: boolean };
