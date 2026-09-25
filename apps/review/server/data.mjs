import { existsSync, readFileSync } from 'node:fs';
import { buildBiographySheet } from '../../../packages/pipeline/src/build/biographies.ts';
import { buildPeople } from '../../../packages/pipeline/src/build/people.ts';
import { profileContentVersion, profileState, readPortraitChecksums, readProfileReviews } from '../../../packages/pipeline/src/build/profiles.ts';
import { buildPlaceReviewSheet, buildProposedTiesSheet, placeRoles, relationshipKinds } from '../../../packages/pipeline/src/build/review.ts';
import { readCorpusConnections } from '../../../packages/pipeline/src/sources/corpus.ts';
import { readTieDecisions } from '../../../packages/pipeline/src/sources/ties.ts';
import { connectionLabelProblem, maxConnectionLabelLength } from '@cihof/content';
import { dataFile } from '../../../packages/pipeline/src/paths.ts';
import { attractLimits, publishedAttractText, readExhibitText } from '../../../packages/pipeline/src/build/exhibit-text.ts';
import { placeHistoryLimit } from '../../../packages/pipeline/src/build/place-text.ts';

/**
 * Everything the review screens show, read fresh from `data/` each time, so a
 * save, or a sheet applied by hand, is reflected on the next page load.
 */

/**
 * Plain-language names for each relationship kind, whether it has a direction,
 * and a hint for the wording. The hints are shown greyed out as examples of
 * the shape; the reviewer types what the record actually says.
 */
export const kindGuide = {
  // No direction: the same words show on both people's side, so they name
  // neither of them.
  'collaborated-with': { label: 'Worked together', directional: false, example: 'worked together to promote Juneteenth' },
  'founded-with': { label: 'Founded something together', directional: false, example: 'founded Community Helping Hands together' },
  'family-of': { label: 'Family', directional: false, example: 'married  /  siblings' },
  'friend-of': { label: 'Friends', directional: false, example: 'longtime friends' },
  mentored: { sentence: '{A} mentored {B}', label: 'Mentored', directional: true, example: 'mentored {B}', inverse: 'was mentored by {A}' },
  taught: { sentence: '{A} taught {B}', label: 'Taught', directional: true, example: 'taught {B} at …', inverse: 'was taught by {A} at …' },
  succeeded: { sentence: '{A} took over a role from {B}', label: 'Followed in a role', directional: true, example: 'succeeded {B} as …', inverse: 'was succeeded by {A} as …' },
  employed: { sentence: '{A} employed {B}', label: 'Employed', directional: true, example: 'employed {B} at …', inverse: 'worked for {A} at …' },
  nominated: { sentence: '{A} nominated {B}', label: 'Nominated', directional: true, example: 'nominated {B} for …', inverse: 'was nominated by {A} for …' },
};

export const roleGuide = {
  lived: 'Lived there',
  worked: 'Worked there',
  studied: 'Studied there',
  taught: 'Taught there',
  organized: 'Organized something there',
  served: 'Served there (volunteer, board, congregation)',
  founded: 'Founded it',
};

export const harvestedKindGuide = {
  born_in: 'born here',
  lived_in: 'lived here',
  moved_to: 'moved here',
  associated_with_place: 'connected here, without saying how',
};

