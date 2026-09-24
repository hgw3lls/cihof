import { composeContextLine } from '../compose.ts';
import { inducteeId } from '../identity.ts';
import { csvCell, parseRows } from './review.ts';

/**
 * Adding a new induction class from a sheet.
 *
 * One row per new inductee, filled in from the institution's own record of
 * the induction. Each person needs a row in the roster of record
 * (`cihof_kiosk_manifest.csv`), a curated record, and a media record with a
 * portrait; this builds all three from the row, so nobody writes them by hand.
 *
 * It adds nothing the row does not say. The permanent id is derived from the
 * name and year exactly as for every existing person. Tags are the ones the
 * row gives, under its decision reference. The contribution line is left
 * empty rather than composed from nothing; the context line is composed, as
 * for everyone else, from the year, region, tags and inducter the row gives.
 * A portrait's rights are what the row says; `approved` shows it, anything
 * else keeps it off screen. Public-web publication is not set: that is a
 * separate decision.
 */

export const newClassColumns = [
  'name', 'classYear', 'displayName', 'sortName', 'region', 'profileUrl', 'inductedBy', 'biography',
  'themeTags', 'countryTags', 'communityTags',
  'portraitFile', 'portraitSourceUrl', 'portraitAltText', 'portraitRights',
  'decisionReference', 'note',
] as const;

type Column = typeof newClassColumns[number];

export const portraitRightsValues = ['approved', 'pending', 'restricted', 'unknown'] as const;
export const regions = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'] as const;

export type NewInductee = {
  readonly line: number;
  readonly id: string;
  readonly name: string;
  readonly classYear: number;
  readonly displayName: string;
  readonly sortName: string;
  readonly region: string;
  readonly profileUrl: string;
  readonly inductedBy: string;
  readonly biography: string;
  readonly themeTags: readonly string[];
  readonly countryTags: readonly string[];
  readonly communityTags: readonly string[];
  readonly portraitFile: string;
  readonly portraitSourceUrl: string;
  readonly portraitAltText: string;
  readonly portraitRights: typeof portraitRightsValues[number];
  readonly decisionReference: string;
  readonly note: string;
};

export function newClassTemplateCsv(): string {
  return `${newClassColumns.join(',')}\n`;
}

/**
 * Reads and checks the sheet. `existingIds` are everybody already in the
 * roster; `known` are the tag vocabularies in use, so a new tag is pointed out
 * (it may be right, and is not refused).
 */
export function readNewClassSheet(
  csvText: string,
  existingIds: ReadonlySet<string>,
  known: { themes: ReadonlySet<string>; countries: ReadonlySet<string>; communities: ReadonlySet<string> },
) {
  const rows = parseRows(csvText.replace(/^﻿/, ''));
  const header = (rows[0] ?? []).map((cell) => cell.trim());
  const missing = newClassColumns.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return { people: [], errors: [`the sheet is missing the column(s) ${missing.join(', ')}; start from npm run class:template`], warnings: [] };
  }

  const people: NewInductee[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  rows.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const cell = (column: Column) => (cells[header.indexOf(column)] ?? '').trim();
    const list = (column: Column) => [...new Set(cell(column).split(/[|;]/).map((value) => value.trim()).filter(Boolean))];
    const name = cell('name');
    if (!name && cells.every((value) => value.trim() === '')) return;
    const problems: string[] = [];

    if (!name) problems.push('name is empty');
    const year = cell('classYear');
    if (!/^\d{4}$/.test(year)) problems.push(`classYear "${year}" is not a year`);
    const id = name && year ? inducteeId(name, year) : '';
    if (id && existingIds.has(id)) problems.push(`${id} is already in the roster`);
    if (id && seen.has(id)) problems.push(`${id} appears twice in this sheet`);

    const sortName = cell('sortName');
    if (!sortName) problems.push('sortName is empty (the name as it sorts, e.g. "Brown, Jeanette Grasselli")');
    const region = cell('region');
    if (!(regions as readonly string[]).includes(region)) problems.push(`region "${region}" is not one of ${regions.join(', ')}`);
    const biography = cell('biography');
    if (!biography) problems.push("biography is empty: the institution's own text for this person");

    const portraitFile = cell('portraitFile');
    if (!portraitFile) problems.push('portraitFile is empty: every person needs a portrait file (its rights can be pending)');
    else if (!/\.(jpe?g|png)$/i.test(portraitFile)) problems.push('portraitFile must be a .jpg or .png');
    const rights = cell('portraitRights').toLowerCase();
    if (!(portraitRightsValues as readonly string[]).includes(rights)) {
      problems.push(`portraitRights "${rights}" is not one of ${portraitRightsValues.join(', ')}`);
    }
    const reference = cell('decisionReference');
    if (!reference) problems.push('decisionReference is empty. Never defaulted, never generated');

    const who = name || `line ${line}`;
    if (problems.length > 0) {
      errors.push(`line ${line} (${who}): ${problems.join('; ')}`);
      return;
    }
    seen.add(id);

    const themeTags = list('themeTags');
    const countryTags = list('countryTags');
    const communityTags = list('communityTags');
    for (const [tags, vocabulary, kind] of [
      [themeTags, known.themes, 'theme'], [countryTags, known.countries, 'country'], [communityTags, known.communities, 'community'],
    ] as const) {
      for (const tag of tags) {
        if (!vocabulary.has(tag)) warnings.push(`line ${line} (${who}): "${tag}" is a new ${kind} tag; check the spelling matches the others`);
      }
    }
    if (!cell('inductedBy')) warnings.push(`line ${line} (${who}): no inductedBy`);

    people.push({
      line, id, name, classYear: Number(year),
      displayName: cell('displayName') || name, sortName, region,
      profileUrl: cell('profileUrl'), inductedBy: cell('inductedBy'), biography,
      themeTags, countryTags, communityTags,
      portraitFile, portraitSourceUrl: cell('portraitSourceUrl'), portraitAltText: cell('portraitAltText'),
      portraitRights: rights as NewInductee['portraitRights'],
      decisionReference: reference, note: cell('note'),
    });
  });

  return { people, errors, warnings };
}

