import { readFileSync } from 'node:fs';

/**
 * The curated roster: 111 records keyed by canonical id.
 *
 * A generated scaffold that curatorial decisions were then applied into. It is
 * canonical and must never be regenerated — doing so would discard every
 * approved tag, approved summary and approval status it has accumulated.
 */
export type CuratedRecord = {
  readonly id: string;
  readonly displayName: string;
  readonly sortName: string;
  /** Curator-written visitor-facing biography. Replaces the harvested text. */
  readonly bioTextOverride: string;
  readonly approvedSummary: string;
  readonly honoredForSummary: string;
  readonly documentedContextLine: string;
  readonly lifeWorkSummary: string;
  readonly pronunciation: string;
  readonly approvalStatus: string;
  readonly approvedThemeTags: readonly string[];
  readonly approvedCommunityTags: readonly string[];
  readonly approvedCountryTags: readonly string[];
  readonly imageRightsStatus: string;
  readonly imageAltText: string;
  readonly imageFocalPoint: string;
};

const curatedUrl = new URL('../../../../data/cihof_curated_metadata.json', import.meta.url);

export function readCuratedRoster(): Map<string, CuratedRecord> {
  const document = JSON.parse(readFileSync(curatedUrl, 'utf8')) as { inductees: Record<string, Record<string, unknown>> };
  const records = new Map<string, CuratedRecord>();

  for (const [id, raw] of Object.entries(document.inductees)) {
    const image = asRecord(raw['image']);
    records.set(id, {
      id,
      displayName: text(raw['displayName']),
      sortName: text(raw['sortName']),
      bioTextOverride: preserved(raw['bioTextOverride']),
      approvedSummary: text(raw['approvedSummary']),
      honoredForSummary: text(raw['honoredForSummary']),
      documentedContextLine: text(raw['documentedContextLine']),
      lifeWorkSummary: text(raw['lifeWorkSummary']),
      pronunciation: text(raw['pronunciation']),
      approvalStatus: text(raw['approvalStatus']),
      approvedThemeTags: list(raw['approvedThemeTags']),
      approvedCommunityTags: list(raw['approvedCommunityTags']),
      approvedCountryTags: list(raw['approvedCountryTags']),
      imageRightsStatus: text(image['rightsStatus']),
      imageAltText: text(image['primaryAltText']),
      imageFocalPoint: text(image['focalPoint']),
    });
  }
  return records;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Curator-written copy is reproduced as written. It is trimmed at the ends and
 * otherwise untouched: normalising it would edit somebody's approved wording.
 */
function preserved(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
