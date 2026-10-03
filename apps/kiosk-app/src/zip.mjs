import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, stat } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInflateRaw, crc32, deflateRawSync } from 'node:zlib';

/**
 * Zip files, read and written with nothing but Node.
 *
 * A content update travels as a zip, and it can carry films, so a zip here
 * may be larger than 4 GB: the large-file form (ZIP64) is read and written
 * where a size or position needs it. Files are streamed from and to disk, so
 * a film is never held in memory; small text is compressed, and media, which
 * does not compress, is stored as it is.
 *
 * Only what a content update needs: no encryption, no spanning, and names
 * that cannot reach outside the folder they are extracted into.
 */

const MAX32 = 0xffffffff;
const MAX16 = 0xffff;
const UTF8 = 0x0800;
const STORE = 0;
const DEFLATE = 8;
/** Compressed in memory: small, and worth compressing. Everything else is stored. */
const compressible = /\.(json|txt|vtt|csv|md|html|css|js|svg)$/i;
const compressLimit = 8 * 1024 * 1024;

/**
 * A name a zip may hold: forward slashes, relative, no ".." or empty parts,
 * no drive letters or control characters. Anything else is refused rather
 * than cleaned, since a cleaned name may land somewhere nobody meant.
 */
export function safeEntryName(name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 512) return false;
  if (name.includes('\\') || name.includes(':') || name.startsWith('/') || /[\u0000-\u001f]/.test(name)) return false;
  const parts = name.replace(/\/$/, '').split('/');
  return parts.every((part) => part !== '' && part !== '.' && part !== '..');
}

/**
 * Writes a zip.
 *
 * @param {string} outPath
 * @param {{ name: string, path?: string, data?: Buffer | string }[]} entries
 *   Each from a file on disk (`path`) or from memory (`data`).
 * @param {{ forceZip64?: boolean }} [options] `forceZip64` writes the
 *   large-file form for every entry, which a test cannot otherwise reach.
 */
