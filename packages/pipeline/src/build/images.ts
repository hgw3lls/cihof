import { createHash } from 'node:crypto';

/**
 * What the media manifest records about an image file: its SHA-256 and its
 * pixel size, read from the file itself. JPEG and PNG, the two formats the
 * collection holds, are read directly from their headers so no image library
 * is needed.
 */
export type ImageFacts = {
  readonly checksumSha256: string;
  readonly width: number | null;
  readonly height: number | null;
};

export function imageFacts(bytes: Uint8Array): ImageFacts {
  const size = imageSize(bytes);
  return {
    checksumSha256: createHash('sha256').update(bytes).digest('hex'),
    width: size?.width ?? null,
    height: size?.height ?? null,
  };
}

export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  return pngSize(bytes) ?? jpegSize(bytes);
}

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngSize(bytes: Uint8Array) {
  if (bytes.length < 24 || !pngSignature.every((byte, index) => bytes[index] === byte)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The first chunk is IHDR: width then height, big-endian, after its length and type.
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegSize(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1]!;
    // Fill bytes, and markers that carry no length.
    if (marker === 0xff) { offset += 1; continue; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
    const length = view.getUint16(offset + 2);
    // Start-of-frame markers carry the size; C4, C8 and CC are not frames.
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      if (offset + 9 > bytes.length) return null;
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}
