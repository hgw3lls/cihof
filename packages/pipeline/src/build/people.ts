import {
  attributed, isEligible,
  type InducteeId, type Portrait, type PublishedPerson, type TagProvenance, type TagSet,
} from '@cihof/content';
import { classifyComposed, composeContextLine, composeHonoredFor } from '../compose.ts';
import { inducteeId } from '../identity.ts';
import { readCuratedRoster } from '../sources/curated.ts';
import { readPortraits } from '../sources/media.ts';
import { readRoster } from '../sources/manifest.ts';
import { normalizeBioText, normalizeCommunityTags } from '../text/biography.ts';

/**
 * Assembles the published person records.
 *
 * The curated roster is authoritative for identity and for anything a reviewer
 * decided. The kiosk manifest supplies the institution's biography and the
 * harvested facts. The media manifest supplies the portrait. Nothing here
 * invents a value that no source asserts.
 */
export function buildPeople(): PublishedPerson[] {
  const curated = readCuratedRoster();
  const portraits = readPortraits();
  const people: PublishedPerson[] = [];

  for (const row of readRoster()) {
    const id = inducteeId(row.name, row.classYear);
    const record = curated.get(id);
    if (!record) continue;

    const name = record.displayName || row.name;
    const classYear = /^\d{4}$/.test(row.classYear) ? Number(row.classYear) : null;
    const countries = record.approvedCountryTags;
    const themes = record.approvedThemeTags;
    const communities = normalizeCommunityTags(record.approvedCommunityTags);

    const contextKind = classifyComposed(
      record.documentedContextLine,
      composeContextLine({ classYear, inductedBy: row.inductedBy, region: row.region, countryTags: countries, communityTags: communities }),
      'context',
    );
    const honoredKind = classifyComposed(
      record.honoredForSummary,
      composeHonoredFor(themes, countries),
      'honoredFor',
    );

    const person: PublishedPerson = {
      id: id as InducteeId,
      name,
      sortName: record.sortName || name,
      classYear,
      portrait: portraitFor(id, name, record.imageRightsStatus, record.imageAltText, record.imageFocalPoint, portraits),
      biography: record.bioTextOverride
        ? attributed(record.bioTextOverride, 'curated', 'cihof_curated_metadata.json#bioTextOverride')
        : attributed(normalizeBioText(row.bioText, name), 'source', 'cihof_kiosk_manifest.csv'),
      contribution: attributed(record.honoredForSummary, honoredKind, 'generate-first-pass-content-decisions.js'),
      context: attributed(record.documentedContextLine, contextKind, 'generate-first-pass-content-decisions.js'),
      communities: tags(communities),
      contributions: tags(themes),
      countries: tags(countries),
      sourceUrl: row.profileUrl || null,
    };

    if (isEligible(person)) people.push(person);
  }

  return people.sort((a, b) => a.sortName.localeCompare(b.sortName));
}

function tags(values: readonly string[]): TagSet {
  // Matches the existing rule: approved tags are curated, an empty set is not a
  // provenance claim. Only curated or documented tags may drive a facet.
  const provenance: TagProvenance = values.length > 0 ? 'curated' : 'none';
  return { values, provenance };
}

function portraitFor(
  id: string,
  name: string,
  rightsStatus: string,
  altOverride: string,
  focalPoint: string,
  portraits: Map<string, { runtimePath: string; altText: string }>,
): Portrait | null {
  const asset = portraits.get(id);
  if (!asset) return null;
  const rights = rightsStatus === 'approved' ? 'approved'
    : rightsStatus === 'pending' ? 'pending'
      : rightsStatus === 'restricted' ? 'restricted'
        : 'unknown';
  const base = {
    src: asset.runtimePath,
    alt: altOverride || asset.altText || `CIHOF profile portrait of ${name}.`,
    rights,
  } as const;
  return focalPoint ? { ...base, focalPoint } : base;
}
