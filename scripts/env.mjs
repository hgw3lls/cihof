#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

/**
 * Sets environment variables, then runs a command, the same way on every system.
 *
 *   node scripts/env.mjs CIHOF_TARGET=kiosk -- npm run build --workspace @cihof/exhibit
 *
 * `CIHOF_TARGET=kiosk npm run …` is shell syntax that Windows' command prompt
 * does not understand, and npm runs package scripts through it on Windows. This
 * keeps the same scripts working there without a dependency.
 */

const argv = process.argv.slice(2);
const split = argv.indexOf('--');
if (split < 1 || split === argv.length - 1) {
  console.error('Usage: node scripts/env.mjs NAME=value [NAME=value ...] -- command [args ...]');
  process.exit(2);
}

const env = { ...process.env };
for (const pair of argv.slice(0, split)) {
  const equals = pair.indexOf('=');
  if (equals < 1) {
    console.error(`"${pair}" is not NAME=value.`);
    process.exit(2);
  }
  env[pair.slice(0, equals)] = pair.slice(equals + 1);
}

const [command, ...args] = argv.slice(split + 1);
// A shell on Windows so that `npm` resolves to npm.cmd.
const result = spawnSync(command, args, { env, stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