export function loadReview() {
  const people = buildPeople();
  const byId = new Map(people.map((person) => [person.id, person]));
  const summary = (id) => {
    const person = byId.get(id);
    if (!person) return { id, name: id, classYear: null, portrait: null, biography: '' };
    return {
      id,
      name: person.name,
      classYear: person.classYear,
      portrait: person.portrait?.src ?? null,
      biography: (person.biography?.text ?? '').slice(0, 600),
    };
  };

  const decisions = readTieDecisions();
  const decisionByTie = new Map(decisions.map((decision) => [decision.tieId, decision]));
  const draftsPath = dataFile('review-sheets/connection-drafts.json');
  const drafts = existsSync(draftsPath) ? JSON.parse(readFileSync(draftsPath, 'utf8')).drafts ?? {} : {};
  const ties = buildProposedTiesSheet(readCorpusConnections(), people, decisions).map((row) => {
    const current = decisionByTie.get(row.tieId);
    const wordingProblem = current
      ? [current.label, current.inverseLabel].map(connectionLabelProblem).find(Boolean) ?? null
      : null;
    return {
    tieId: row.tieId,
    a: summary(row.personA),
    b: summary(row.personB),
    sourceType: row.sourceType,
    suggestedKind: relationshipKinds.includes(row.suggestedKind) ? row.suggestedKind : '',
    verificationLayer: row.verificationLayer,
    evidence: row.evidence,
    sourceUrls: row.sourceUrls,
    status: row.currentStatus,
    // What is on file now, so a reviewer revisiting a tie sees what they are replacing.
    current: current
      ? { decision: current.decision, kind: current.kind ?? '', label: current.label ?? '', inverseLabel: current.inverseLabel ?? '', reversed: Boolean(current.reversed) }
      : null,
    // A decision whose wording cannot go on the map comes back to be looked at.
    wordingProblem,
    suggestion: drafts[row.tieId] ?? null,
    };
  });

  const placesDocument = JSON.parse(readFileSync(dataFile('cihof_places.json'), 'utf8'));
  const associationsPath = dataFile('cihof_place_associations.json');
  const associations = existsSync(associationsPath)
    ? JSON.parse(readFileSync(associationsPath, 'utf8')).associations ?? []
    : [];
  const seeds = new Map((placesDocument.places ?? []).map((place) => [place.id, place]));
  // Suggested rewordings, each drafted from particular words. One whose words
  // have since changed is not offered: it was a rewording of something else.
  const placeDraftsPath = dataFile('review-sheets/place-drafts.json');
  const placeDrafts = existsSync(placeDraftsPath) ? JSON.parse(readFileSync(placeDraftsPath, 'utf8')).drafts ?? {} : {};
  const places = buildPlaceReviewSheet(placesDocument.places ?? [], associations, people).rows.map((row) => {
    const seed = seeds.get(row.placeId) ?? {};
    return {
      placeId: row.placeId,
      name: row.name,
      neighborhood: row.neighborhood,
      address: typeof seed.address === 'string' ? seed.address : '',
      dates: typeof seed.dateRange?.label === 'string' ? seed.dateRange.label : '',
      shortHistory: row.shortHistory,
      canApprove: row.band === 'researched',
      reviewed: row.reviewed,
      // What an approval of the words shown records, and whether the approval
      // on file covers them (see packages/pipeline/src/build/place-text.ts).
      contentVersion: row.contentVersion,
      words: row.words,
      suggestion: placeDrafts[row.placeId]?.from === row.contentVersion ? placeDrafts[row.placeId].text : null,
      // A role is decided once per person and place. The research sometimes
      // records the same person there twice (born here, and moved here), so
      // those are one row carrying both notes.
      ties: [...Map.groupBy(row.ties, (tie) => tie.person).values()].map((ties) => ({
        person: summary(ties[0].person),
        harvested: [...new Set(ties.map((tie) => harvestedKindGuide[tie.kind] ?? tie.kind))].join('; '),
        role: ties.find((tie) => tie.role)?.role ?? null,
      })),
    };
  });

  const bios = buildBiographySheet(people).map((row) => ({
    id: row.id,
    name: row.name,
    classYear: row.classYear,
    portrait: byId.get(row.id)?.portrait?.src ?? null,
    provenance: row.provenance,
    text: row.currentText,
  }));

  // Each profile as a visitor sees it, with what a curator has said about it.
  const reviews = readProfileReviews();
  const checksums = readPortraitChecksums();
  const profiles = [...people]
    .sort((a, b) => (a.classYear ?? 0) - (b.classYear ?? 0) || a.sortName.localeCompare(b.sortName))
    .map((person) => {
      const contentVersion = profileContentVersion(person, checksums.get(person.id) ?? '');
      const review = reviews.get(person.id);
      return {
        id: person.id,
        name: person.name,
        classYear: person.classYear,
        portrait: person.portrait
          ? { src: person.portrait.src, alt: person.portrait.alt, shown: person.portrait.rights === 'approved', rights: person.portrait.rights }
          : null,
        biography: person.biography ? { text: person.biography.text, provenance: person.biography.provenance } : null,
        contribution: person.contribution ? { text: person.contribution.text, provenance: person.contribution.provenance } : null,
        context: person.context ? { text: person.context.text, provenance: person.context.provenance } : null,
        tags: {
          contributions: person.contributions.values,
          communities: person.communities.values,
          countries: person.countries.values,
        },
        presentedBy: person.presentedBy?.recordedName ?? null,
        sourceUrl: person.sourceUrl,
        contentVersion,
        state: profileState(review, contentVersion),
        reviewNote: review?.note ?? '',
      };
    });

  return {
    ties,
    places,
    bios,
    profiles,
    kinds: relationshipKinds.map((kind) => ({ kind, ...kindGuide[kind] })),
    attract: attractWords(),
    limits: { label: maxConnectionLabelLength, headline: attractLimits.headline, tagline: attractLimits.tagline, placeHistory: placeHistoryLimit },
    roles: placeRoles.map((role) => ({ role, label: roleGuide[role] ?? role })),
  };
}

/** The attract screen's words as they stand, and whether the display may show them. */
function attractWords() {
  const stored = readExhibitText().attract ?? {};
  const status = publishedAttractText('kiosk');
  return {
    headline: typeof stored.headline === 'string' ? stored.headline : '',
    tagline: typeof stored.tagline === 'string' ? stored.tagline : '',
    contentVersion: status.contentVersion ?? '',
    approved: status.problem === null && status.text !== null,
    problem: status.problem,
    reviewedAt: stored.review?.reviewedAt ?? null,
  };
}
