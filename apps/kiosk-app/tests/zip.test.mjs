import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { extractZip, listZip, safeEntryName, writeZip } from '../src/zip.mjs';

const folder = () => mkdtempSync(join(tmpdir(), 'cihof-zip-'));
const hasTool = (tool) => spawnSync(tool, ['-v'], { stdio: 'ignore' }).status === 0;
const binary = Buffer.from(Array.from({ length: 300_000 }, (_, index) => (index * 7919) % 256));
const text = JSON.stringify({ people: Array.from({ length: 200 }, (_, index) => ({ id: `person-${index}`, name: `Person ${index} — ü` })) });

async function roundTrip(options) {
  const here = folder();
  writeFileSync(join(here, 'film.mp4'), binary);
  const zip = join(here, 'update.zip');
  await writeZip(zip, [
    { name: 'content.json', data: '{"format":"cihof-content"}' },
    { name: 'site/data/exhibit.json', data: text },
    { name: 'films/someone/film.mp4', path: join(here, 'film.mp4') },
    { name: 'site/empty.txt', data: '' },
  ], options);
  const out = join(here, 'out');
  const entries = await extractZip(zip, out);
  assert.deepEqual(entries.map((entry) => entry.name), ['content.json', 'site/data/exhibit.json', 'films/someone/film.mp4', 'site/empty.txt']);
  assert.equal(readFileSync(join(out, 'site/data/exhibit.json'), 'utf8'), text);
  assert.deepEqual(readFileSync(join(out, 'films/someone/film.mp4')), binary);
  assert.equal(readFileSync(join(out, 'site/empty.txt'), 'utf8'), '');
  // Text is compressed; media, which does not compress, is stored as it is.
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  assert.ok(byName.get('site/data/exhibit.json').compressed < Buffer.byteLength(text));
  assert.equal(byName.get('films/someone/film.mp4').compressed, binary.length);
  return zip;
}

test('a zip written here comes back exactly as it went in, text compressed and media stored', async () => {
  await roundTrip();
});

test('the large-file form (ZIP64) is written and read back the same', async () => {
  await roundTrip({ forceZip64: true });
});

test('the system unzip reads what is written here, in both forms', { skip: !hasTool('unzip') && 'no unzip on this computer' }, async () => {
  for (const options of [{}, { forceZip64: true }]) {
    const zip = await roundTrip(options);
    const result = spawnSync('unzip', ['-t', zip], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /No errors detected/);
  }
});

test('a zip made by the system zip is read here, in both forms', { skip: !hasTool('zip') && 'no zip on this computer' }, async () => {
  for (const flags of [[], ['-fz']]) {
    const here = folder();
    mkdirSync(join(here, 'in', 'site', 'data'), { recursive: true });
    writeFileSync(join(here, 'in', 'site', 'data', 'exhibit.json'), text);
    writeFileSync(join(here, 'in', 'film.mp4'), binary);
    execFileSync('zip', ['-q', '-r', ...flags, join(here, 'made.zip'), '.'], { cwd: join(here, 'in') });
    const out = join(here, 'out');
    await extractZip(join(here, 'made.zip'), out);
    assert.equal(readFileSync(join(out, 'site/data/exhibit.json'), 'utf8'), text);
    assert.deepEqual(readFileSync(join(out, 'film.mp4')), binary);
  }
});

test('names that could reach outside the folder are refused, and nothing is written', async () => {
  for (const name of ['../evil.txt', '/etc/passwd', 'a/../../b', 'C:/windows/x', 'a\\b', 'a//b', './a', '']) {
    assert.equal(safeEntryName(name), false, name);
  }
  assert.equal(safeEntryName('site/data/exhibit.json'), true);
  assert.equal(safeEntryName('site/media/'), true);
  const here = folder();
  await assert.rejects(writeZip(join(here, 'bad.zip'), [{ name: '../evil.txt', data: 'x' }]), /Not a name a zip may hold/);
});

test('a damaged zip is refused: a changed byte fails its checksum, and a non-zip is not read', async () => {
  const here = folder();
  const zip = join(here, 'update.zip');
  await writeZip(zip, [{ name: 'films/a.mp4', data: binary }]);
  const bytes = readFileSync(zip);
  bytes[200] ^= 0xff;
  writeFileSync(zip, bytes);
  await assert.rejects(extractZip(zip, join(here, 'out')), /does not match its checksum/);
  writeFileSync(join(here, 'not.zip'), 'hello');
  await assert.rejects(listZip(join(here, 'not.zip')), /not a zip file/);
});