/** Where the portrait lives in the collection, from the file's own extension. */
export function portraitPaths(person: NewInductee) {
  const extension = /\.png$/i.test(person.portraitFile) ? 'png' : 'jpg';
  return {
    filePath: `public/media/images/${person.id}/primary.${extension}`,
    runtimePath: `/media/images/${person.id}/primary.${extension}`,
  };
}

/** The roster row, in the roster's own columns. */
export function rosterRow(person: NewInductee, header: readonly string[]): string {
  const values: Record<string, string> = {
    name: person.name,
    class_year: String(person.classYear),
    region: person.region,
    profile_url: person.profileUrl,
    inducted_by: person.inductedBy,
    primary_image_url: person.portraitSourceUrl,
    image_urls: person.portraitSourceUrl,
    bio_text: person.biography,
  };
  return header.map((column) => csvCell(values[column.replace(/^﻿/, '')] ?? '')).join(',');
}

export function altText(person: NewInductee): string {
  return person.portraitAltText || `CIHOF profile portrait of ${person.displayName}, Class of ${person.classYear}.`;
}

export function curatedRecord(person: NewInductee, appliedAt: string) {
  const day = appliedAt.slice(0, 10);
  return {
    id: person.id,
    approvalStatus: 'draft',
    reviewPriority: 'medium',
    displayName: person.displayName,
    sortName: person.sortName,
    pronunciation: '',
    summaryDraft: '',
    approvedSummary: '',
    themeTagCandidates: [],
    approvedThemeTags: [...person.themeTags],
    communityTagCandidates: [],
    approvedCommunityTags: [...person.communityTags],
    featured: false,
    featuredCandidate: false,
    attractPriority: 0,
    journeySuggestions: [],
    image: {
      primaryAltText: altText(person),
      focalPoint: 'center',
      rightsStatus: person.portraitRights,
      rightsNotes: `Recorded as ${person.portraitRights} under ${person.decisionReference} on ${day}.`,
      sourceUrl: person.portraitSourceUrl,
    },
    video: {
      hasVideo: false,
      reviewStatus: 'no-video-linked',
      captionStatus: 'not-applicable',
      transcriptStatus: 'not-applicable',
      audioDescriptionStatus: 'not-applicable',
      rightsStatus: 'not-applicable',
      sourceUrls: [],
      youtubeVideoIds: [],
      localVideoPaths: [],
    },
    accessibility: { plainLanguageReview: 'needed', sensitiveContentReview: 'needed', imageDescriptionReview: 'needed' },
    curatorNotes: [
      `Added with the class of ${person.classYear} under ${person.decisionReference} on ${day}.`,
      ...(person.note ? [person.note] : []),
    ],
    countryTagCandidates: [],
    approvedCountryTags: [...person.countryTags],
    countryNotes: '',
    documentedContextLine: composeContextLine({
      classYear: person.classYear,
      inductedBy: person.inductedBy,
      region: person.region,
      countryTags: person.countryTags,
      communityTags: person.communityTags,
    }),
    // Left empty. The composed line needs theme tags to say anything, and
    // with none it falls back to wording nobody decided.
    honoredForSummary: '',
    lifeWorkSummary: '',
  };
}

export function mediaRecord(
  person: NewInductee,
  facts: { checksumSha256: string; width: number | null; height: number | null },
) {
  const paths = portraitPaths(person);
  return {
    id: person.id,
    name: person.displayName,
    classYear: person.classYear,
    region: person.region,
    approvalStatus: 'draft',
    reviewPriority: 'medium',
    images: {
      primary: {
        sourceUrl: person.portraitSourceUrl,
        filePath: paths.filePath,
        runtimePath: paths.runtimePath,
        ...facts,
        altText: altText(person),
        primary: true,
        rightsStatus: person.portraitRights,
        approvedForKiosk: person.portraitRights === 'approved',
        // Deliberately false: the public web is its own decision.
        approvedForPublicWeb: false,
        decisionReference: person.decisionReference,
      },
      gallery: [],
    },
    videos: [],
    notes: [`Added with the class of ${person.classYear} under ${person.decisionReference}.`],
  };
}
