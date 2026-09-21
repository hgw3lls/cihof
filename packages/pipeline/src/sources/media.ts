import { readFileSync } from 'node:fs';

/** A portrait as recorded in the media manifest, with its rights state. */
export type PortraitAsset = {
  readonly runtimePath: string;
  readonly altText: string;
  readonly width: number | null;
  readonly height: number | null;
};

const mediaUrl = new URL('../../../../data/media_manifest.json', import.meta.url);

/** Primary portraits by canonical id. Rights live in the curated roster, not here. */
export function readPortraits(): Map<string, PortraitAsset> {
  const document = JSON.parse(readFileSync(mediaUrl, 'utf8')) as { assets: Record<string, Record<string, unknown>> };
  const portraits = new Map<string, PortraitAsset>();

  for (const [id, asset] of Object.entries(document.assets ?? {})) {
    const primary = asRecord(asRecord(asset['images'])['primary']);
    const runtimePath = typeof primary['runtimePath'] === 'string' ? primary['runtimePath'] : '';
    if (!runtimePath) continue;
    portraits.set(id, {
      runtimePath,
      altText: typeof primary['altText'] === 'string' ? primary['altText'] : '',
      width: typeof primary['width'] === 'number' ? primary['width'] : null,
      height: typeof primary['height'] === 'number' ? primary['height'] : null,
    });
  }
  return portraits;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