export async function writeZip(outPath, entries, { forceZip64 = false } = {}) {
  await mkdir(dirname(resolve(outPath)), { recursive: true });
  const out = await open(outPath, 'w');
  let offset = 0;
  const central = [];
  const write = async (buffer) => {
    await out.write(buffer, 0, buffer.length, offset);
    offset += buffer.length;
  };
  try {
    for (const entry of entries) {
      if (!safeEntryName(entry.name)) throw new Error(`Not a name a zip may hold: ${entry.name}`);
      const name = Buffer.from(entry.name, 'utf8');
      const source = entry.data !== undefined ? Buffer.from(entry.data) : null;
      const size = source ? source.length : (await stat(entry.path)).size;
      const deflate = compressible.test(entry.name) && size <= compressLimit;

      // The checksum, and for compressed entries the compressed bytes, before the header.
      let crc = 0;
      let packed = null;
      if (deflate) {
        const raw = source ?? (await readWhole(entry.path));
        crc = crc32(raw);
        packed = deflateRawSync(raw);
      } else if (source) {
        crc = crc32(source);
      } else {
        for await (const chunk of createReadStream(entry.path)) crc = crc32(chunk, crc);
      }
      const compressed = packed ? packed.length : size;
      const headerOffset = offset;
      const big = forceZip64 || size >= MAX32 || compressed >= MAX32;

      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(big ? 45 : 20, 4);
      local.writeUInt16LE(UTF8, 6);
      local.writeUInt16LE(packed ? DEFLATE : STORE, 8);
      local.writeUInt32LE(dosTime(), 10);
      local.writeUInt32LE(crc >>> 0, 14);
      local.writeUInt32LE(big ? MAX32 : compressed, 18);
      local.writeUInt32LE(big ? MAX32 : size, 22);
      local.writeUInt16LE(name.length, 26);
      const localExtra = big ? zip64Extra([size, compressed]) : Buffer.alloc(0);
      local.writeUInt16LE(localExtra.length, 28);
      await write(Buffer.concat([local, name, localExtra]));

      if (packed) await write(packed);
      else if (source) await write(source);
      else for await (const chunk of createReadStream(entry.path)) await write(chunk);

      central.push({ name, crc, size, compressed, headerOffset, method: packed ? DEFLATE : STORE });
    }

    const centralOffset = offset;
    for (const record of central) {
      const overflow = forceZip64
        ? [record.size, record.compressed, record.headerOffset]
        : [
          ...(record.size >= MAX32 ? [record.size] : []),
          ...(record.compressed >= MAX32 ? [record.compressed] : []),
          ...(record.headerOffset >= MAX32 ? [record.headerOffset] : []),
        ];
      const wide = forceZip64;
      const extra = overflow.length ? zip64Extra(overflow) : Buffer.alloc(0);
      const header = Buffer.alloc(46);
      header.writeUInt32LE(0x02014b50, 0);
      header.writeUInt16LE(45, 4);
      header.writeUInt16LE(overflow.length ? 45 : 20, 6);
      header.writeUInt16LE(UTF8, 8);
      header.writeUInt16LE(record.method, 10);
      header.writeUInt32LE(dosTime(), 12);
      header.writeUInt32LE(record.crc >>> 0, 16);
      header.writeUInt32LE(wide ? MAX32 : Math.min(record.compressed, MAX32), 20);
      header.writeUInt32LE(wide ? MAX32 : Math.min(record.size, MAX32), 24);
      header.writeUInt16LE(record.name.length, 28);
      header.writeUInt16LE(extra.length, 30);
      header.writeUInt32LE(wide ? MAX32 : Math.min(record.headerOffset, MAX32), 42);
      await write(Buffer.concat([header, record.name, extra]));
    }
    const centralSize = offset - centralOffset;

    const large = forceZip64 || central.length >= MAX16 || centralOffset >= MAX32 || centralSize >= MAX32;
    if (large) {
      const recordOffset = offset;
      const record = Buffer.alloc(56);
      record.writeUInt32LE(0x06064b50, 0);
      record.writeBigUInt64LE(44n, 4);
      record.writeUInt16LE(45, 12);
      record.writeUInt16LE(45, 14);
      record.writeBigUInt64LE(BigInt(central.length), 24);
      record.writeBigUInt64LE(BigInt(central.length), 32);
      record.writeBigUInt64LE(BigInt(centralSize), 40);
      record.writeBigUInt64LE(BigInt(centralOffset), 48);
      const locator = Buffer.alloc(20);
      locator.writeUInt32LE(0x07064b50, 0);
      locator.writeBigUInt64LE(BigInt(recordOffset), 8);
      locator.writeUInt32LE(1, 16);
      await write(Buffer.concat([record, locator]));
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(large ? MAX16 : central.length, 8);
    end.writeUInt16LE(large ? MAX16 : central.length, 10);
    end.writeUInt32LE(large ? MAX32 : centralSize, 12);
    end.writeUInt32LE(large ? MAX32 : centralOffset, 16);
    await write(end);
  } finally {
    await out.close();
  }
}

/**
 * The entries of a zip, from its central directory.
 *
 * @returns {Promise<{ name: string, directory: boolean, size: number, compressed: number, crc: number, method: number, offset: number }[]>}
 */
export async function listZip(path) {
  const file = await open(path, 'r');
  try {
    const { size } = await file.stat();
    const tailLength = Math.min(size, 22 + MAX16 + 20);
    const tail = Buffer.alloc(tailLength);
    await file.read(tail, 0, tailLength, size - tailLength);
    let at = -1;
    for (let index = tailLength - 22; index >= 0; index -= 1) {
      if (tail.readUInt32LE(index) === 0x06054b50) { at = index; break; }
    }
    if (at < 0) throw new Error('This is not a zip file.');

    let count = tail.readUInt16LE(at + 10);
    let centralSize = tail.readUInt32LE(at + 12);
    let centralOffset = tail.readUInt32LE(at + 16);
    if (count === MAX16 || centralSize === MAX32 || centralOffset === MAX32) {
      // The large-file form: the locator just before the end record says where its record is.
      if (at < 20 || tail.readUInt32LE(at - 20) !== 0x07064b50) throw new Error('A large zip without its ZIP64 record.');
      const recordOffset = Number(tail.readBigUInt64LE(at - 20 + 8));
      const record = Buffer.alloc(56);
      await file.read(record, 0, 56, recordOffset);
      if (record.readUInt32LE(0) !== 0x06064b50) throw new Error('A damaged ZIP64 record.');
      count = Number(record.readBigUInt64LE(32));
      centralSize = Number(record.readBigUInt64LE(40));
      centralOffset = Number(record.readBigUInt64LE(48));
    }
    if (centralOffset + centralSize > size) throw new Error('A damaged zip: its directory runs past its end.');

    const directory = Buffer.alloc(centralSize);
    await file.read(directory, 0, centralSize, centralOffset);
    const entries = [];
    let cursor = 0;
    for (let index = 0; index < count; index += 1) {
      if (directory.readUInt32LE(cursor) !== 0x02014b50) throw new Error('A damaged zip directory.');
      const flags = directory.readUInt16LE(cursor + 8);
      const method = directory.readUInt16LE(cursor + 10);
      const crc = directory.readUInt32LE(cursor + 16);
      let compressed = directory.readUInt32LE(cursor + 20);
      let length = directory.readUInt32LE(cursor + 24);
      const nameLength = directory.readUInt16LE(cursor + 28);
      const extraLength = directory.readUInt16LE(cursor + 30);
      const commentLength = directory.readUInt16LE(cursor + 32);
      let offset = directory.readUInt32LE(cursor + 42);
      const name = directory.subarray(cursor + 46, cursor + 46 + nameLength).toString(flags & UTF8 ? 'utf8' : 'latin1');
      const extra = directory.subarray(cursor + 46 + nameLength, cursor + 46 + nameLength + extraLength);
      // ZIP64 sizes and position, in that order, for the fields that overflowed.
      for (let e = 0; e + 4 <= extra.length;) {
        const id = extra.readUInt16LE(e);
        const fieldLength = extra.readUInt16LE(e + 2);
        if (id === 0x0001) {
          let f = e + 4;
          if (length === MAX32) { length = Number(extra.readBigUInt64LE(f)); f += 8; }
          if (compressed === MAX32) { compressed = Number(extra.readBigUInt64LE(f)); f += 8; }
          if (offset === MAX32) { offset = Number(extra.readBigUInt64LE(f)); }
        }
        e += 4 + fieldLength;
      }
      if (flags & 0x0001) throw new Error(`${name} is encrypted, which an update never is.`);
      entries.push({ name, directory: name.endsWith('/'), size: length, compressed, crc: crc >>> 0, method, offset });
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  } finally {
    await file.close();
  }
}

/**
 * Extracts one entry to a file, checking its size and checksum as it goes.
 * A file that does not match what the zip says it holds is an error, and is
 * left for the caller to remove with the rest of a half-finished extraction.
 */
export async function extractEntry(zipPath, entry, destination) {
  if (entry.method !== STORE && entry.method !== DEFLATE) throw new Error(`${entry.name} uses a compression this app does not read.`);
  const file = await open(zipPath, 'r');
  let start;
  try {
    const local = Buffer.alloc(30);
    await file.read(local, 0, 30, entry.offset);
    if (local.readUInt32LE(0) !== 0x04034b50) throw new Error(`A damaged zip at ${entry.name}.`);
    start = entry.offset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
  } finally {
    await file.close();
  }
  await mkdir(dirname(destination), { recursive: true });
  let crc = 0;
  let written = 0;
  const check = new Transform({
    transform(chunk, _encoding, done) {
      crc = crc32(chunk, crc);
      written += chunk.length;
      if (written > entry.size) { done(new Error(`${entry.name} is larger than the zip says.`)); return; }
      done(null, chunk);
    },
  });
  const source = entry.compressed > 0 ? createReadStream(zipPath, { start, end: start + entry.compressed - 1 }) : emptyStream();
  const stages = entry.method === DEFLATE ? [source, createInflateRaw(), check] : [source, check];
  await pipeline(...stages, createWriteStream(destination));
  if (written !== entry.size || (crc >>> 0) !== entry.crc) throw new Error(`${entry.name} does not match its checksum: the zip is damaged.`);
}

/**
 * Extracts every entry into a folder. Every name is checked before anything
 * is written, so a zip with one bad name writes nothing at all.
 */
export async function extractZip(zipPath, folder, { entries } = {}) {
  const list = entries ?? (await listZip(zipPath));
  const root = resolve(folder);
  for (const entry of list) {
    if (!safeEntryName(entry.name)) throw new Error(`The zip holds a name it may not: ${entry.name}`);
    const target = resolve(root, ...entry.name.replace(/\/$/, '').split('/'));
    if (target !== root && !target.startsWith(root + sep)) throw new Error(`The zip holds a name outside its folder: ${entry.name}`);
  }
  for (const entry of list) {
    const target = join(root, ...entry.name.replace(/\/$/, '').split('/'));
    if (entry.directory) await mkdir(target, { recursive: true });
    else await extractEntry(zipPath, entry, target);
  }
  return list;
}

function zip64Extra(values) {
  const extra = Buffer.alloc(4 + values.length * 8);
  extra.writeUInt16LE(0x0001, 0);
  extra.writeUInt16LE(values.length * 8, 2);
  values.forEach((value, index) => extra.writeBigUInt64LE(BigInt(value), 4 + index * 8));
  return extra;
}

/** Now, as the date and time a zip records. */
function dosTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return ((day << 16) | time) >>> 0;
}

async function readWhole(path) {
  const chunks = [];
  for await (const chunk of createReadStream(path)) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function emptyStream() {
  return (async function* empty() {})();
}
